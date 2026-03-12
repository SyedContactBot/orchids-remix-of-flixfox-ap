/**
 * /api/streams
 * ─────────────────────────────────────────────────────────────
 * Full stream management API.
 *
 * PUBLIC (read):
 *   GET /api/streams                     — all streams
 *   GET /api/streams/live                — currently live streams
 *   GET /api/streams/live/:category      — live by category (cricket/football/sports/movies/series)
 *   GET /api/streams/category/:category  — all in category
 *   GET /api/streams/tag/:tag            — by tag (ipl/wpl/t20/odi/test/epl…)
 *   GET /api/streams/:id                 — single stream
 *
 * ADMIN (write) — protect with ADMIN_KEY in .env:
 *   POST   /api/streams                  — add new stream
 *   PATCH  /api/streams/:id              — update stream
 *   DELETE /api/streams/:id              — delete stream
 *
 * Stream body example:
 * {
 *   "title":       "IPL 2024 — MI vs CSK",
 *   "category":    "cricket",
 *   "streamUrl":   "https://your-cdn.com/ipl-mi-csk.m3u8",
 *   "streamType":  "hls",          // hls | dash | iframe | direct
 *   "thumbnail":   "https://...",
 *   "description": "Live T20 match",
 *   "tags":        ["ipl", "live", "t20"],
 *   "isLive":      true,
 *   "startTime":   "2024-04-01T14:00:00Z",
 *   "endTime":     "2024-04-01T18:00:00Z",
 *   "meta": {
 *     "team1": "Mumbai Indians",
 *     "team2": "Chennai Super Kings",
 *     "venue": "Wankhede Stadium",
 *     "language": "Hindi"
 *   }
 * }
 */

const router = require('express').Router();
const store  = require('../services/streamStore');

const ok   = (res, data) => res.json({ success: true, data });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// ── Simple admin auth middleware ───────────────────────────────────────────────
function adminAuth(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return next(); // no key set = open (dev mode)

  const provided = req.headers['x-admin-key'] || req.query.admin_key;
  if (provided !== adminKey) {
    return res.status(401).json({ success: false, message: 'Unauthorized — x-admin-key required' });
  }
  next();
}

// ══════════════════════════════════════════════════════════════════════════════
//  PUBLIC READS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/streams
router.get('/', wrap(async (req, res) => {
  ok(res, store.getAll());
}));

// GET /api/streams/live
router.get('/live', wrap(async (req, res) => {
  ok(res, store.getLive());
}));

// GET /api/streams/live/:category   e.g. /api/streams/live/cricket
router.get('/live/:category', wrap(async (req, res) => {
  ok(res, store.getLiveByCategory(req.params.category));
}));

// GET /api/streams/category/:category
router.get('/category/:category', wrap(async (req, res) => {
  ok(res, store.getByCategory(req.params.category));
}));

// GET /api/streams/tag/:tag
router.get('/tag/:tag', wrap(async (req, res) => {
  ok(res, store.getByTag(req.params.tag));
}));

// GET /api/streams/:id
router.get('/:id', wrap(async (req, res) => {
  const stream = store.getById(req.params.id);
  if (!stream) return res.status(404).json({ success: false, message: 'Stream not found' });
  ok(res, stream);
}));

// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN WRITES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/streams
router.post('/', adminAuth, wrap(async (req, res) => {
  const { title, streamUrl } = req.body;
  if (!title)     return res.status(400).json({ success: false, message: 'title is required' });
  if (!streamUrl) return res.status(400).json({ success: false, message: 'streamUrl is required' });

  const stream = store.addStream(req.body);
  res.status(201).json({ success: true, data: stream });
}));

// PATCH /api/streams/:id
router.patch('/:id', adminAuth, wrap(async (req, res) => {
  const stream = store.updateStream(req.params.id, req.body);
  if (!stream) return res.status(404).json({ success: false, message: 'Stream not found' });
  ok(res, stream);
}));

// DELETE /api/streams/:id
router.delete('/:id', adminAuth, wrap(async (req, res) => {
  const deleted = store.deleteStream(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: 'Stream not found' });
  ok(res, { message: 'Stream deleted' });
}));

module.exports = router;
