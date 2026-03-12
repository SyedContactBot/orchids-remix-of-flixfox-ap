const router = require('express').Router();
const tmdb = require('../services/tmdbService');

const ok = (res, data) => res.json({ success: true, data });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// ─── Trending / Popular / Charts ─────────────────────────────────────────────
// GET /api/movies/trending?time_window=week&page=1
router.get('/trending', wrap(async (req, res) => {
  const { time_window = 'week', page = 1 } = req.query;
  ok(res, await tmdb.getTrendingMovies(time_window, page));
}));

// GET /api/movies/popular?page=1
router.get('/popular', wrap(async (req, res) => {
  ok(res, await tmdb.getPopularMovies(req.query.page));
}));

// GET /api/movies/top_rated?page=1
router.get('/top_rated', wrap(async (req, res) => {
  ok(res, await tmdb.getTopRatedMovies(req.query.page));
}));

// GET /api/movies/now_playing?page=1
router.get('/now_playing', wrap(async (req, res) => {
  ok(res, await tmdb.getNowPlayingMovies(req.query.page));
}));

// GET /api/movies/upcoming?page=1
router.get('/upcoming', wrap(async (req, res) => {
  ok(res, await tmdb.getUpcomingMovies(req.query.page));
}));

// ─── Search & Discover ────────────────────────────────────────────────────────
// GET /api/movies/search?q=batman&page=1&year=2022
router.get('/search', wrap(async (req, res) => {
  const { q, page = 1, year } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'q is required' });
  ok(res, await tmdb.searchMovies(q, page, year));
}));

// GET /api/movies/discover?with_genres=28&sort_by=popularity.desc&page=1
router.get('/discover', wrap(async (req, res) => {
  ok(res, await tmdb.discoverMovies(req.query));
}));

// ─── Genres ───────────────────────────────────────────────────────────────────
// GET /api/movies/genres
router.get('/genres', wrap(async (req, res) => {
  ok(res, await tmdb.getMovieGenres());
}));

// GET /api/movies/genre/:id?page=1
router.get('/genre/:id', wrap(async (req, res) => {
  ok(res, await tmdb.getMoviesByGenre(req.params.id, req.query.page));
}));

// ─── Single Movie ─────────────────────────────────────────────────────────────
// GET /api/movies/:id
router.get('/:id', wrap(async (req, res) => {
  ok(res, await tmdb.getMovieDetails(req.params.id));
}));

// GET /api/movies/:id/videos
router.get('/:id/videos', wrap(async (req, res) => {
  ok(res, await tmdb.getMovieVideos(req.params.id));
}));

// GET /api/movies/:id/credits
router.get('/:id/credits', wrap(async (req, res) => {
  ok(res, await tmdb.getMovieCredits(req.params.id));
}));

// GET /api/movies/:id/images
router.get('/:id/images', wrap(async (req, res) => {
  ok(res, await tmdb.getMovieImages(req.params.id));
}));

// GET /api/movies/:id/watch_providers
router.get('/:id/watch_providers', wrap(async (req, res) => {
  ok(res, await tmdb.getMovieWatchProviders(req.params.id));
}));

module.exports = router;
