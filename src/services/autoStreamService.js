/**
 * autoStreamService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Automatically fetches live & upcoming match streams from multiple
 * FREE public sports streaming aggregator APIs — no manual entry needed.
 *
 * Sources used (all public, no auth required):
 *   1. streamed.su      — live sports streams for all sports
 *   2. daddylive.dad    — daily sports schedule + stream channels
 *   3. embedme.top      — embed streams for cricket / football
 *   4. cricketapi (own service) — cricket match data
 *
 * All data is merged, deduplicated, normalised and cached every 5 min.
 */

const axios = require('axios');
const cache = require('../cache/cacheManager');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept': 'application/json, */*' };

// ─── tiny fetch helper ────────────────────────────────────────────────────────
async function get(url, extraHeaders = {}, timeout = 12000) {
  const res = await axios.get(url, {
    headers: { ...HEADERS, ...extraHeaders },
    timeout,
  });
  return res.data;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SOURCE 1 — streamed.su  (provides HLS streams for all major sports)
//  Public API docs: https://streamed.su
// ══════════════════════════════════════════════════════════════════════════════

const STREAMED_BASE = 'https://streamed.su/api';

async function fetchStreamedMatches(sport = 'all') {
  const cacheKey = `streamed:matches:${sport}`;
  const cached = cache.get(cacheKey, 'short');
  if (cached) return cached;

  try {
    const url = sport === 'all'
      ? `${STREAMED_BASE}/matches/live`
      : `${STREAMED_BASE}/matches/${sport}`;
    const data = await get(url, { Referer: 'https://streamed.su/' });
    const result = Array.isArray(data) ? data : (data.matches || data.events || []);
    cache.set(cacheKey, result, 'short');
    return result;
  } catch (e) {
    console.error(`[AutoStream] streamed.su ${sport}: ${e.message}`);
    return [];
  }
}

async function fetchStreamedStream(matchId, source) {
  const cacheKey = `streamed:stream:${matchId}:${source}`;
  const cached = cache.get(cacheKey, 'short');
  if (cached) return cached;

  try {
    const data = await get(
      `${STREAMED_BASE}/stream/${source}/${matchId}`,
      { Referer: 'https://streamed.su/' }
    );
    const streams = Array.isArray(data) ? data : [data];
    cache.set(cacheKey, streams, 'short');
    return streams;
  } catch (e) {
    return [];
  }
}

// Normalise a streamed.su match entry
function normaliseStreamedMatch(m) {
  const streams = [];

  if (m.sources && Array.isArray(m.sources)) {
    m.sources.forEach((src, i) => {
      const streamUrl = src.source
        ? buildStreamedEmbedUrl(m.id, src.source)
        : null;
      if (streamUrl) {
        streams.push({
          label:      `Stream ${i + 1}${src.source ? ` (${src.source})` : ''}`,
          streamUrl,
          embedUrl:   buildStreamedEmbedUrl(m.id, src.source),
          streamType: 'iframe',
          source:     'streamed.su',
          m3u8:       buildStreamedM3U8(m.id, src.source),
        });
      }
    });
  }

  return {
    id:          `streamed_${m.id}`,
    sourceId:    m.id,
    title:       m.title || `${m.teams?.home?.name || ''} vs ${m.teams?.away?.name || ''}`,
    category:    normaliseSport(m.category || m.sport || ''),
    sport:       m.category || m.sport || 'sports',
    teams: {
      home: m.teams?.home?.name || null,
      away: m.teams?.away?.name || null,
      homeBadge: m.teams?.home?.badge ? `https://streamed.su${m.teams.home.badge}` : null,
      awayBadge: m.teams?.away?.badge ? `https://streamed.su${m.teams.away.badge}` : null,
    },
    poster:      m.poster      ? `https://streamed.su${m.poster}` : null,
    isLive:      m.isLive !== false,
    startTime:   m.date ? new Date(m.date * 1000).toISOString() : null,
    streams,
    tags:        buildTags(m),
    dataSource:  'streamed.su',
  };
}

function buildStreamedEmbedUrl(matchId, source) {
  return `https://embedme.top/embed/${source}/${matchId}/1`;
}

function buildStreamedM3U8(matchId, source) {
  return `https://rr.vipstreams.in/${source}/js/${matchId}/1/index.m3u8`;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SOURCE 2 — DaddyLive  (daily schedule with channel streams)
// ══════════════════════════════════════════════════════════════════════════════

const DADDY_BASE = 'https://daddylive.dad';

async function fetchDaddySchedule() {
  const cacheKey = 'daddy:schedule';
  const cached = cache.get(cacheKey, 'short');
  if (cached) return cached;

  try {
    const data = await get(
      `${DADDY_BASE}/schedule/schedule-generated.json`,
      { Referer: `${DADDY_BASE}/` }
    );
    cache.set(cacheKey, data, 'short');
    return data;
  } catch (e) {
    console.error(`[AutoStream] daddylive schedule: ${e.message}`);
    return {};
  }
}

function normaliseDaddyEvents(raw) {
  const results = [];
  if (!raw || typeof raw !== 'object') return results;

  Object.entries(raw).forEach(([dateKey, categories]) => {
    if (!categories || typeof categories !== 'object') return;
    Object.entries(categories).forEach(([sport, events]) => {
      if (!Array.isArray(events)) return;
      events.forEach(ev => {
        const channels = (ev.channels || []).map((ch, i) => ({
          label:      ch.channel_name || `Channel ${i + 1}`,
          streamUrl:  ch.channel_id
            ? `${DADDY_BASE}/stream/stream-${ch.channel_id}.php`
            : null,
          embedUrl:   ch.channel_id
            ? `${DADDY_BASE}/stream/stream-${ch.channel_id}.php`
            : null,
          streamType: 'iframe',
          source:     'daddylive',
          m3u8:       ch.channel_id
            ? `https://webhdplay.su/hls/${ch.channel_id}/index.m3u8`
            : null,
        })).filter(c => c.streamUrl);

        if (!channels.length) return;

        results.push({
          id:          `daddy_${sport}_${ev.event || ev.name}_${dateKey}`.replace(/\s+/g, '_'),
          sourceId:    ev.event || ev.name,
          title:       ev.event || ev.name || 'Live Event',
          category:    normaliseSport(sport),
          sport:       sport,
          teams:       { home: null, away: null },
          poster:      null,
          isLive:      true,
          startTime:   ev.time ? parseDaddyTime(dateKey, ev.time) : null,
          streams:     channels,
          tags:        buildTagsFromSport(sport),
          dataSource:  'daddylive',
        });
      });
    });
  });

  return results;
}

function parseDaddyTime(dateKey, timeStr) {
  try {
    return new Date(`${dateKey} ${timeStr} UTC`).toISOString();
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SOURCE 3 — EmbedMe / VIPStreams  (direct m3u8 for cricket & football)
// ══════════════════════════════════════════════════════════════════════════════

async function fetchEmbedMeEvents() {
  const cacheKey = 'embedme:events';
  const cached = cache.get(cacheKey, 'short');
  if (cached) return cached;

  try {
    const data = await get(
      'https://embedme.top/api/events',
      { Referer: 'https://embedme.top/' }
    );
    const events = Array.isArray(data) ? data : (data.events || []);
    cache.set(cacheKey, events, 'short');
    return events;
  } catch (e) {
    console.error(`[AutoStream] embedme.top: ${e.message}`);
    return [];
  }
}

function normaliseEmbedMeEvent(ev) {
  const streams = [];
  const sources = ev.sources || ev.streams || [];
  sources.forEach((s, i) => {
    const url = s.url || s.stream_url || s.hls || null;
    if (url) {
      streams.push({
        label:      s.label || s.name || `Stream ${i + 1}`,
        streamUrl:  url,
        embedUrl:   `https://embedme.top/embed/${ev.id || ev.match_id}/${i + 1}`,
        streamType: url.includes('.m3u8') ? 'hls' : 'iframe',
        source:     'embedme.top',
        m3u8:       url.includes('.m3u8') ? url : null,
      });
    }
  });

  return {
    id:         `embedme_${ev.id || ev.match_id}`,
    sourceId:   ev.id || ev.match_id,
    title:      ev.title || ev.name || 'Live Match',
    category:   normaliseSport(ev.sport || ev.category || ''),
    sport:      ev.sport || ev.category || 'sports',
    teams: {
      home: ev.home || ev.team1 || null,
      away: ev.away || ev.team2 || null,
    },
    poster:     ev.poster || ev.thumbnail || null,
    isLive:     true,
    startTime:  ev.start_time || ev.time || null,
    streams,
    tags:       buildTagsFromSport(ev.sport || ''),
    dataSource: 'embedme.top',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  SOURCE 4 — CricHD-style public cricket stream finder
// ══════════════════════════════════════════════════════════════════════════════

async function fetchCricketStreams() {
  const cacheKey = 'cricket:publicstreams';
  const cached = cache.get(cacheKey, 'short');
  if (cached) return cached;

  // Fetch from streamed.su cricket category specifically
  try {
    const data = await get(
      `${STREAMED_BASE}/matches/cricket`,
      { Referer: 'https://streamed.su/' }
    );
    const matches = Array.isArray(data) ? data : [];
    const normalised = matches.map(m => normaliseStreamedMatch(m));
    cache.set(cacheKey, normalised, 'short');
    return normalised;
  } catch (e) {
    console.error(`[AutoStream] cricket streams: ${e.message}`);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MERGE & DEDUPLICATE
// ══════════════════════════════════════════════════════════════════════════════

let _allStreamsCache = [];
let _lastFetch = 0;

async function fetchAllAutoStreams() {
  // Use in-memory cache (5 min)
  if (Date.now() - _lastFetch < 5 * 60 * 1000 && _allStreamsCache.length) {
    return _allStreamsCache;
  }

  console.log('[AutoStream] Fetching all streams from all sources...');

  const [streamedAll, daddyRaw, embedMeRaw] = await Promise.allSettled([
    fetchStreamedMatches('all'),
    fetchDaddySchedule(),
    fetchEmbedMeEvents(),
  ]);

  const results = [];

  // Source 1: streamed.su
  if (streamedAll.status === 'fulfilled' && Array.isArray(streamedAll.value)) {
    streamedAll.value.forEach(m => {
      try { results.push(normaliseStreamedMatch(m)); } catch (_) {}
    });
  }

  // Source 2: daddylive
  if (daddyRaw.status === 'fulfilled') {
    normaliseDaddyEvents(daddyRaw.value).forEach(e => results.push(e));
  }

  // Source 3: embedme
  if (embedMeRaw.status === 'fulfilled' && Array.isArray(embedMeRaw.value)) {
    embedMeRaw.value.forEach(ev => {
      try { results.push(normaliseEmbedMeEvent(ev)); } catch (_) {}
    });
  }

  // Deduplicate by title similarity
  const seen = new Set();
  const deduped = results.filter(r => {
    const key = r.title?.toLowerCase().replace(/\s+/g, '').slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  _allStreamsCache = deduped;
  _lastFetch = Date.now();

  console.log(`[AutoStream] Fetched ${deduped.length} total streams from all sources`);
  return deduped;
}

// ── Filter helpers ────────────────────────────────────────────────────────────

async function getLiveAutoStreams() {
  const all = await fetchAllAutoStreams();
  return all.filter(s => s.isLive && s.streams.length > 0);
}

async function getAutoStreamsByCategory(category) {
  const all = await fetchAllAutoStreams();
  return all.filter(s => s.category === normaliseSport(category) && s.streams.length > 0);
}

async function getAutoStreamsByTag(tag) {
  const tl = tag.toLowerCase();
  const all = await fetchAllAutoStreams();
  return all.filter(s =>
    s.tags.some(t => t.toLowerCase().includes(tl)) ||
    s.title?.toLowerCase().includes(tl) ||
    s.sport?.toLowerCase().includes(tl)
  );
}

async function getAutoStreamById(id) {
  const all = await fetchAllAutoStreams();
  return all.find(s => s.id === id || s.sourceId === id) || null;
}

// ── Sport / tag normalisation ─────────────────────────────────────────────────

function normaliseSport(sport) {
  const s = sport.toLowerCase();
  if (s.includes('cricket'))    return 'cricket';
  if (s.includes('football') || s.includes('soccer')) return 'football';
  if (s.includes('basketball')) return 'basketball';
  if (s.includes('tennis'))     return 'tennis';
  if (s.includes('rugby'))      return 'rugby';
  if (s.includes('hockey'))     return 'hockey';
  if (s.includes('baseball'))   return 'baseball';
  if (s.includes('golf'))       return 'golf';
  if (s.includes('boxing') || s.includes('mma') || s.includes('ufc')) return 'combat';
  if (s.includes('motor') || s.includes('f1') || s.includes('formula')) return 'motorsport';
  if (s.includes('cycling'))    return 'cycling';
  if (s.includes('darts'))      return 'darts';
  return 'sports';
}

function buildTags(m) {
  const tags = [];
  const title = (m.title || '').toLowerCase();
  const sport = (m.category || m.sport || '').toLowerCase();

  tags.push(normaliseSport(sport));
  if (title.includes('ipl') || title.includes('indian premier'))   tags.push('ipl');
  if (title.includes('wpl') || title.includes("women's premier"))  tags.push('wpl');
  if (title.includes('t20'))   tags.push('t20');
  if (title.includes(' odi ') || title.includes('one day'))        tags.push('odi');
  if (title.includes('test'))  tags.push('test');
  if (title.includes('champions league')) tags.push('ucl');
  if (title.includes('premier league'))   tags.push('epl');
  if (title.includes('la liga'))          tags.push('laliga');
  if (title.includes('bundesliga'))       tags.push('bundesliga');
  if (title.includes('serie a'))          tags.push('seriea');
  if (m.isLive) tags.push('live');

  return [...new Set(tags)];
}

function buildTagsFromSport(sport) {
  const s = sport.toLowerCase();
  const tags = [normaliseSport(s), 'live'];
  if (s.includes('cricket')) tags.push('cricket');
  if (s.includes('football') || s.includes('soccer')) tags.push('football');
  return [...new Set(tags)];
}

module.exports = {
  fetchAllAutoStreams,
  getLiveAutoStreams,
  getAutoStreamsByCategory,
  getAutoStreamsByTag,
  getAutoStreamById,
  fetchStreamedMatches,
  fetchCricketStreams,
  normaliseSport,
};
