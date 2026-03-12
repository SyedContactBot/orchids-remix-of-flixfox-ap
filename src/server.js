require('dotenv').config();

const express     = require('express');
const path        = require('path');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');

const rateLimiter  = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const cache        = require('./cache/cacheManager');

// Routes
const moviesRouter      = require('./routes/movies');
const seriesRouter      = require('./routes/series');
const sportsRouter      = require('./routes/sports');
const cricketRouter     = require('./routes/cricket');
const streamsRouter     = require('./routes/streams');
const autoStreamsRouter = require('./routes/autoStreams');
const searchRouter      = require('./routes/search');
const peopleRouter      = require('./routes/people');
const animeRouter          = require('./routes/anime');
const cricketStreamsRouter = require('./routes/cricketStreams');

// Auto-update scheduler (every 5 min)
require('./utils/scheduler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(rateLimiter);
app.use(express.static(path.join(__dirname, '../public')));

// ── Health / Root ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/api', (req, res) => {
  res.json({
    name:         'Media & Sports Streaming API',
    version:      '2.0.0',
    status:       'running',
    auto_update:  'every 5 minutes',
    routes: {
      movies:          '/api/movies',
      series:          '/api/series',
      sports:          '/api/sports',
      cricket:         '/api/cricket',
      cricket_streams: '/api/cricket-streams  ← live IPL/WPL/T20/ODI streams (JioHotstar, CricHD, streamed.su, daddylive)',
      auto_streams:    '/api/auto-streams     ← all live sports streams (no setup needed)',
      streams:         '/api/streams          ← manually managed streams',
      search:          '/api/search',
      people:          '/api/people',
      anime:           '/api/anime',
    },
    docs:   '/api/docs',
    health: '/health',
  });
});

app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    uptime:  process.uptime(),
    memory:  process.memoryUsage(),
    cache:   cache.stats(),
    env_configured: {
      tmdb:        !!process.env.TMDB_API_KEY && process.env.TMDB_API_KEY !== 'your_tmdb_api_key_here',
      cricapi:     !!process.env.CRICAPI_KEY  && process.env.CRICAPI_KEY  !== 'your_cricapi_key_here',
      api_football: !!process.env.API_FOOTBALL_KEY && process.env.API_FOOTBALL_KEY !== 'your_api_football_key_here',
      admin_key:   !!process.env.ADMIN_KEY,
    },
  });
});

app.get('/api/cache/flush', (req, res) => {
  cache.flush();
  res.json({ success: true, message: 'Cache flushed — all data will refresh from sources' });
});

