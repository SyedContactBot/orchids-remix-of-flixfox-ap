// In Vercel serverless, node-cron background jobs are not supported.
// We still do a single warm-up on cold start; cron is only registered
// when running as a long-lived process (local dev / self-hosted).
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);

let cron;
if (!isServerless) {
  try { cron = require('node-cron'); } catch (_) {}
}

const cache = require('../cache/cacheManager');
const tmdb        = require('../services/tmdbService');
const sports      = require('../services/sportsService');
const autoStreams  = require('../services/autoStreamService');

let cricketService;
try { cricketService = require('../services/cricketService'); } catch (_) {}

function log(msg) {
  console.log(`[Scheduler][${new Date().toISOString()}] ${msg}`);
}

async function warm(label, fn) {
  try {
    await fn();
    log(`✔ Warmed: ${label}`);
  } catch (e) {
    log(`✘ Failed: ${label} — ${e.message}`);
  }
}

// ── Core refresh (runs every 5 minutes) ──────────────────────────────────────
async function refreshAll() {
  log('=== Starting full refresh ===');

  await Promise.allSettled([
    // ── AUTO STREAMS (highest priority — run first)
    warm('auto streams (all sources)', () => autoStreams.fetchAllAutoStreams()),

    // ── Movies
    warm('trending movies (day)',   () => tmdb.getTrendingMovies('day', 1)),
    warm('trending movies (week)',  () => tmdb.getTrendingMovies('week', 1)),
    warm('popular movies',          () => tmdb.getPopularMovies(1)),
    warm('top rated movies',        () => tmdb.getTopRatedMovies(1)),
    warm('now playing movies',      () => tmdb.getNowPlayingMovies(1)),
    warm('upcoming movies',         () => tmdb.getUpcomingMovies(1)),

    // ── Series / TV
    warm('trending series (day)',   () => tmdb.getTrendingSeries('day', 1)),
    warm('trending series (week)',  () => tmdb.getTrendingSeries('week', 1)),
    warm('popular series',          () => tmdb.getPopularSeries(1)),
    warm('top rated series',        () => tmdb.getTopRatedSeries(1)),
    warm('airing today series',     () => tmdb.getAiringTodaySeries(1)),
    warm('on air series',           () => tmdb.getOnAirSeries(1)),

    // ── Genres (static-ish, still refresh)
    warm('movie genres',            () => tmdb.getMovieGenres()),
    warm('tv genres',               () => tmdb.getSeriesGenres()),

    // ── Sports — live
    warm('live sports events',      () => sports.getLiveEvents()),
    warm('live basketball',         () => sports.getLiveEventsBySport('Basketball')),
    warm('live cricket',            () => sports.getLiveEventsBySport('Cricket')),
    warm('live tennis',             () => sports.getLiveEventsBySport('Tennis')),
    warm('live rugby',              () => sports.getLiveEventsBySport('Rugby')),
    warm('live hockey',             () => sports.getLiveEventsBySport('Ice Hockey')),

    // ── Cricket tournaments
    warm('IPL next events',         () => sports.getNextEventsByLeague('5864')),
    warm('IPL past events',         () => sports.getLastEventsByLeague('5864')),
    warm('WPL next events',         () => sports.getNextEventsByLeague('6116')),
    warm('ICC events next',         () => sports.getNextEventsByLeague('4750')),

    // ── CricAPI live (if configured)
    ...(cricketService ? [
      warm('cricket live matches',  () => cricketService.getLiveMatches()),
      warm('cricket current series',() => cricketService.getCurrentSeries()),
      warm('ipl matches',           () => cricketService.getIPLMatches()),
      warm('wpl matches',           () => cricketService.getWPLMatches()),
      warm('international matches', () => cricketService.getInternationalMatches()),
    ] : []),

    // ── People trending
    warm('trending people',         () => tmdb.getTrendingPeople()),

  ]);

  log('=== Refresh complete ===');
}

// Always run once on cold start (works in both long-lived and serverless)
refreshAll();

if (cron) {
  // Long-lived process: schedule periodic refreshes
  cron.schedule('*/5 * * * *', refreshAll);

  cron.schedule('0 3 * * *', async () => {
    log('=== Daily static refresh ===');
    await Promise.allSettled([
      warm('all sports',     () => sports.getAllSports()),
      warm('all leagues',    () => sports.getAllLeagues()),
      warm('all countries',  () => sports.getAllCountries()),
    ]);
  });

  log('Scheduler initialised — full refresh every 5 minutes.');
} else {
  log('Serverless environment detected — cron scheduling skipped (single warm-up only).');
}

module.exports = { refreshAll };
