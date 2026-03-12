import asyncio
import time
import logging
from contextlib import asynccontextmanager
from typing import Any, Optional

import httpx
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger("flixfox_proxy")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
FLIXFOX_API = "https://api.flixfox.app"
MOVIE_API = "https://api.hbzws.com"
CHANNEL_ID = "100"
DOMAIN = "flixfoxmovies.com"
DEFAULT_LANG = "en_US"
CACHE_TTL = 300  # 5 minutes default cache TTL

# ---------------------------------------------------------------------------
# In-memory cache
# ---------------------------------------------------------------------------
_cache: dict[str, dict[str, Any]] = {}


def cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < entry["ttl"]:
        return entry["data"]
    return None


def cache_set(key: str, data: Any, ttl: int = CACHE_TTL) -> None:
    _cache[key] = {"data": data, "ts": time.time(), "ttl": ttl}


# ---------------------------------------------------------------------------
# HTTP client helpers
# ---------------------------------------------------------------------------
_client: httpx.AsyncClient | None = None


async def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0, follow_redirects=False)
    return _client


async def fetch_json(url: str, params: dict | None = None) -> dict:
    """Fetch JSON from upstream, return parsed dict or error dict."""
    try:
        client = await get_client()
        resp = await client.get(url, params=params)
        if resp.status_code == 302:
            return {"error": "upstream_redirect", "status": resp.status_code, "location": resp.headers.get("location", "")}
        if resp.status_code != 200:
            return {"error": "upstream_error", "status": resp.status_code, "body": resp.text[:500]}
        if not resp.text.strip():
            return {"error": "empty_response"}
        return resp.json()
    except Exception as exc:
        return {"error": str(exc)}


async def fetch_cached(cache_key: str, url: str, params: dict | None = None, ttl: int = CACHE_TTL) -> dict:
    """Return cached result or fetch from upstream."""
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    data = await fetch_json(url, params)
    if "error" not in data:
        cache_set(cache_key, data, ttl)
    return data


def unwrap(data: dict) -> Any:
    """Unwrap FlixFox standard response: {code, datas, message} -> datas or full."""
    if isinstance(data, dict) and "datas" in data:
        return data["datas"]
    return data


# ---------------------------------------------------------------------------
# Background refresh task
# ---------------------------------------------------------------------------
async def refresh_cache_once():
    """Pre-fetch popular endpoints to keep cache warm."""
    endpoints = [
        ("domain_config", f"{FLIXFOX_API}/open/domainConfig/get", {"name": DOMAIN}),
        ("languages", f"{FLIXFOX_API}/open/language/getList", {"channelId": CHANNEL_ID}),
        ("app_info", f"{FLIXFOX_API}/open/app/getAppInfo", {"channelId": CHANNEL_ID}),
        ("app_data", f"{FLIXFOX_API}/open/app/getData", {"channelCode": "flixfox"}),
        ("faq_download", f"{FLIXFOX_API}/open/faq/getList", {"type": "download", "channelId": CHANNEL_ID, "domain": DOMAIN}),
        ("blog_list_p1", f"{FLIXFOX_API}/open/blog/getList", {"domain": DOMAIN, "page": "1", "size": "20"}),
        ("agreement_privacy", f"{FLIXFOX_API}/open/agreement/getData", {"type": "privacy", "channelId": CHANNEL_ID}),
        ("agreement_terms", f"{FLIXFOX_API}/open/agreement/getData", {"type": "terms", "channelId": CHANNEL_ID}),
        ("sitemap", f"{FLIXFOX_API}/open/sitemap/getSitemap", {"channelId": CHANNEL_ID, "defaultLanguage": DEFAULT_LANG}),
        ("page_meta_home", f"{FLIXFOX_API}/open/pageMeta/get", {"type": "home", "channelId": CHANNEL_ID, "domain": DOMAIN}),
        ("page_meta_download", f"{FLIXFOX_API}/open/pageMeta/get", {"type": "download", "channelId": CHANNEL_ID, "domain": DOMAIN}),
    ]
    for key, url, params in endpoints:
        try:
            await fetch_cached(key, url, params, ttl=600)
        except Exception:
            pass


async def periodic_refresh():
    """Run cache refresh every 5 minutes."""
    while True:
        try:
            await refresh_cache_once()
            logger.info("Cache refresh completed")
        except Exception as exc:
            logger.error("Cache refresh error: %s", exc)
        await asyncio.sleep(300)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(application: FastAPI):
    task = asyncio.create_task(periodic_refresh())
    yield
    task.cancel()
    if _client and not _client.is_closed:
        await _client.aclose()


