const router = require('express').Router();
const sports = require('../services/sportsService');

const ok = (res, data) => res.json({ success: true, data });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// ══════════════════════════════════════════════════════════════════════════════
//  SPORTS & LEAGUES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/sports/all_sports
router.get('/all_sports', wrap(async (req, res) => {
  ok(res, await sports.getAllSports());
}));

// GET /api/sports/leagues
router.get('/leagues', wrap(async (req, res) => {
  ok(res, await sports.getAllLeagues());
}));

// GET /api/sports/leagues/search?q=premier
router.get('/leagues/search', wrap(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'q is required' });
  ok(res, await sports.searchLeagues(q));
}));

// GET /api/sports/leagues/by_country?country=England
router.get('/leagues/by_country', wrap(async (req, res) => {
  const { country } = req.query;
  if (!country) return res.status(400).json({ success: false, message: 'country is required' });
  ok(res, await sports.getLeaguesByCountry(country));
}));

// GET /api/sports/leagues/by_sport?sport=Soccer
router.get('/leagues/by_sport', wrap(async (req, res) => {
  const { sport } = req.query;
  if (!sport) return res.status(400).json({ success: false, message: 'sport is required' });
  ok(res, await sports.getLeaguesBySport(sport));
}));

// GET /api/sports/leagues/:id
router.get('/leagues/:id', wrap(async (req, res) => {
  ok(res, await sports.getLeagueDetails(req.params.id));
}));

// ══════════════════════════════════════════════════════════════════════════════
//  TEAMS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/sports/teams/search?q=arsenal
router.get('/teams/search', wrap(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'q is required' });
  ok(res, await sports.searchTeams(q));
}));

// GET /api/sports/teams/by_league?league=English+Premier+League
router.get('/teams/by_league', wrap(async (req, res) => {
  const { league } = req.query;
  if (!league) return res.status(400).json({ success: false, message: 'league is required' });
  ok(res, await sports.getTeamsByLeague(league));
}));

// GET /api/sports/teams/by_sport?sport=Soccer&country=England
router.get('/teams/by_sport', wrap(async (req, res) => {
  const { sport, country } = req.query;
  if (!sport || !country) return res.status(400).json({ success: false, message: 'sport and country are required' });
  ok(res, await sports.getTeamsBySportAndCountry(sport, country));
}));

// GET /api/sports/teams/:id
router.get('/teams/:id', wrap(async (req, res) => {
  ok(res, await sports.getTeamDetails(req.params.id));
}));

// GET /api/sports/teams/:id/players
router.get('/teams/:id/players', wrap(async (req, res) => {
  ok(res, await sports.getTeamPlayers(req.params.id));
}));

// GET /api/sports/teams/:id/events/next
router.get('/teams/:id/events/next', wrap(async (req, res) => {
  ok(res, await sports.getTeamEvents(req.params.id));
}));

// GET /api/sports/teams/:id/events/past
router.get('/teams/:id/events/past', wrap(async (req, res) => {
  ok(res, await sports.getTeamPastEvents(req.params.id));
}));

// GET /api/sports/teams/:id/seasons?season=2023-2024
router.get('/teams/:id/seasons', wrap(async (req, res) => {
  ok(res, await sports.getTeamSeasonResults(req.params.id, req.query.season));
}));

// ══════════════════════════════════════════════════════════════════════════════
//  PLAYERS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/sports/players/search?q=ronaldo
router.get('/players/search', wrap(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'q is required' });
  ok(res, await sports.searchPlayers(q));
}));

// GET /api/sports/players/:id
router.get('/players/:id', wrap(async (req, res) => {
  ok(res, await sports.getPlayerDetails(req.params.id));
}));

// GET /api/sports/players/:id/honors
router.get('/players/:id/honors', wrap(async (req, res) => {
  ok(res, await sports.getPlayerHonors(req.params.id));
}));

// GET /api/sports/players/:id/milestones
router.get('/players/:id/milestones', wrap(async (req, res) => {
  ok(res, await sports.getPlayerMilestones(req.params.id));
}));

// GET /api/sports/players/:id/contracts
router.get('/players/:id/contracts', wrap(async (req, res) => {
  ok(res, await sports.getPlayerContracts(req.params.id));
}));

// ══════════════════════════════════════════════════════════════════════════════
//  EVENTS / FIXTURES / LIVE
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/sports/events/live
router.get('/events/live', wrap(async (req, res) => {
  ok(res, await sports.getLiveEvents());
}));

// GET /api/sports/events/live/:sport
router.get('/events/live/:sport', wrap(async (req, res) => {
  ok(res, await sports.getLiveEventsBySport(req.params.sport));
}));

// GET /api/sports/events/search?q=manchester+vs&season=2023-2024
router.get('/events/search', wrap(async (req, res) => {
  const { q, season } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'q is required' });
  ok(res, await sports.searchEvents(q, season));
}));

// GET /api/sports/events/:id
router.get('/events/:id', wrap(async (req, res) => {
  ok(res, await sports.getEventDetails(req.params.id));
}));

// GET /api/sports/events/:id/timeline
router.get('/events/:id/timeline', wrap(async (req, res) => {
  ok(res, await sports.getEventTimeline(req.params.id));
}));

// GET /api/sports/events/:id/stats
router.get('/events/:id/stats', wrap(async (req, res) => {
  ok(res, await sports.getEventStats(req.params.id));
}));

// GET /api/sports/events/:id/lineups
router.get('/events/:id/lineups', wrap(async (req, res) => {
  ok(res, await sports.getEventLineups(req.params.id));
}));

// GET /api/sports/events/:id/highlights
router.get('/events/:id/highlights', wrap(async (req, res) => {
  ok(res, await sports.getEventHighlights(req.params.id));
}));

// ─── League Events ────────────────────────────────────────────────────────────
// GET /api/sports/leagues/:id/events?season=2023-2024
router.get('/leagues/:id/events', wrap(async (req, res) => {
  const { season } = req.query;
  if (!season) return res.status(400).json({ success: false, message: 'season is required' });
  ok(res, await sports.getEventsByLeagueAndSeason(req.params.id, season));
}));

// GET /api/sports/leagues/:id/events/round?season=2023-2024&round=5
router.get('/leagues/:id/events/round', wrap(async (req, res) => {
  const { season, round } = req.query;
  if (!season || !round) return res.status(400).json({ success: false, message: 'season and round required' });
  ok(res, await sports.getEventsByLeagueRound(req.params.id, season, round));
}));

// GET /api/sports/leagues/:id/events/next
router.get('/leagues/:id/events/next', wrap(async (req, res) => {
  ok(res, await sports.getNextEventsByLeague(req.params.id));
}));

// GET /api/sports/leagues/:id/events/past
router.get('/leagues/:id/events/past', wrap(async (req, res) => {
  ok(res, await sports.getLastEventsByLeague(req.params.id));
}));

// ─── Standings ────────────────────────────────────────────────────────────────
// GET /api/sports/leagues/:id/standings?season=2023-2024
router.get('/leagues/:id/standings', wrap(async (req, res) => {
  const { season } = req.query;
  if (!season) return res.status(400).json({ success: false, message: 'season is required' });
  ok(res, await sports.getStandings(req.params.id, season));
}));

// ══════════════════════════════════════════════════════════════════════════════
//  COUNTRIES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/sports/countries
router.get('/countries', wrap(async (req, res) => {
  ok(res, await sports.getAllCountries());
}));

module.exports = router;
