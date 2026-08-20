# Otaku-Streamers API (`D:\Otaku-streamers api`)

⚡ **Automated Session API** for searching anime titles, listing episode catalogs, extracting signed `/g/` watch URLs, and resolving **direct `.mp4` video streaming links** (`https://vid17.otaku-streamers.com/s/....mp4`) from `otaku-streamers.com`!

---

## 🌐 Live Cloudflare Workers Endpoint
👉 **`https://otaku-streamers-api.premmiz-real.workers.dev`**

---

## 📌 Features

- 🔐 **Auto-Authentication & Custom User Auth**: Automatically authenticates session using environment variables (`OTAKU_USERNAME` / `OTAKU_PASSWORD`) or custom request headers (`x-otaku-username`, `x-otaku-password`, `x-otaku-cookie`) so users can log in with their own account!
- 🎬 **Direct MP4 Stream Extractor**: Resolves direct high-speed video `.mp4` streaming links for ANY episode by OSID, title query, or `/g/{blob}` watch URL.
- 🔢 **Episode Mapping**: Maps every episode number to its direct MP4 stream API.
- 🔍 **Title Search API**: Fast JSON title search returning anime IDs (`osid`), title names, categories, release years, cover posters, and watch links.

---

## 🔑 Authentication Options

### Option A: Environment Variables (Default)
Set environment variables in Cloudflare Workers or local `.env`:
- `OTAKU_USERNAME`: `your_email@gmail.com`
- `OTAKU_PASSWORD`: `your_password`

### Option B: Custom Request Headers (User Self-Login)
Users calling your API can supply their own credentials directly in request headers:
- `x-otaku-username`: `user@example.com`
- `x-otaku-password`: `user_password`
- `x-otaku-cookie`: `bb_betasessionhash=...` (direct session cookie, bypasses login)

---

## 📡 Exhaustive API Endpoint Reference

### 1. 🎬 Get Direct MP4 Stream (`/api/stream`)
Resolves the direct high-speed `.mp4` video streaming URL for any episode.

- **Method**: `GET`
- **Route**: `/api/stream`
- **Query Parameters**:

| Parameter | Type | Required | Description | Example |
|---|---|---|---|---|
| `osid` | integer/string | Optional* | Anime OSID | `1042` |
| `ep` | integer | Optional | Episode number (default `1`) | `1`, `2`, `500` |
| `q` | string | Optional* | Anime title search query | `To Love-Ru` |
| `url` | string | Optional* | Signed `/g/{blob}` watch page URL | `https://otaku-streamers.com/g/...` |

*\*Specify at least one of `osid`, `q`, or `url`.*

#### 🌟 Example Requests:
- **By OSID & Episode**:  
  `GET https://otaku-streamers-api.premmiz-real.workers.dev/api/stream?osid=1042&ep=1`
- **By Title Query & Episode**:  
  `GET https://otaku-streamers-api.premmiz-real.workers.dev/api/stream?q=To%20Love-Ru&ep=2`
- **By Watch URL**:  
  `GET https://otaku-streamers-api.premmiz-real.workers.dev/api/stream?url=https://otaku-streamers.com/g/aqVKDO0md...`

#### 📦 Response (`200 OK`):
```json
{
  "status": "success",
  "title": "To Love-Ru",
  "episode": 1,
  "stream_url": "https://vid17.otaku-streamers.com/s/h39xg1JsOV7Icy_PdGsHpBlfP0EW3rS9AKAEl7UGLgXkHH0oc_s7d53eMYkEfz4ffcbUCkv7tEGJXbLiovzptK9DUcwI-zY-lZtCCVcN1gv6G_dwvMfAfIVMhnlzYC21.mp4",
  "watch_url": "https://otaku-streamers.com/g/aqVKDO0md-VrsEy_daPaVv9x...",
  "total_episodes": 26,
  "episodes": [
    {
      "episode": 1,
      "title": "Episode 1",
      "stream_url_api": "/api/stream?osid=1042&ep=1",
      "watch_url": "https://otaku-streamers.com/g/aqVKDO0md-VrsEy..."
    },
    {
      "episode": 2,
      "title": "Episode 2",
      "stream_url_api": "/api/stream?osid=1042&ep=2",
      "watch_url": "https://otaku-streamers.com/g/nWyzAroHYhPEbU..."
    }
  ]
}
```

---

### 2. 🔍 Search Anime Titles (`/api/search`)
Search anime titles on `otaku-streamers.com`.

- **Method**: `GET`
- **Route**: `/api/search`
- **Query Parameters**:

