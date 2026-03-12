/**
 * streamStore.js
 * ─────────────────────────────────────────────────────────────
 * File-backed in-memory store for live stream entries.
 * Admin can POST /api/streams to add a stream URL (M3U8, iframe,
 * direct link) for any match/event — sports, cricket, anything.
 *
 * Persisted to data/streams.json so restarts don't lose streams.
 */

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Vercel (and other serverless platforms) have a read-only filesystem
// except for /tmp.  We detect this and redirect writes there.
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);

const DATA_DIR  = isServerless ? '/tmp' : path.join(__dirname, '../../data');
const DATA_FILE = isServerless ? '/tmp/streams.json' : path.join(DATA_DIR, 'streams.json');

// ── Ensure data dir + file exist ──────────────────────────────
try {
  if (!isServerless && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));
} catch (_) {
  // On read-only FS the initial file won't exist until first write; that's fine.
}

function loadAll() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveAll(streams) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(streams, null, 2));
  } catch (err) {
    console.warn('[streamStore] Could not persist streams.json:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
//  CRUD
// ─────────────────────────────────────────────────────────────

function getAll() {
  return loadAll();
}

function getById(id) {
  return loadAll().find(s => s.id === id) || null;
}

/** category: 'cricket' | 'football' | 'sports' | 'movies' | 'series' | 'other' */
function getByCategory(category) {
  return loadAll().filter(s => s.category?.toLowerCase() === category.toLowerCase());
}

function getByTag(tag) {
  return loadAll().filter(s =>
    s.tags?.some(t => t.toLowerCase() === tag.toLowerCase())
  );
}

function getLive() {
  const now = Date.now();
  return loadAll().filter(s => {
    if (!s.isLive) return false;
    if (s.startTime && new Date(s.startTime).getTime() > now) return false;
    if (s.endTime   && new Date(s.endTime).getTime()   < now) return false;
    return true;
  });
}

function getLiveByCategory(category) {
  return getLive().filter(s => s.category?.toLowerCase() === category.toLowerCase());
}

/**
 * Add a stream.
 * @param {Object} data
 * @param {string} data.title         - Match / show title
 * @param {string} data.category      - cricket | football | sports | movies | series | other
 * @param {string} data.streamUrl     - M3U8, DASH, iframe embed, or direct link
 * @param {string} [data.streamType]  - hls | dash | iframe | direct (default: hls)
 * @param {string} [data.thumbnail]
 * @param {string} [data.description]
 * @param {string[]} [data.tags]      - ['ipl', 'live', 't20']
 * @param {boolean} [data.isLive]     - default true
 * @param {string} [data.startTime]   - ISO date
 * @param {string} [data.endTime]     - ISO date
 * @param {Object} [data.meta]        - any extra key-value
 */
function addStream(data) {
  const streams = loadAll();
  const entry = {
    id:          uuidv4(),
    title:       data.title,
    category:    data.category || 'other',
    streamUrl:   data.streamUrl,
    streamType:  data.streamType || 'hls',
    thumbnail:   data.thumbnail   || null,
    description: data.description || null,
    tags:        data.tags        || [],
    isLive:      data.isLive !== undefined ? data.isLive : true,
    startTime:   data.startTime   || null,
    endTime:     data.endTime     || null,
    meta:        data.meta        || {},
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };
  streams.push(entry);
  saveAll(streams);
  return entry;
}

function updateStream(id, updates) {
  const streams = loadAll();
  const idx = streams.findIndex(s => s.id === id);
  if (idx === -1) return null;
  streams[idx] = { ...streams[idx], ...updates, updatedAt: new Date().toISOString() };
  saveAll(streams);
  return streams[idx];
}

function deleteStream(id) {
  const streams = loadAll();
  const idx = streams.findIndex(s => s.id === id);
  if (idx === -1) return false;
  streams.splice(idx, 1);
  saveAll(streams);
  return true;
}

module.exports = {
  getAll, getById, getByCategory, getByTag,
  getLive, getLiveByCategory,
  addStream, updateStream, deleteStream,
};
