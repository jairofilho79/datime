/**
 * CRUD jogadores, grupos, config e botão Limpar tudo.
 */

import { getState, setState, clearAll } from './state.js';
import dialog from './dialog.js';
import * as teams from './teams.js';
import * as scoring from './scoring.js';
import * as partidaTimer from './partidaTimer.js';

const SPORT_PRESETS = {
  volleyball: {
    playersPerTeam: 6,
    melhorDe: 3,
    partidaEndMode: 'points',
    maxPointsPerPartida: 25,
    numTempos: 1,
    partidaDurationMinutes: 5,
    remixLevel: 'normal',
  },
  beachVolleyball: {
    playersPerTeam: 2,
    melhorDe: 3,
    partidaEndMode: 'points',
    maxPointsPerPartida: 15,
    numTempos: 1,
    partidaDurationMinutes: 5,
    remixLevel: 'normal',
  },
  voleizin: {
    playersPerTeam: 6,
    melhorDe: 3,
    partidaEndMode: 'points',
    maxPointsPerPartida: 15,
    numTempos: 1,
    partidaDurationMinutes: 5,
    remixLevel: 'normal',
  },
  football: {
    playersPerTeam: 11,
    melhorDe: 1,
    partidaEndMode: 'timeOrPoints',
    maxPointsPerPartida: 0,
    numTempos: 2,
    partidaDurationMinutes: 45,
    remixLevel: 'normal',
  },
};

let lastCreatedGroupId = null;
let onPlayMatchClick = null;

function setOnPlayMatchClick(fn) {
  onPlayMatchClick = typeof fn === 'function' ? fn : null;
}

