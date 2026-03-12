const { tmdbClient } = require('../utils/httpClient');
const cache = require('../cache/cacheManager');

const API_KEY = () => process.env.TMDB_API_KEY;
const IMG_BASE = process.env.TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p';

// ─── Image helpers ────────────────────────────────────────────────────────────
function buildImages(item) {
  return {
    poster:    item.poster_path    ? `${IMG_BASE}/w500${item.poster_path}`    : null,
    backdrop:  item.backdrop_path  ? `${IMG_BASE}/w1280${item.backdrop_path}` : null,
    poster_original:   item.poster_path   ? `${IMG_BASE}/original${item.poster_path}`   : null,
    backdrop_original: item.backdrop_path ? `${IMG_BASE}/original${item.backdrop_path}` : null,
  };
}

// ─── Normalize movie ──────────────────────────────────────────────────────────
function normalizeMovie(m) {
  return {
    id:            m.id,
    type:          'movie',
    title:         m.title || m.original_title,
    original_title: m.original_title,
    overview:      m.overview,
    tagline:       m.tagline || null,
    release_date:  m.release_date,
    runtime:       m.runtime || null,
    status:        m.status || null,
    language:      m.original_language,
    popularity:    m.popularity,
    vote_average:  m.vote_average,
    vote_count:    m.vote_count,
    adult:         m.adult,
    genres:        m.genres || m.genre_ids || [],
    images:        buildImages(m),
    imdb_id:       m.imdb_id || null,
    homepage:      m.homepage || null,
    budget:        m.budget || null,
    revenue:       m.revenue || null,
    production_companies: m.production_companies || [],
    production_countries: m.production_countries || [],
    spoken_languages:     m.spoken_languages || [],
    videos:        m.videos?.results || [],
    credits:       m.credits || null,
    similar:       m.similar?.results?.map(normalizeMovie) || [],
    recommendations: m.recommendations?.results?.map(normalizeMovie) || [],
  };
}

// ─── Normalize TV / Series ────────────────────────────────────────────────────
function normalizeSeries(s) {
  return {
    id:              s.id,
    type:            'series',
    title:           s.name || s.original_name,
    original_title:  s.original_name,
    overview:        s.overview,
    tagline:         s.tagline || null,
    first_air_date:  s.first_air_date,
    last_air_date:   s.last_air_date || null,
    status:          s.status || null,
    number_of_seasons:  s.number_of_seasons || null,
    number_of_episodes: s.number_of_episodes || null,
    episode_run_time:   s.episode_run_time || [],
    language:        s.original_language,
    popularity:      s.popularity,
    vote_average:    s.vote_average,
    vote_count:      s.vote_count,
    adult:           s.adult,
    genres:          s.genres || s.genre_ids || [],
    images:          buildImages(s),
    networks:        s.networks || [],
    seasons:         s.seasons || [],
    videos:          s.videos?.results || [],
    credits:         s.credits || null,
    similar:         s.similar?.results?.map(normalizeSeries) || [],
    recommendations: s.recommendations?.results?.map(normalizeSeries) || [],
    created_by:      s.created_by || [],
  };
}

// ─── Generic fetch with cache ─────────────────────────────────────────────────
async function fetchTMDB(path, params = {}, cacheTier = 'medium', cacheKey = null) {
  const key = cacheKey || `tmdb:${path}:${JSON.stringify(params)}`;
  const cached = cache.get(key, cacheTier);
  if (cached) return cached;

  const res = await tmdbClient.get(path, {
    params: { api_key: API_KEY(), language: 'en-US', ...params },
  });

  cache.set(key, res.data, cacheTier);
  return res.data;
}

// ══════════════════════════════════════════════════════════════════════════════
//  MOVIES
// ══════════════════════════════════════════════════════════════════════════════

async function getTrendingMovies(timeWindow = 'week', page = 1) {
  const data = await fetchTMDB(`/trending/movie/${timeWindow}`, { page }, 'short');
  return { ...data, results: data.results.map(normalizeMovie) };
}

async function getPopularMovies(page = 1) {
  const data = await fetchTMDB('/movie/popular', { page }, 'short');
  return { ...data, results: data.results.map(normalizeMovie) };
}

async function getTopRatedMovies(page = 1) {
  const data = await fetchTMDB('/movie/top_rated', { page }, 'medium');
  return { ...data, results: data.results.map(normalizeMovie) };
}

async function getNowPlayingMovies(page = 1) {
  const data = await fetchTMDB('/movie/now_playing', { page }, 'short');
  return { ...data, results: data.results.map(normalizeMovie) };
}

async function getUpcomingMovies(page = 1) {
  const data = await fetchTMDB('/movie/upcoming', { page }, 'short');
  return { ...data, results: data.results.map(normalizeMovie) };
}

async function getMovieDetails(id) {
  const data = await fetchTMDB(
    `/movie/${id}`,
    { append_to_response: 'videos,credits,similar,recommendations,images' },
    'long'
  );
  return normalizeMovie(data);
}

async function getMovieVideos(id) {
  const data = await fetchTMDB(`/movie/${id}/videos`, {}, 'long');
  return data.results || [];
}

async function getMovieCredits(id) {
  return fetchTMDB(`/movie/${id}/credits`, {}, 'long');
}

async function getMovieImages(id) {
  return fetchTMDB(`/movie/${id}/images`, { include_image_language: 'en,null' }, 'long');
}

