import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()
app.use('*', cors())

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const SESSION_TTL = 30 * 60 * 1000 // 30 minutes

// Map of user session cookies: username -> { cookies, timestamp }
const userSessions = new Map()

// Retrieve credentials or custom cookie from Request or Environment Variables
function getAuthContext(c) {
  const customCookie = c.req.header('x-otaku-cookie')
  if (customCookie) {
    return { type: 'cookie', cookie: customCookie }
  }

  const reqUsername = c.req.header('x-otaku-username')
  const reqPassword = c.req.header('x-otaku-password')

  const username = reqUsername || c.env?.OTAKU_USERNAME || (typeof process !== 'undefined' ? process.env?.OTAKU_USERNAME : '')
  const password = reqPassword || c.env?.OTAKU_PASSWORD || (typeof process !== 'undefined' ? process.env?.OTAKU_PASSWORD : '')

  return { type: 'credentials', username, password }
}

// Authenticate session with otaku-streamers.com
async function ensureSession(c) {
  const authCtx = getAuthContext(c)

  if (authCtx.type === 'cookie' && authCtx.cookie) {
    return authCtx.cookie
  }

  const { username, password } = authCtx

  if (!username || !password) {
    throw {
      status: 401,
      error: 'Authentication Required',
      message: 'No credentials provided. Please set OTAKU_USERNAME & OTAKU_PASSWORD environment variables or supply x-otaku-username and x-otaku-password headers.'
    }
  }

  const now = Date.now()
  const cached = userSessions.get(username)

  if (cached && (now - cached.timestamp < SESSION_TTL)) {
    return cached.cookies
  }

  console.log(`[Auth] Authenticating user '${username}' on otaku-streamers.com...`)
  const bodyData = new URLSearchParams({
    username,
    password,
    remember: '1',
    redirect: '/'
  })

  const res = await fetch('https://otaku-streamers.com/login', {
    method: 'POST',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://otaku-streamers.com',
      'Referer': 'https://otaku-streamers.com/login'
    },
    body: bodyData.toString(),
    redirect: 'manual'
  })

  const rawHeader = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')]
  const cookiePairs = []
  
  if (Array.isArray(rawHeader)) {
    for (const cItem of rawHeader) {
      if (cItem) {
        const pair = cItem.split(';')[0]
        if (pair) cookiePairs.push(pair)
      }
    }
  } else if (rawHeader) {
    const pair = rawHeader.split(';')[0]
    if (pair) cookiePairs.push(pair)
  }

  const cookies = cookiePairs.join('; ')
  userSessions.set(username, { cookies, timestamp: now })
  console.log(`[Auth] User '${username}' authenticated successfully!`)
  return cookies
}

// Dynamically resolve exact anime title name from numeric OSID using op=fl
async function resolveTitleByOsid(c, osid) {
  const cookies = await ensureSession(c)
  const bodyData = new URLSearchParams({ op: 'fl', osid: String(osid) })

  const res = await fetch('https://otaku-streamers.com/a.php', {
    method: 'POST',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
      'Origin': 'https://otaku-streamers.com',
      'Referer': 'https://otaku-streamers.com/'
    },
    body: bodyData.toString()
  })

  if (!res.ok) return null
  const data = await res.json()
  const contentStr = data.content || ''
  const match = contentStr.match(/(?:added|removed)\s+([^\n]+?)\s+(?:to|from)\s+your/i)
  return match ? match[1].trim() : null
}

// 1. Search Titles API
async function searchTitles(c, query) {
  if (!query) {
    throw { status: 400, error: 'Missing Query', message: 'Please specify search query using ?q=...' }
  }

  const cookies = await ensureSession(c)
  const bodyData = new URLSearchParams({ op: 'title_search', q: query })

  const res = await fetch('https://otaku-streamers.com/a.php', {
    method: 'POST',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
      'Origin': 'https://otaku-streamers.com',
      'Referer': 'https://otaku-streamers.com/'
    },
    body: bodyData.toString()
  })

  if (!res.ok) {
    throw { status: res.status, error: 'Search Failed', message: `Failed to search otaku-streamers.com (HTTP ${res.status}).` }
  }

  const data = await res.json()
  const results = (data && data.content && Array.isArray(data.content)) ? data.content : []

  const formattedResults = results.map(item => ({
    osid: item.osid,
    title: item.title,
    type: item.type || 'Series',
    year: item.year || null,
    cover: item.cover || null,
    watch_url: item.url || null,
    episodes_api: `/api/episodes?osid=${item.osid}`,
    stream_api: `/api/stream?osid=${item.osid}&ep=1`
  }))

  return {
    status: 'success',
    query,
    results_count: formattedResults.length,
    results: formattedResults
  }
}