function render() {
  const formContainer = document.getElementById('players-form-container');
  const listContainer = document.getElementById('players-list-container');
  const configContainer = document.getElementById('config-container');
  const clearContainer = document.getElementById('clear-container');
  const playMatchContainer = document.getElementById('play-match-container');
  if (!formContainer || !listContainer || !clearContainer || !playMatchContainer) return;

  const { groups, players, config } = getState();

  clearContainer.innerHTML = '';
  playMatchContainer.innerHTML = '';

  const clearBlock = document.createElement('div');
  clearBlock.className = 'clear-block';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn btn-icon btn-clear-all';
  clearBtn.id = 'btn-clear-all';
  clearBtn.setAttribute('aria-label', 'Limpar tudo');
  clearBtn.title = 'Limpar tudo';
  clearBtn.innerHTML = `<svg class="icon-trash" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
  clearBtn.addEventListener('click', confirmClearAll);
  clearBlock.appendChild(clearBtn);
  clearContainer.appendChild(clearBlock);

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'btn btn-primary btn-block';
  playBtn.id = 'btn-play-match';
  playBtn.textContent = 'Ir à partida';
  const tooFewPlayers = players.length < 2;
  if (tooFewPlayers) playBtn.classList.add('btn--disabled-look');
  playBtn.setAttribute('aria-disabled', tooFewPlayers ? 'true' : 'false');
  playBtn.addEventListener('click', () => {
    const { players: currentPlayers } = getState();
    if (currentPlayers.length < 2) {
      dialog.error(
        'É necessário ter pelo menos 2 jogadores na lista de jogadores para poder iniciar uma partida.',
        'Ir à partida'
      );
      return;
    }
    if (onPlayMatchClick) onPlayMatchClick();
  });
  playMatchContainer.appendChild(playBtn);

  formContainer.innerHTML = '';
  listContainer.innerHTML = '';
  if (configContainer) configContainer.innerHTML = '';

  // Card "Novo Jogador" no mesmo estilo de Configurações
  const form = document.createElement('div');
  form.className = 'new-player-card config-block';
  form.innerHTML = `
    <h3>Novo Jogador</h3>
    <div class="config-row">
      <label for="player-name">Nome</label>
      <input type="text" id="player-name" placeholder="Nome do jogador" maxlength="24" />
    </div>
    <div class="config-row">
      <span class="label-with-info" id="group-label-with-info" role="button" tabindex="0" aria-label="O que são grupos?">
        <span class="label-text">Grupo</span>
        <span class="info-icon" aria-hidden="true">!</span>
      </span>
      <select id="player-group" aria-label="Grupo do novo jogador"></select>
    </div>
    <div class="config-row">
      <button type="button" class="btn btn-primary btn-block" id="btn-add-player">Adicionar jogador</button>
    </div>
  `;
  formContainer.appendChild(form);

  const groupSelect = form.querySelector('#player-group');
  groups.forEach((g) => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    groupSelect.appendChild(opt);
  });
  const newGroupOpt = document.createElement('option');
  newGroupOpt.value = NEW_GROUP_VALUE;
  newGroupOpt.textContent = '+ Novo grupo';
  groupSelect.appendChild(newGroupOpt);

  groupSelect.addEventListener('change', () => {
    if (groupSelect.value === NEW_GROUP_VALUE) {
      addGroup();
    }
  });

  form.querySelector('#btn-add-player').addEventListener('click', addPlayer);

  if (lastCreatedGroupId) {
    groupSelect.value = lastCreatedGroupId;
    lastCreatedGroupId = null;
  }

  const groupInfoTrigger = form.querySelector('#group-label-with-info');
  if (groupInfoTrigger) {
    const openGroupInfo = () => {
      dialog.info(
        'Os grupos servem apenas para equilibrar a força dos times (Time A vs Time B). Eles não definem quem é titular ou reserva — isso é definido pelo número de partidas jogadas, para que todos tenham chance parecida de jogar. Quanto menor o número do grupo (ex.: Grupo 1), mais influente é esse grupo na pontuação do time. Pessoas do mesmo grupo têm aproximadamente a mesma chance de ajudar o time a marcar pontos.',
        'O que são grupos?'
      );
    };
    groupInfoTrigger.addEventListener('click', openGroupInfo);
    groupInfoTrigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openGroupInfo();
      }
    });
  }

  // Ordenar: por ordem do grupo (Grupo 1, 2, …), depois alfabético pelo nome
  const sortedPlayers = [...players].sort((a, b) => {
    const idxA = groups.findIndex((g) => g.id === a.groupId);
    const idxB = groups.findIndex((g) => g.id === b.groupId);
    const orderA = idxA === -1 ? 999 : idxA;
    const orderB = idxB === -1 ? 999 : idxB;
    if (orderA !== orderB) return orderA - orderB;
    return (a.name || '').localeCompare(b.name || '', 'pt-BR');
  });

  const countByGroup = new Map();
  for (const p of players) {
    countByGroup.set(p.groupId, (countByGroup.get(p.groupId) || 0) + 1);
  }
  const shortGroupName = (g) => g.name.replace(/^Grupo\s*/i, 'G') || g.name.slice(0, 2);
  const statsParts = groups.map((g) => `${g.name} (${countByGroup.get(g.id) || 0})`);
  const groupStatsLine = statsParts.length ? statsParts.join(' ·  · ') : '';
  const totalLine = players.length ? `Total (${players.length})` : 'Nenhum jogador';

  const listCard = document.createElement('div');
  listCard.className = 'config-block list-card';
  listCard.innerHTML = `
    <h3>Lista</h3>
    <p class="list-card-subtitle">
      ${groupStatsLine ? `<span class="list-card-stats-groups">${escapeHtml(groupStatsLine)}</span>` : ''}
      <span class="list-card-stats-total">${escapeHtml(totalLine)}</span>
    </p>
    <ul class="players-list"></ul>
  `;
  const ul = listCard.querySelector('.players-list');
  listContainer.appendChild(listCard);

  sortedPlayers.forEach((p) => {
    const group = groups.find((g) => g.id === p.groupId);
    const li = document.createElement('li');
    li.dataset.id = p.id;
    const groupSelectId = 'player-group-select-' + p.id;
    li.innerHTML = `
      <div class="player-info">
        <span class="player-name">${escapeHtml(p.name)}</span>
      </div>
      <div class="player-right">
        <select class="player-group-select" id="${groupSelectId}" data-player-id="${p.id}" aria-label="Grupo de ${escapeHtml(p.name)}">
          ${groups.map((g) => `<option value="${g.id}" ${g.id === p.groupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
        </select>
        <div class="player-actions">
          <button type="button" class="btn btn-danger btn-remove" data-id="${p.id}">Remover</button>
        </div>
      </div>
    `;
    li.querySelector('.player-group-select').addEventListener('change', (e) => {
      const newGroupId = e.target.value;
      setPlayerGroup(p.id, newGroupId);
    });
    li.querySelector('.btn-remove').addEventListener('click', () => confirmRemovePlayer(p.id));
    ul.appendChild(li);
  });

  const { removedPlayers } = getState();
  if (removedPlayers.length > 0) {
    const removedCard = document.createElement('div');
    removedCard.className = 'config-block removed-players-card';
    const titleRow = document.createElement('div');
    titleRow.className = 'removed-players-title-row';
    const title = document.createElement('h3');
    title.textContent = 'Jogadores removidos';
    titleRow.appendChild(title);
    const infoTrigger = document.createElement('span');
    infoTrigger.className = 'label-with-info';
    infoTrigger.setAttribute('role', 'button');
    infoTrigger.setAttribute('tabindex', '0');
    infoTrigger.setAttribute('aria-label', 'Por que esta lista existe?');
    const infoIcon = document.createElement('span');
    infoIcon.className = 'info-icon';
    infoIcon.setAttribute('aria-hidden', 'true');
    infoIcon.textContent = 'i';
    infoTrigger.appendChild(infoIcon);
    titleRow.appendChild(infoTrigger);
    removedCard.appendChild(titleRow);
    const infoMessage = 'Quem já participou de alguma partida, ao ser excluído, fica registrado aqui para manter o histórico de partidas íntegro (os nomes continuam aparecendo nas partidas em que jogaram).';
    infoTrigger.addEventListener('click', () => dialog.info(infoMessage, 'Jogadores removidos'));
    infoTrigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dialog.info(infoMessage, 'Jogadores removidos');
      }
    });
    const removedList = document.createElement('ul');
    removedList.className = 'removed-players-list';
    removedPlayers.forEach((p) => {
      const li = document.createElement('li');
      li.textContent = p.name || '—';
      removedList.appendChild(li);
    });
    removedCard.appendChild(removedList);
    listContainer.appendChild(removedCard);
  }

  // Config
  const configBlock = document.createElement('div');
  configBlock.className = 'config-block';
  const partidaEndModeDisplay =
    config.partidaEndMode === 'timeOrPoints' && config.maxPointsPerPartida === 0
      ? 'timeOnly'
      : config.partidaEndMode === 'timeOrPoints'
        ? 'timeOrPoints'
        : 'points';
  const durationMinutes = Number.isFinite(config.partidaDurationMinutes) && config.partidaDurationMinutes >= 1 && config.partidaDurationMinutes <= 120
    ? config.partidaDurationMinutes
    : 5;
  const melhorDe = Number.isFinite(config.melhorDe) && config.melhorDe >= 1 ? config.melhorDe : 1;
  const isMelhorDeCustom = ![1, 3, 5, 7].includes(melhorDe);
  const melhorDeCustomValue = isMelhorDeCustom ? Math.min(21, Math.max(1, melhorDe)) : 9;
  const numTempos = Number.isFinite(config.numTempos) && (config.numTempos === 1 || config.numTempos === 2 || config.numTempos === 4)
    ? config.numTempos
    : 1;
  configBlock.innerHTML = `
    <h3>Configurações da partida</h3>
    <div class="config-presets" aria-label="Pré-preencher por modalidade">
      <button type="button" class="preset-chip" data-preset="volleyball">Vôlei</button>
      <button type="button" class="preset-chip" data-preset="beachVolleyball">Vôlei de praia</button>
      <button type="button" class="preset-chip" data-preset="voleizin">Voleizin</button>
      <button type="button" class="preset-chip" data-preset="football">Futebol</button>
    </div>
    <div class="config-row">
      <label for="config-players-per-team">Jogadores por time</label>
      <input type="number" id="config-players-per-team" min="1" max="20" value="${config.playersPerTeam}" />
    </div>
    <div class="config-row">
      <label for="config-melhor-de">Melhor de</label>
      <select id="config-melhor-de">
        <option value="1" ${melhorDe === 1 ? 'selected' : ''}>1</option>
        <option value="3" ${melhorDe === 3 ? 'selected' : ''}>3</option>
        <option value="5" ${melhorDe === 5 ? 'selected' : ''}>5</option>
        <option value="7" ${melhorDe === 7 ? 'selected' : ''}>7</option>
        <option value="custom" ${isMelhorDeCustom ? 'selected' : ''}>N (personalizado)</option>
      </select>
    </div>
    <div class="config-row" id="config-melhor-de-custom-row" ${isMelhorDeCustom ? '' : 'hidden'}>
      <label for="config-melhor-de-n">N (quantas partidas para vencer a série)</label>
      <input type="number" id="config-melhor-de-n" min="1" max="21" value="${melhorDeCustomValue}" />
    </div>
    <div class="config-group config-group--partida-end">
      <span class="config-group-label">Critério de fim da partida</span>
      <div class="config-row" id="config-partida-end-mode-row">
        <label for="config-partida-end-mode">Fim da partida</label>
        <select id="config-partida-end-mode">
          <option value="points" ${partidaEndModeDisplay === 'points' ? 'selected' : ''}>Por pontos</option>
          <option value="timeOrPoints" ${partidaEndModeDisplay === 'timeOrPoints' ? 'selected' : ''}>Por tempo ou pontos (o que vier primeiro)</option>
          <option value="timeOnly" ${partidaEndModeDisplay === 'timeOnly' ? 'selected' : ''}>Só tempo (pontos não encerram)</option>
        </select>
      </div>
      <div class="config-row" id="config-duration-row" ${partidaEndModeDisplay === 'points' ? 'hidden' : ''}>
        <label for="config-duration-minutes">Duração de 1 tempo (minutos)</label>
        <input type="number" id="config-duration-minutes" min="1" max="120" value="${durationMinutes}" title="Cada tempo terá esta duração. Com 2 tempos = 2 × este valor; com 4 tempos = 4 × este valor." />
      </div>
      <div class="config-row" id="config-max-points-row" ${partidaEndModeDisplay === 'time' ? 'hidden' : ''}>
        <label for="config-max-points">Pontos máximos por partida</label>
        <input type="number" id="config-max-points" min="0" max="99" value="${config.maxPointsPerPartida}" />
      </div>
      <div class="config-row" id="config-num-tempos-row" ${partidaEndModeDisplay === 'points' ? 'hidden' : ''}>
        <label for="config-num-tempos">Tempos da partida</label>
        <select id="config-num-tempos">
          <option value="1" ${numTempos === 1 ? 'selected' : ''}>1 (inteira)</option>
          <option value="2" ${numTempos === 2 ? 'selected' : ''}>2 (dois tempos)</option>
          <option value="4" ${numTempos === 4 ? 'selected' : ''}>4 (quatro tempos)</option>
        </select>
      </div>
    </div>
    <div class="config-row">
      <label for="config-remix">Remistura ao final da partida</label>
      <select id="config-remix">
        <option value="pouco" ${config.remixLevel === 'pouco' ? 'selected' : ''}>Pouco</option>
        <option value="normal" ${config.remixLevel === 'normal' ? 'selected' : ''}>Normal</option>
        <option value="muito" ${config.remixLevel === 'muito' ? 'selected' : ''}>Muito</option>
      </select>
    </div>
  `;
  configContainer.appendChild(configBlock);
  configBlock.querySelectorAll('.preset-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = SPORT_PRESETS[btn.dataset.preset];
      if (preset) {
        setState({ config: { ...getState().config, ...preset } });
        render();
      }
    });
  });
  configBlock.querySelector('#config-players-per-team').addEventListener('change', saveConfigFromForm);
  configBlock.querySelector('#config-max-points').addEventListener('change', saveConfigFromForm);
  configBlock.querySelector('#config-remix').addEventListener('change', saveConfigFromForm);
  configBlock.querySelector('#config-melhor-de').addEventListener('change', () => {
    saveConfigFromForm();
    const isCustom = configBlock.querySelector('#config-melhor-de').value === 'custom';
    configBlock.querySelector('#config-melhor-de-custom-row').hidden = !isCustom;
  });
  configBlock.querySelector('#config-melhor-de-n').addEventListener('change', saveConfigFromForm);
  configBlock.querySelector('#config-num-tempos').addEventListener('change', saveConfigFromForm);
  const partidaEndModeEl = configBlock.querySelector('#config-partida-end-mode');
  const durationRowEl = configBlock.querySelector('#config-duration-row');
  const maxPointsRowEl = configBlock.querySelector('#config-max-points-row');
  const numTemposRowEl = configBlock.querySelector('#config-num-tempos-row');
  partidaEndModeEl.addEventListener('change', () => {
    saveConfigFromForm();
    const mode = partidaEndModeEl.value;
    durationRowEl.hidden = mode === 'points';
    maxPointsRowEl.hidden = false;
    if (numTemposRowEl) numTemposRowEl.hidden = mode === 'points';
    if (mode === 'timeOnly' && configBlock.querySelector('#config-max-points')) {
      configBlock.querySelector('#config-max-points').value = 0;
    }
  });
  configBlock.querySelector('#config-duration-minutes').addEventListener('change', saveConfigFromForm);
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function addGroup() {
  const { groups } = getState();
  const n = groups.length + 1;
  const id = 'g' + Date.now();
  lastCreatedGroupId = id;
  setState({ groups: [...groups, { id, name: `Grupo ${n}` }] });
  render();
}

