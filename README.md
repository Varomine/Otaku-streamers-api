# Otaku-Streamers API (`D:\Otaku-streamers api`)

⚡ **Automated Session API** for searching anime titles, listing episode catalogs, and resolving **direct `.mp4` video streaming links** (`https://vid17.otaku-streamers.com/s/....mp4`) for ANY episode from `otaku-streamers.com`!

---

## 📌 Features

- 🔐 **Auto-Authentication**: Automatically logs into `otaku-streamers.com` using the account credentials (`premmiz.real@gmail.com` / `realneko`) and preserves session cookies (`bb_betasessionhash`, `bb_betaremember`).
- 🎬 **Direct MP4 Stream Extractor**: Resolves direct high-speed video `.mp4` streaming links (e.g., `https://vid17.otaku-streamers.com/s/...mp4`) for ANY episode by episode number (`ep=1`, `ep=2`, `ep=500`).
- 🔢 **Episode Mapping**: Maps every single episode number to its direct MP4 stream API.
- 🔍 **Title Search API**: Fast JSON title search returning anime IDs (`osid`), title names, categories, release years, cover posters, and watch links.

---

## 📡 Complete API Reference

### 1. 🎬 Get Direct MP4 Video Stream (`/api/stream`)

Fetch the direct `.mp4` video streaming link for ANY episode!

#### Method & Parameters:
`GET /api/stream`

| Parameter | Type | Required | Description | Example |
|---|---|---|---|---|
| `osid` | integer | Optional | Anime OSID | `959` |
| `ep` | integer | Optional | Episode number (default `1`) | `1`, `2`, `500` |
| `q` | string | Optional | Anime title query | `Naruto Shippuuden` |
| `url` | string | Optional | Full `/g/{blob}` watch URL | `https://otaku-streamers.com/g/...` |

#### 🌟 Example Requests:
- **Get Episode 1 MP4 Stream by OSID**:  
  `GET http://localhost:8800/api/stream?osid=959&ep=1`
- **Get Episode 2 MP4 Stream by OSID**:  
  `GET http://localhost:8800/api/stream?osid=959&ep=2`
- **Get Episode 500 MP4 Stream by OSID**:  
  `GET http://localhost:8800/api/stream?osid=959&ep=500`
- **Get Episode 1 MP4 Stream by Title Query**:  
  `GET http://localhost:8800/api/stream?q=Naruto&ep=1`

#### 📦 JSON Response:
```json
{
  "status": "success",
  "title": "Naruto Shippuuden",
  "episode": 1,
  "stream_url": "https://vid17.otaku-streamers.com/s/P06n7IX54qqI0Loa9vFP_BvEYCkWn93ltx_s5mSsSgL0DL67MEBhltZSD7uo2oSgbOGirGXZhwaqisF7_XeyWCYjPtOLnKNunBCLi0kxo3M34qvxf-x6xYxlGxoEPjg.mp4",
  "watch_url": "https://otaku-streamers.com/g/69QTgUfFcS4n...",
  "total_episodes": 500,
  "episodes": [
    {
      "episode": 1,
      "title": "Episode 1",
      "stream_url_api": "/api/stream?osid=959&ep=1",
      "watch_url": "https://otaku-streamers.com/g/69QTgUfFcS4n..."
    },
    {
      "episode": 2,
      "title": "Episode 2",
      "stream_url_api": "/api/stream?osid=959&ep=2",
      "watch_url": "https://otaku-streamers.com/g/G2ep3GObtBHS..."
    }
  ]
}
```

---

### 2. 🔍 Search Anime Titles (`/api/search`)

```http
GET http://localhost:8800/api/search?q={query}
```

#### 🌟 Example Request:
`GET http://localhost:8800/api/search?q=Naruto`

#### 📦 JSON Response:
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
      "episodes_api": "/api/episodes?osid=959",
      "stream_api": "/api/stream?osid=959&ep=1"
    }
  ]
}
```

---

### 3. 📺 Get Anime Episode List (`/api/episodes`)

```http
GET http://localhost:8800/api/episodes?osid={osid}
```

#### 🌟 Example Request:
`GET http://localhost:8800/api/episodes?osid=959`

---

## 🛠️ How to Run

```bash
cd "D:\Otaku-streamers api"
npm start
```
Server runs on **`http://localhost:8800`**.
Visit `http://localhost:8800` in browser to test streams live.
