# FlixFox Proxy API

Auth-free proxy for the [FlixFox](https://flixfoxmovies.com) streaming platform API. Extracts decoded data from the protected/whitelabeled FlixFox API and serves it without authentication. Auto-updates with real FlixFox data every 5 minutes.

## Major Routes

### Config
| Route | Description |
|-------|-------------|
| `GET /config` | Full domain configuration (logo, theme, SEO, Google keys, etc.) |
| `GET /config/app` | App download info (APK URL, version, size) |
| `GET /config/app/data` | App data by channel code |
| `GET /config/languages` | Supported languages (English, Hindi, Telugu, Tamil, Malayalam) |

### Blog / Content (Movies, Sports, Series, etc.)
| Route | Description |
|-------|-------------|
| `GET /blogs` | Paginated blog posts (movies, sports, series articles). Params: `page`, `size`, `language` |
| `GET /blogs/trending` | Trending blog posts across all categories |
| `GET /blogs/recommendations/{blog_id}` | Recommended blogs for a given blog post |
| `GET /blogs/category/{category_id}` | Blog posts filtered by category (movies, sports, series, etc.) |
| `GET /blogs/{page_url}` | Single blog post by URL slug |

### Pages
| Route | Description |
|-------|-------------|
| `GET /pages/meta/{page_type}` | Page metadata (home, download, about, blog, etc.) |
| `GET /pages/meta` | Multiple page metadata at once. Param: `types` (comma-separated) |
| `GET /pages/faq/{faq_type}` | FAQ list by type (download, general, etc.) |
| `GET /pages/agreement/{agreement_type}` | Legal agreements (privacy, terms) |
| `GET /pages/article/{article_type}` | Lite articles (about, etc.) |
| `GET /pages/category/{code}` | Category data by code |

### SEO
| Route | Description |
|-------|-------------|
| `GET /seo/sitemap` | Full sitemap data |
| `GET /seo/sitemap/blogs` | Blog sitemap entries |
| `GET /seo/sitemap/blogs-by-domain` | Blog sitemap by domain (paginated) |
| `GET /seo/sitemap/blog-pages` | Blog pages sitemap |
| `GET /seo/schema/{route_name}` | Schema.org structured data for a route |
| `GET /seo/tdk/{route_name}` | Title/Description/Keywords for a route |

### Internationalization (i18n)
| Route | Description |
|-------|-------------|
| `GET /i18n/{page_names}` | Translation strings for page(s). Comma-separated page names. Param: `language` |

### Raw Proxy (access any upstream endpoint directly)
| Route | Description |
|-------|-------------|
| `GET /proxy/flixfox/{path}` | Raw proxy to `api.flixfox.app` - pass any query params |
| `GET /proxy/movies/{path}` | Raw proxy to movie API (`api.hbzws.com`) - pass any query params |

### Cache Management
| Route | Description |
|-------|-------------|
| `GET /cache/status` | Cache statistics (entries, TTL, age) |
| `POST /cache/refresh` | Force refresh all cached data |
| `POST /cache/clear` | Clear all cached data |

### Meta
| Route | Description |
|-------|-------------|
| `GET /` | API info with all available routes |
| `GET /routes` | List all routes with descriptions |
| `GET /healthz` | Health check |
| `GET /docs` | Interactive Swagger UI documentation |
| `GET /redoc` | ReDoc API documentation |

## Features

- **Auth-free**: No API keys or tokens needed. All FlixFox auth is handled internally
- **Auto-updating**: Background task refreshes popular data every 5 minutes
- **In-memory cache**: 5-minute TTL cache reduces upstream calls
- **Response unwrapping**: Converts FlixFox format `{code, datas, message}` to just the `datas` payload
- **Error handling**: Graceful handling of upstream redirects, timeouts, and empty responses
- **CORS enabled**: Access from any origin

## Deployment

### Vercel (recommended)
1. Connect this repo to Vercel
2. It auto-detects `vercel.json` and deploys the Python serverless function
3. All routes are served from `api/index.py`

### Railway
1. Connect this repo to Railway
2. It auto-detects `railway.json` and uses Nixpacks to build
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Render
1. Connect this repo to Render
2. It auto-detects `render.yaml`
3. Creates a web service with health checks

### Docker
```bash
docker build -t flixfox-proxy .
docker run -p 8000:8000 flixfox-proxy
```

### Heroku
```bash
heroku create
git push heroku main
```
Uses the `Procfile` automatically.

### Local Development
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Or with Poetry:
```bash
poetry install
poetry run fastapi dev app/main.py --port 8000
```

Then visit `http://localhost:8000/docs` for interactive API docs.

## Supported Languages
- `en_US` - English (default)
- `hi-IN` - Hindi
- `te-IN` - Telugu
- `ta-IN` - Tamil
- `ml-IN` - Malayalam

Pass `?language=hi-IN` to any route to get data in that language.

## Upstream APIs
- **FlixFox CMS**: `https://api.flixfox.app` (channelId=100, domain=flixfoxmovies.com)
- **Movie API**: `https://api.hbzws.com`
