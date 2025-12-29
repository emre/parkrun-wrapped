import { useState, useEffect } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import './App.css'
import './Story.css'

function App() {
  const initialIdFromPath = (() => {
    const path = window.location.pathname
    const match = path.match(/\/runner\/(\w+)/)
    return match ? match[1] : null
  })()

  const [parkrunId, setParkrunId] = useState(initialIdFromPath ? String(initialIdFromPath) : '8604987')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showStory, setShowStory] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [autoPlay, setAutoPlay] = useState(true)
  const [slideProgress, setSlideProgress] = useState(0)

  useEffect(() => {
    document.title = 'ParkRun Wrapped 2025'
  }, [])

  useEffect(() => {
    if (initialIdFromPath) {
      fetchData(String(initialIdFromPath))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIdFromPath])

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin

  const fetchData = async (overrideId) => {
    setLoading(true)
    setError(null)
    try {
      const targetId = overrideId !== undefined ? String(overrideId) : String(parkrunId)
      console.log('fetchData called with overrideId:', overrideId, 'parkrunId:', parkrunId, 'targetId:', targetId)
      if (!targetId || targetId === 'undefined' || targetId === 'null') return; // Skip if no ID (homepage)

      const normalizedId = String(targetId).replace(/^[A-Za-z]/, '') || targetId
      console.log('normalizedId:', normalizedId)
      const response = await axios.get(`${API_BASE_URL}/api/parkrunner/${normalizedId}`)
      if (!response.data?.runs?.length) {
        setData(null)
        setShowStory(false)
        setError('No 2025 runs found for this parkrun ID yet.')
        return
      }
      setData(response.data)
      const newUrl = `/runner/${normalizedId}`
      if (window.location.pathname !== newUrl) {
        window.history.replaceState({}, '', newUrl)
      }
      setShowStory(true) // Auto-start story when data loads
      setCurrentSlide(0)
    } catch (err) {
      setError('Failed to fetch parkrun data. Make sure the backend server is running.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const processTimeData = () => {
    if (!data?.runs) return []
    
    return data.runs.slice(0, 20).reverse().map((run, index) => {
      const timeParts = run.time.split(':')
      const totalSeconds = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1])
      return {
        date: run.date,
        time: totalSeconds,
        formattedTime: run.time,
        position: parseInt(run.position) || 0
      }
    }).filter(item => !isNaN(item.time))
  }

  const formatTimeForDisplay = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1))
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7)
  }

  const processMonthlyStats = () => {
    if (!data?.runs) return []
    
    const monthlyData = {}
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    data.runs.forEach(run => {
      const date = new Date(run.date.split('/').reverse().join('-'))
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, runs: 0, totalTime: 0 }
      }
      monthlyData[monthKey].runs += 1
      
      const timeParts = run.time.split(':')
      if (timeParts.length === 2) {
        monthlyData[monthKey].totalTime += parseInt(timeParts[0]) * 60 + parseInt(timeParts[1])
      }
    })
    
    return Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12) // Last 12 months
      .map(month => {
        const [year, monthNum] = month.month.split('-')
        return {
          ...month,
          month: monthNames[parseInt(monthNum) - 1],
          avgTime: month.runs > 0 ? Math.round(month.totalTime / month.runs) : 0
        }
      })
  }

  const calculateStoryStats = () => {
    if (!data?.runs) return []
    
    const runs = data.runs
    const runs2025 = runs.filter(run => run.date.includes('2025'))
    const uniqueLocations2025 = new Set(runs2025.map(run => run.event))
    const locationArray = Array.from(uniqueLocations2025)
    let locationNames = locationArray.slice(0, 3).join(', ')
    if (locationArray.length > 3) {
      locationNames += ` & ${locationArray.length - 3} more`
    }
    
    // Season analysis
    const seasons = { Spring: 0, Summer: 0, Autumn: 0, Winter: 0 }
    runs2025.forEach(run => {
      const month = new Date(run.date.split('/').reverse().join('-')).getMonth()
      if (month >= 2 && month <= 4) seasons.Spring++
      else if (month >= 5 && month <= 7) seasons.Summer++
      else if (month >= 8 && month <= 10) seasons.Autumn++
      else seasons.Winter++
    })
    const busiestSeason = Object.entries(seasons).reduce((a, b) => a[1] > b[1] ? a : b)[0]
    
    // Fastest month
    const monthlyAvg = {}
    runs2025.forEach(run => {
      const date = new Date(run.date.split('/').reverse().join('-'))
      const monthKey = date.toLocaleString('default', { month: 'long' })
      const timeParts = run.time.split(':')
      const seconds = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1])
      
      if (!monthlyAvg[monthKey]) {
        monthlyAvg[monthKey] = { total: 0, count: 0 }
      }
      monthlyAvg[monthKey].total += seconds
      monthlyAvg[monthKey].count++
    })
    
    const fastestMonth = Object.entries(monthlyAvg)
      .map(([month, data]) => ({ 
        month, 
        avg: data.total / data.count,
        avgTime: formatTimeForDisplay(Math.round(data.total / data.count)),
        totalRuns: data.count
      }))
      .sort((a, b) => a.avg - b.avg)[0]
    
    // Most visited parkrun
    const eventCounts = {}
    runs2025.forEach(run => {
      eventCounts[run.event] = (eventCounts[run.event] || 0) + 1
    })
    const mostVisited = Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1])[0]
    
    // Total minutes and distance
    const totalSeconds = runs2025.reduce((total, run) => {
      const timeParts = run.time.split(':')
      return total + (parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]))
    }, 0)
    const totalMinutes = Math.round(totalSeconds / 60)
    const totalDistance = (runs2025.length * 5).toFixed(1) // 5km per run
    
    // Calculate additional performance stats
    const positions = runs2025.map(run => parseInt(run.position)).filter(p => !isNaN(p))
    const bestPosition = positions.length > 0 ? Math.min(...positions) : 0
    const avgPosition = positions.length > 0 ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length) : 0
    
    // Count personal bests (from actual PB indicator)
    const pbCount = runs2025.filter(run => run.isPB).length
    
    // Find overall best time
    let bestTimeSeconds = Infinity
    runs2025.forEach(run => {
      const timeParts = run.time.split(':')
      const seconds = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1])
      if (seconds < bestTimeSeconds) {
        bestTimeSeconds = seconds
      }
    })
    const bestTimeFormatted = bestTimeSeconds !== Infinity ? formatTimeForDisplay(bestTimeSeconds) : '—'
    
    // Calculate longest streak (consecutive weeks)
    let currentStreak = 0
    let maxStreak = 0
    const weekSet = new Set()
    runs2025.forEach(run => {
      const date = new Date(run.date.split('/').reverse().join('-'))
      const weekNum = getWeekNumber(date)
      const year = date.getFullYear()
      weekSet.add(`${year}-${weekNum}`)
    })
    
    const sortedWeeks = Array.from(weekSet).sort()
    for (let i = 0; i < sortedWeeks.length; i++) {
      if (i === 0) {
        currentStreak = 1
      } else {
        const [prevYear, prevWeek] = sortedWeeks[i-1].split('-').map(Number)
        const [currYear, currWeek] = sortedWeeks[i].split('-').map(Number)
        
        if (currYear === prevYear && currWeek === prevWeek + 1) {
          currentStreak++
        } else {
          maxStreak = Math.max(maxStreak, currentStreak)
          currentStreak = 1
        }
      }
      maxStreak = Math.max(maxStreak, currentStreak)
    }
    
    // Average age grade
    const avgAgeGrade = runs2025.reduce((total, run) => {
      const grade = parseFloat(run.ageGrade.replace('%', ''))
      return total + (isNaN(grade) ? 0 : grade)
    }, 0) / runs2025.length
    
    // Prepare chart data
    const timeData = processTimeData().slice(-10)
    const monthlyData = processMonthlyStats().slice(-12)
    
    const runnerName = data?.runnerInfo?.name || 'Parkrun legend'

    const summaryStats = [
      { label: 'Runs', value: runs2025.length },
      { label: 'Distance (km)', value: totalDistance },
      { label: 'Minutes', value: totalMinutes.toLocaleString() },
      { label: 'PB Count', value: pbCount },
      { label: 'Longest Streak', value: maxStreak ? `${maxStreak} wks` : '—' },
      { label: 'Best Time', value: bestTimeFormatted },
      { label: 'Avg Age Grade', value: `${avgAgeGrade.toFixed(1)}%` },
      { label: 'Busiest Season', value: `${busiestSeason} (${seasons[busiestSeason]})` }
    ]

    return [
      { title: 'TOTAL PARKRUNS IN 2025', value: runs2025.length, subtitle: `at ${locationNames}`, type: 'stat' },
      { title: 'PERFORMANCE TREND', value: null, subtitle: 'Recent running times', type: 'chart', chartData: timeData, chartType: 'line' },
      { title: 'MONTHLY ACTIVITY', value: null, subtitle: 'Runs per month', type: 'chart', chartData: monthlyData, chartType: 'bar' },
      { title: 'BUSIEST SEASON', value: busiestSeason, subtitle: `${seasons[busiestSeason]} runs`, type: 'stat' },
      { title: 'FASTEST MONTH', value: fastestMonth?.month || 'N/A', subtitle: `avg ${fastestMonth?.avgTime || 'N/A'} • ${fastestMonth?.totalRuns || 0} runs`, type: 'stat' },
      { title: 'MOST VISITED PARKRUN', value: mostVisited[0], subtitle: `${mostVisited[1]} times`, type: 'stat' },
      { title: 'BEST POSITION', value: bestPosition, subtitle: 'highest finish', type: 'stat' },
      { title: 'AVERAGE POSITION', value: avgPosition, subtitle: 'typical finish', type: 'stat' },
      { title: 'PERSONAL BESTS', value: pbCount, subtitle: 'new records set', type: 'stat' },
      { title: 'LONGEST STREAK', value: maxStreak, subtitle: 'consecutive weeks', type: 'stat' },
      { title: 'AVERAGE AGE GRADE', value: `${avgAgeGrade.toFixed(1)}%`, subtitle: 'over the year', type: 'stat' },
      { title: 'TOTAL DISTANCE', value: totalDistance, subtitle: 'kilometers ran', type: 'stat' },
      { title: 'PARKRUN WRAPPED 2025', value: null, stats: summaryStats, type: 'summary', subtitle: `${runnerName} keep it rolling into 2026!` }
    ]
  }

  useEffect(() => {
    if (showStory && autoPlay) {
      const interval = setInterval(() => {
        nextSlide()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [showStory, currentSlide, autoPlay])

  useEffect(() => {
    if (!showStory) return
    setSlideProgress(0)
    if (!autoPlay) return
    const start = Date.now()
    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - start
      const percent = Math.min((elapsed / 5000) * 100, 100)
      setSlideProgress(percent)
    }, 100)
    return () => clearInterval(progressTimer)
  }, [showStory, currentSlide, autoPlay])

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (showStory) {
        if (e.key === 'ArrowRight') {
          setAutoPlay(false)
          nextSlide()
        } else if (e.key === 'ArrowLeft') {
          setAutoPlay(false)
          prevSlide()
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [showStory, currentSlide])

  const nextSlide = () => {
    const stats = calculateStoryStats()
    if (currentSlide < stats.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else {
      setCurrentSlide(0) // Loop back to start
    }
  }

  const prevSlide = () => {
    const stats = calculateStoryStats()
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    } else {
      setCurrentSlide(stats.length - 1) // Loop to end
    }
  }

  return (
    <div className="app">
      <div className="header">
        <h1>🏃‍♂️ Parkrun Wrapped 2025</h1>
        <p>Your parkrun journey visualized</p>
      </div>

      <div className="input-section">
        <input
          type="text"
          value={parkrunId}
          onChange={(e) => {
            const sanitized = String(e.target.value).replace(/^[A-Za-z]/, '')
            setParkrunId(sanitized)
          }}
          placeholder="Enter parkrun ID (e.g., 8604987)"
          className="id-input"
        />
        <button onClick={() => fetchData()} disabled={loading} className="fetch-btn">
          {loading ? 'Loading...' : 'Get My Wrapped'}
        </button>
        {data && (
          <button onClick={() => setShowStory(!showStory)} className="story-btn">
            {showStory ? 'View Dashboard' : 'View Story'}
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {data && !showStory && (
        <div className="stats-container">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Runs</h3>
              <div className="stat-value">{data.statistics?.totalRuns || 0}</div>
            </div>
            <div className="stat-card">
              <h3>Best Time</h3>
              <div className="stat-value">{data.statistics?.bestTime || 'N/A'}</div>
            </div>
            <div className="stat-card">
              <h3>Unique Events</h3>
              <div className="stat-value">{data.statistics?.uniqueEvents || 0}</div>
            </div>
            <div className="stat-card">
              <h3>First Run</h3>
              <div className="stat-value">{data.statistics?.firstRun || 'N/A'}</div>
            </div>
          </div>

          <div className="chart-section">
            <h3>Recent Performance Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={processTimeData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'Time (seconds)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => [`${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`, 'Time']} />
                <Line type="monotone" dataKey="time" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-section">
            <h3>Monthly Activity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={processMonthlyStats()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="runs" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="recent-runs">
            <h3>Recent Runs</h3>
            <div className="runs-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event</th>
                    <th>Position</th>
                    <th>Time</th>
                    <th>Age Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {data.runs?.slice(0, 10).map((run, index) => (
                    <tr key={index}>
                      <td>{run.date}</td>
                      <td>{run.event}</td>
                      <td>{run.position}</td>
                      <td>{run.time}</td>
                      <td>{run.ageGrade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {data && showStory && (
        <div className="story-container">
          <div className="story-slide">
            <div className="story-progress">
              <div
                className="story-progress-bar"
                style={{ width: `${slideProgress}%` }}
              />
            </div>
            <div className="progress-dots">
              {calculateStoryStats().map((_, index) => (
                <div
                  key={index}
                  className={`dot ${index === currentSlide ? 'active' : ''}`}
                  onClick={() => setCurrentSlide(index)}
                />
              ))}
            </div>
            
            <div className="story-card">
              <h2 className="story-title">
                {calculateStoryStats()[currentSlide]?.title}
              </h2>
              
              {calculateStoryStats()[currentSlide]?.type === 'summary' ? (
                <div className="story-summary">
                  <div className="summary-stats-grid">
                    {calculateStoryStats()[currentSlide]?.stats?.map((stat, idx) => (
                      <div className="summary-item" key={idx}>
                        <div className="summary-number">{stat.value}</div>
                        <div className="summary-label">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="summary-message">
                    {calculateStoryStats()[currentSlide]?.subtitle || 'Thanks for an amazing 2025!'}
                  </div>
                </div>
              ) : calculateStoryStats()[currentSlide]?.type === 'chart' ? (
                <div className="story-chart">
                  {calculateStoryStats()[currentSlide]?.chartType === 'line' ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={calculateStoryStats()[currentSlide]?.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                        <YAxis 
                          stroke="rgba(255,255,255,0.5)" 
                          tickFormatter={formatTimeForDisplay}
                          domain={['dataMin - 60', 'dataMax + 60']}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }}
                          formatter={(value) => [formatTimeForDisplay(value), 'Time']}
                        />
                        <Line type="monotone" dataKey="time" stroke="#ffa300" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={calculateStoryStats()[currentSlide]?.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis 
                          dataKey="month" 
                          stroke="rgba(255,255,255,0.5)"
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis stroke="rgba(255,255,255,0.5)" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }}
                        />
                        <Bar dataKey="runs" fill="#ff8c00" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <div className="story-subtitle">
                    {calculateStoryStats()[currentSlide]?.subtitle}
                  </div>
                </div>
              ) : (
                <>
                  <div className="story-value">
                    {calculateStoryStats()[currentSlide]?.value}
                  </div>
                  <div className="story-subtitle">
                    {calculateStoryStats()[currentSlide]?.subtitle}
                  </div>
                </>
              )}
            </div>
            
            <div className="story-controls">
              <button
                onClick={() => {
                  setAutoPlay(false)
                  prevSlide()
                }}
                className="control-btn prev-btn"
                aria-label="Previous slide"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 5 8 12 15 19" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setAutoPlay(false)
                  nextSlide()
                }}
                className="control-btn play-btn"
                aria-label="Next slide"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-credit">
          Made with ❤️ by{' '}
          <a href="https://www.strava.com/athletes/44064119" target="_blank" rel="noreferrer">Emre</a>
          {' & '}
          <a href="https://www.strava.com/athletes/62588962" target="_blank" rel="noreferrer">Aydan</a>.
        </div>
        <div className="footer-disclaimer">Not affiliated with parkrun. Data retrieved from public sources.</div>
      </footer>
    </div>
  )
}

export default App
