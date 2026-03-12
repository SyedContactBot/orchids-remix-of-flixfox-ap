const router  = require('express').Router();
const cricket = require('../services/cricketService');

const ok   = (res, data) => res.json({ success: true, data });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// ══════════════════════════════════════════════════════════════════════════════
//  LIVE
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/cricket/live               — all live matches
router.get('/live', wrap(async (req, res) => {
  ok(res, await cricket.getLiveMatches());
}));

// GET /api/cricket/scores             — current match scores
router.get('/scores', wrap(async (req, res) => {
  ok(res, await cricket.getLiveScores());
}));

// ══════════════════════════════════════════════════════════════════════════════
//  IPL / WPL / INTERNATIONAL
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/cricket/ipl
router.get('/ipl', wrap(async (req, res) => {
  ok(res, await cricket.getIPLMatches());
}));

// GET /api/cricket/wpl
router.get('/wpl', wrap(async (req, res) => {
  ok(res, await cricket.getWPLMatches());
}));

// GET /api/cricket/international
router.get('/international', wrap(async (req, res) => {
  ok(res, await cricket.getInternationalMatches());
}));

// ══════════════════════════════════════════════════════════════════════════════
//  SERIES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/cricket/series             — all current series
router.get('/series', wrap(async (req, res) => {
  ok(res, await cricket.getCurrentSeries());
}));

// GET /api/cricket/series/:id
router.get('/series/:id', wrap(async (req, res) => {
  ok(res, await cricket.getSeriesInfo(req.params.id));
}));

// ══════════════════════════════════════════════════════════════════════════════
//  MATCHES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/cricket/matches/:id
router.get('/matches/:id', wrap(async (req, res) => {
  ok(res, await cricket.getMatchInfo(req.params.id));
}));

// GET /api/cricket/matches/:id/scorecard
router.get('/matches/:id/scorecard', wrap(async (req, res) => {
  ok(res, await cricket.getMatchScorecard(req.params.id));
}));

// GET /api/cricket/matches/:id/squads
router.get('/matches/:id/squads', wrap(async (req, res) => {
  ok(res, await cricket.getMatchSquads(req.params.id));
}));

// ══════════════════════════════════════════════════════════════════════════════
//  PLAYERS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/cricket/players/search?q=virat
router.get('/players/search', wrap(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'q is required' });
  ok(res, await cricket.searchPlayer(q));
}));

// GET /api/cricket/players/:id
router.get('/players/:id', wrap(async (req, res) => {
  ok(res, await cricket.getPlayerInfo(req.params.id));
}));

// GET /api/cricket/players/:id/stats
router.get('/players/:id/stats', wrap(async (req, res) => {
  ok(res, await cricket.getPlayerStats(req.params.id));
}));

// ══════════════════════════════════════════════════════════════════════════════
//  VENUES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/cricket/venues
router.get('/venues', wrap(async (req, res) => {
  ok(res, await cricket.getVenues());
}));

// GET /api/cricket/venues/:id
router.get('/venues/:id', wrap(async (req, res) => {
  ok(res, await cricket.getVenueInfo(req.params.id));
}));

module.exports = router;
