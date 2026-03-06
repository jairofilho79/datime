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
    maxPointsPerPartida: 25,
    remixLevel: 'normal',
    partidaEndMode: 'points',
    partidaDurationMinutes: 5,
    melhorDe: 1,
    numTempos: 1,
  },
  teams: {
    teamA: [],
    teamB: [],
    reserves: [],
  },
  currentPartida: {
    teamAPoints: 0,
    teamBPoints: 0,
    pointHistory: [],
    timerStartedAt: null,
    timerEnded: false,
    tempos: [],
    currentTempoIndex: 0,
  },
  seriesHistory: [],
  lastRemixSummary: null,
  remixCardCollapsed: true,
  removedPlayers: [],
};

let state = { ...defaults };

function getState() {
  return state;
}

function getPlayerName(id) {
  const p = state.players.find((x) => x.id === id) || state.removedPlayers.find((x) => x.id === id);
  return p?.name ?? '—';
}

function setState(partial) {
  state = { ...state, ...partial };
  save();
}

function migratePartidasToSeries(partidasHistory) {
  if (!partidasHistory || !partidasHistory.length) return [];
  return partidasHistory.map((p) => {
    const winner = p.scoreA > p.scoreB ? 'A' : 'B';
    return {
      bestOf: 1,
      teamAIds: p.teamAIds || [],
      teamBIds: p.teamBIds || [],
      reservesIds: p.reservesIds || [],
      partidas: [{ scoreA: p.scoreA, scoreB: p.scoreB, pointHistory: p.pointHistory || [] }],
      winner,
    };
  });
}

function ensureCurrentSeries() {
  const { seriesHistory, teams, config } = state;
  const melhorDe = Number.isFinite(config.melhorDe) && config.melhorDe >= 1 ? config.melhorDe : 1;
  const last = seriesHistory.length > 0 ? seriesHistory[seriesHistory.length - 1] : null;
  const needsNew =
    seriesHistory.length === 0 || (last && last.winner != null);
  if (needsNew) {
    const newSerie = {
      bestOf: melhorDe,
      teamAIds: [...(teams.teamA || [])],
      teamBIds: [...(teams.teamB || [])],
      reservesIds: [...(teams.reserves || [])],
      partidas: [],
      winner: null,
    };
    state = { ...state, seriesHistory: [...state.seriesHistory, newSerie] };
    save();
    return;
  }
  if (last && last.partidas.length === 0 && (teams.teamA?.length > 0 || teams.teamB?.length > 0)) {
    const updated = [...seriesHistory];
    updated[updated.length - 1] = {
      ...last,
      bestOf: melhorDe,
      teamAIds: [...(teams.teamA || [])],
      teamBIds: [...(teams.teamB || [])],
      reservesIds: [...(teams.reserves || [])],
    };
    state = { ...state, seriesHistory: updated };
    save();
  }
  // Série atual vazia (sem partidas) deve sempre refletir config.melhorDe
  if (last && last.partidas.length === 0 && last.winner == null && last.bestOf !== melhorDe) {
    const updated = [...seriesHistory];
    updated[updated.length - 1] = { ...last, bestOf: melhorDe };
    state = { ...state, seriesHistory: updated };
    save();
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const cfg = parsed.config ?? {};
    let seriesHistory = parsed.seriesHistory ?? defaults.seriesHistory;
    if (parsed.partidasHistory && parsed.partidasHistory.length > 0 && !parsed.seriesHistory) {
      seriesHistory = migratePartidasToSeries(parsed.partidasHistory);
    }
    state = {
      groups: (parsed.groups && parsed.groups.length > 0) ? parsed.groups : defaults.groups,
      players: parsed.players ?? defaults.players,
      config: {
        ...defaults.config,
        ...parsed.config,
        maxPointsPerPartida: cfg.maxPointsPerPartida ?? cfg.maxPointsPerSet ?? defaults.config.maxPointsPerPartida,
        partidaEndMode: (() => {
          const raw = cfg.partidaEndMode ?? cfg.setEndMode ?? defaults.config.partidaEndMode;
          return raw === 'time' ? 'timeOrPoints' : raw;
        })(),
        partidaDurationMinutes: cfg.partidaDurationMinutes ?? cfg.setDurationMinutes ?? defaults.config.partidaDurationMinutes,
        melhorDe: Number.isFinite(cfg.melhorDe) && cfg.melhorDe >= 1 ? cfg.melhorDe : defaults.config.melhorDe,
        numTempos: (() => {
          const v = cfg.numTempos ?? cfg.numPartes;
          return Number.isFinite(v) && (v === 1 || v === 2 || v === 4) ? v : defaults.config.numTempos;
        })(),
      },
      teams: { ...defaults.teams, ...parsed.teams },
      currentPartida: {
        ...defaults.currentPartida,
        ...(parsed.currentPartida ?? parsed.currentSet ?? {}),
        tempos: Array.isArray(parsed.currentPartida?.tempos ?? parsed.currentPartida?.partes ?? parsed.currentSet?.tempos ?? parsed.currentSet?.partes)
          ? (parsed.currentPartida?.tempos ?? parsed.currentPartida?.partes ?? parsed.currentSet?.tempos ?? parsed.currentSet?.partes)
          : defaults.currentPartida.tempos,
        currentTempoIndex: Number.isFinite(parsed.currentPartida?.currentTempoIndex ?? parsed.currentPartida?.currentParteIndex ?? parsed.currentSet?.currentTempoIndex ?? parsed.currentSet?.currentParteIndex)
          ? (parsed.currentPartida?.currentTempoIndex ?? parsed.currentPartida?.currentParteIndex ?? parsed.currentSet?.currentTempoIndex ?? parsed.currentSet?.currentParteIndex)
          : defaults.currentPartida.currentTempoIndex,
      },
      seriesHistory,
      lastRemixSummary: parsed.lastRemixSummary ?? null,
      remixCardCollapsed: parsed.remixCardCollapsed ?? true,
      removedPlayers: parsed.removedPlayers ?? [],
    };
    ensureCurrentSeries();
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
    currentPartida: {
      teamAPoints: 0,
      teamBPoints: 0,
      pointHistory: [],
      timerStartedAt: null,
      timerEnded: false,
      tempos: [],
      currentTempoIndex: 0,
    },
    seriesHistory: [],
    lastRemixSummary: null,
    remixCardCollapsed: true,
    removedPlayers: [],
  };
  save();
}

export { getState, setState, load, save, clearAll, getPlayerName, ensureCurrentSeries };
