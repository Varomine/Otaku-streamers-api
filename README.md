# Otaku-Streamers API (`D:\Otaku-streamers api`)

⚡ **Automated Session API** for searching anime titles, listing episode catalogs, and resolving **direct `.mp4` video streaming links** (`https://vid17.otaku-streamers.com/s/....mp4`) from `otaku-streamers.com`!

---

## 📌 Features

- 🔐 **Secure Environment & Custom User Auth**: Supports `OTAKU_USERNAME` & `OTAKU_PASSWORD` environment variables or custom request headers (`x-otaku-username`, `x-otaku-password`, `x-otaku-cookie`) so users can log in with their own account!
- 🎬 **Direct MP4 Stream Extractor**: Resolves direct high-speed video `.mp4` streaming links for ANY episode by OSID or title query (`ep=1`, `ep=2`, `ep=500`).
- 🔢 **Episode Mapping**: Maps every episode number to its direct MP4 stream API.
- 🔍 **Title Search API**: Fast JSON title search returning anime IDs (`osid`), title names, categories, release years, cover posters, and watch links.

---

## 🔐 How to Set Credentials

### Option A: Local Development (`.env` file)
Copy `.env.example` to `.env` and fill in your credentials:
```env
OTAKU_USERNAME=your_email@gmail.com
OTAKU_PASSWORD=your_password
```

### Option B: Cloudflare Workers Secrets
Set environment secrets in Cloudflare Workers using Wrangler:
```bash
npx wrangler secret put OTAKU_USERNAME
npx wrangler secret put OTAKU_PASSWORD
```

### Option C: Pass Custom Credentials per Request
Users can pass their own credentials in request headers:
- `x-otaku-username: user@example.com`
- `x-otaku-password: user_password`
- `x-otaku-cookie: bb_betasessionhash=...` (direct session cookie)

---

## 📡 API Reference

### 1. 🎬 Get Direct MP4 Video Stream (`/api/stream`)

```http
GET /api/stream?osid=1042&ep=1
```
- **With Custom User Headers**:
  - `x-otaku-username: user@example.com`
  - `x-otaku-password: user_password`

#### 📦 JSON Response:
```json
{
  "status": "success",
  "title": "To Love-Ru",
  "episode": 1,
  "stream_url": "https://vid17.otaku-streamers.com/s/h39xg1JsOV7Icy_PdGsHpBlfP0EW3rS9AKAEl7UGLgXkHH0oc_s7d53eMYkEfz4ffcbUCkv7tEGJXbLiovzptK9DUcwI-zY-lZtCCVcN1gv6G_dwvMfAfIVMhnlzYC21.mp4",
  "watch_url": "https://otaku-streamers.com/g/aqVKDO0md-VrsEy_daPaVv9x..."
}
```

---

## 🛠️ How to Run

```bash
cd "D:\Otaku-streamers api"
npm start
```
Server runs on **`http://localhost:8800`**.
Visit `http://localhost:8800` in browser to test streams live.
