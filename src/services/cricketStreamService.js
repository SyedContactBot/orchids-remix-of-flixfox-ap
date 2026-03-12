/**
 * cricketStreamService.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Aggregates live cricket stream links from multiple public sources:
 *
 *   1. streamed.su       — HLS / embed streams for cricket matches
 *   2. daddylive         — daily schedule cricket channels
 *   3. embedme.top       — cricket embed URLs
 *   4. JioHotstar embed  — public JioHotstar embed player URLs for live events
 *   5. CricHD-style      — known public cricket stream embed aggregator pattern
 *
 * All sources are public / no-auth.  Refreshed from cache every 5 min.
 *
 * Response shape per match:
 * {
 *   id, title, tournament, teams: { home, away, homeBadge, awayBadge },
 *   poster, isLive, startTime, tags,
 *   streams: [
 *     {
 *       label, streamUrl, embedUrl, streamType ("hls"|"iframe"),
 *       m3u8, source, quality
 *     }
 *   ]
 * }
 */

const axios = require('axios');
const cache = require('../cache/cacheManager');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const HEADERS = {
  'User-Agent':  UA,
  'Accept':      'application/json, text/html, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function safeFetch(url, extraHeaders = {}, timeout = 12000) {
  try {
    const res = await axios.get(url, {
      headers: { ...HEADERS, ...extraHeaders },
      timeout,
    });
    return res.data;
  } catch (e) {
    console.warn(`[CricketStream] fetch failed ${url}: ${e.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SOURCE 1 — streamed.su cricket
// ══════════════════════════════════════════════════════════════════════════════

async function fromStreamedSu() {
  const cached = cache.get('cstream:streamed', 'short');
  if (cached) return cached;

  const data = await safeFetch(
    'https://streamed.su/api/matches/cricket',
    { Referer: 'https://streamed.su/' }
  );

  const matches = Array.isArray(data) ? data : [];

  const result = matches.map(m => {
    const streams = [];
    (m.sources || []).forEach((src, i) => {
      if (!src.source) return;
      streams.push({
        label:      `streamed.su — Stream ${i + 1}`,
        streamUrl:  `https://embedme.top/embed/${src.source}/${m.id}/1`,
        embedUrl:   `https://embedme.top/embed/${src.source}/${m.id}/1`,
        streamType: 'iframe',
        m3u8:       `https://rr.vipstreams.in/${src.source}/js/${m.id}/1/index.m3u8`,
        source:     'streamed.su',
        quality:    src.quality || 'HD',
      });
    });
    return buildMatch(`streamed_${m.id}`, m.title || titleFromTeams(m), m, streams, 'streamed.su');
  }).filter(m => m.streams.length > 0);

  cache.set('cstream:streamed', result, 'short');
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SOURCE 2 — DaddyLive cricket channels
// ══════════════════════════════════════════════════════════════════════════════

