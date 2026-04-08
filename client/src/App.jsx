import { useState, useEffect, useMemo } from 'react'
import { useAuth, UserButton, SignedOut, SignInButton } from '@clerk/clerk-react'
import api from './api'

const isMobile = window.innerWidth < 768

const STEPS = [
  { question: 'how are you feeling right now?' },
  { question: 'what triggered this feeling?' },
  { question: 'how would you rate your mood?' }
]

const FEELING_SUGGESTIONS = [
  'anxious', 'calm', 'excited', 'drained', 'grateful', 'overwhelmed',
  'content', 'frustrated', 'hopeful', 'numb', 'energized', 'in a good headspace',
  'feeling low', 'restless', 'at peace', 'stressed out', 'motivated'
]

const TRIGGER_SUGGESTIONS = [
  'work pressure', 'a conversation', 'lack of sleep', 'social media',
  'finances', 'family', 'a friend', 'loneliness', 'uncertainty',
  'a decision I have to make', 'physical tiredness', 'the news',
  'something I said', 'being misunderstood', 'a small win'
]

function Nav({ page, setPage }) {
  return (
    <div style={styles.nav}>
      <h1 style={styles.logo}>pulse</h1>
      <div style={styles.navLinks}>
        {['journal', 'entries', 'insights', 'about'].map(p => (
          <button
            key={p}
            style={page === (p === 'journal' ? 'home' : p) ? styles.navLinkActive : styles.navLink}
            onClick={() => setPage(p === 'journal' ? 'home' : p)}
          >{p}</button>
        ))}
        <div style={{ marginLeft: isMobile ? '0' : 'auto', paddingBottom: '12px', flexShrink: 0 }}>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </div>
  )
}

