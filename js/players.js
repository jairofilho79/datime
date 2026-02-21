/**
 * CRUD jogadores, grupos, config e botão Limpar tudo.
 */

import { getState, setState, clearAll } from './state.js';
import dialog from './dialog.js';

let lastCreatedGroupId = null;

function render() {
  // Será implementado no passo 3
  const formContainer = document.getElementById('players-form-container');
  const listContainer = document.getElementById('players-list-container');
  const configContainer = document.getElementById('config-container');
  const clearContainer = document.getElementById('clear-container');
  if (!formContainer || !listContainer) return;

  const { groups, players, config } = getState();

  formContainer.innerHTML = '';
  listContainer.innerHTML = '';
  if (configContainer) configContainer.innerHTML = '';
  if (clearContainer) clearContainer.innerHTML = '';

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
        'Os grupos servem apenas para equilibrar a força dos times (Time A vs Time B). Eles não definem quem é titular ou reserva — isso é definido pelo número de sets jogados, para que todos tenham chance parecida de jogar. Quanto menor o número do grupo (ex.: Grupo 1), mais influente é esse grupo na pontuação do time. Pessoas do mesmo grupo têm aproximadamente a mesma chance de ajudar o time a marcar pontos.',
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
    li.querySelector('.btn-remove').addEventListener('click', () => removePlayer(p.id));
    ul.appendChild(li);
  });

  // Config
  const configBlock = document.createElement('div');
  configBlock.className = 'config-block';
  configBlock.innerHTML = `
    <h3>Configurações</h3>
    <div class="config-row">
      <label for="config-players-per-team">Jogadores por time</label>
      <input type="number" id="config-players-per-team" min="1" max="20" value="${config.playersPerTeam}" />
    </div>
    <div class="config-row">
      <label for="config-max-points">Pontos máximos por set</label>
      <input type="number" id="config-max-points" min="1" max="99" value="${config.maxPointsPerSet}" />
    </div>
    <div class="config-row">
      <label for="config-remix">Remistura ao final do set</label>
      <select id="config-remix">
        <option value="pouco" ${config.remixLevel === 'pouco' ? 'selected' : ''}>Pouco</option>
        <option value="normal" ${config.remixLevel === 'normal' ? 'selected' : ''}>Normal</option>
        <option value="muito" ${config.remixLevel === 'muito' ? 'selected' : ''}>Muito</option>
      </select>
    </div>
  `;
  configContainer.appendChild(configBlock);
  configBlock.querySelector('#config-players-per-team').addEventListener('change', saveConfigFromForm);
  configBlock.querySelector('#config-max-points').addEventListener('change', saveConfigFromForm);
  configBlock.querySelector('#config-remix').addEventListener('change', saveConfigFromForm);

  // Limpar tudo
  const clearBlock = document.createElement('div');
  clearBlock.className = 'clear-block';
  clearBlock.innerHTML = '<button type="button" class="btn btn-danger" id="btn-clear-all">Limpar tudo</button>';
  clearBlock.querySelector('#btn-clear-all').addEventListener('click', confirmClearAll);
  clearContainer.appendChild(clearBlock);
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

function removePlayer(id) {
  const { players } = getState();
  setState({ players: players.filter((x) => x.id !== id) });
  render();
}

function saveConfigFromForm() {
  const perTeam = parseInt(document.getElementById('config-players-per-team')?.value, 10);
  const maxPoints = parseInt(document.getElementById('config-max-points')?.value, 10);
  const remix = document.getElementById('config-remix')?.value;
  const { config } = getState();
  setState({
    config: {
      ...config,
      playersPerTeam: Number.isFinite(perTeam) ? Math.max(1, perTeam) : config.playersPerTeam,
      maxPointsPerSet: Number.isFinite(maxPoints) ? Math.max(1, maxPoints) : config.maxPointsPerSet,
      remixLevel: remix === 'pouco' || remix === 'normal' || remix === 'muito' ? remix : config.remixLevel,
    },
  });
}

function confirmClearAll() {
  dialog.open({
    title: 'Limpar tudo',
    message: 'Todos os dados dessa partida vão ser apagados. Jogadores, grupos, sets e configurações deverão ser refeitos. Deseja continuar?',
    variant: 'alert',
    buttons: [
      { label: 'Cancelar', primary: false },
      { label: 'Limpar tudo', primary: true, callback: () => {
        clearAll();
        render();
      } },
    ],
  });
}

export { render };
