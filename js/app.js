// Shared utilities, PokeAPI helpers, localStorage management

const API = 'https://pokeapi.co/api/v2';
const CACHE = {};

// --- PokeAPI ---

async function fetchPokemon(nameOrId) {
  const key = String(nameOrId).toLowerCase();
  if (CACHE[key]) return CACHE[key];
  const res = await fetch(`${API}/pokemon/${key}`);
  if (!res.ok) throw new Error(`Pokemon not found: ${nameOrId}`);
  const data = await res.json();
  CACHE[key] = data;
  return data;
}

async function fetchMove(nameOrId) {
  const key = `__move__${String(nameOrId).toLowerCase()}`;
  if (CACHE[key]) return CACHE[key];
  const res = await fetch(`${API}/move/${String(nameOrId).toLowerCase()}`);
  if (!res.ok) throw new Error(`Move not found: ${nameOrId}`);
  const data = await res.json();
  CACHE[key] = data;
  return data;
}

async function fetchItemList(limit = 2000) {
  if (CACHE['__items__']) return CACHE['__items__'];
  const res = await fetch(`${API}/item?limit=${limit}`);
  const data = await res.json();
  CACHE['__items__'] = data.results.map(i => i.name);
  return CACHE['__items__'];
}

async function fetchItem(nameOrId) {
  const key = `__item__${String(nameOrId).toLowerCase()}`;
  if (CACHE[key]) return CACHE[key];
  const res = await fetch(`${API}/item/${String(nameOrId).toLowerCase()}`);
  if (!res.ok) throw new Error(`Item not found: ${nameOrId}`);
  const data = await res.json();
  CACHE[key] = data;
  return data;
}

async function fetchPokemonList(limit = 1025) {
  if (CACHE['__list__']) return CACHE['__list__'];
  const res = await fetch(`${API}/pokemon?limit=${limit}`);
  const data = await res.json();
  CACHE['__list__'] = data.results;
  return data.results;
}

// Get official art or default sprite
function getSpriteUrl(pokemonData) {
  return (
    pokemonData.sprites?.other?.['official-artwork']?.front_default ||
    pokemonData.sprites?.front_default ||
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png'
  );
}

function getIconUrl(pokemonData) {
  return (
    pokemonData.sprites?.front_default ||
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png'
  );
}

function getTypes(pokemonData) {
  return pokemonData.types.map(t => t.type.name);
}

function getStats(pokemonData) {
  return pokemonData.stats.map(s => ({ name: s.stat.name, value: s.base_stat }));
}

// --- localStorage team ---

function getMyTeam() {
  try { return JSON.parse(localStorage.getItem('myTeam') || '[]'); } catch { return []; }
}

function saveMyTeam(team) {
  localStorage.setItem('myTeam', JSON.stringify(team));
}

function getSelectedOpponent() {
  try { return JSON.parse(localStorage.getItem('selectedOpponent') || 'null'); } catch { return null; }
}

function saveSelectedOpponent(opp) {
  localStorage.setItem('selectedOpponent', JSON.stringify(opp));
}

// --- UI helpers ---

function typeBadge(type) {
  return `<span class="type-badge type-${type}">${type}</span>`;
}

function statColor(val) {
  if (val >= 100) return '#4ade80';
  if (val >= 70)  return '#86efac';
  if (val >= 50)  return '#fbbf24';
  return '#f87171';
}

function multLabel(mult) {
  if (mult === 0) return `<span class="pill pill-gray">Immune</span>`;
  if (mult >= 4)  return `<span class="pill pill-green">4×</span>`;
  if (mult === 2) return `<span class="pill pill-green">2×</span>`;
  if (mult === 1) return `<span class="pill pill-gray">1×</span>`;
  if (mult === 0.5) return `<span class="pill pill-red">½×</span>`;
  if (mult === 0.25) return `<span class="pill pill-red">¼×</span>`;
  return `<span class="pill pill-gray">${mult}×</span>`;
}

// Set active nav link based on current page
function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === path);
  });
}

// Render a stat bar row
function renderStatBar(name, value) {
  const max = 255;
  const pct = Math.round((value / max) * 100);
  const color = statColor(value);
  const labels = {
    'hp': 'HP', 'attack': 'ATK', 'defense': 'DEF',
    'special-attack': 'SpATK', 'special-defense': 'SpDEF', 'speed': 'SPD'
  };
  return `<div class="stat-row">
    <span class="stat-name">${labels[name] || name}</span>
    <div class="stat-track"><div class="stat-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="stat-val">${value}</span>
  </div>`;
}

// Render a full Pokemon card (used on team builder + comparison)
function renderPokemonCard(pkData, level, removable = false, idx = null) {
  const types = getTypes(pkData);
  const sprite = getSpriteUrl(pkData);
  const typeHTML = types.map(typeBadge).join('');
  const removeBtn = removable
    ? `<button class="remove-btn" onclick="removeFromTeam(${idx})" title="Remove">✕</button>` : '';
  return `
    <div class="pokemon-card filled">
      ${removeBtn}
      <img src="${sprite}" alt="${pkData.name}" loading="lazy">
      <div class="pkmn-name">${pkData.name}</div>
      ${level ? `<div class="pkmn-level">Lv. ${level}</div>` : ''}
      <div class="types">${typeHTML}</div>
    </div>`;
}

/**
 * Return up to 4 level-up moves the Pokemon would know at the given level.
 * Takes the highest-level move learned at or below `level` across any version group.
 */
function getLevelUpMoves(pkData, level) {
  const best = new Map(); // moveName → highest level_learned_at ≤ level
  for (const entry of pkData.moves) {
    const name = entry.move.name;
    for (const vg of entry.version_group_details) {
      const ll = vg.level_learned_at;
      if (vg.move_learn_method.name === 'level-up' && ll > 0 && ll <= level) {
        if (!best.has(name) || ll > best.get(name)) best.set(name, ll);
      }
    }
  }
  return [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);
}

document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  const hamburger = document.querySelector('.hamburger');
  const navLinks  = document.querySelector('.nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
    // Close menu when a link is tapped
    navLinks.addEventListener('click', e => {
      if (e.target.tagName === 'A') navLinks.classList.remove('open');
    });
  }
});
