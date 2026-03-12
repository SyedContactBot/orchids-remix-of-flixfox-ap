/**
 * /api/auto-streams
 * ─────────────────────────────────────────────────────────────
 * Auto-fetched live streams — no manual entry required.
 * Data refreshes every 5 minutes from public aggregators.
 *
 * GET /api/auto-streams                     all matches with streams
 * GET /api/auto-streams/live                only currently live
 * GET /api/auto-streams/category/:category  by sport (cricket/football/basketball/tennis…)
 * GET /api/auto-streams/tag/:tag            by tag   (ipl/wpl/t20/odi/ucl/epl…)
 * GET /api/auto-streams/:id                 single match + all its streams
 *
 * Each match entry includes:
 *  {
 *    id, title, category, sport, teams, poster, isLive, startTime, tags,
 *    streams: [
 *      { label, streamUrl, embedUrl, streamType, source, m3u8 }
 *    ]
 *  }
 *
 *  streamType: "hls" (use <video> / hls.js)  |  "iframe" (embed in <iframe>)
 *  m3u8:  direct .m3u8 URL if available (null otherwise)
 */

const router = require('express').Router();
const svc    = require('../services/autoStreamService');

const ok   = (res, data) => res.json({ success: true, count: Array.isArray(data) ? data.length : undefined, data });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// GET /api/auto-streams
router.get('/', wrap(async (req, res) => {
  const all = await svc.fetchAllAutoStreams();
  ok(res, all);
}));

// GET /api/auto-streams/live
router.get('/live', wrap(async (req, res) => {
  ok(res, await svc.getLiveAutoStreams());
}));

// GET /api/auto-streams/category/cricket
// GET /api/auto-streams/category/football
// GET /api/auto-streams/category/basketball
// GET /api/auto-streams/category/tennis
// GET /api/auto-streams/category/rugby
// GET /api/auto-streams/category/motorsport
// GET /api/auto-streams/category/combat
router.get('/category/:category', wrap(async (req, res) => {
  ok(res, await svc.getAutoStreamsByCategory(req.params.category));
}));

// GET /api/auto-streams/tag/ipl
// GET /api/auto-streams/tag/wpl
// GET /api/auto-streams/tag/t20
// GET /api/auto-streams/tag/odi
// GET /api/auto-streams/tag/test
// GET /api/auto-streams/tag/ucl
// GET /api/auto-streams/tag/epl
// GET /api/auto-streams/tag/laliga
router.get('/tag/:tag', wrap(async (req, res) => {
  ok(res, await svc.getAutoStreamsByTag(req.params.tag));
}));

// GET /api/auto-streams/:id
router.get('/:id', wrap(async (req, res) => {
  const match = await svc.getAutoStreamById(req.params.id);
  if (!match) return res.status(404).json({ success: false, message: 'Stream not found' });
  ok(res, match);
}));

module.exports = router;
