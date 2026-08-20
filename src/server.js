import { serve } from '@hono/node-server'
import app from './index.js'

const port = 8800
console.log(`[Server] Otaku-Streamers API running locally on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
