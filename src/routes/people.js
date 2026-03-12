const router = require('express').Router();
const tmdb = require('../services/tmdbService');

const ok = (res, data) => res.json({ success: true, data });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// GET /api/people/trending
router.get('/trending', wrap(async (req, res) => {
  ok(res, await tmdb.getTrendingPeople());
}));

// GET /api/people/:id
router.get('/:id', wrap(async (req, res) => {
  ok(res, await tmdb.getPersonDetails(req.params.id));
}));

module.exports = router;