// ── Docs ───────────────────────────────────────────────────────────────────────
app.get('/api/docs', (req, res) => {
  res.json({
    auto_update_interval: '5 minutes (all endpoints)',
    setup: {
      step1_tmdb:     'Get free key at https://www.themoviedb.org/settings/api  →  set TMDB_API_KEY in .env',
      step2_cricapi:  'Get free key at https://cricapi.com                      →  set CRICAPI_KEY in .env',
      step3_football: 'Get free key at https://www.api-football.com             →  set API_FOOTBALL_KEY in .env (optional)',
      step4_admin:    'Set ADMIN_KEY in .env to protect stream write endpoints',
    },
    movies: [
      'GET /api/movies/trending?time_window=week|day&page=1',
      'GET /api/movies/popular?page=1',
      'GET /api/movies/top_rated?page=1',
      'GET /api/movies/now_playing?page=1',
      'GET /api/movies/upcoming?page=1',
      'GET /api/movies/search?q=batman&page=1&year=2022',
      'GET /api/movies/discover?with_genres=28&sort_by=popularity.desc&page=1',
      'GET /api/movies/genres',
      'GET /api/movies/genre/:id?page=1',
      'GET /api/movies/:id',
      'GET /api/movies/:id/videos',
      'GET /api/movies/:id/credits',
      'GET /api/movies/:id/images',
      'GET /api/movies/:id/watch_providers',
    ],
    series_tv: [
      'GET /api/series/trending?time_window=week|day&page=1',
      'GET /api/series/popular?page=1',
      'GET /api/series/top_rated?page=1',
      'GET /api/series/airing_today?page=1',
      'GET /api/series/on_air?page=1',
      'GET /api/series/search?q=breaking+bad&page=1',
      'GET /api/series/discover?with_genres=18&sort_by=popularity.desc',
      'GET /api/series/genres',
      'GET /api/series/genre/:id?page=1',
      'GET /api/series/:id',
      'GET /api/series/:id/seasons/:season_number',
      'GET /api/series/:id/seasons/:season_number/episodes/:episode_number',
      'GET /api/series/:id/videos',
      'GET /api/series/:id/credits',
      'GET /api/series/:id/watch_providers',
      'GET /api/series/:id/content_ratings',
    ],
    sports: [
      'GET /api/sports/all_sports',
      'GET /api/sports/leagues',
      'GET /api/sports/leagues/search?q=premier',
      'GET /api/sports/leagues/by_country?country=England',
      'GET /api/sports/leagues/by_sport?sport=Cricket|Basketball|Tennis|Rugby',
      'GET /api/sports/leagues/:id',
      'GET /api/sports/leagues/:id/events?season=2023-2024',
      'GET /api/sports/leagues/:id/events/round?season=2023-2024&round=5',
      'GET /api/sports/leagues/:id/events/next',
      'GET /api/sports/leagues/:id/events/past',
      'GET /api/sports/leagues/:id/standings?season=2023-2024',
      'GET /api/sports/teams/search?q=csk',
      'GET /api/sports/teams/by_league?league=Indian+Premier+League',
      'GET /api/sports/teams/by_sport?sport=Cricket&country=India',
      'GET /api/sports/teams/:id',
      'GET /api/sports/teams/:id/players',
      'GET /api/sports/teams/:id/events/next',
      'GET /api/sports/teams/:id/events/past',
      'GET /api/sports/teams/:id/seasons?season=2023-2024',
      'GET /api/sports/players/search?q=kohli',
      'GET /api/sports/players/:id',
      'GET /api/sports/players/:id/honors',
      'GET /api/sports/players/:id/milestones',
      'GET /api/sports/players/:id/contracts',
      'GET /api/sports/events/live',
      'GET /api/sports/events/live/:sport',
      'GET /api/sports/events/search?q=india+vs&season=2023-2024',
      'GET /api/sports/events/:id',
      'GET /api/sports/events/:id/timeline',
      'GET /api/sports/events/:id/stats',
      'GET /api/sports/events/:id/lineups',
      'GET /api/sports/events/:id/highlights',
      'GET /api/sports/countries',
    ],
    cricket_live_streams: [
      '=== CRICKET STREAMS — IPL, WPL, T20, ODI, Test, International ===',
      'Sources: JioHotstar embeds, CricHD-style, streamed.su, daddylive, embedme.top',
      'GET /api/cricket-streams                           all matches + stream links',
      'GET /api/cricket-streams/live                      only live right now',
      'GET /api/cricket-streams/ipl                       IPL streams',
      'GET /api/cricket-streams/wpl                       WPL streams',
      'GET /api/cricket-streams/t20                       T20 matches',
      'GET /api/cricket-streams/odi                       ODI matches',
      'GET /api/cricket-streams/test                      Test matches',
      'GET /api/cricket-streams/tournament/:name          by tournament: worldcup|champions-trophy|asia-cup|bbl|cpl|psl|sa20|lpl',
      'GET /api/cricket-streams/search?q=india            search by team / title',
      'GET /api/cricket-streams/:id                       single match + all stream links',
      '--- Each stream object contains ---',
      '{ label, streamUrl, embedUrl, streamType(hls|iframe), m3u8, source, quality }',
    ],
    cricket_ipl_wpl: [
      '--- Requires CRICAPI_KEY in .env (free at cricapi.com) ---',
      'GET /api/cricket/live                         all live cricket matches',
      'GET /api/cricket/scores                       live scores',
      'GET /api/cricket/ipl                          IPL matches',
      'GET /api/cricket/wpl                          WPL matches',
      'GET /api/cricket/international                Tests / ODIs / T20Is',
      'GET /api/cricket/series                       all current series',
      'GET /api/cricket/series/:id',
      'GET /api/cricket/matches/:id',
      'GET /api/cricket/matches/:id/scorecard',
      'GET /api/cricket/matches/:id/squads',
      'GET /api/cricket/players/search?q=virat',
      'GET /api/cricket/players/:id',
      'GET /api/cricket/players/:id/stats',
      'GET /api/cricket/venues',
      'GET /api/cricket/venues/:id',
    ],
    auto_streams_NO_SETUP_NEEDED: [
      '=== AUTO-FETCHED — works immediately, no API key needed ===',
      'Streams are pulled every 5 min from streamed.su, daddylive, embedme.top',
      'GET /api/auto-streams                         all matches with stream links',
      'GET /api/auto-streams/live                    only currently live matches',
      'GET /api/auto-streams/category/cricket        cricket streams (IPL, WPL, intl)',
      'GET /api/auto-streams/category/football       football streams',
      'GET /api/auto-streams/category/basketball',
      'GET /api/auto-streams/category/tennis',
      'GET /api/auto-streams/category/rugby',
      'GET /api/auto-streams/category/motorsport     F1, MotoGP etc',
      'GET /api/auto-streams/category/combat         boxing, MMA, UFC',
      'GET /api/auto-streams/tag/ipl                 IPL streams',
      'GET /api/auto-streams/tag/wpl                 WPL streams',
      'GET /api/auto-streams/tag/t20',
      'GET /api/auto-streams/tag/odi',
      'GET /api/auto-streams/tag/test',
      'GET /api/auto-streams/tag/ucl                 Champions League',
      'GET /api/auto-streams/tag/epl                 Premier League',
      'GET /api/auto-streams/:id                     single match + all stream links',
      '--- Each stream object contains ---',
      '{ streamUrl, embedUrl, streamType(hls|iframe), m3u8, source, label }',
    ],
    manual_streams_admin: [
      '=== MANUALLY MANAGED STREAMS ===',
      'GET /api/streams                              all streams',
      'GET /api/streams/live                         currently live',
      'GET /api/streams/live/cricket                 live cricket streams',
      'GET /api/streams/live/football                live football streams',
      'GET /api/streams/live/sports                  live sports streams',
      'GET /api/streams/live/movies                  live movie streams',
      'GET /api/streams/live/series                  live series streams',
      'GET /api/streams/category/cricket             all cricket streams',
      'GET /api/streams/tag/ipl                      streams tagged ipl',
      'GET /api/streams/tag/wpl                      streams tagged wpl',
      'GET /api/streams/tag/t20',
      'GET /api/streams/tag/odi',
      'GET /api/streams/:id',
      '=== ADMIN WRITE (send x-admin-key header) ===',
      'POST   /api/streams                           add new stream',
      'PATCH  /api/streams/:id                       update stream',
      'DELETE /api/streams/:id                       delete stream',
      '--- Stream POST body ---',
      '{ title*, category, streamUrl*, streamType(hls|dash|iframe|direct),',
      '  thumbnail, description, tags[], isLive, startTime, endTime,',
      '  meta:{ team1, team2, venue, language, ... } }',
    ],
    search_people: [
      'GET /api/search?q=avengers&page=1             movies + series + people',
      'GET /api/search/people?q=tom+hanks',
      'GET /api/people/trending',
      'GET /api/people/:id',
    ],
    anime_kitsu: [
      'GET /api/anime?filter[text]=naruto&page[limit]=10&page[offset]=0',
      'GET /api/anime/search?q=naruto',
      'GET /api/anime/:id',
      'GET /api/anime/:id/episodes',
      'GET /api/anime/:id/characters',
      'GET /api/anime/:id/castings',
      'GET /api/anime/:id/genres',
      'GET /api/anime/:id/media-relationships',
      'GET /api/anime/:id/streaming-links',
      'GET /api/anime/kitsu/:resource...             passthrough to Kitsu edge routes',
    ],
    utility: [
      'GET /health                                   server health + env status',
      'GET /api/cache/flush                          flush all cached data',
    ],
  });
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/movies',       moviesRouter);
app.use('/api/series',       seriesRouter);
app.use('/api/sports',       sportsRouter);
app.use('/api/cricket',      cricketRouter);
app.use('/api/streams',      streamsRouter);
app.use('/api/auto-streams', autoStreamsRouter);
app.use('/api/search',       searchRouter);
app.use('/api/people',       peopleRouter);
app.use('/api/anime',           animeRouter);
app.use('/api/cricket-streams', cricketStreamsRouter);

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, status: 404, message: `Route '${req.path}' not found — see /api/docs` });
});

// ── Error handler ──────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Media & Sports Streaming API v2`);
  console.log(`  URL:         http://localhost:${PORT}`);
  console.log(`  Docs:        http://localhost:${PORT}/api/docs`);
  console.log(`  Health:      http://localhost:${PORT}/health`);
  console.log(`  Streams:     http://localhost:${PORT}/api/streams/live`);
  console.log(`  Auto-update: every 5 minutes\n`);
});

module.exports = app;
