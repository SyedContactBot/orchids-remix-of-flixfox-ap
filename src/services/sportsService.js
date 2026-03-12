const { sportsDBClient, footballClient } = require('../utils/httpClient');
const cache = require('../cache/cacheManager');

const DB_KEY = () => process.env.SPORTSDB_API_KEY || '3';

// ─── Generic TheSportsDB fetch ────────────────────────────────────────────────
async function fetchSportsDB(path, params = {}, tier = 'medium') {
  const cacheKey = `sportsdb:${path}:${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey, tier);
  if (cached) return cached;

  try {
    const res = await sportsDBClient.get(`/${DB_KEY()}${path}`, { params });
    cache.set(cacheKey, res.data, tier);
    return res.data;
  } catch (e) {
    if ([401, 403, 404, 429, 500].includes(e.status)) {
      return {
        error: true,
        source: 'TheSportsDB',
        status: e.status,
        message: e.message,
        endpoint: path,
        params,
      };
    }
    throw e;
  }
}

// ─── Generic API-Football fetch ───────────────────────────────────────────────
async function fetchFootball(path, params = {}, tier = 'short') {
  const cacheKey = `football:${path}:${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey, tier);
  if (cached) return cached;

  try {
    const res = await footballClient.get(path, { params });
    cache.set(cacheKey, res.data, tier);
    return res.data;
  } catch (e) {
    // API-Football key is optional — return null gracefully
    if (e.status === 401 || e.status === 403) return null;
    throw e;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  LEAGUES / SPORTS
// ══════════════════════════════════════════════════════════════════════════════

async function getAllSports() {
  return fetchSportsDB('/all_sports.php', {}, 'long');
}

async function getAllLeagues() {
  return fetchSportsDB('/all_leagues.php', {}, 'long');
}

async function getLeaguesByCountry(country) {
  return fetchSportsDB('/search_all_leagues.php', { c: country }, 'long');
}

async function getLeaguesBySport(sport) {
  return fetchSportsDB('/search_all_leagues.php', { s: sport }, 'long');
}

async function getLeagueDetails(leagueId) {
  return fetchSportsDB('/lookupleague.php', { id: leagueId }, 'long');
}

async function searchLeagues(query) {
  return fetchSportsDB('/search_all_leagues.php', { l: query }, 'medium');
}

// ══════════════════════════════════════════════════════════════════════════════
//  TEAMS
// ══════════════════════════════════════════════════════════════════════════════

async function searchTeams(query) {
  return fetchSportsDB('/searchteams.php', { t: query }, 'medium');
}

async function getTeamsByLeague(leagueName) {
  return fetchSportsDB('/search_all_teams.php', { l: leagueName }, 'medium');
}

async function getTeamsBySportAndCountry(sport, country) {
  return fetchSportsDB('/search_all_teams.php', { s: sport, c: country }, 'medium');
}

async function getTeamDetails(teamId) {
  return fetchSportsDB('/lookupteam.php', { id: teamId }, 'long');
}

async function getTeamPlayers(teamId) {
  return fetchSportsDB('/lookup_all_players.php', { id: teamId }, 'medium');
}

async function getTeamEvents(teamId) {
  return fetchSportsDB('/eventsnext.php', { id: teamId }, 'short');
}

async function getTeamPastEvents(teamId) {
  return fetchSportsDB('/eventslast.php', { id: teamId }, 'short');
}

async function getTeamSeasonResults(teamId, season) {
  return fetchSportsDB('/lookupteamseasons.php', { id: teamId }, 'medium');
}

// ══════════════════════════════════════════════════════════════════════════════
//  PLAYERS
// ══════════════════════════════════════════════════════════════════════════════

async function searchPlayers(query) {
  return fetchSportsDB('/searchplayers.php', { p: query }, 'medium');
}

async function getPlayerDetails(playerId) {
  return fetchSportsDB('/lookupplayer.php', { id: playerId }, 'long');
}

async function getPlayerHonors(playerId) {
  return fetchSportsDB('/lookuphonors.php', { id: playerId }, 'long');
}

async function getPlayerMilestones(playerId) {
  return fetchSportsDB('/lookupmilestones.php', { id: playerId }, 'long');
}

async function getPlayerContracts(playerId) {
  return fetchSportsDB('/lookupcontracts.php', { id: playerId }, 'long');
}

// ══════════════════════════════════════════════════════════════════════════════
//  EVENTS / FIXTURES
// ══════════════════════════════════════════════════════════════════════════════

async function searchEvents(query, season = null) {
  const params = { e: query };
  if (season) params.s = season;
  return fetchSportsDB('/searchevents.php', params, 'short');
}

async function getEventDetails(eventId) {
  return fetchSportsDB('/lookupevent.php', { id: eventId }, 'medium');
}

async function getEventsByLeagueAndSeason(leagueId, season) {
  return fetchSportsDB('/eventsseason.php', { id: leagueId, s: season }, 'medium');
}

async function getEventsByLeagueRound(leagueId, season, round) {
  return fetchSportsDB('/eventsround.php', { id: leagueId, s: season, r: round }, 'short');
}

async function getNextEventsByLeague(leagueId) {
  return fetchSportsDB('/eventsnextleague.php', { id: leagueId }, 'short');
}

async function getLastEventsByLeague(leagueId) {
  return fetchSportsDB('/eventspastleague.php', { id: leagueId }, 'short');
}

async function getLiveEvents() {
  return fetchSportsDB('/livescore.php', {}, 'short', 30); // 30-sec cache for live
}

async function getLiveEventsBySport(sport) {
  return fetchSportsDB('/livescore.php', { s: sport }, 'short');
}

async function getEventTimeline(eventId) {
  return fetchSportsDB('/lookuptimeline.php', { id: eventId }, 'short');
}

async function getEventStats(eventId) {
  return fetchSportsDB('/lookupeventstats.php', { id: eventId }, 'short');
}

async function getEventLineups(eventId) {
  return fetchSportsDB('/lookuplineup.php', { id: eventId }, 'short');
}

async function getEventHighlights(eventId) {
  return fetchSportsDB('/lookupvideo.php', { id: eventId }, 'medium');
}

// ══════════════════════════════════════════════════════════════════════════════
//  STANDINGS / TABLES
// ══════════════════════════════════════════════════════════════════════════════

async function getStandings(leagueId, season) {
  return fetchSportsDB('/lookuptable.php', { l: leagueId, s: season }, 'short');
}

// ══════════════════════════════════════════════════════════════════════════════
//  COUNTRIES
// ══════════════════════════════════════════════════════════════════════════════

async function getAllCountries() {
  return fetchSportsDB('/all_countries.php', {}, 'long');
}

// ══════════════════════════════════════════════════════════════════════════════
//  API-FOOTBALL (optional premium data)
// ══════════════════════════════════════════════════════════════════════════════

async function getFootballFixtures(params = {}) {
  return fetchFootball('/fixtures', params, 'short');
}

async function getFootballLiveFixtures() {
  return fetchFootball('/fixtures', { live: 'all' }, 'short');
}

async function getFootballStandings(leagueId, season) {
  return fetchFootball('/standings', { league: leagueId, season }, 'medium');
}

async function getFootballLeagues(params = {}) {
  return fetchFootball('/leagues', params, 'long');
}

async function getFootballTeamStats(teamId, leagueId, season) {
  return fetchFootball('/teams/statistics', { team: teamId, league: leagueId, season }, 'medium');
}

async function getFootballTopScorers(leagueId, season) {
  return fetchFootball('/players/topscorers', { league: leagueId, season }, 'medium');
}

async function getFootballH2H(team1, team2) {
  return fetchFootball('/fixtures/headtohead', { h2h: `${team1}-${team2}` }, 'medium');
}

module.exports = {
  // Leagues / Sports
  getAllSports, getAllLeagues, getLeaguesByCountry,
  getLeaguesBySport, getLeagueDetails, searchLeagues,

  // Teams
  searchTeams, getTeamsByLeague, getTeamsBySportAndCountry,
  getTeamDetails, getTeamPlayers, getTeamEvents,
  getTeamPastEvents, getTeamSeasonResults,

  // Players
  searchPlayers, getPlayerDetails, getPlayerHonors,
  getPlayerMilestones, getPlayerContracts,

  // Events / Fixtures
  searchEvents, getEventDetails, getEventsByLeagueAndSeason,
  getEventsByLeagueRound, getNextEventsByLeague, getLastEventsByLeague,
  getLiveEvents, getLiveEventsBySport, getEventTimeline,
  getEventStats, getEventLineups, getEventHighlights,

  // Standings
  getStandings,

  // Countries
  getAllCountries,

  // API-Football
  getFootballFixtures, getFootballLiveFixtures, getFootballStandings,
  getFootballLeagues, getFootballTeamStats, getFootballTopScorers, getFootballH2H,
};
