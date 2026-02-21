/**
 * Estado em memória e persistência em localStorage.
 * Chave: datime_store
 */

const STORAGE_KEY = 'datime_store';

const defaultGroup = { id: 'g-default', name: 'Grupo 1' };

const defaults = {
  groups: [defaultGroup],
  players: [],
  config: {
    playersPerTeam: 6,
    maxPointsPerSet: 25,
    remixLevel: 'normal',
  },
  teams: {
    teamA: [],
    teamB: [],
    reserves: [],
  },
  currentSet: {
    teamAPoints: 0,
    teamBPoints: 0,
    pointHistory: [],
  },
  setsHistory: [],
};

let state = { ...defaults };

function getState() {
  return state;
}

function setState(partial) {
  state = { ...state, ...partial };
  save();
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state = {
      groups: (parsed.groups && parsed.groups.length > 0) ? parsed.groups : defaults.groups,
      players: parsed.players ?? defaults.players,
      config: { ...defaults.config, ...parsed.config },
      teams: { ...defaults.teams, ...parsed.teams },
      currentSet: { ...defaults.currentSet, ...parsed.currentSet },
      setsHistory: parsed.setsHistory ?? defaults.setsHistory,
    };
  } catch (_) {
    state = { ...defaults };
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

function clearAll() {
  state = {
    groups: [defaultGroup],
    players: [],
    config: { ...defaults.config },
    teams: { teamA: [], teamB: [], reserves: [] },
    currentSet: { teamAPoints: 0, teamBPoints: 0, pointHistory: [] },
    setsHistory: [],
  };
  save();
}

export { getState, setState, load, save, clearAll };
