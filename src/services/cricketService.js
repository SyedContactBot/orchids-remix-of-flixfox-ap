const axios = require('axios');
const cache = require('../cache/cacheManager');

const CRIC_BASE  = 'https://api.cricapi.com/v1';
const CRIC_KEY   = () => process.env.CRICAPI_KEY || '';

// ─── fetch helper ─────────────────────────────────────────────────────────────
async function fetchCric(endpoint, params = {}, tier = 'short') {
  const key = CRIC_KEY();
  if (!key) return { error: true, message: 'CRICAPI_KEY not configured in .env' };

  const cacheKey = `cric:${endpoint}:${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey, tier);
  if (cached) return cached;

  try {
    const res = await axios.get(`${CRIC_BASE}/${endpoint}`, {
      params: { apikey: key, ...params },
      timeout: 10000,
    });
    cache.set(cacheKey, res.data, tier);
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.message || e.message };
  }
}

// ─── Unofficial Cricbuzz-style public data (no key needed) ──────────────────
async function fetchCricbuzz(path, params = {}, tier = 'short') {
  const cacheKey = `cricbuzz:${path}:${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey, tier);
  if (cached) return cached;

  try {
    const res = await axios.get(`https://cricbuzz-cricket.p.rapidapi.com/${path}`, {
      headers: {
        'x-rapidapi-host': 'cricbuzz-cricket.p.rapidapi.com',
        'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
      },
      params,
      timeout: 10000,
    });
    cache.set(cacheKey, res.data, tier);
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.message || e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  LIVE MATCHES
// ══════════════════════════════════════════════════════════════════════════════

async function getLiveMatches() {
  return fetchCric('currentMatches', { offset: 0 }, 'short');
}

async function getLiveScores() {
  return fetchCric('matches', { offset: 0 }, 'short');
}

// ══════════════════════════════════════════════════════════════════════════════
//  SERIES
// ══════════════════════════════════════════════════════════════════════════════

async function getCurrentSeries() {
  return fetchCric('series', { offset: 0 }, 'short');
}

async function getSeriesInfo(seriesId) {
  return fetchCric('series_info', { id: seriesId }, 'medium');
}

// IPL — series ID 'd5a498c8-7596-4b93-8ab0-e0efc3345312' (2024 season example)
async function getIPLMatches() {
  // Fetch all current series and filter IPL
  const all = await fetchCric('currentMatches', { offset: 0 }, 'short');
  if (all?.error) return all;
  const matches = all?.data || [];
  return {
    ...all,
    data: matches.filter(m =>
      m.series?.toLowerCase().includes('ipl') ||
      m.series?.toLowerCase().includes('indian premier league') ||
      m.name?.toLowerCase().includes('ipl')
    ),
  };
}

// WPL — Women's Premier League
async function getWPLMatches() {
  const all = await fetchCric('currentMatches', { offset: 0 }, 'short');
  if (all?.error) return all;
  const matches = all?.data || [];
  return {
    ...all,
    data: matches.filter(m =>
      m.series?.toLowerCase().includes('wpl') ||
      m.series?.toLowerCase().includes("women's premier league") ||
      m.name?.toLowerCase().includes('wpl')
    ),
  };
}

// International matches (Tests, ODIs, T20Is)
async function getInternationalMatches() {
  const all = await fetchCric('currentMatches', { offset: 0 }, 'short');
  if (all?.error) return all;
  const matches = all?.data || [];
  return {
    ...all,
    data: matches.filter(m =>
      m.matchType?.toLowerCase().includes('test') ||
      m.matchType?.toLowerCase().includes('odi') ||
      m.matchType?.toLowerCase().includes('t20i') ||
      m.matchType?.toLowerCase().includes('t20 i') ||
      m.series?.toLowerCase().includes('international')
    ),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  MATCH INFO
// ══════════════════════════════════════════════════════════════════════════════

async function getMatchInfo(matchId) {
  return fetchCric('match_info', { id: matchId }, 'short');
}

async function getMatchScorecard(matchId) {
  return fetchCric('match_scorecard', { id: matchId }, 'short');
}

async function getMatchSquads(matchId) {
  return fetchCric('match_squad', { id: matchId }, 'short');
}

// ══════════════════════════════════════════════════════════════════════════════
//  PLAYERS
// ══════════════════════════════════════════════════════════════════════════════

async function searchPlayer(name) {
  return fetchCric('players', { search: name, offset: 0 }, 'medium');
}

async function getPlayerInfo(playerId) {
  return fetchCric('players_info', { id: playerId }, 'long');
}

async function getPlayerStats(playerId) {
  return fetchCric('player_batting_stats', { id: playerId }, 'medium');
}

// ══════════════════════════════════════════════════════════════════════════════
//  VENUES
// ══════════════════════════════════════════════════════════════════════════════

async function getVenues() {
  return fetchCric('venues', { offset: 0 }, 'long');
}

async function getVenueInfo(venueId) {
  return fetchCric('venues_info', { id: venueId }, 'long');
}

module.exports = {
  getLiveMatches, getLiveScores,
  getCurrentSeries, getSeriesInfo,
  getIPLMatches, getWPLMatches, getInternationalMatches,
  getMatchInfo, getMatchScorecard, getMatchSquads,
  searchPlayer, getPlayerInfo, getPlayerStats,
  getVenues, getVenueInfo,
};
