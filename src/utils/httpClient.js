const axios = require('axios');

function createClient(baseURL, headers = {}, timeout = 10000) {
  const client = axios.create({ baseURL, headers, timeout });

  client.interceptors.response.use(
    res => res,
    err => {
      const msg = err.response?.data?.message || err.message;
      const status = err.response?.status || 500;
      const error = new Error(msg);
      error.status = status;
      return Promise.reject(error);
    }
  );

  return client;
}

const tmdbClient = createClient(
  process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
  { 'Content-Type': 'application/json' }
);

const sportsDBClient = createClient(
  process.env.SPORTSDB_BASE_URL || 'https://www.thesportsdb.com/api/v1/json'
);

const footballClient = createClient(
  process.env.API_FOOTBALL_BASE || 'https://v3.football.api-sports.io',
  {
    'x-rapidapi-host': 'v3.football.api-sports.io',
    'x-rapidapi-key': process.env.API_FOOTBALL_KEY || '',
  }
);

const kitsuClient = createClient(
  process.env.KITSU_BASE_URL || 'https://kitsu.io/api/edge',
  { 'Content-Type': 'application/vnd.api+json' }
);

module.exports = { tmdbClient, sportsDBClient, footballClient, kitsuClient };