const NEW_GROUP_VALUE = '__new_group__';

function addPlayer() {
  const nameEl = document.getElementById('player-name');
  const groupEl = document.getElementById('player-group');
  const name = (nameEl?.value || '').trim().slice(0, 24);
  const groupId = groupEl?.value || '';
  if (!name || !groupId || groupId === NEW_GROUP_VALUE) return;
  const { players, groups } = getState();
  if (!groups.some((g) => g.id === groupId)) return;
  const id = 'p' + Date.now();
  setState({ players: [...players, { id, name, groupId }] });
  nameEl.value = '';
  render();
}

function setPlayerGroup(playerId, groupId) {
  const { players, groups } = getState();
  if (!groups.some((g) => g.id === groupId)) return;
  setState({
    players: players.map((p) => (p.id === playerId ? { ...p, groupId } : p)),
  });
  render();
}

function isPlayerInHistory(playerId) {
  const { seriesHistory } = getState();
  if (!seriesHistory || !seriesHistory.length) return false;
  for (const serie of seriesHistory) {
    const ids = [...(serie.teamAIds || []), ...(serie.teamBIds || []), ...(serie.reservesIds || [])];
    if (ids.includes(playerId)) return true;
  }
  return false;
}

function removePlayer(id) {
  const { players, removedPlayers, teams: teamsState, lastRemixSummary } = getState();
  const player = players.find((p) => p.id === id);
  if (!player) return;

  const filterId = (arr) => (arr || []).filter((x) => x !== id);
  const newPlayers = players.filter((p) => p.id !== id);
  const newTeams = {
    teamA: filterId(teamsState.teamA),
    teamB: filterId(teamsState.teamB),
    reserves: filterId(teamsState.reserves),
  };

  let newRemovedPlayers = removedPlayers;
  let newLastRemixSummary = lastRemixSummary;

  if (isPlayerInHistory(id)) {
    newRemovedPlayers = [...removedPlayers, player];
  }

  if (lastRemixSummary) {
    const enteredA = filterId(lastRemixSummary.enteredA || []);
    const enteredB = filterId(lastRemixSummary.enteredB || []);
    const enteredReserves = filterId(lastRemixSummary.enteredReserves || []);
    if (enteredA.length || enteredB.length || enteredReserves.length) {
      newLastRemixSummary = { enteredA, enteredB, enteredReserves };
    } else {
      newLastRemixSummary = null;
    }
  }

  setState({
    players: newPlayers,
    removedPlayers: newRemovedPlayers,
    teams: newTeams,
    lastRemixSummary: newLastRemixSummary,
  });
  render();
  teams.renderTeamsPanel();
  scoring.renderScoreButtons();
  scoring.renderPartidasHistory();
}

