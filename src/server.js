import { serve } from '@hono/node-server'
import app from './index.js'
import fs from 'fs'
import path from 'path'

// Load .env file for local development if available
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8')
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=')
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim()
        const val = trimmed.slice(idx + 1).trim()
        process.env[key] = val
      }
    }
  })
}

const port = 8800
console.log(`[Server] Otaku-Streamers API running locally on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