function HomePage({ getToken }) {
  const [step, setStep] = useState(0)
  const [feeling, setFeeling] = useState('')
  const [trigger, setTrigger] = useState('')
  const [mood, setMood] = useState(5)
  const [saved, setSaved] = useState(false)

  const handleNext = () => {
    if (step === 0 && feeling.trim() === '') return
    if (step === 1 && trigger.trim() === '') return
    setStep(step + 1)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (step < 2) handleNext()
    }
  }

  const handleSave = async () => {
    const token = await getToken()
    await api.saveEntry(token, { text: feeling, trigger, mood })
    setFeeling('')
    setTrigger('')
    setMood(5)
    setStep(0)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const appendSuggestion = (setter, current, suggestion) => {
    const trimmed = current.trim()
    setter(trimmed ? trimmed + ', ' + suggestion : suggestion)
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div style={styles.page}>
      {saved && <div style={styles.toast}>entry saved</div>}
      <div style={styles.wizardWrapper}>
        <div style={styles.progressBarTrack}>
          <div style={{ ...styles.progressBarFill, width: `${progress}%` }} />
        </div>
        <p style={styles.stepIndicator}>step {step + 1} of {STEPS.length}</p>
        <p style={styles.question}>{STEPS[step].question}</p>

        {step === 0 && (
          <>
            <textarea autoFocus style={styles.textarea} placeholder="write freely..."
              value={feeling} onChange={(e) => setFeeling(e.target.value)}
              onKeyDown={handleKeyDown} rows={3} />
            <div style={styles.suggestions}>
              {FEELING_SUGGESTIONS.map(s => (
                <button key={s} style={styles.chip}
                  onClick={() => appendSuggestion(setFeeling, feeling, s)}>{s}</button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <textarea autoFocus style={styles.textarea} placeholder="a person, situation, thought..."
              value={trigger} onChange={(e) => setTrigger(e.target.value)}
              onKeyDown={handleKeyDown} rows={3} />
            <div style={styles.suggestions}>
              {TRIGGER_SUGGESTIONS.map(s => (
                <button key={s} style={styles.chip}
                  onClick={() => appendSuggestion(setTrigger, trigger, s)}>{s}</button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <div style={styles.sliderWrapper}>
            <div style={styles.moodScore}>{mood}</div>
            <input type="range" min={1} max={10} value={mood}
              onChange={(e) => setMood(Number(e.target.value))} style={styles.slider} />
            <div style={styles.sliderLabels}>
              <span>very low</span><span>very high</span>
            </div>
          </div>
        )}

        <div style={styles.wizardActions}>
          {step > 0 && <button style={styles.backButton} onClick={() => setStep(step - 1)}>back</button>}
          {step < 2 && <button style={styles.button} onClick={handleNext}>next</button>}
          {step === 2 && <button style={styles.button} onClick={handleSave}>save</button>}
        </div>
      </div>
    </div>
  )
}

function EntriesPage({ getToken }) {
  const [entries, setEntries] = useState([])
  const [hoveredId, setHoveredId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editTrigger, setEditTrigger] = useState('')
  const [editMood, setEditMood] = useState(5)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(0)

  useEffect(() => { loadEntries() }, [])

  const loadEntries = async () => {
    const token = await getToken()
    const data = await api.getEntries(token)
    setEntries(data)
  }

  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Delete this entry?')) return
    const token = await getToken()
    await api.deleteEntry(token, id)
    loadEntries()
  }

  const handleDeleteLast = async () => {
    if (!window.confirm('Delete your most recent entry?')) return
    const token = await getToken()
    await api.deleteLastEntry(token)
    loadEntries()
  }

  const handleDeleteAll = async () => {
    if (confirmDeleteAll === 0) { setConfirmDeleteAll(1); return }
    if (!window.confirm('This will permanently delete every entry. Are you absolutely sure?')) {
      setConfirmDeleteAll(0); return
    }
    const token = await getToken()
    await api.deleteAllEntries(token)
    setConfirmDeleteAll(0)
    loadEntries()
  }

  const handleEditStart = (e) => {
    setEditingId(e.id)
    setEditText(e.text)
    setEditTrigger(e.trigger || '')
    setEditMood(e.mood || 5)
  }

  const handleEditSave = async () => {
    const token = await getToken()
    await api.updateEntry(token, { id: editingId, text: editText, trigger: editTrigger, mood: editMood })
    setEditingId(null)
    loadEntries()
  }

  const handleExportPDF = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    let y = 20
    doc.setFontSize(20)
    doc.setTextColor(100, 60, 200)
    doc.text('pulse journal export', 20, y)
    y += 10
    doc.setFontSize(10)
    doc.setTextColor(150, 150, 150)
    doc.text(`exported on ${new Date().toLocaleDateString()}`, 20, y)
    y += 14
    entries.forEach((e) => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.setFontSize(9); doc.setTextColor(120, 120, 120)
      doc.text(new Date(e.created_at).toLocaleString(), 20, y); y += 6
      doc.setFontSize(11); doc.setTextColor(230, 230, 230)
      const fl = doc.splitTextToSize(e.text || '', 170)
      doc.text(fl, 20, y); y += fl.length * 6
      if (e.trigger) {
        doc.setFontSize(10); doc.setTextColor(150, 150, 150)
        const tl = doc.splitTextToSize(`triggered by: ${e.trigger}`, 170)
        doc.text(tl, 20, y); y += tl.length * 6
      }
      if (e.mood) {
        doc.setFontSize(10); doc.setTextColor(160, 130, 250)
        doc.text(`mood: ${e.mood}/10`, 20, y); y += 6
      }
      y += 6; doc.setDrawColor(40, 40, 40); doc.line(20, y, 190, y); y += 8
    })
    doc.save('pulse-journal.pdf')
  }

  const handleExportCSV = () => {
    const header = 'date,time,feeling,trigger,mood\n'
    const rows = entries.map(e => {
      const date = new Date(e.created_at).toLocaleDateString()
      const time = new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const feeling = `"${(e.text || '').replace(/"/g, '""')}"`
      const trigger = `"${(e.trigger || '').replace(/"/g, '""')}"`
      return `${date},${time},${feeling},${trigger},${e.mood || ''}`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'pulse-entries.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const groupByDate = (entries) => {
    const groups = {}
    entries.forEach(e => {
      const date = new Date(e.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      if (!groups[date]) groups[date] = []
      groups[date].push(e)
    })
    return groups
  }

  const grouped = groupByDate(entries)

  return (
    <div style={styles.page}>
      <div style={styles.entriesHeader}>
        <p style={styles.entryCount}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
        <div style={styles.headerActions}>
          <button style={styles.exportButton} onClick={handleExportCSV}>export csv</button>
          <button style={styles.exportButton} onClick={handleExportPDF}>export pdf</button>
          <button style={styles.dangerButtonSoft} onClick={handleDeleteLast}>delete last</button>
          <button style={confirmDeleteAll === 1 ? styles.dangerButtonHot : styles.dangerButtonSoft} onClick={handleDeleteAll}>
            {confirmDeleteAll === 1 ? 'tap again to confirm' : 'delete all'}
          </button>
        </div>
      </div>
      <div style={styles.feed}>
        {entries.length === 0 && <p style={styles.emptyState}>no entries yet. start journaling from the home page.</p>}
        {Object.entries(grouped).map(([date, dayEntries]) => (
          <div key={date}>
            <p style={styles.dateLabel}>{date}</p>
            {dayEntries.map(e => (
              <div key={e.id} style={styles.entryCard}
                onMouseEnter={() => setHoveredId(e.id)}
                onMouseLeave={() => setHoveredId(null)}>
                {editingId === e.id ? (
                  <div>
                    <p style={styles.editLabel}>how were you feeling?</p>
                    <textarea style={{ ...styles.textarea, marginBottom: 12 }} value={editText}
                      onChange={ev => setEditText(ev.target.value)} rows={2} />
                    <p style={styles.editLabel}>what triggered it?</p>
                    <textarea style={{ ...styles.textarea, marginBottom: 16 }} value={editTrigger}
                      onChange={ev => setEditTrigger(ev.target.value)} rows={2} />
                    <p style={styles.editLabel}>mood score</p>
                    <div style={styles.sliderWrapper}>
                      <div style={styles.moodScore}>{editMood}</div>
                      <input type="range" min={1} max={10} value={editMood}
                        onChange={ev => setEditMood(Number(ev.target.value))} style={styles.slider} />
                      <div style={styles.sliderLabels}><span>very low</span><span>very high</span></div>
                    </div>
                    <div style={styles.editActions}>
                      <button style={styles.backButton} onClick={() => setEditingId(null)}>cancel</button>
                      <button style={styles.button} onClick={handleEditSave}>save changes</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={styles.entryText}>{e.text}</p>
                    {e.trigger && <p style={styles.entryTrigger}>triggered by: {e.trigger}</p>}
                    <div style={styles.entryFooter}>
                      <span style={styles.timestamp}>
                        {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div style={styles.entryMeta}>
                        {e.mood && <span style={styles.moodBadge}>mood {e.mood}/10</span>}
                        {hoveredId === e.id && (
                          <>
                            <button style={styles.editEntryButton} onClick={() => handleEditStart(e)}>edit</button>
                            <button style={styles.deleteEntryButton} onClick={() => handleDeleteEntry(e.id)}>delete</button>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function MoodLineChart({ data }) {
  const max = 10, min = 1, width = 600, height = 160, padX = 20, padY = 20
  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * (width - padX * 2),
    y: padY + ((max - d.mood) / (max - min)) * (height - padY * 2),
    ...d
  }))
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {[2, 4, 6, 8, 10].map(v => {
        const y = padY + ((max - v) / (max - min)) * (height - padY * 2)
        return <g key={v}>
          <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#2e2e2e" strokeWidth="1" />
          <text x={0} y={y + 4} fill="#555" fontSize="9">{v}</text>
        </g>
      })}
      <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => <g key={i}>
        <circle cx={p.x} cy={p.y} r="3" fill="#a78bfa" />
        <text x={p.x} y={height - 4} fill="#555" fontSize="9" textAnchor="middle">{p.day}</text>
      </g>)}
    </svg>
  )
}

function MoodBarChart({ data }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const width = 600, height = 120, padX = 20, padY = 10
  const barWidth = (width - padX * 2) / data.length
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {data.map((d, i) => {
        const barH = d.count === 0 ? 2 : ((d.count / max) * (height - padY * 2 - 20))
        const x = padX + i * barWidth + barWidth * 0.15
        const y = height - padY - 16 - barH
        return <g key={d.score}>
          <rect x={x} y={y} width={barWidth * 0.7} height={barH} fill="#a78bfa" opacity={d.count === 0 ? 0.1 : 0.8} rx="2" />
          <text x={x + barWidth * 0.35} y={height - padY} fill="#555" fontSize="9" textAnchor="middle">{d.score}</text>
        </g>
      })}
    </svg>
  )
}

function InsightsPage({ getToken }) {
  const [entries, setEntries] = useState([])
  const [timeRange, setTimeRange] = useState('week')
  const [storedInsights, setStoredInsights] = useState({})
  const [loadingRange, setLoadingRange] = useState(null)
  const [storedClusters, setStoredClusters] = useState({})
  const [clusteringRange, setClusteringRange] = useState(null)
  const [expandedClusters, setExpandedClusters] = useState({})

  useEffect(() => {
    loadEntries()
    loadStoredInsights()
    loadStoredClusters()
  }, [])

  const loadEntries = async () => {
    const token = await getToken()
    const data = await api.getEntries(token)
    setEntries(data)
  }

  const loadStoredInsights = async () => {
    const token = await getToken()
    const data = await api.getAiInsights(token)
    setStoredInsights(data)
  }

  const loadStoredClusters = async () => {
    const token = await getToken()
    const data = await api.getTriggerClusters(token)
    setStoredClusters(data)
  }

  const filterByRange = (entries, range) => {
    const now = new Date()
    const cutoff = new Date()
    if (range === 'today') cutoff.setHours(0, 0, 0, 0)
    if (range === 'week') cutoff.setDate(now.getDate() - 7)
    if (range === 'month') cutoff.setDate(now.getDate() - 30)
    return entries.filter(e => new Date(e.created_at) >= cutoff)
  }

  const filtered = useMemo(() => filterByRange(entries, timeRange), [entries, timeRange])
  const getFilteredForRange = (range) => filterByRange(entries, range)
  const minEntries = { today: 5, week: 20, month: 50 }

  const handleGenerateInsight = async (range) => {
    const rangeEntries = getFilteredForRange(range)
    setLoadingRange(range)
    try {
      const token = await getToken()
      const result = await api.generateAiInsight(token, { entries: rangeEntries, range })
      setStoredInsights(prev => ({ ...prev, [range]: { insight: result.insight, generatedAt: new Date().toISOString() } }))
    } catch (e) { console.error(e) }
    setLoadingRange(null)
  }

  const handleClusterTriggers = async (range) => {
    const rangeEntries = getFilteredForRange(range)
    setClusteringRange(range)
    try {
      const token = await getToken()
      const result = await api.generateTriggerClusters(token, { entries: rangeEntries, range })
      setStoredClusters(prev => ({ ...prev, [range]: { clusters: result.clusters, generatedAt: new Date().toISOString() } }))
    } catch (e) { console.error(e) }
    setClusteringRange(null)
  }

  const toggleCluster = (range, label) => {
    const key = `${range}:${label}`
    setExpandedClusters(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const getMoodOverTime = () => {
    const byDay = {}
    filtered.forEach(e => {
      if (!e.mood) return
      const day = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!byDay[day]) byDay[day] = { total: 0, count: 0 }
      byDay[day].total += e.mood; byDay[day].count += 1
    })
    return Object.entries(byDay).map(([day, val]) => ({ day, mood: parseFloat((val.total / val.count).toFixed(1)) })).reverse()
  }

  const getMoodByTimeOfDay = () => {
    const slots = {
      morning: { label: 'morning', range: '6am to 12pm', total: 0, count: 0 },
      afternoon: { label: 'afternoon', range: '12pm to 6pm', total: 0, count: 0 },
      evening: { label: 'evening', range: '6pm to 12am', total: 0, count: 0 },
      night: { label: 'night', range: '12am to 6am', total: 0, count: 0 }
    }
    filtered.forEach(e => {
      if (!e.mood) return
      const h = new Date(e.created_at).getHours()
      if (h >= 6 && h < 12) { slots.morning.total += e.mood; slots.morning.count++ }
      else if (h >= 12 && h < 18) { slots.afternoon.total += e.mood; slots.afternoon.count++ }
      else if (h >= 18 && h < 24) { slots.evening.total += e.mood; slots.evening.count++ }
      else { slots.night.total += e.mood; slots.night.count++ }
    })
    return Object.values(slots).map(s => ({ label: s.label, range: s.range, mood: s.count > 0 ? parseFloat((s.total / s.count).toFixed(1)) : null }))
  }

  const getStreak = () => {
    const days = [...new Set(entries.map(e => new Date(e.created_at).toDateString()))].sort((a, b) => new Date(b) - new Date(a))
    let streak = 0, current = new Date()
    current.setHours(0, 0, 0, 0)
    for (const day of days) {
      const d = new Date(day); d.setHours(0, 0, 0, 0)
      if ((current - d) / (1000 * 60 * 60 * 24) <= 1) { streak++; current = d } else break
    }
    return streak
  }

  const getMoodDistribution = () => {
    const dist = {}
    for (let i = 1; i <= 10; i++) dist[i] = 0
    filtered.forEach(e => { if (e.mood) dist[e.mood]++ })
    return Object.entries(dist).map(([score, count]) => ({ score: String(score), count }))
  }

  const getBestAndWorstDays = () => {
    const byDay = {}
    filtered.forEach(e => {
      if (!e.mood) return
      const day = new Date(e.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      if (!byDay[day]) byDay[day] = { total: 0, count: 0 }
      byDay[day].total += e.mood; byDay[day].count++
    })
    const days = Object.entries(byDay).map(([day, val]) => ({ day, avg: parseFloat((val.total / val.count).toFixed(1)) }))
    if (days.length < 2) return null
    const sorted = [...days].sort((a, b) => b.avg - a.avg)
    return { best: sorted[0], worst: sorted[sorted.length - 1] }
  }

  const moodOverTime = getMoodOverTime()
  const moodByTime = getMoodByTimeOfDay()
  const streak = getStreak()
  const moodDist = getMoodDistribution()
  const bestWorst = getBestAndWorstDays()
  const avgMood = filtered.length > 0
    ? (filtered.filter(e => e.mood).reduce((sum, e) => sum + e.mood, 0) / filtered.filter(e => e.mood).length).toFixed(1)
    : null

  return (
    <div style={styles.page}>
      <div style={styles.insightsHeader}>
        <div style={styles.timeRangeTabs}>
          {['today', 'week', 'month'].map(r => (
            <button key={r} style={timeRange === r ? styles.timeTabActive : styles.timeTab} onClick={() => setTimeRange(r)}>{r}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && <p style={styles.emptyState}>no entries in this time range yet.</p>}

      {filtered.length > 0 && (
        <>
          <div style={styles.statRow}>
            <div style={styles.statCard}><p style={styles.statLabel}>entries</p><p style={styles.statValue}>{filtered.length}</p></div>
            {avgMood && <div style={styles.statCard}><p style={styles.statLabel}>avg mood</p><p style={styles.statValue}>{avgMood}</p></div>}
            <div style={styles.statCard}><p style={styles.statLabel}>day streak</p><p style={styles.statValue}>{streak}</p></div>
          </div>

          {moodOverTime.length > 1 && (
            <div style={styles.chartCard}>
              <p style={styles.chartTitle}>mood over time</p>
              <MoodLineChart data={moodOverTime} />
            </div>
          )}

          <div style={styles.chartCard}>
            <p style={styles.chartTitle}>mood by time of day</p>
            <div style={styles.timeOfDayGrid}>
              {moodByTime.map(slot => (
                <div key={slot.label} style={styles.timeOfDayCard}>
                  <p style={styles.timeOfDayLabel}>{slot.label}</p>
                  <p style={styles.timeOfDayRange}>{slot.range}</p>
                  <p style={styles.timeOfDayMood}>{slot.mood !== null ? slot.mood : 'no data'}</p>
                </div>
              ))}
            </div>
          </div>

          {moodDist && (
            <div style={styles.chartCard}>
              <p style={styles.chartTitle}>mood distribution</p>
              <MoodBarChart data={moodDist} />
            </div>
          )}

          <div style={styles.chartCard}>
            <p style={styles.chartTitle}>top triggers</p>
            {[timeRange].map(range => {
              const rangeEntries = getFilteredForRange(range)
              const hasTriggers = rangeEntries.some(e => e.trigger)
              const stored = storedClusters[range]
              const isLoading = clusteringRange === range
              return (
                <div key={range} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {!hasTriggers && <p style={{ margin: 0, color: '#555', fontSize: 13 }}>no triggers logged in this time range.</p>}
                  {hasTriggers && (
                    <button style={{ alignSelf: 'flex-start', background: isLoading ? 'rgba(120,80,220,0.15)' : 'rgba(120,80,220,0.25)', border: '1px solid rgba(120,80,220,0.4)', borderRadius: 8, color: '#c4b5fd', fontSize: 12, padding: '6px 14px', cursor: isLoading ? 'default' : 'pointer' }}
                      onClick={() => !isLoading && handleClusterTriggers(range)}>
                      {isLoading ? 'analyzing triggers...' : stored ? 'reanalyze' : 'analyze triggers'}
                    </button>
                  )}
                  {stored && !isLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {stored.clusters.map((cluster, i) => {
                        const key = `${range}:${cluster.label}`
                        const isExpanded = expandedClusters[key]
                        return (
                          <div key={cluster.label} style={{ background: 'rgba(120,80,220,0.05)', border: '1px solid rgba(120,80,220,0.12)', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }} onClick={() => toggleCluster(range, cluster.label)}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ color: '#6b7280', fontSize: 12, width: 16 }}>{i + 1}</span>
                                <span style={{ color: '#e2e8f0', fontSize: 14 }}>{cluster.label}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ color: '#a78bfa', fontSize: 12 }}>{cluster.count}x</span>
                                <span style={{ color: '#555', fontSize: 11 }}>{isExpanded ? '▲' : '▼'}</span>
                              </div>
                            </div>
                            {isExpanded && (
                              <div style={{ borderTop: '1px solid rgba(120,80,220,0.1)', padding: '8px 14px 10px 40px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {cluster.raw.map(r => (
                                  <div key={r.text} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#888', fontSize: 13 }}>{r.text}</span>
                                    <span style={{ color: '#555', fontSize: 12 }}>{r.count}x</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {bestWorst && (
            <div style={styles.chartCard}>
              <p style={styles.chartTitle}>best and worst days</p>
              <div style={styles.bestWorstRow}>
                <div style={styles.bestCard}>
                  <p style={styles.bestLabel}>best day</p>
                  <p style={styles.bestDay}>{bestWorst.best.day}</p>
                  <p style={styles.bestMood}>avg mood {bestWorst.best.avg}</p>
                </div>
                <div style={styles.worstCard}>
                  <p style={styles.worstLabel}>worst day</p>
                  <p style={styles.bestDay}>{bestWorst.worst.day}</p>
                  <p style={styles.worstMood}>avg mood {bestWorst.worst.avg}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div style={styles.chartCard}>
        <p style={styles.chartTitle}>ai reflection</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[timeRange].map(range => {
            const rangeEntries = getFilteredForRange(range)
            const count = rangeEntries.length
            const min = minEntries[range]
            const hasEnough = count >= min
            const stored = storedInsights[range]
            const isLoading = loadingRange === range
            return (
              <div key={range} style={{ background: 'rgba(120,80,220,0.07)', border: '1px solid rgba(120,80,220,0.18)', borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ margin: 0, color: '#a78bfa', fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>{range}</p>
                  {stored && !isLoading && (
                    <p style={{ margin: 0, color: '#555', fontSize: 11 }}>
                      generated {new Date(stored.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(stored.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                {!hasEnough && <p style={{ margin: 0, color: '#555', fontSize: 13 }}>need at least {min} entries for a {range} insight. you have {count}.</p>}
                {hasEnough && (
                  <button style={{ alignSelf: 'flex-start', background: isLoading ? 'rgba(120,80,220,0.15)' : 'rgba(120,80,220,0.25)', border: '1px solid rgba(120,80,220,0.4)', borderRadius: 8, color: '#c4b5fd', fontSize: 12, padding: '6px 14px', cursor: isLoading ? 'default' : 'pointer' }}
                    onClick={() => !isLoading && handleGenerateInsight(range)}>
                    {isLoading ? 'reading your entries...' : stored ? 'regenerate' : 'generate insight'}
                  </button>
                )}
                {isLoading && <p style={{ margin: 0, color: '#666', fontSize: 13, fontStyle: 'italic' }}>thinking...</p>}
                {stored && !isLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {stored.insight.split('\n\n').map((section, i) => {
                      const lines = section.split('\n')
                      return (
                        <div key={i}>
                          <p style={{ margin: '0 0 4px 0', color: '#a78bfa', fontSize: 13, fontWeight: 500, letterSpacing: 0.3 }}>{lines[0].replace(/^#+\s*/, '')}</p>
                          <p style={{ margin: 0, color: '#aaa', fontSize: 14, lineHeight: 1.7, fontWeight: 400 }}>{lines.slice(1).join('\n')}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AboutPage() {
  return (
    <div style={styles.page}>
      <div style={styles.aboutWrapper}>
        <p style={styles.aboutTagline}>a new kind of journal</p>
        <h2 style={styles.aboutHeading}>what is pulse?</h2>
        <p style={styles.aboutBody}>Most journaling apps ask you to sit down, reflect, and write. But real emotions do not work that way. They spike during a stressful meeting, dip on a slow afternoon, and shift a dozen times before you ever open a journal.</p>
        <p style={styles.aboutBody}>Pulse is a micro-journaling app that lets you capture how you feel in the moment, in just a few words, whenever it hits you. Over time it stitches those moments together to surface patterns, themes, and emotional triggers you would never spot on your own.</p>
        <p style={styles.aboutBody}>The result is not just a record of your thoughts but a genuine map of your inner life, one that gets smarter and more personal the more you use it.</p>
        <div style={styles.aboutDivider} />
        <h2 style={styles.aboutHeading}>how it works</h2>
        <div style={styles.aboutSteps}>
          {[
            { n: '01', title: 'capture the moment', body: 'Whenever something shifts, open Pulse and log how you are feeling, what triggered it, and your mood score. Takes less than a minute.' },
            { n: '02', title: 'build your history', body: 'Every entry is saved securely to your account. Your data is private and only accessible to you.' },
            { n: '03', title: 'discover your patterns', body: 'Visit the insights page to see your mood over time, your top triggers, your best and worst days, and more.' }
          ].map(s => (
            <div key={s.n} style={styles.aboutStep}>
              <p style={styles.aboutStepNumber}>{s.n}</p>
              <p style={styles.aboutStepTitle}>{s.title}</p>
              <p style={styles.aboutStepBody}>{s.body}</p>
            </div>
          ))}
        </div>
        <div style={styles.aboutDivider} />
        <h2 style={styles.aboutHeading}>your data</h2>
        <p style={styles.aboutBody}>Everything you write in Pulse is stored securely in your private account. Only you can access your entries. You can export all your entries at any time as a CSV or PDF from the entries page.</p>
        <div style={styles.aboutDivider} />
        <p style={styles.aboutVersion}>pulse v2.0 · built with intention</p>
      </div>
    </div>
  )
}

function LandingPage() {
  return (
    <div style={{ ...styles.page, textAlign: 'center', paddingTop: 80 }}>
      <h1 style={{ ...styles.logo, fontSize: 48, marginBottom: 24 }}>pulse</h1>
      <p style={{ color: '#999', fontSize: 16, lineHeight: 1.8, maxWidth: 480, margin: '0 auto 40px' }}>
        a micro-journaling app that captures how you feel in the moment and surfaces emotional patterns over time.
      </p>
      <SignInButton mode="modal">
        <button style={styles.button}>get started</button>
      </SignInButton>
    </div>
  )
}

function App() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const [page, setPage] = useState('home')

  const fetchToken = async () => {
    const t = await getToken()
    return t
  }

  if (!isLoaded) return <div style={{ color: '#555', padding: 40, fontFamily: 'Georgia, serif' }}>loading...</div>

  if (!isSignedIn) return (
    <div style={styles.container}>
      <LandingPage />
    </div>
  )

  return (
    <div style={styles.container}>
      <Nav page={page} setPage={setPage} />
      {page === 'home' && <HomePage getToken={fetchToken} />}
      {page === 'entries' && <EntriesPage getToken={fetchToken} />}
      {page === 'insights' && <InsightsPage getToken={fetchToken} />}
      {page === 'about' && <AboutPage />}
    </div>
  )
}

const styles = {
  container: { backgroundColor: '#0f0f0f', minHeight: '100vh', fontFamily: 'Georgia, serif', color: '#f0f0f0', width: '100%', boxSizing: 'border-box' },
  nav: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobile ? '24px 16px 0px 16px' : '32px 40px 0px 40px', borderBottom: '1px solid #1e1e1e', position: 'sticky', top: 0, backgroundColor: '#0f0f0f', zIndex: 10, width: '100%', boxSizing: 'border-box', overflow: 'hidden' },
  logo: { fontSize: '28px', fontWeight: '400', letterSpacing: '8px', color: '#a78bfa', margin: '0 0 20px 0' },
  navLinks: { display: 'flex', gap: isMobile ? '12px' : '40px', marginBottom: '0px', alignItems: 'center', width: '100%', justifyContent: isMobile ? 'space-between' : 'center' },
  navLink: { backgroundColor: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#555', fontSize: '12px', cursor: 'pointer', letterSpacing: '3px', fontFamily: 'Georgia, serif', paddingBottom: '12px', textTransform: 'uppercase' },
  navLinkActive: { backgroundColor: 'transparent', border: 'none', borderBottom: '2px solid #a78bfa', color: '#a78bfa', fontSize: isMobile ? '10px' : '12px', cursor: 'pointer', letterSpacing: isMobile ? '1px' : '3px', fontFamily: 'Georgia, serif', paddingBottom: '12px', textTransform: 'uppercase' },
  page: { padding: isMobile ? '24px 16px' : '40px', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box' },
  toast: { position: 'fixed', bottom: '32px', right: '32px', backgroundColor: '#a78bfa', color: '#0f0f0f', padding: '12px 24px', borderRadius: '8px', fontSize: '13px', letterSpacing: '2px' },
  wizardWrapper: { backgroundColor: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '12px', padding: '36px', maxWidth: '600px', margin: '0 auto' },
  progressBarTrack: { backgroundColor: '#2e2e2e', borderRadius: '999px', height: '3px', marginBottom: '24px' },
  progressBarFill: { backgroundColor: '#a78bfa', height: '3px', borderRadius: '999px', transition: 'width 0.3s ease' },
  stepIndicator: { fontSize: '11px', letterSpacing: '3px', color: '#555', textTransform: 'uppercase', marginBottom: '8px' },
  question: { fontSize: '20px', color: '#f0f0f0', marginBottom: '24px', lineHeight: '1.5' },
  textarea: { width: '100%', backgroundColor: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '10px', padding: '14px', fontSize: '15px', color: '#f0f0f0', resize: 'none', outline: 'none', fontFamily: 'Georgia, serif', lineHeight: '1.6', boxSizing: 'border-box' },
  sliderWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '10px 0' },
  moodScore: { fontSize: '56px', color: '#a78bfa', fontWeight: '300' },
  slider: { width: '100%', accentColor: '#a78bfa', cursor: 'pointer' },
  sliderLabels: { display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '11px', color: '#555', letterSpacing: '1px' },
  wizardActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' },
  backButton: { backgroundColor: 'transparent', color: '#555', border: '1px solid #2e2e2e', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', cursor: 'pointer', letterSpacing: '2px', fontFamily: 'Georgia, serif' },
  button: { backgroundColor: '#a78bfa', color: '#0f0f0f', border: 'none', borderRadius: '8px', padding: '10px 28px', fontSize: '14px', cursor: 'pointer', letterSpacing: '2px' },
  entriesHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  entryCount: { fontSize: '12px', letterSpacing: '3px', color: '#555', textTransform: 'uppercase', margin: 0 },
  headerActions: { display: 'flex', gap: '12px' },
  dangerButtonSoft: { backgroundColor: 'transparent', color: '#555', border: '1px solid #2e2e2e', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', letterSpacing: '1px', fontFamily: 'Georgia, serif' },
  dangerButtonHot: { backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', letterSpacing: '1px', fontFamily: 'Georgia, serif' },
  feed: { display: 'flex', flexDirection: 'column', gap: '24px' },
  dateLabel: { fontSize: '12px', letterSpacing: '3px', color: '#555', textTransform: 'uppercase', marginBottom: '12px' },
  entryCard: { backgroundColor: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '10px', padding: '20px', marginBottom: '10px' },
  entryText: { fontSize: '15px', lineHeight: '1.6', marginBottom: '6px', color: '#e0e0e0' },
  entryTrigger: { fontSize: '13px', color: '#777', marginBottom: '8px', fontStyle: 'italic' },
  entryFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  timestamp: { fontSize: '12px', color: '#555' },
  entryMeta: { display: 'flex', alignItems: 'center', gap: '12px' },
  moodBadge: { fontSize: '11px', color: '#a78bfa', letterSpacing: '1px' },
  deleteEntryButton: { backgroundColor: 'transparent', color: '#ef4444', border: 'none', fontSize: '12px', cursor: 'pointer', fontFamily: 'Georgia, serif', letterSpacing: '1px' },
  editEntryButton: { backgroundColor: 'transparent', color: '#a78bfa', border: 'none', fontSize: '12px', cursor: 'pointer', fontFamily: 'Georgia, serif', letterSpacing: '1px' },
  emptyState: { color: '#555', fontSize: '14px', letterSpacing: '1px' },
  editLabel: { fontSize: '11px', letterSpacing: '2px', color: '#555', textTransform: 'uppercase', marginBottom: '8px' },
  editActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' },
  suggestions: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' },
  chip: { backgroundColor: 'transparent', border: '1px solid #2e2e2e', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', color: '#888', cursor: 'pointer', fontFamily: 'Georgia, serif', letterSpacing: '0.5px' },
  insightsHeader: { marginBottom: '32px' },
  timeRangeTabs: { display: 'flex', gap: '8px' },
  timeTab: { backgroundColor: 'transparent', border: '1px solid #2e2e2e', borderRadius: '999px', padding: '6px 20px', fontSize: '12px', color: '#555', cursor: 'pointer', letterSpacing: '2px', fontFamily: 'Georgia, serif', textTransform: 'uppercase' },
  timeTabActive: { backgroundColor: '#a78bfa', border: '1px solid #a78bfa', borderRadius: '999px', padding: '6px 20px', fontSize: '12px', color: '#0f0f0f', cursor: 'pointer', letterSpacing: '2px', fontFamily: 'Georgia, serif', textTransform: 'uppercase' },
  statRow: { display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' },
  statCard: { backgroundColor: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '10px', padding: '20px 28px', flex: 1, textAlign: 'center', minWidth: isMobile ? '60px' : '100px' },
  statLabel: { fontSize: '11px', letterSpacing: '3px', color: '#555', textTransform: 'uppercase', marginBottom: '8px' },
  statValue: { fontSize: '36px', color: '#a78bfa', fontWeight: '300' },
  chartCard: { backgroundColor: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '10px', padding: '24px', marginBottom: '20px' },
  chartTitle: { fontSize: '11px', letterSpacing: '3px', color: '#555', textTransform: 'uppercase', marginBottom: '20px' },
  timeOfDayGrid: { display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px' },
  timeOfDayCard: { backgroundColor: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '8px', padding: '16px', textAlign: 'center' },
  timeOfDayLabel: { fontSize: '12px', letterSpacing: '2px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' },
  timeOfDayRange: { fontSize: '10px', color: '#444', marginBottom: '12px' },
  timeOfDayMood: { fontSize: '28px', color: '#a78bfa', fontWeight: '300' },
  bestWorstRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  bestCard: { backgroundColor: '#0f0f0f', border: '1px solid #1e3a2e', borderRadius: '8px', padding: '20px' },
  worstCard: { backgroundColor: '#0f0f0f', border: '1px solid #3a1e1e', borderRadius: '8px', padding: '20px' },
  bestLabel: { fontSize: '11px', letterSpacing: '2px', color: '#4ade80', textTransform: 'uppercase', marginBottom: '8px' },
  worstLabel: { fontSize: '11px', letterSpacing: '2px', color: '#ef4444', textTransform: 'uppercase', marginBottom: '8px' },
  bestDay: { fontSize: '14px', color: '#e0e0e0', marginBottom: '6px' },
  bestMood: { fontSize: '12px', color: '#4ade80' },
  worstMood: { fontSize: '12px', color: '#ef4444' },
  exportButton: { backgroundColor: 'transparent', color: '#a78bfa', border: '1px solid #a78bfa', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', letterSpacing: '1px', fontFamily: 'Georgia, serif' },
  aboutWrapper: { maxWidth: '640px', margin: '0 auto' },
  aboutTagline: { fontSize: '11px', letterSpacing: '4px', color: '#555', textTransform: 'uppercase', marginBottom: '12px' },
  aboutHeading: { fontSize: '22px', fontWeight: '400', color: '#f0f0f0', marginBottom: '16px' },
  aboutBody: { fontSize: '15px', lineHeight: '1.8', color: '#999', marginBottom: '14px' },
  aboutDivider: { borderTop: '1px solid #1e1e1e', margin: '32px 0' },
  aboutSteps: { display: 'flex', flexDirection: 'column', gap: '24px' },
  aboutStep: { display: 'flex', flexDirection: 'column', gap: '4px' },
  aboutStepNumber: { fontSize: '11px', letterSpacing: '3px', color: '#a78bfa', marginBottom: '4px' },
  aboutStepTitle: { fontSize: '15px', color: '#f0f0f0', marginBottom: '4px' },
  aboutStepBody: { fontSize: '14px', lineHeight: '1.7', color: '#777' },
  aboutVersion: { fontSize: '11px', letterSpacing: '3px', color: '#333', textTransform: 'uppercase', marginTop: '8px' },
}

export default App