function confirmRemovePlayer(id) {
  const { players } = getState();
  const player = players.find((p) => p.id === id);
  if (!player) return;
  const name = player.name || 'Este jogador';
  const inHistory = isPlayerInHistory(id);
  const message = inHistory
    ? `Excluir ${name}? Ele participou de partidas; o nome será mantido no histórico e na lista de jogadores removidos.`
    : `Excluir ${name}? Ele será removido da lista e dos times atuais.`;
  dialog.open({
    title: 'Excluir jogador',
    message,
    variant: 'alert',
    buttons: [
      { label: 'Cancelar', primary: false },
      { label: 'Excluir', primary: true, callback: () => removePlayer(id) },
    ],
  });
}

function saveConfigFromForm() {
  const perTeam = parseInt(document.getElementById('config-players-per-team')?.value, 10);
  const maxPoints = parseInt(document.getElementById('config-max-points')?.value, 10);
  const remix = document.getElementById('config-remix')?.value;
  const partidaEndModeRaw = document.getElementById('config-partida-end-mode')?.value;
  const durationMinutes = parseInt(document.getElementById('config-duration-minutes')?.value, 10);
  const melhorDeSelect = document.getElementById('config-melhor-de')?.value;
  const melhorDeN = parseInt(document.getElementById('config-melhor-de-n')?.value, 10);
  const numTemposRaw = parseInt(document.getElementById('config-num-tempos')?.value, 10);
  const { config } = getState();
  const partidaEndMode =
    partidaEndModeRaw === 'timeOnly' ? 'timeOrPoints' : partidaEndModeRaw === 'timeOrPoints' ? 'timeOrPoints' : 'points';
  const isTimeOnly = partidaEndModeRaw === 'timeOnly';
  const rawMax = Number.isFinite(maxPoints) ? maxPoints : config.maxPointsPerPartida ?? 25;
  const maxPointsPerPartidaValue =
    isTimeOnly ? 0 : partidaEndModeRaw === 'points' ? Math.max(1, rawMax) : Math.max(0, rawMax);
  const partidaDurationMinutes = Number.isFinite(durationMinutes) && durationMinutes >= 1 && durationMinutes <= 120
    ? durationMinutes
    : config.partidaDurationMinutes ?? 5;
  let melhorDe = config.melhorDe ?? 1;
  if (melhorDeSelect === 'custom') {
    melhorDe = Number.isFinite(melhorDeN) ? Math.min(21, Math.max(1, melhorDeN)) : melhorDe;
  } else {
    const v = parseInt(melhorDeSelect, 10);
    melhorDe = Number.isFinite(v) && v >= 1 ? v : melhorDe;
  }
  const numTempos = Number.isFinite(numTemposRaw) && (numTemposRaw === 1 || numTemposRaw === 2 || numTemposRaw === 4)
    ? numTemposRaw
    : (Number.isFinite(config.numTempos) ? config.numTempos : 1);
  const nextConfig = {
    ...config,
    playersPerTeam: Number.isFinite(perTeam) ? Math.max(1, perTeam) : config.playersPerTeam,
    maxPointsPerPartida: maxPointsPerPartidaValue,
    remixLevel: remix === 'pouco' || remix === 'normal' || remix === 'muito' ? remix : config.remixLevel,
    partidaEndMode,
    partidaDurationMinutes,
    melhorDe,
    numTempos,
  };
  const { seriesHistory } = getState();
  let nextSeriesHistory = null;
  if (seriesHistory?.length > 0) {
    const last = seriesHistory[seriesHistory.length - 1];
    if (last && (last.partidas?.length ?? 0) === 0 && last.winner == null && (last.bestOf ?? 1) !== melhorDe) {
      const updated = [...seriesHistory];
      updated[updated.length - 1] = { ...last, bestOf: melhorDe };
      nextSeriesHistory = updated;
    }
  }
  setState({
    config: nextConfig,
    ...(nextSeriesHistory != null ? { seriesHistory: nextSeriesHistory } : {}),
  });
}

function confirmClearAll() {
  dialog.open({
    title: 'Limpar tudo',
    message: 'Todos os dados dessa partida vão ser apagados. Jogadores, grupos, partidas e configurações deverão ser refeitos. Deseja continuar?',
    variant: 'alert',
    buttons: [
      { label: 'Cancelar', primary: false },
      { label: 'Limpar tudo', primary: true, callback: () => {
        partidaTimer.stop();
        clearAll();
        render();
      } },
    ],
  });
}

export { render, setOnPlayMatchClick };