app = FastAPI(
    title="FlixFox Proxy API",
    description="Auth-free proxy for the FlixFox streaming platform API. Auto-updates from upstream.",
    version="1.0.0",
    lifespan=lifespan,
)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===================================================================
# ROUTES
# ===================================================================

# --------------- Health / Meta ---------------

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {
        "name": "FlixFox Proxy API",
        "version": "1.0.0",
        "description": "Auth-free proxy for FlixFox streaming platform API with auto-updating cache",
        "upstream": {
            "flixfox_api": FLIXFOX_API,
            "movie_api": MOVIE_API,
        },
        "channel_id": CHANNEL_ID,
        "domain": DOMAIN,
        "routes": {
            "config": {
                "/config": "Full domain configuration",
                "/config/app": "App download info (APK)",
                "/config/languages": "Supported languages",
            },
            "content": {
                "/blogs": "Blog posts list (paginated)",
                "/blogs/{page_url}": "Single blog post by URL slug",
                "/blogs/trending": "Trending blog posts",
                "/blogs/recommendations/{blog_id}": "Recommended blogs",
                "/blogs/category/{category_id}": "Blogs by category",
            },
            "pages": {
                "/pages/meta/{page_type}": "Page metadata (home, download, about, etc.)",
                "/pages/meta": "Multiple page metadata at once",
                "/pages/faq/{faq_type}": "FAQ list by type",
                "/pages/agreement/{agreement_type}": "Legal agreements (privacy, terms)",
                "/pages/article/{article_type}": "Lite articles",
            },
            "seo": {
                "/seo/sitemap": "Full sitemap",
                "/seo/schema/{route_name}": "Schema.org data",
                "/seo/tdk/{route_name}": "Title/Description/Keywords",
            },
            "proxy": {
                "/proxy/flixfox/{path}": "Raw proxy to api.flixfox.app (any endpoint)",
                "/proxy/movies/{path}": "Raw proxy to movie API (api.hbzws.com)",
            },
            "cache": {
                "/cache/status": "Cache statistics",
                "/cache/refresh": "Force refresh all cached data",
                "/cache/clear": "Clear all cached data",
            },
        },
    }


@app.get("/cache/status")
async def cache_status():
    now = time.time()
    entries = {}
    for key, entry in _cache.items():
        age = now - entry["ts"]
        entries[key] = {
            "age_seconds": round(age, 1),
            "ttl_seconds": entry["ttl"],
            "expired": age > entry["ttl"],
            "data_type": type(entry["data"]).__name__,
        }
    return {"total_entries": len(_cache), "entries": entries}


@app.post("/cache/refresh")
async def cache_refresh():
    await refresh_cache_once()
    return {"status": "refreshed", "total_entries": len(_cache)}


@app.post("/cache/clear")
async def cache_clear():
    count = len(_cache)
    _cache.clear()
    return {"status": "cleared", "entries_removed": count}


# --------------- Configuration ---------------

@app.get("/config")
async def get_config():
    """Get full domain configuration for FlixFox."""
    data = await fetch_cached(
        "domain_config",
        f"{FLIXFOX_API}/open/domainConfig/get",
        {"name": DOMAIN},
    )
    return unwrap(data)


@app.get("/config/app")
async def get_app_info(
    platform: Optional[str] = Query(None, description="Platform filter (e.g. android)"),
):
    """Get FlixFox app download information."""
    params: dict[str, str] = {"channelId": CHANNEL_ID}
    if platform:
        params["platform"] = platform
    data = await fetch_cached("app_info", f"{FLIXFOX_API}/open/app/getAppInfo", params)
    return unwrap(data)


@app.get("/config/app/data")
async def get_app_data(
    platform: Optional[str] = Query(None, description="Platform filter"),
):
    """Get FlixFox app data by channel code."""
    params: dict[str, str] = {"channelCode": "flixfox"}
    if platform:
        params["platform"] = platform
    data = await fetch_json(f"{FLIXFOX_API}/open/app/getData", params)
    return unwrap(data)


@app.get("/config/languages")
async def get_languages():
    """Get list of supported languages."""
    data = await fetch_cached(
        "languages",
        f"{FLIXFOX_API}/open/language/getList",
        {"channelId": CHANNEL_ID},
    )
    return unwrap(data)


# --------------- Blog / Content ---------------

@app.get("/blogs")
async def get_blogs(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    language: Optional[str] = Query(None, description="Language code (e.g. en_US, hi-IN)"),
):
    """Get paginated blog posts."""
    params: dict[str, str] = {"domain": DOMAIN, "page": str(page), "size": str(size)}
    if language:
        params["languageCode"] = language
    cache_key = f"blog_list_p{page}_s{size}_{language or 'all'}"
    data = await fetch_cached(cache_key, f"{FLIXFOX_API}/open/blog/getList", params)
    return unwrap(data)


