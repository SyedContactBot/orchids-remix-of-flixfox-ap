const animeList = document.getElementById('animeList');
const sportsList = document.getElementById('sportsList');
const streamsList = document.getElementById('streamsList');
const animeQuery = document.getElementById('animeQuery');
const animeSearchBtn = document.getElementById('animeSearchBtn');

function card(title, sub, link = null, linkText = 'Open') {
  const a = link ? `<a class="link" href="${link}" target="_blank" rel="noreferrer">${linkText}</a>` : '';
  return `<div class="card"><div class="card-title">${title}</div><div class="card-sub">${sub || '-'}</div>${a}</div>`;
}

function setLoading(el, label) {
  el.innerHTML = card(`Loading ${label}...`, 'Please wait');
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function normalizeAnimeData(payload) {
  if (!payload) return [];
  const d = payload.data;
  if (!d) return [];

  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

async function loadAnime(q = 'one piece') {
  setLoading(animeList, 'anime');
  try {
    const endpoint = `/api/anime/search?q=${encodeURIComponent(q)}&page[limit]=12`;
    const json = await fetchJson(endpoint);
    const items = normalizeAnimeData(json);

    if (!items.length) {
      animeList.innerHTML = card('No anime found', 'Try another query');
      return;
    }

    animeList.innerHTML = items
      .map(item => {
        const attr = item.attributes || {};
        const title = attr.canonicalTitle || attr.titles?.en_jp || attr.titles?.en || 'Unknown';
        const sub = `${attr.status || 'n/a'} | ${attr.averageRating || 'NR'} rating`;
        return card(title, sub);
      })
      .join('');
  } catch (err) {
    animeList.innerHTML = card('Anime API error', err.message);
  }
}

async function loadSports() {
  setLoading(sportsList, 'sports');
  try {
    const json = await fetchJson('/api/sports/events/live');
    const events = json?.data?.events || json?.data?.event || [];

    if (!events.length) {
      sportsList.innerHTML = card('No live events right now', 'Try again later');
      return;
    }

    sportsList.innerHTML = events
      .slice(0, 14)
      .map(ev => {
        const title = ev.strEvent || `${ev.strHomeTeam || ''} vs ${ev.strAwayTeam || ''}`.trim();
        const sub = `${ev.strSport || 'Sport'} | ${ev.strLeague || 'League'} | ${ev.strStatus || ev.strTimestamp || 'Live'}`;
        return card(title || 'Live Event', sub);
      })
      .join('');
  } catch (err) {
    sportsList.innerHTML = card('Sports API error', err.message);
  }
}

async function loadStreams() {
  setLoading(streamsList, 'streams');
  try {
    const json = await fetchJson('/api/auto-streams/live');
    const streams = Array.isArray(json?.data) ? json.data : [];

    if (!streams.length) {
      streamsList.innerHTML = card('No live streams found', 'Aggregators may be down temporarily');
      return;
    }

    streamsList.innerHTML = streams
      .slice(0, 16)
      .map(item => {
        const first = item.streams?.[0];
        const sub = `${item.category || 'sports'} | ${item.dataSource || 'source'} | ${item.streams?.length || 0} links`;
        return card(item.title || 'Live Stream', sub, first?.streamUrl || first?.embedUrl || null, 'Watch');
      })
      .join('');
  } catch (err) {
    streamsList.innerHTML = card('Streams API error', err.message);
  }
}

animeSearchBtn.addEventListener('click', () => {
  const q = animeQuery.value.trim();
  loadAnime(q || 'one piece');
});

animeQuery.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    animeSearchBtn.click();
  }
});

loadAnime();
loadSports();
loadStreams();
