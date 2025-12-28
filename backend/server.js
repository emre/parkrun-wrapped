const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/parkrunner/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const url = `https://www.parkrun.co.nl/parkrunner/${id}/all/`;
    
    console.log('🚀 Using curl to fetch parkrun data for ID:', id);
    
    // Use curl with --compressed to handle gzip decompression
    const curlCommand = `curl -s --compressed -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7" -H "Accept-Language: en-US,en;q=0.9,nl;q=0.8" -H "Accept-Encoding: gzip, deflate, br" -H "DNT: 1" -H "Connection: keep-alive" -H "Upgrade-Insecure-Requests: 1" -H "Sec-Fetch-Dest: document" -H "Sec-Fetch-Mode: navigate" -H "Sec-Fetch-Site: none" -H "Sec-Fetch-User: ?1" -H "Cache-Control: max-age=0" -H "sec-ch-ua: \\"Not_A Brand\\";v=\\"8\\", \\"Chromium\\";v=\\"120\\", \\"Google Chrome\\";v=\\"120\\"" -H "sec-ch-ua-mobile: ?0" -H "sec-ch-ua-platform: \\"macOS\\"" -H "Referer: https://www.google.com/" "${url}"`;
    
    const htmlData = await new Promise((resolve, reject) => {
      exec(curlCommand, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
    
    console.log('✅ Curl request successful, HTML length:', htmlData.length);
    
    const $ = cheerio.load(htmlData);
    const parkrunData = {
      runnerInfo: {},
      runs: [],
      statistics: {}
    };
    
    // Extract runner name - look more broadly
    const allHeadings = $('h1, h2, h3, h4, h5, h6, .name, .runner-name, .athlete-name, .title');
    console.log('📝 Found', allHeadings.length, 'heading elements');
    
    allHeadings.each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 0 && !text.includes('parkrun') && !text.includes('Netherlands')) {
        parkrunData.runnerInfo.name = text;
        console.log('👤 Found runner name:', text);
        return false; // break
      }
    });
    
    // Parse data from results table rows
    let tableRows = $('table tbody tr');
    if (!tableRows.length) {
      tableRows = $('tr.even, tr.odd');
    }
    console.log('📊 Found', tableRows.length, 'table rows');

    tableRows.each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 5) return;

      const event = $(cells[0]).text().trim();
      const date = $(cells[1]).text().trim();
      const positionCellIndex = cells.length >= 7 ? 3 : 2;
      const timeCellIndex = cells.length >= 7 ? 4 : 3;
      const ageGradeCellIndex = cells.length >= 7 ? 5 : 4;

      const position = $(cells[positionCellIndex]).text().trim();
      const time = $(cells[timeCellIndex]).text().trim();
      const ageGrade = $(cells[ageGradeCellIndex]).text().trim();

      if (!event || !date || !position || !time || !ageGrade) return;
      if (isNaN(parseInt(position)) || parseInt(position) <= 0 || parseInt(position) > 999) return;

      const runYear = date.split('/')[2];
      if (runYear !== '2025') return;

      const run = { event, date, position, time, ageGrade };
      const exists = parkrunData.runs.some(existing =>
        existing.date === run.date && existing.event === run.event && existing.time === run.time
      );
      if (!exists) {
        parkrunData.runs.push(run);
        console.log('✅ Found table run:', run);
      }
    });
    
    console.log('🏃 Total runs extracted:', parkrunData.runs.length);
    
    // Sort runs by date (most recent first)
    parkrunData.runs.sort((a, b) => {
      const dateA = new Date(a.date.split('/').reverse().join('-'));
      const dateB = new Date(b.date.split('/').reverse().join('-'));
      return dateB - dateA;
    });
    
    // Calculate statistics
    if (parkrunData.runs.length > 0) {
      parkrunData.statistics.totalRuns = parkrunData.runs.length;
      parkrunData.statistics.firstRun = parkrunData.runs[parkrunData.runs.length - 1].date;
      parkrunData.statistics.latestRun = parkrunData.runs[0].date;
      
      // Calculate best time
      const validTimes = parkrunData.runs
        .filter(run => run.time && run.time.includes(':'))
        .map(run => {
          try {
            const timeParts = run.time.split(':');
            if (timeParts.length === 2) {
              const minutes = parseInt(timeParts[0]);
              const seconds = parseInt(timeParts[1]);
              if (!isNaN(minutes) && !isNaN(seconds) && minutes >= 0 && seconds >= 0) {
                return minutes * 60 + seconds;
              }
            }
          } catch (e) {
            console.log('Error parsing time:', run.time);
          }
          return null;
        })
        .filter(time => time !== null);
      
      if (validTimes.length > 0) {
        const bestTimeSeconds = Math.min(...validTimes);
        parkrunData.statistics.bestTime = `${Math.floor(bestTimeSeconds / 60)}:${(bestTimeSeconds % 60).toString().padStart(2, '0')}`;
      }
      
      // Count different events
      const events = new Set(parkrunData.runs.map(run => run.event).filter(event => event));
      parkrunData.statistics.uniqueEvents = events.size;
    } else {
      console.log('❌ No runs found - checking page structure...');
      console.log('📄 Page title:', $('title').text());
      
      // Save debug info
      const fs = require('fs');
      fs.writeFileSync('debug-parkrun-final.html', htmlData);
      console.log('💾 Saved debug HTML to debug-parkrun-final.html');
    }
    
    res.json(parkrunData);
  } catch (error) {
    console.error('❌ Error scraping parkrun data:', error.message);
    res.status(500).json({ 
      error: `Failed to fetch parkrun data: ${error.message}` 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('✅ Using curl + pattern-based text parsing for accurate parkrun data extraction');
});