@app.get("/blogs/trending")
async def get_trending_blogs(
    language: Optional[str] = Query(None, description="Language code"),
):
    """Get trending blog posts."""
    params: dict[str, str] = {"channelId": CHANNEL_ID, "domain": DOMAIN}
    if language:
        params["languageCode"] = language
    data = await fetch_cached(
        f"blogs_trending_{language or 'all'}",
        f"{FLIXFOX_API}/open/blog/getTrendingListByMainCategoryIds",
        params,
    )
    return unwrap(data)


@app.get("/blogs/recommendations/{blog_id}")
async def get_blog_recommendations(
    blog_id: int,
    language: Optional[str] = Query(None, description="Language code"),
):
    """Get recommended blog posts for a given blog."""
    params: dict[str, str] = {"id": str(blog_id), "domain": DOMAIN}
    if language:
        params["languageCode"] = language
    data = await fetch_cached(
        f"blog_recs_{blog_id}_{language or 'all'}",
        f"{FLIXFOX_API}/open/blog/getRecommends",
        params,
    )
    return unwrap(data)


@app.get("/blogs/category/{category_id}")
async def get_blogs_by_category(
    category_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """Get blog posts by category."""
    params: dict[str, str] = {
        "categoryId": str(category_id),
        "channelId": CHANNEL_ID,
        "domain": DOMAIN,
        "page": str(page),
        "size": str(size),
    }
    data = await fetch_cached(
        f"blogs_cat_{category_id}_p{page}",
        f"{FLIXFOX_API}/open/blog/getListByCategoryId",
        params,
    )
    return unwrap(data)


@app.get("/blogs/{page_url:path}")
async def get_blog_by_url(
    page_url: str,
    language: Optional[str] = Query(None, description="Language code"),
):
    """Get a single blog post by its page URL slug."""
    params: dict[str, str] = {"pageUrl": page_url, "domain": DOMAIN}
    if language:
        params["languageCode"] = language
    data = await fetch_cached(
        f"blog_{page_url}_{language or 'all'}",
        f"{FLIXFOX_API}/open/blog/getDataByPageUrl",
        params,
    )
    return unwrap(data)


# --------------- Pages ---------------

@app.get("/pages/meta/{page_type}")
async def get_page_meta(
    page_type: str,
    language: Optional[str] = Query(None, description="Language code"),
):
    """Get page metadata by type (home, download, about, blog, etc.)."""
    params: dict[str, str] = {"type": page_type, "channelId": CHANNEL_ID, "domain": DOMAIN}
    if language:
        params["languageCode"] = language
    data = await fetch_cached(
        f"page_meta_{page_type}_{language or 'all'}",
        f"{FLIXFOX_API}/open/pageMeta/get",
        params,
    )
    return unwrap(data)


@app.get("/pages/meta")
async def get_pages_meta(
    types: str = Query(..., description="Comma-separated page types"),
    language: Optional[str] = Query(None, description="Language code"),
):
    """Get multiple page metadata at once."""
    params: dict[str, str] = {"types": types, "channelId": CHANNEL_ID, "domain": DOMAIN}
    if language:
        params["languageCode"] = language
    data = await fetch_cached(
        f"pages_meta_{types}_{language or 'all'}",
        f"{FLIXFOX_API}/open/pageMeta/gets",
        params,
    )
    return unwrap(data)


@app.get("/pages/faq/{faq_type}")
async def get_faq(
    faq_type: str,
    language: Optional[str] = Query(None, description="Language code"),
):
    """Get FAQ list by type (download, general, etc.)."""
    params: dict[str, str] = {"type": faq_type, "channelId": CHANNEL_ID, "domain": DOMAIN}
    if language:
        params["languageCode"] = language
    data = await fetch_cached(
        f"faq_{faq_type}_{language or 'all'}",
        f"{FLIXFOX_API}/open/faq/getList",
        params,
    )
    return unwrap(data)


@app.get("/pages/agreement/{agreement_type}")
async def get_agreement(
    agreement_type: str,
    language: Optional[str] = Query(None, description="Language code"),
):
    """Get legal agreement by type (privacy, terms)."""
    params: dict[str, str] = {"type": agreement_type, "channelId": CHANNEL_ID}
    if language:
        params["languageCode"] = language
    data = await fetch_cached(
        f"agreement_{agreement_type}_{language or 'all'}",
        f"{FLIXFOX_API}/open/agreement/getData",
        params,
    )
    return unwrap(data)


@app.get("/pages/article/{article_type}")
async def get_lite_article(
    article_type: str,
    language: Optional[str] = Query(None, description="Language code"),
):
    """Get lite article by type (about, etc.)."""
    params: dict[str, str] = {"type": article_type, "channelId": CHANNEL_ID}
    if language:
        params["languageCode"] = language
    data = await fetch_cached(
        f"article_{article_type}_{language or 'all'}",
        f"{FLIXFOX_API}/open/liteArticle/getData",
        params,
    )
    return unwrap(data)


@app.get("/pages/category/{code}")
async def get_category(code: str):
    """Get category data by code."""
    data = await fetch_cached(
        f"category_{code}",
        f"{FLIXFOX_API}/open/category/getDataByCode",
        {"code": code},
    )
    return unwrap(data)


# --------------- SEO ---------------

@app.get("/seo/sitemap")
async def get_sitemap():
    """Get full sitemap data."""
    data = await fetch_cached(
        "sitemap",
        f"{FLIXFOX_API}/open/sitemap/getSitemap",
        {"channelId": CHANNEL_ID, "defaultLanguage": DEFAULT_LANG},
    )
    return unwrap(data)


@app.get("/seo/sitemap/blogs")
async def get_sitemap_blogs():
    """Get blog sitemap entries."""
    data = await fetch_cached(
        "sitemap_blogs",
        f"{FLIXFOX_API}/open/sitemap/getBlog",
        {"channelId": CHANNEL_ID},
    )
    return unwrap(data)


@app.get("/seo/sitemap/blogs-by-domain")
async def get_sitemap_blogs_by_domain(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
):
    """Get blog sitemap entries by domain."""
    data = await fetch_cached(
        f"sitemap_blogs_domain_p{page}",
        f"{FLIXFOX_API}/open/sitemap/getBlogsByDomain",
        {"domain": DOMAIN, "page": str(page), "size": str(size)},
    )
    return unwrap(data)


@app.get("/seo/sitemap/blog-pages")
async def get_sitemap_blog_pages():
    """Get blog pages sitemap."""
    data = await fetch_cached(
        "sitemap_blog_pages",
        f"{FLIXFOX_API}/open/sitemap/getBlogPagesSitemap",
        {"channelId": CHANNEL_ID},
    )
    return unwrap(data)


@app.get("/seo/schema/{route_name}")
async def get_schema(
    route_name: str,
    sub_domain: Optional[str] = Query(None),
):
    """Get schema.org structured data for a route."""
    params: dict[str, str] = {"routeName": route_name, "domain": DOMAIN}
    if sub_domain:
        params["subDomain"] = sub_domain
    data = await fetch_cached(
        f"schema_{route_name}_{sub_domain or ''}",
        f"{FLIXFOX_API}/open/schema/get",
        params,
    )
    return unwrap(data)


@app.get("/seo/tdk/{route_name}")
async def get_tdk(
    route_name: str,
    sub_domain: Optional[str] = Query(None),
):
    """Get Title/Description/Keywords for a route."""
    params: dict[str, str] = {"routeName": route_name, "domain": DOMAIN}
    if sub_domain:
        params["subDomain"] = sub_domain
    data = await fetch_cached(
        f"tdk_{route_name}_{sub_domain or ''}",
        f"{FLIXFOX_API}/open/tdk/get",
        params,
    )
    return unwrap(data)


# --------------- i18n ---------------

@app.get("/i18n/{page_names}")
async def get_i18n(
    page_names: str,
    language: Optional[str] = Query(None, description="Language code"),
):
    """Get internationalization strings for page(s). page_names is comma-separated."""
    params: dict[str, str] = {"projectName": "FlixfoxWeb", "pageNames": page_names}
    if language:
        params["languageCode"] = language
    data = await fetch_cached(
        f"i18n_{page_names}_{language or 'all'}",
        f"{FLIXFOX_API}/open/i18n/get",
        params,
    )
    return unwrap(data)


# --------------- Raw Proxy ---------------

@app.get("/proxy/flixfox/{path:path}")
async def proxy_flixfox(path: str, request: Request):
    """Raw proxy to the FlixFox CMS API (api.flixfox.app). Pass any query params."""
    params = dict(request.query_params)
    url = f"{FLIXFOX_API}/{path}"
    data = await fetch_json(url, params)
    return data


@app.get("/proxy/movies/{path:path}")
async def proxy_movies(path: str, request: Request):
    """Raw proxy to the FlixFox Movie API (api.hbzws.com). Pass any query params."""
    params = dict(request.query_params)
    url = f"{MOVIE_API}/{path}"
    data = await fetch_json(url, params)
    return data


# --------------- All Routes Reference ---------------

@app.get("/routes")
async def list_routes():
    """List all available routes with descriptions for building a website."""
    routes = []
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            routes.append({
                "path": route.path,
                "methods": sorted(route.methods),
                "name": route.name,
                "description": getattr(route.endpoint, "__doc__", "") or "",
            })
    return {"total": len(routes), "routes": routes}
