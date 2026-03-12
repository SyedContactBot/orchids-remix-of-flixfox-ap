const NodeCache = require('node-cache');

const shortCache  = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_SHORT)  || 300 });
const mediumCache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_MEDIUM) || 1800 });
const longCache   = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_LONG)   || 86400 });

const CACHES = { short: shortCache, medium: mediumCache, long: longCache };

function get(key, tier = 'medium') {
  return CACHES[tier]?.get(key) ?? null;
}

function set(key, value, tier = 'medium') {
  CACHES[tier]?.set(key, value);
}

function del(key) {
  Object.values(CACHES).forEach(c => c.del(key));
}

function flush() {
  Object.values(CACHES).forEach(c => c.flushAll());
}

function stats() {
  return {
    short:  shortCache.getStats(),
    medium: mediumCache.getStats(),
    long:   longCache.getStats(),
  };
}

module.exports = { get, set, del, flush, stats };
