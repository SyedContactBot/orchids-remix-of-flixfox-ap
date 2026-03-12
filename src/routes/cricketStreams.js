/**
 * /api/cricket-streams
 * ──────────────────────────────────────────────────────────────────────────────
 * Dedicated cricket live stream aggregator.
 * Sources: streamed.su, daddylive, embedme.top, JioHotstar embeds, CricHD-style
 *
 * GET /api/cricket-streams                  all cricket matches with stream links
 * GET /api/cricket-streams/live             only currently live matches
 * GET /api/cricket-streams/ipl              IPL streams
 * GET /api/cricket-streams/wpl              WPL streams
 * GET /api/cricket-streams/t20              T20 matches
 * GET /api/cricket-streams/odi              ODI matches
 * GET /api/cricket-streams/test             Test matches
 * GET /api/cricket-streams/tournament/:name by tournament name (ipl/wpl/worldcup/cpl/psl/bbl/sa20…)
 * GET /api/cricket-streams/search?q=india   search by title / team
 * GET /api/cricket-streams/:id              single match + all stream links
 */

const router = require('express').Router();
const svc    = require('../services/cricketStreamService');

const ok   = (res, data) => res.json({ success: true, count: Array.isArray(data) ? data.length : undefined, data });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// GET /api/cricket-streams
router.get('/', wrap(async (req, res) => {
  ok(res, await svc.fetchAllCricketStreams());
}));

// GET /api/cricket-streams/live
router.get('/live', wrap(async (req, res) => {
  ok(res, await svc.getLiveCricketStreams());
}));

// GET /api/cricket-streams/ipl
router.get('/ipl', wrap(async (req, res) => {
  ok(res, await svc.getCricketStreamsByTournament('ipl'));
}));

// GET /api/cricket-streams/wpl
router.get('/wpl', wrap(async (req, res) => {
  ok(res, await svc.getCricketStreamsByTournament('wpl'));
}));

// GET /api/cricket-streams/t20
router.get('/t20', wrap(async (req, res) => {
  ok(res, await svc.getCricketStreamsByTournament('t20'));
}));

// GET /api/cricket-streams/odi
router.get('/odi', wrap(async (req, res) => {
  ok(res, await svc.getCricketStreamsByTournament('odi'));
}));

// GET /api/cricket-streams/test
router.get('/test', wrap(async (req, res) => {
  ok(res, await svc.getCricketStreamsByTournament('test'));
}));

// GET /api/cricket-streams/tournament/:name   e.g. worldcup, cpl, psl, bbl, sa20, asia-cup
router.get('/tournament/:name', wrap(async (req, res) => {
  ok(res, await svc.getCricketStreamsByTournament(req.params.name));
}));

// GET /api/cricket-streams/search?q=india+vs+australia
router.get('/search', wrap(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'q is required' });
  const all = await svc.fetchAllCricketStreams();
  const ql  = q.toLowerCase();
  const results = all.filter(m =>
    (m.title || '').toLowerCase().includes(ql) ||
    (m.teams?.home || '').toLowerCase().includes(ql) ||
    (m.teams?.away || '').toLowerCase().includes(ql) ||
    (m.tournament || '').toLowerCase().includes(ql) ||
    m.tags.some(t => t.includes(ql))
  );
  ok(res, results);
}));

// GET /api/cricket-streams/:id  — must be last
router.get('/:id', wrap(async (req, res) => {
  const match = await svc.getCricketStreamById(req.params.id);
  if (!match) return res.status(404).json({ success: false, message: 'Stream not found' });
  ok(res, match);
}));

module.exports = router;
