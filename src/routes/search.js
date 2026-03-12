const router = require('express').Router();
const tmdb = require('../services/tmdbService');

const ok = (res, data) => res.json({ success: true, data });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// GET /api/search?q=avengers&page=1   (multi: movies + series + people)
router.get('/', wrap(async (req, res) => {
  const { q, page = 1 } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'q is required' });
  ok(res, await tmdb.multiSearch(q, page));
}));

// GET /api/search/people?q=tom+hanks
router.get('/people', wrap(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'q is required' });
  ok(res, await tmdb.multiSearch(q));
}));

module.exports = router;
