const { kitsuClient } = require('../utils/httpClient');
const cache = require('../cache/cacheManager');

async function fetchKitsu(path, params = {}, tier = 'medium') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const cacheKey = `kitsu:${cleanPath}:${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey, tier);
  if (cached) return cached;

  const res = await kitsuClient.get(cleanPath, { params });
  cache.set(cacheKey, res.data, tier);
  return res.data;
}

function toPathParams(query = {}) {
  const params = { ...query };

  // Friendly aliases
  if (params.q && !params['filter[text]']) {
    params['filter[text]'] = params.q;
    delete params.q;
  }
  if (params.limit && !params['page[limit]']) {
    params['page[limit]'] = params.limit;
    delete params.limit;
  }
  if (params.offset && !params['page[offset]']) {
    params['page[offset]'] = params.offset;
    delete params.offset;
  }

  return params;
}

async function listAnime(query = {}) {
  return fetchKitsu('/anime', toPathParams(query), 'medium');
}

async function searchAnime(text, query = {}) {
  return fetchKitsu('/anime', { ...toPathParams(query), 'filter[text]': text }, 'short');
}

async function getAnimeById(id, query = {}) {
  return fetchKitsu(`/anime/${id}`, toPathParams(query), 'long');
}

async function getAnimeRelationship(id, relationship, query = {}) {
  return fetchKitsu(`/anime/${id}/${relationship}`, toPathParams(query), 'medium');
}

async function proxyKitsu(path, query = {}) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return fetchKitsu(normalized, toPathParams(query), 'medium');
}

module.exports = {
  listAnime,
  searchAnime,
  getAnimeById,
  getAnimeRelationship,
  proxyKitsu,
};
