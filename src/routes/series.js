const router = require('express').Router();
const tmdb = require('../services/tmdbService');

const ok = (res, data) => res.json({ success: true, data });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// ─── Trending / Popular / Charts ─────────────────────────────────────────────
// GET /api/series/trending?time_window=week&page=1
router.get('/trending', wrap(async (req, res) => {
  const { time_window = 'week', page = 1 } = req.query;
  ok(res, await tmdb.getTrendingSeries(time_window, page));
}));

// GET /api/series/popular?page=1
router.get('/popular', wrap(async (req, res) => {
  ok(res, await tmdb.getPopularSeries(req.query.page));
}));

// GET /api/series/top_rated?page=1
router.get('/top_rated', wrap(async (req, res) => {
  ok(res, await tmdb.getTopRatedSeries(req.query.page));
}));

// GET /api/series/airing_today?page=1
router.get('/airing_today', wrap(async (req, res) => {
  ok(res, await tmdb.getAiringTodaySeries(req.query.page));
}));

// GET /api/series/on_air?page=1
router.get('/on_air', wrap(async (req, res) => {
  ok(res, await tmdb.getOnAirSeries(req.query.page));
}));

// ─── Search & Discover ────────────────────────────────────────────────────────
// GET /api/series/search?q=breaking+bad&page=1
router.get('/search', wrap(async (req, res) => {
  const { q, page = 1 } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'q is required' });
  ok(res, await tmdb.searchSeries(q, page));
}));

// GET /api/series/discover?with_genres=18&sort_by=popularity.desc&page=1
router.get('/discover', wrap(async (req, res) => {
  ok(res, await tmdb.discoverSeries(req.query));
}));

// ─── Genres ───────────────────────────────────────────────────────────────────
// GET /api/series/genres
router.get('/genres', wrap(async (req, res) => {
  ok(res, await tmdb.getSeriesGenres());
}));

// GET /api/series/genre/:id?page=1
router.get('/genre/:id', wrap(async (req, res) => {
  ok(res, await tmdb.getSeriesByGenre(req.params.id, req.query.page));
}));

// ─── Single Series ────────────────────────────────────────────────────────────
// GET /api/series/:id
router.get('/:id', wrap(async (req, res) => {
  ok(res, await tmdb.getSeriesDetails(req.params.id));
}));

// GET /api/series/:id/seasons/:season_number
router.get('/:id/seasons/:season_number', wrap(async (req, res) => {
  ok(res, await tmdb.getSeasonDetails(req.params.id, req.params.season_number));
}));

// GET /api/series/:id/seasons/:season_number/episodes/:episode_number
router.get('/:id/seasons/:season_number/episodes/:episode_number', wrap(async (req, res) => {
  ok(res, await tmdb.getEpisodeDetails(
    req.params.id,
    req.params.season_number,
    req.params.episode_number
  ));
}));

// GET /api/series/:id/videos
router.get('/:id/videos', wrap(async (req, res) => {
  ok(res, await tmdb.getSeriesVideos(req.params.id));
}));

// GET /api/series/:id/credits
router.get('/:id/credits', wrap(async (req, res) => {
  ok(res, await tmdb.getSeriesCredits(req.params.id));
}));

// GET /api/series/:id/watch_providers
router.get('/:id/watch_providers', wrap(async (req, res) => {
  ok(res, await tmdb.getSeriesWatchProviders(req.params.id));
}));

// GET /api/series/:id/content_ratings
router.get('/:id/content_ratings', wrap(async (req, res) => {
  ok(res, await tmdb.getSeriesContentRatings(req.params.id));
}));

module.exports = router;