async function searchMovies(query, page = 1, year = null) {
  const params = { query, page };
  if (year) params.year = year;
  const data = await fetchTMDB('/search/movie', params, 'short');
  return { ...data, results: data.results.map(normalizeMovie) };
}

async function discoverMovies(params = {}) {
  const data = await fetchTMDB('/discover/movie', params, 'medium');
  return { ...data, results: data.results.map(normalizeMovie) };
}

async function getMovieGenres() {
  return fetchTMDB('/genre/movie/list', {}, 'long');
}

async function getMoviesByGenre(genreId, page = 1) {
  return discoverMovies({ with_genres: genreId, page, sort_by: 'popularity.desc' });
}

async function getMovieWatchProviders(id) {
  return fetchTMDB(`/movie/${id}/watch/providers`, {}, 'long');
}

// ══════════════════════════════════════════════════════════════════════════════
//  TV SERIES
// ══════════════════════════════════════════════════════════════════════════════

async function getTrendingSeries(timeWindow = 'week', page = 1) {
  const data = await fetchTMDB(`/trending/tv/${timeWindow}`, { page }, 'short');
  return { ...data, results: data.results.map(normalizeSeries) };
}

async function getPopularSeries(page = 1) {
  const data = await fetchTMDB('/tv/popular', { page }, 'short');
  return { ...data, results: data.results.map(normalizeSeries) };
}

async function getTopRatedSeries(page = 1) {
  const data = await fetchTMDB('/tv/top_rated', { page }, 'medium');
  return { ...data, results: data.results.map(normalizeSeries) };
}

async function getAiringTodaySeries(page = 1) {
  const data = await fetchTMDB('/tv/airing_today', { page }, 'short');
  return { ...data, results: data.results.map(normalizeSeries) };
}

async function getOnAirSeries(page = 1) {
  const data = await fetchTMDB('/tv/on_the_air', { page }, 'short');
  return { ...data, results: data.results.map(normalizeSeries) };
}

async function getSeriesDetails(id) {
  const data = await fetchTMDB(
    `/tv/${id}`,
    { append_to_response: 'videos,credits,similar,recommendations,images,content_ratings' },
    'long'
  );
  return normalizeSeries(data);
}

async function getSeasonDetails(seriesId, seasonNumber) {
  return fetchTMDB(`/tv/${seriesId}/season/${seasonNumber}`, {}, 'long');
}

async function getEpisodeDetails(seriesId, seasonNumber, episodeNumber) {
  return fetchTMDB(
    `/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`,
    { append_to_response: 'videos,credits' },
    'long'
  );
}

async function getSeriesVideos(id) {
  const data = await fetchTMDB(`/tv/${id}/videos`, {}, 'long');
  return data.results || [];
}

async function getSeriesCredits(id) {
  return fetchTMDB(`/tv/${id}/credits`, {}, 'long');
}

async function searchSeries(query, page = 1) {
  const data = await fetchTMDB('/search/tv', { query, page }, 'short');
  return { ...data, results: data.results.map(normalizeSeries) };
}

async function discoverSeries(params = {}) {
  const data = await fetchTMDB('/discover/tv', params, 'medium');
  return { ...data, results: data.results.map(normalizeSeries) };
}

async function getSeriesGenres() {
  return fetchTMDB('/genre/tv/list', {}, 'long');
}

async function getSeriesByGenre(genreId, page = 1) {
  return discoverSeries({ with_genres: genreId, page, sort_by: 'popularity.desc' });
}

async function getSeriesWatchProviders(id) {
  return fetchTMDB(`/tv/${id}/watch/providers`, {}, 'long');
}

async function getSeriesContentRatings(id) {
  return fetchTMDB(`/tv/${id}/content_ratings`, {}, 'long');
}

// ══════════════════════════════════════════════════════════════════════════════
//  MULTI SEARCH
// ══════════════════════════════════════════════════════════════════════════════

async function multiSearch(query, page = 1) {
  const data = await fetchTMDB('/search/multi', { query, page }, 'short');
  return {
    ...data,
    results: data.results.map(item => {
      if (item.media_type === 'movie') return normalizeMovie(item);
      if (item.media_type === 'tv')    return normalizeSeries(item);
      return item;
    }),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  PEOPLE / CAST
// ══════════════════════════════════════════════════════════════════════════════

async function getPersonDetails(id) {
  return fetchTMDB(`/person/${id}`, { append_to_response: 'movie_credits,tv_credits,images' }, 'long');
}

async function getTrendingPeople() {
  return fetchTMDB('/trending/person/week', {}, 'short');
}

module.exports = {
  // Movies
  getTrendingMovies, getPopularMovies, getTopRatedMovies,
  getNowPlayingMovies, getUpcomingMovies, getMovieDetails,
  getMovieVideos, getMovieCredits, getMovieImages,
  searchMovies, discoverMovies, getMovieGenres,
  getMoviesByGenre, getMovieWatchProviders,

  // Series
  getTrendingSeries, getPopularSeries, getTopRatedSeries,
  getAiringTodaySeries, getOnAirSeries, getSeriesDetails,
  getSeasonDetails, getEpisodeDetails, getSeriesVideos,
  getSeriesCredits, searchSeries, discoverSeries,
  getSeriesGenres, getSeriesByGenre, getSeriesWatchProviders,
  getSeriesContentRatings,

  // Multi
  multiSearch,

  // People
  getPersonDetails, getTrendingPeople,
};