// 2. Extract Page & Parse Episode Links
async function parseWatchPage(c, urlInput) {
  let fullUrl = urlInput.trim()
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = 'https://otaku-streamers.com' + (fullUrl.startsWith('/') ? '' : '/') + fullUrl
  }

  let parsedUrl
  try { parsedUrl = new URL(fullUrl) } catch {
    throw { status: 400, error: 'Invalid URL', message: 'The provided input is not a valid URL.' }
  }

  const cookies = await ensureSession(c)
  const res = await fetch(parsedUrl.href, {
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Cookie': cookies,
      'Referer': 'https://otaku-streamers.com/anime'
    }
  })

  if (!res.ok) {
    throw { status: res.status, error: 'Page Fetch Failed', message: `Failed to fetch signed watch page (HTTP ${res.status}).` }
  }

  const html = await res.text()

  // Direct MP4 Stream Link Regex
  const streamMatch = html.match(/https?:\/\/vid\d*\.otaku-streamers\.com\/s\/[^\s"\'<>]+\.mp4/i)
  const streamUrl = streamMatch ? streamMatch[0] : null

  // Title Regex
  const titleMatch = html.match(/<h1[^>]*class=["\'][^"\']*tp-title[^"\']*["\'][^>]*>([^<]+)<\/h1>/i) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const title = titleMatch ? titleMatch[1].trim() : 'Anime Title'

  // Extract all episode links with episode numbers
  const epMatches = html.match(/<a[^>]+href=["\'](https?:\/\/otaku-streamers\.com)?(\/g\/[^"'\s]+)["\'][^>]*>([\s\S]*?)<\/a>/gi) || []
  
  const episodesList = []
  const seenEps = new Set()

  for (const item of epMatches) {
    const pathMatch = item.match(/href=["'](https?:\/\/otaku-streamers\.com)?(\/g\/[^"'\s]+)["']/i)
    if (pathMatch) {
      const gPath = pathMatch[2]
      const fullGUrl = `https://otaku-streamers.com${gPath}`
      const cleanInner = item.replace(/<[^>]+>/g, ' ').trim()
      const numMatch = cleanInner.match(/(?:Ep(?:isode)?\s*|#\s*)(\d+)/i)
      
      if (numMatch) {
        const epNum = parseInt(numMatch[1], 10)
        if (!seenEps.has(epNum)) {
          seenEps.add(epNum)
          episodesList.push({
            episode: epNum,
            title: `Episode ${epNum}`,
            watch_url: fullGUrl,
            stream_api: `/api/stream?url=${encodeURIComponent(fullGUrl)}`
          })
        }
      }
    }
  }

  episodesList.sort((a, b) => a.episode - b.episode)

  return {
    title,
    watch_url: parsedUrl.href,
    stream_url: streamUrl,
    episodes: episodesList
  }
}

// 3. Resolve Stream by OSID or Title Query and Episode Number
async function resolveStreamByOsidOrQuery(c, osid, query, targetEp = 1) {
  const epNum = parseInt(targetEp, 10) || 1
  let mainWatchUrl = null

  if (osid) {
    const titleName = await resolveTitleByOsid(c, osid)
    if (titleName) {
      const searchRes = await searchTitles(c, titleName)
      if (searchRes.results && searchRes.results.length > 0) {
        const exactMatch = searchRes.results.find(r => r.osid === parseInt(osid, 10))
        mainWatchUrl = exactMatch ? exactMatch.watch_url : searchRes.results[0].watch_url
      }
    }
  } else if (query) {
    const searchRes = await searchTitles(c, query)
    if (searchRes.results && searchRes.results.length > 0) {
      mainWatchUrl = searchRes.results[0].watch_url
    }
  }

  if (!mainWatchUrl) {
    throw { status: 404, error: 'Anime Not Found', message: `Could not find anime for OSID/query '${osid || query}'.` }
  }

  const basePage = await parseWatchPage(c, mainWatchUrl)
  const episodesMap = new Map()

  basePage.episodes.forEach(e => {
    episodesMap.set(e.episode, e.watch_url)
  })

  const targetWatchUrl = episodesMap.get(epNum) || mainWatchUrl
  const targetPage = await parseWatchPage(c, targetWatchUrl)

  const formattedEpisodes = Array.from(episodesMap.entries()).map(([num, watchUrl]) => ({
    episode: num,
    title: `Episode ${num}`,
    stream_url_api: osid ? `/api/stream?osid=${osid}&ep=${num}` : `/api/stream?q=${encodeURIComponent(query)}&ep=${num}`,
    watch_url: watchUrl
  })).sort((a, b) => a.episode - b.episode)

  return {
    status: 'success',
    title: targetPage.title,
    episode: epNum,
    stream_url: targetPage.stream_url,
    watch_url: targetWatchUrl,
    total_episodes: formattedEpisodes.length,
    episodes: formattedEpisodes
  }
}

// -----------------------------------------------------------------------------
// REST ENDPOINTS
// -----------------------------------------------------------------------------

// 1. MP4 Stream Endpoint: GET /api/stream
app.get('/api/stream', async (c) => {
  const url = c.req.query('url') || c.req.query('link')
  const osid = c.req.query('osid') || c.req.query('id')
  const query = c.req.query('q') || c.req.query('query')
  const ep = c.req.query('ep') || c.req.query('episode') || '1'

  try {
    if (url) {
      const pageData = await parseWatchPage(c, url)
      return c.json({
        status: 'success',
        title: pageData.title,
        stream_url: pageData.stream_url,
        watch_url: pageData.watch_url,
        total_episodes_found: pageData.episodes.length,
        episodes: pageData.episodes
      })
    } else if (osid || query) {
      const data = await resolveStreamByOsidOrQuery(c, osid, query, ep)
      return c.json(data)
    } else {
      throw {
        status: 400,
        error: 'Missing Parameter',
        message: 'Please specify how to fetch stream. Example: /api/stream?osid=1042&ep=1 OR /api/stream?q=To%20Love-Ru&ep=1'
      }
    }
  } catch (err) {
    return c.json({ status: 'error', error: err.error || 'Stream Error', message: err.message || 'Failed to resolve stream' }, err.status || 500)
  }
})

// 2. Search Endpoint: GET /api/search
app.get('/api/search', async (c) => {
  const query = c.req.query('q') || c.req.query('query')
  try {
    const data = await searchTitles(c, query)
    return c.json(data)
  } catch (err) {
    return c.json({ status: 'error', error: err.error || 'Search Error', message: err.message || 'Failed to search' }, err.status || 500)
  }
})

// 3. Episodes Catalog Endpoint: GET /api/episodes
app.get('/api/episodes', async (c) => {
  const osid = c.req.query('osid') || c.req.query('id')
  const query = c.req.query('q') || c.req.query('query')

  try {
    if (!osid && !query) {
      throw { status: 400, error: 'Missing Parameter', message: 'Please specify ?osid=1042 OR ?q=To%20Love-Ru' }
    }
    const data = await resolveStreamByOsidOrQuery(c, osid, query, 1)
    return c.json({
      status: 'success',
      title: data.title,
      total_episodes: data.total_episodes,
      episodes: data.episodes
    })
  } catch (err) {
    return c.json({ status: 'error', error: err.error || 'Episodes Error', message: err.message || 'Failed to get episodes' }, err.status || 500)
  }
})

// Health Check
app.get('/api/health', (c) => {
  const authCtx = getAuthContext(c)
  return c.json({
    status: 'ok',
    service: 'Otaku-Streamers API',
    auth_mode: authCtx.type,
    authenticated_user: authCtx.username || (authCtx.type === 'cookie' ? 'custom-session-cookie' : 'none'),
    timestamp: new Date().toISOString()
  })
})

// Complete Interactive Playground & Full API Documentation UI
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Otaku-Streamers API — Environment & Custom Auth</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #090a0f;
      --bg-card: #12141d;
      --accent: #e60000;
      --accent-glow: rgba(230, 0, 0, 0.25);
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --border: rgba(255, 255, 255, 0.08);
      --code-bg: #050608;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg-dark);
      color: var(--text-main);
      padding: 40px 20px;
      line-height: 1.6;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(230, 0, 0, 0.15);
      border: 1px solid rgba(230, 0, 0, 0.3);
      color: #ff4d4d;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 12px;
    }
    h1 { font-size: 2.2rem; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.5px; }
    p.subtitle { color: var(--text-muted); font-size: 1.05rem; margin-bottom: 30px; }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 30px;
    }
    .form-group { margin-bottom: 16px; }
    .form-row { display: flex; gap: 12px; }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }
    input[type="text"], input[type="password"] {
      width: 100%;
      background: var(--code-bg);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 12px 16px;
      border-radius: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      outline: none;
    }
    input[type="text"]:focus, input[type="password"]:focus { border-color: var(--accent); }
    .btn {
      background: linear-gradient(135deg, #e60000 0%, #b30000 100%);
      color: #ffffff;
      border: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.95rem;
      white-space: nowrap;
    }
    .btn:hover { opacity: 0.9; }
    .result-box {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: #38bdf8;
      white-space: pre-wrap;
      word-break: break-all;
      margin-top: 16px;
      display: none;
      max-height: 450px;
      overflow-y: auto;
    }
    .video-preview {
      width: 100%;
      max-height: 480px;
      border-radius: 12px;
      margin-top: 16px;
      background: #000;
      display: none;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
    th { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; }
    code { font-family: 'JetBrains Mono', monospace; background: var(--code-bg); padding: 2px 6px; border-radius: 6px; color: #ff4d4d; font-size: 0.85rem; }
    .method { background: rgba(230,0,0,0.2); color: #ff4d4d; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">SECURE ENVIRONMENT & USER AUTH API</div>
    <h1>Otaku-Streamers API</h1>
    <p class="subtitle">Direct MP4 Video Stream Extractor with Custom User Authentication & Env Secrets Support.</p>

    <!-- LIVE TESTER CARD -->
    <div class="card">
      <h3 style="margin-bottom: 16px;">🎬 Live MP4 Stream Extractor</h3>
      
      <div class="form-row" style="margin-bottom: 12px;">
        <div style="flex: 2;" class="form-group">
          <label>Anime OSID / Title Query</label>
          <input type="text" id="test-query" value="1042" placeholder="e.g. 1042 OR To Love-Ru">
        </div>
        <div style="flex: 1;" class="form-group">
          <label>Episode Number (ep)</label>
          <input type="text" id="test-ep" value="1" placeholder="1">
        </div>
      </div>

      <div class="form-row" style="margin-bottom: 16px;">
        <div style="flex: 1;" class="form-group">
          <label>Custom Username Header (x-otaku-username, optional)</label>
          <input type="text" id="custom-user" placeholder="Defaults to ENV">
        </div>
        <div style="flex: 1;" class="form-group">
          <label>Custom Password Header (x-otaku-password, optional)</label>
          <input type="password" id="custom-pass" placeholder="Defaults to ENV">
        </div>
      </div>

      <button class="btn" onclick="testStreamApi()">Get MP4 Stream</button>

      <div class="result-box" id="result-box"></div>
      <video id="video-preview" controls class="video-preview"></video>
    </div>

    <!-- DOCUMENTATION CARD -->
    <div class="card">
      <h3 style="margin-bottom: 20px;">🔐 Environment Variables & Request Headers</h3>
      
      <h4>Option A: Cloudflare Worker Environment Variables</h4>
      <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 16px;">Set your account credentials securely in Cloudflare Workers using secrets:</p>
      <pre style="background: var(--code-bg); padding: 12px; border-radius: 8px; font-family: 'JetBrains Mono'; font-size: 0.85rem; color: #ff4d4d;">npx wrangler secret put OTAKU_USERNAME
npx wrangler secret put OTAKU_PASSWORD</pre>

      <h4 style="margin-top: 24px;">Option B: Request Headers (Pass your own login)</h4>
      <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 12px;">Users can supply their own login credentials in any HTTP request header:</p>
      <table>
        <thead>
          <tr>
            <th>Header Name</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>x-otaku-username</code></td>
            <td>String</td>
            <td>User's otaku-streamers.com email/username</td>
          </tr>
          <tr>
            <td><code>x-otaku-password</code></td>
            <td>String</td>
            <td>User's otaku-streamers.com password</td>
          </tr>
          <tr>
            <td><code>x-otaku-cookie</code></td>
            <td>String</td>
            <td>Direct session cookie string (bypasses login)</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    async function testStreamApi() {
      const q = document.getElementById('test-query').value.trim();
      const ep = document.getElementById('test-ep').value.trim() || '1';
      const user = document.getElementById('custom-user').value.trim();
      const pass = document.getElementById('custom-pass').value.trim();

      const resBox = document.getElementById('result-box');
      const vid = document.getElementById('video-preview');

      resBox.style.display = 'block';
      vid.style.display = 'none';
      resBox.innerText = 'Resolving direct MP4 video stream...';

      try {
        let fetchUrl = '';
        if (q.startsWith('http://') || q.startsWith('https://')) {
          fetchUrl = '/api/stream?url=' + encodeURIComponent(q);
        } else if (/^\\d+$/.test(q)) {
          fetchUrl = '/api/stream?osid=' + q + '&ep=' + ep;
        } else {
          fetchUrl = '/api/stream?q=' + encodeURIComponent(q) + '&ep=' + ep;
        }

        const headers = {};
        if (user) headers['x-otaku-username'] = user;
        if (pass) headers['x-otaku-password'] = pass;

        const res = await fetch(fetchUrl, { headers });
        const data = await res.json();
        resBox.innerText = JSON.stringify(data, null, 2);

        if (data.stream_url) {
          vid.src = data.stream_url;
          vid.style.display = 'block';
        }
      } catch (err) {
        resBox.innerText = '// Error: ' + err.message;
      }
    }
  </script>
</body>
</html>`)
})

export default app