| Parameter | Type | Required | Description | Example |
|---|---|---|---|---|
| `q` | string | **Required** | Search keyword | `Naruto` |

#### 🌟 Example Request:
`GET https://otaku-streamers-api.premmiz-real.workers.dev/api/search?q=Naruto`

#### 📦 Response (`200 OK`):
```json
{
  "status": "success",
  "query": "Naruto",
  "results_count": 8,
  "results": [
    {
      "osid": 959,
      "title": "Naruto Shippuuden",
      "type": "Series",
      "year": 2007,
      "cover": "https://otaku-streamers.com/aniencyclopedia/images/65ap20081017224238.jpg",
      "watch_url": "https://otaku-streamers.com/g/3sSLa_9WzLf...",
      "episodes_api": "/api/episodes?osid=959",
      "stream_api": "/api/stream?osid=959&ep=1"
    }
  ]
}
```

---

### 3. 📺 Get Anime Episode List (`/api/episodes`)
Retrieves the full mapped list of episode numbers and titles for an anime.

- **Method**: `GET`
- **Route**: `/api/episodes`
- **Query Parameters**:

| Parameter | Type | Required | Description | Example |
|---|---|---|---|---|
| `osid` | integer/string | Optional* | Anime OSID | `1042` |
| `q` | string | Optional* | Anime title query | `To Love-Ru` |

*\*Specify either `osid` or `q`.*

#### 🌟 Example Request:
`GET https://otaku-streamers-api.premmiz-real.workers.dev/api/episodes?osid=1042`

#### 📦 Response (`200 OK`):
```json
{
  "status": "success",
  "title": "To Love-Ru",
  "total_episodes": 26,
  "episodes": [
    {
      "episode": 1,
      "title": "Episode 1",
      "stream_url_api": "/api/stream?osid=1042&ep=1",
      "watch_url": "https://otaku-streamers.com/g/aqVKDO0md..."
    },
    {
      "episode": 2,
      "title": "Episode 2",
      "stream_url_api": "/api/stream?osid=1042&ep=2",
      "watch_url": "https://otaku-streamers.com/g/nWyzAroHY..."
    }
  ]
}
```

---

### 4. 📄 Extract Signed Watch Page (`/api/extract`)
Parses a signed `/g/{blob}` watch URL and extracts the title, direct MP4 stream URL, and episode navigation.

- **Method**: `GET`
- **Route**: `/api/extract`
- **Query Parameters**:

| Parameter | Type | Required | Description | Example |
|---|---|---|---|---|
| `url` | string | **Required** | Signed `/g/{blob}` watch page URL | `https://otaku-streamers.com/g/...` |

#### 🌟 Example Request:
`GET https://otaku-streamers-api.premmiz-real.workers.dev/api/extract?url=https://otaku-streamers.com/g/aqVKDO0md...`

#### 📦 Response (`200 OK`):
```json
{
  "status": "success",
  "domain": "otaku-streamers.com",
  "watch_url": "https://otaku-streamers.com/g/aqVKDO0md...",
  "title": "To Love-Ru",
  "current_episode": 1,
  "stream_url": "https://vid17.otaku-streamers.com/s/h39xg1JsOV7Icy...mp4",
  "total_episodes_found": 26,
  "episodes": [
    {
      "episode": 1,
      "title": "Episode 1",
      "watch_url": "https://otaku-streamers.com/g/aqVKDO0md...",
      "stream_api": "/api/stream?url=https%3A%2F%2Fotaku-streamers.com%2Fg%2FaqVKDO0md..."
    }
  ]
}
```

---

### 5. 🏥 Health Check (`/api/health`)
Verifies server health and active authentication session.

- **Method**: `GET`
- **Route**: `/api/health`

#### 🌟 Example Request:
`GET https://otaku-streamers-api.premmiz-real.workers.dev/api/health`

#### 📦 Response (`200 OK`):
```json
{
  "status": "ok",
  "service": "Otaku-Streamers API",
  "auth_mode": "credentials",
  "authenticated_user": "premmiz.real@gmail.com",
  "timestamp": "2026-08-20T04:45:04.923Z"
}
```

---

### 6. 🖥️ Interactive Web UI (`/`)
Visit `https://otaku-streamers-api.premmiz-real.workers.dev/` in your browser to try out the live video player & MP4 link extractor UI.

---

## 🛠️ How to Run & Deploy

### Local Execution:
```bash
cd "D:\Otaku-streamers api"
npm start
```
Server runs locally on **`http://localhost:8800`**.

### Deploy to Cloudflare Workers:
```bash
npx wrangler deploy
```
