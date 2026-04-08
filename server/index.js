if (process.env.NODE_ENV !== 'production') require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const Anthropic = require('@anthropic-ai/sdk')
const { createClerkClient } = require('@clerk/clerk-sdk-node')

const app = express()
const port = process.env.PORT || 3001

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://pulse-web-bice.vercel.app',
    'https://www.pulse-journaling.com',
    'https://pulse-journaling.com'
  ]
}))
app.use(express.json())

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const token = authHeader.split(' ')[1]
    const payload = await clerk.verifyToken(token)
    req.userId = payload.sub
    next()
  } catch (err) {
    console.error('auth error:', err.message)
    return res.status(401).json({ error: 'unauthorized' })
  }
}

const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS entries (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      trigger TEXT,
      mood INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_insights (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      range TEXT NOT NULL,
      insight TEXT NOT NULL,
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, range)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trigger_clusters (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      range TEXT NOT NULL,
      clusters TEXT NOT NULL,
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, range)
    )
  `)
  console.log('database ready')
}

app.get('/health', (req, res) => res.json({ ok: true }))

app.post('/entries', requireAuth, async (req, res) => {
  const { text, trigger, mood } = req.body
  const result = await pool.query(
    'INSERT INTO entries (user_id, text, trigger, mood) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.userId, text, trigger, mood]
  )
  res.json(result.rows[0])
})

app.get('/entries', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM entries WHERE user_id = $1 ORDER BY created_at DESC',
    [req.userId]
  )
  res.json(result.rows)
})

app.delete('/entries/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM entries WHERE id = $1 AND user_id = $2', [req.params.id, req.userId])
  res.json({ success: true })
})

app.delete('/entries/last/one', requireAuth, async (req, res) => {
  await pool.query(
    'DELETE FROM entries WHERE id = (SELECT id FROM entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)',
    [req.userId]
  )
  res.json({ success: true })
})

app.delete('/entries/all/clear', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM entries WHERE user_id = $1', [req.userId])
  res.json({ success: true })
})

app.put('/entries/:id', requireAuth, async (req, res) => {
  const { text, trigger, mood } = req.body
  const result = await pool.query(
    'UPDATE entries SET text = $1, trigger = $2, mood = $3 WHERE id = $4 AND user_id = $5 RETURNING *',
    [text, trigger, mood, req.params.id, req.userId]
  )
  res.json(result.rows[0])
})

app.post('/ai/insights', requireAuth, async (req, res) => {
  const { entries, range } = req.body
  const summary = entries.slice(0, 50).map(e =>
    `[${e.created_at}] mood: ${e.mood ?? 'unrated'} | feeling: ${e.text} | trigger: ${e.trigger ?? 'none'}`
  ).join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a compassionate journaling assistant analyzing someone's private mood journal entries. Based on the entries below, provide warm and personal insights about their emotional patterns, recurring triggers, and any notable trends. Be specific, reference actual content from their entries, and keep the tone supportive and non-clinical. Format your response in three short sections: Patterns, Triggers, and One thing to consider.

Entries:
${summary}`
    }]
  })

  const insight = message.content[0].text

  await pool.query(`
    INSERT INTO ai_insights (user_id, range, insight)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, range) DO UPDATE SET insight = excluded.insight, generated_at = NOW()
  `, [req.userId, range, insight])

  res.json({ insight })
})

app.get('/ai/insights', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM ai_insights WHERE user_id = $1',
    [req.userId]
  )
  const data = {}
  result.rows.forEach(row => {
    data[row.range] = { insight: row.insight, generatedAt: row.generated_at }
  })
  res.json(data)
})

app.post('/ai/clusters', requireAuth, async (req, res) => {
  const { entries, range } = req.body

  const rawCounts = {}
  entries.forEach(e => {
    if (!e.trigger) return
    const t = e.trigger.toLowerCase().trim()
    rawCounts[t] = (rawCounts[t] || 0) + 1
  })

  const rawList = Object.entries(rawCounts)
    .map(([trigger, count]) => `${trigger} (${count}x)`)
    .join('\n')

  if (!rawList) return res.json({ clusters: [] })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are analyzing trigger phrases from a mood journal. Group the following triggers into semantic clusters where triggers that mean the same thing are combined. Return ONLY a JSON array, no markdown, no explanation, just the raw JSON.

Each item in the array should have:
- "label": a short clean label for the cluster (2 to 4 words, lowercase)
- "count": total combined count across all triggers in the cluster
- "raw": an array of objects with "text" (the original trigger) and "count" (how many times it appeared)

Sort the array by count descending and return only the top 5 clusters. Here are the triggers:

${rawList}`
    }]
  })

  const text = message.content[0].text.replace(/```json|```/g, '').trim()
  const clusters = JSON.parse(text)

  await pool.query(`
    INSERT INTO trigger_clusters (user_id, range, clusters)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, range) DO UPDATE SET clusters = excluded.clusters, generated_at = NOW()
  `, [req.userId, range, JSON.stringify(clusters)])

  res.json({ clusters })
})

app.get('/ai/clusters', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM trigger_clusters WHERE user_id = $1',
    [req.userId]
  )
  const data = {}
  result.rows.forEach(row => {
    data[row.range] = { clusters: JSON.parse(row.clusters), generatedAt: row.generated_at }
  })
  res.json(data)
})

initDb().then(() => {
  app.listen(port, () => console.log(`server running on port ${port}`))
}).catch(err => {
  console.error('failed to initialize database', err)
  process.exit(1)
})