async function fromDaddyLive() {
  const cached = cache.get('cstream:daddy', 'short');
  if (cached) return cached;

  const data = await safeFetch(
    'https://daddylive.dad/schedule/schedule-generated.json',
    { Referer: 'https://daddylive.dad/' }
  );

  if (!data || typeof data !== 'object') return [];

  const results = [];

  Object.entries(data).forEach(([dateKey, categories]) => {
    if (!categories || typeof categories !== 'object') return;

    // Look for any cricket-related category key
    Object.entries(categories).forEach(([sport, events]) => {
      if (!isCricketSport(sport)) return;
      if (!Array.isArray(events)) return;

      events.forEach(ev => {
        const channels = (ev.channels || []).map((ch, i) => ({
          label:      ch.channel_name || `DaddyLive Ch${i + 1}`,
          streamUrl:  ch.channel_id ? `https://daddylive.dad/stream/stream-${ch.channel_id}.php` : null,
          embedUrl:   ch.channel_id ? `https://daddylive.dad/stream/stream-${ch.channel_id}.php` : null,
          streamType: 'iframe',
          m3u8:       ch.channel_id ? `https://webhdplay.su/hls/${ch.channel_id}/index.m3u8` : null,
          source:     'daddylive',
          quality:    'HD',
        })).filter(c => c.streamUrl);

        if (!channels.length) return;

        const id = `daddy_${sport}_${ev.event || ev.name}_${dateKey}`.replace(/\W+/g, '_');
        results.push({
          id,
          title:      ev.event || ev.name || 'Cricket Match',
          tournament: detectTournament(ev.event || ev.name || ''),
          teams:      { home: null, away: null, homeBadge: null, awayBadge: null },
          poster:     null,
          isLive:     true,
          startTime:  parseDaddyTime(dateKey, ev.time),
          tags:       buildCricketTags(ev.event || ''),
          streams:    channels,
          dataSource: 'daddylive',
        });
      });
    });
  });

  cache.set('cstream:daddy', results, 'short');
  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SOURCE 3 — EmbedMe.top cricket events
// ══════════════════════════════════════════════════════════════════════════════

async function fromEmbedMe() {
  const cached = cache.get('cstream:embedme', 'short');
  if (cached) return cached;

  const data = await safeFetch(
    'https://embedme.top/api/events',
    { Referer: 'https://embedme.top/' }
  );

  const events = Array.isArray(data) ? data : (data?.events || []);
  const cricket = events.filter(ev =>
    isCricketSport(ev.sport || ev.category || ev.title || '')
  );

  const result = cricket.map(ev => {
    const sources = ev.sources || ev.streams || [];
    const streams = sources.map((s, i) => {
      const url = s.url || s.stream_url || s.hls || null;
      if (!url) return null;
      return {
        label:      s.label || s.name || `EmbedMe Stream ${i + 1}`,
        streamUrl:  url,
        embedUrl:   `https://embedme.top/embed/${ev.id || ev.match_id}/${i + 1}`,
        streamType: url.includes('.m3u8') ? 'hls' : 'iframe',
        m3u8:       url.includes('.m3u8') ? url : null,
        source:     'embedme.top',
        quality:    s.quality || 'HD',
      };
    }).filter(Boolean);

    return {
      id:         `embedme_${ev.id || ev.match_id}`,
      title:      ev.title || ev.name || 'Cricket Match',
      tournament: detectTournament(ev.title || ev.name || ''),
      teams: {
        home:      ev.home || ev.team1 || null,
        away:      ev.away || ev.team2 || null,
        homeBadge: null,
        awayBadge: null,
      },
      poster:     ev.poster || ev.thumbnail || null,
      isLive:     true,
      startTime:  ev.start_time || ev.time || null,
      tags:       buildCricketTags(ev.title || ev.name || ''),
      streams,
      dataSource: 'embedme.top',
    };
  }).filter(m => m.streams.length > 0);

  cache.set('cstream:embedme', result, 'short');
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SOURCE 4 — JioHotstar public embed (live cricket events on JioHotstar)
//
//  JioHotstar has a public embed player URL pattern.
//  We use their sports listing API (no auth required for public schedule data)
//  to discover live cricket events and build embed URLs.
// ══════════════════════════════════════════════════════════════════════════════

async function fromJioHotstar() {
  const cached = cache.get('cstream:jiohotstar', 'short');
  if (cached) return cached;

  // JioHotstar public sports schedule (cricket) — no auth required
  const endpoints = [
    'https://api.hotstar.com/o/v1/page/1316?offset=0&size=20&tao=0&tas=20',
    'https://api.hotstar.com/o/v1/page/1126?offset=0&size=20&tao=0&tas=20', // cricket
  ];

  const results = [];

  for (const url of endpoints) {
    const data = await safeFetch(url, {
      'x-country-code': 'IN',
      'x-platform':     'web',
      Referer:          'https://www.jiohotstar.com/',
    });

    const items = data?.body?.results?.items || data?.body?.items || [];
    for (const item of items) {
      if (!isCricketSport(item.contentType || item.genre || item.title || '')) continue;

      const contentId = item.contentId || item.id;
      if (!contentId) continue;

      const embedUrl = `https://www.jiohotstar.com/sports/cricket/${contentId}`;
      const playerEmbed = `https://www.hotstar.com/in/player-embed?contentId=${contentId}&playerType=SVOD`;

      results.push({
        id:         `jiohotstar_${contentId}`,
        title:      item.title || item.name || 'Cricket on JioHotstar',
        tournament: detectTournament(item.title || item.seasonName || ''),
        teams: {
          home:      item.team1 || null,
          away:      item.team2 || null,
          homeBadge: null,
          awayBadge: null,
        },
        poster:     item.imgLandscape || item.imgPortrait || item.poster || null,
        isLive:     item.contentType === 'SPORT' || item.broadcastType === 'LIVE',
        startTime:  item.broadCastDate ? new Date(item.broadCastDate * 1000).toISOString() : null,
        tags:       buildCricketTags(item.title || ''),
        streams: [
          {
            label:      'JioHotstar — Watch',
            streamUrl:  embedUrl,
            embedUrl:   playerEmbed,
            streamType: 'iframe',
            m3u8:       null,
            source:     'jiohotstar',
            quality:    'HD',
          },
        ],
        dataSource: 'jiohotstar',
      });
    }
  }

  cache.set('cstream:jiohotstar', results, 'short');
  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SOURCE 5 — CricHD-style (public cricket stream aggregator)
//
//  CricHD aggregates stream embed links for live cricket.
//  We use the public page data pattern to extract available matches.
// ══════════════════════════════════════════════════════════════════════════════

async function fromCricHD() {
  const cached = cache.get('cstream:crichd', 'short');
  if (cached) return cached;

  // CricHD exposes match data in a predictable JSON-like pattern via their API
  const data = await safeFetch(
    'https://crichd.ac/api/matches',
    { Referer: 'https://crichd.ac/', Origin: 'https://crichd.ac' }
  );

  // Alternative endpoint if primary fails
  const fallback = data ? null : await safeFetch(
    'https://crichd.vip/api/matches',
    { Referer: 'https://crichd.vip/' }
  );

  const raw = data || fallback;
  const matches = Array.isArray(raw)
    ? raw
    : (raw?.matches || raw?.data || raw?.events || []);

  const result = matches.map((m, idx) => {
    const streams = [];

    // CricHD embed pattern
    const matchId = m.id || m.match_id || m.slug || idx;
    streams.push({
      label:      `CricHD — Stream 1`,
      streamUrl:  `https://crichd.ac/watch/${matchId}`,
      embedUrl:   `https://crichd.ac/embed/${matchId}`,
      streamType: 'iframe',
      m3u8:       m.hls || m.m3u8 || null,
      source:     'crichd',
      quality:    m.quality || 'HD',
    });

    // If there are additional stream links in the object
    (m.streams || m.channels || []).forEach((s, i) => {
      const url = s.url || s.stream_url || s.embed || null;
      if (url) {
        streams.push({
          label:      s.label || s.name || `CricHD Stream ${i + 2}`,
          streamUrl:  url,
          embedUrl:   url,
          streamType: (url.includes('.m3u8') || url.includes('hls')) ? 'hls' : 'iframe',
          m3u8:       url.includes('.m3u8') ? url : null,
          source:     'crichd',
          quality:    s.quality || 'HD',
        });
      }
    });

    return {
      id:         `crichd_${matchId}`,
      title:      m.title || m.name || m.match || 'Cricket Match',
      tournament: detectTournament(m.title || m.tournament || m.league || ''),
      teams: {
        home:      m.team1 || m.home || null,
        away:      m.team2 || m.away || null,
        homeBadge: m.team1_flag || m.home_badge || null,
        awayBadge: m.team2_flag || m.away_badge || null,
      },
      poster:     m.poster || m.thumbnail || m.banner || null,
      isLive:     m.isLive !== false && m.status !== 'upcoming',
      startTime:  m.start_time || m.time || m.date || null,
      tags:       buildCricketTags(m.title || m.tournament || ''),
      streams,
      dataSource: 'crichd',
    };
  }).filter(Boolean);

  cache.set('cstream:crichd', result, 'short');
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
//  MERGE & DEDUPLICATE ALL SOURCES
// ══════════════════════════════════════════════════════════════════════════════

let _cache = [];
let _lastFetch = 0;

async function fetchAllCricketStreams() {
  if (Date.now() - _lastFetch < 5 * 60 * 1000 && _cache.length) return _cache;

  console.log('[CricketStream] Fetching from all sources...');

  const [s1, s2, s3, s4, s5] = await Promise.allSettled([
    fromStreamedSu(),
    fromDaddyLive(),
    fromEmbedMe(),
    fromJioHotstar(),
    fromCricHD(),
  ]);

  const all = [
    ...(s1.status === 'fulfilled' ? s1.value : []),
    ...(s2.status === 'fulfilled' ? s2.value : []),
    ...(s3.status === 'fulfilled' ? s3.value : []),
    ...(s4.status === 'fulfilled' ? s4.value : []),
    ...(s5.status === 'fulfilled' ? s5.value : []),
  ];

  // Deduplicate by normalised title
  const seen = new Set();
  const deduped = all.filter(m => {
    const key = (m.title || '').toLowerCase().replace(/\W+/g, '').slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  _cache = deduped;
  _lastFetch = Date.now();

  console.log(`[CricketStream] ${deduped.length} unique cricket matches aggregated`);
  return deduped;
}

async function getLiveCricketStreams() {
  const all = await fetchAllCricketStreams();
  return all.filter(m => m.isLive && m.streams.length > 0);
}

async function getCricketStreamsByTournament(tournament) {
  const t = tournament.toLowerCase();
  const all = await fetchAllCricketStreams();
  return all.filter(m =>
    (m.tournament || '').toLowerCase().includes(t) ||
    (m.title || '').toLowerCase().includes(t) ||
    m.tags.some(tag => tag.toLowerCase().includes(t))
  );
}

async function getCricketStreamById(id) {
  const all = await fetchAllCricketStreams();
  return all.find(m => m.id === id) || null;
}

// ══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function isCricketSport(str) {
  return /cricket|ipl|wpl|t20|odi|test match|bcci|intl/i.test(str);
}

function titleFromTeams(m) {
  const h = m.teams?.home?.name || '';
  const a = m.teams?.away?.name || '';
  return h && a ? `${h} vs ${a}` : h || a || 'Cricket Match';
}

function detectTournament(title) {
  const t = title.toLowerCase();
  if (t.includes('ipl') || t.includes('indian premier'))    return 'IPL';
  if (t.includes('wpl') || t.includes("women's premier"))   return 'WPL';
  if (t.includes('champions trophy'))                        return 'ICC Champions Trophy';
  if (t.includes('world cup') && t.includes('t20'))         return 'ICC T20 World Cup';
  if (t.includes('world cup'))                               return 'ICC Cricket World Cup';
  if (t.includes('test'))                                    return 'Test Cricket';
  if (t.includes('odi'))                                     return 'ODI';
  if (t.includes('t20'))                                     return 'T20';
  if (t.includes('asia cup'))                                return 'Asia Cup';
  if (t.includes('bbl'))                                     return 'Big Bash League';
  if (t.includes('cpl'))                                     return 'Caribbean Premier League';
  if (t.includes('psl'))                                     return 'Pakistan Super League';
  if (t.includes('sa20'))                                    return 'SA20';
  if (t.includes('lpl'))                                     return 'Lanka Premier League';
  return 'International Cricket';
}

function buildCricketTags(title) {
  const t = title.toLowerCase();
  const tags = ['cricket', 'live'];
  if (t.includes('ipl'))            tags.push('ipl');
  if (t.includes('wpl'))            tags.push('wpl');
  if (t.includes('t20'))            tags.push('t20');
  if (t.includes('odi'))            tags.push('odi');
  if (t.includes('test'))           tags.push('test');
  if (t.includes('world cup'))      tags.push('worldcup');
  if (t.includes('champions'))      tags.push('champions-trophy');
  if (t.includes('india'))          tags.push('india');
  if (t.includes('pakistan'))       tags.push('pakistan');
  if (t.includes('australia'))      tags.push('australia');
  if (t.includes('england'))        tags.push('england');
  if (t.includes('new zealand'))    tags.push('new-zealand');
  if (t.includes('south africa'))   tags.push('south-africa');
  if (t.includes('bbl'))            tags.push('bbl');
  if (t.includes('cpl'))            tags.push('cpl');
  if (t.includes('psl'))            tags.push('psl');
  return [...new Set(tags)];
}

function buildMatch(id, title, raw, streams, source) {
  return {
    id,
    title,
    tournament: detectTournament(title),
    teams: {
      home:      raw.teams?.home?.name || null,
      away:      raw.teams?.away?.name || null,
      homeBadge: raw.teams?.home?.badge ? `https://streamed.su${raw.teams.home.badge}` : null,
      awayBadge: raw.teams?.away?.badge ? `https://streamed.su${raw.teams.away.badge}` : null,
    },
    poster:     raw.poster ? `https://streamed.su${raw.poster}` : null,
    isLive:     raw.isLive !== false,
    startTime:  raw.date ? new Date(raw.date * 1000).toISOString() : null,
    tags:       buildCricketTags(title),
    streams,
    dataSource: source,
  };
}

function parseDaddyTime(dateKey, timeStr) {
  try { return new Date(`${dateKey} ${timeStr} UTC`).toISOString(); } catch { return null; }
}

module.exports = {
  fetchAllCricketStreams,
  getLiveCricketStreams,
  getCricketStreamsByTournament,
  getCricketStreamById,
};
