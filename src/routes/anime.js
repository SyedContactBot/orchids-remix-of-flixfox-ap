const router = require('express').Router();
const anime = require('../services/animeService');

const ok = (res, data) => res.json({ success: true, data });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// GET /api/anime?filter[text]=naruto&page[limit]=10&page[offset]=0
router.get('/', wrap(async (req, res) => {
  ok(res, await anime.listAnime(req.query));
}));

// GET /api/anime/search?q=naruto&page[limit]=10
router.get('/search', wrap(async (req, res) => {
  const q = req.query.q || req.query['filter[text]'];
  if (!q) return res.status(400).json({ success: false, message: 'q or filter[text] is required' });
  ok(res, await anime.searchAnime(q, req.query));
}));

// Common Kitsu relationships
router.get('/:id/episodes', wrap(async (req, res) => {
  ok(res, await anime.getAnimeRelationship(req.params.id, 'episodes', req.query));
}));

router.get('/:id/characters', wrap(async (req, res) => {
  ok(res, await anime.getAnimeRelationship(req.params.id, 'characters', req.query));
}));

router.get('/:id/castings', wrap(async (req, res) => {
  ok(res, await anime.getAnimeRelationship(req.params.id, 'castings', req.query));
}));

router.get('/:id/genres', wrap(async (req, res) => {
  ok(res, await anime.getAnimeRelationship(req.params.id, 'genres', req.query));
}));

router.get('/:id/media-relationships', wrap(async (req, res) => {
  ok(res, await anime.getAnimeRelationship(req.params.id, 'media-relationships', req.query));
}));

router.get('/:id/streaming-links', wrap(async (req, res) => {
  ok(res, await anime.getAnimeRelationship(req.params.id, 'streaming-links', req.query));
}));

router.get('/:id', wrap(async (req, res) => {
  ok(res, await anime.getAnimeById(req.params.id, req.query));
}));

// Generic passthrough to mirror Kitsu edge routes
// Example: /api/anime/kitsu/manga?filter[text]=berserk
router.get('/kitsu/*splat', wrap(async (req, res) => {
  const rest = req.params.splat;
  const path = Array.isArray(rest) ? rest.join('/') : rest;
  ok(res, await anime.proxyKitsu(path, req.query));
}));

module.exports = router;
