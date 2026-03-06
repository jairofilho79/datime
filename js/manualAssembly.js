/**
 * Dialog de Montagem manual: três listas (Time A, Time B, Reservas),
 * seleção origem/destino com troca, checkbox "Manter equilíbrio".
 */

import { getState, setState, getPlayerName } from './state.js';
import * as teams from './teams.js';
import * as scoring from './scoring.js';
import dialog from './dialog.js';

let overlayEl = null;
let escapeHandler = null;

/** Cópia local dos times durante a edição no dialog */
let localTeams = { teamA: [], teamB: [], reserves: [] };
/** { playerId, listKey } ou null */
let selectedOrigin = null;

const LIST_KEYS = ['teamA', 'teamB', 'reserves'];

function getPlayerById(id) {
  return getState().players.find((p) => p.id === id);
}

function closeAndSave() {
  if (!overlayEl) return;
  setState({
    teams: {
      teamA: [...localTeams.teamA],
      teamB: [...localTeams.teamB],
      reserves: [...localTeams.reserves],
    },
    lastRemixSummary: null,
  });
  teams.renderTeamsPanel();
  scoring.renderScoreButtons();
  scoring.renderPointHistoryPanel();
  scoring.renderPartidasHistory();
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
    escapeHandler = null;
  }
  overlayEl.remove();
  overlayEl = null;
  selectedOrigin = null;
}

function swapPlayers(idA, listKeyA, idB, listKeyB) {
  const idxA = localTeams[listKeyA].indexOf(idA);
  const idxB = localTeams[listKeyB].indexOf(idB);
  if (idxA === -1 || idxB === -1) return;
  localTeams[listKeyA][idxA] = idB;
  localTeams[listKeyB][idxB] = idA;
}

function isDestinationAllowed(destPlayerId, balanceChecked) {
  if (!selectedOrigin) return false;
  if (balanceChecked) {
    const originPlayer = getPlayerById(selectedOrigin.playerId);
    const destPlayer = getPlayerById(destPlayerId);
    return originPlayer && destPlayer && originPlayer.groupId === destPlayer.groupId;
  }
  return true;
}

function renderLists(container, balanceChecked) {
  container.innerHTML = '';

  LIST_KEYS.forEach((listKey) => {
    const title = listKey === 'teamA' ? 'Time A' : listKey === 'teamB' ? 'Time B' : 'Reservas';
    const ids = localTeams[listKey] || [];
    const isOriginList = selectedOrigin && selectedOrigin.listKey === listKey;

    const block = document.createElement('div');
    block.className = 'manual-assembly-list-block' + (isOriginList ? ' manual-assembly-list-block--disabled' : '');
    block.dataset.listKey = listKey;
    block.setAttribute('aria-label', title);

    const heading = document.createElement('h3');
    heading.className = 'manual-assembly-list-title';
    heading.textContent = title;
    block.appendChild(heading);

    const listEl = document.createElement('ul');
    listEl.className = 'manual-assembly-list';

    ids.forEach((playerId) => {
      const name = getPlayerName(playerId);
      const li = document.createElement('li');
      li.className = 'manual-assembly-item';
      li.dataset.playerId = playerId;
      li.dataset.listKey = listKey;
      const isSelected = selectedOrigin && selectedOrigin.playerId === playerId && selectedOrigin.listKey === listKey;
      if (isSelected) li.classList.add('manual-assembly-item--selected');
      const isDestDisabled =
        selectedOrigin &&
        selectedOrigin.listKey !== listKey &&
        balanceChecked &&
        !isDestinationAllowed(playerId, true);
      if (isDestDisabled) li.classList.add('manual-assembly-item--disabled');
      const isOriginItemDisabled = isOriginList && !isSelected;
      if (isOriginItemDisabled) li.classList.add('manual-assembly-item--disabled');

      const showProhibited = isOriginItemDisabled || isDestDisabled;
      if (showProhibited) {
        const prohibitedSpan = document.createElement('span');
        prohibitedSpan.className = 'manual-assembly-item-prohibited';
        prohibitedSpan.setAttribute('aria-hidden', 'true');
        prohibitedSpan.textContent = '\u{1F6AB}'; // 🚫 Prohibited
        li.appendChild(prohibitedSpan);
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'manual-assembly-item-name';
      nameSpan.textContent = name;
      li.appendChild(nameSpan);
      if (isSelected) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'manual-assembly-item-icon';
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.textContent = '\u21C4'; // ⇄
        li.appendChild(iconSpan);
      }

      listEl.appendChild(li);
    });

    block.appendChild(listEl);
    container.appendChild(block);
  });
}

function setupListClicks(container, balanceCheckbox) {
  container.addEventListener('click', (e) => {
    const item = e.target.closest('.manual-assembly-item');
    if (!item) return;
    const playerId = item.dataset.playerId;
    const listKey = item.dataset.listKey;
    const balanceChecked = balanceCheckbox.checked;

    if (item.classList.contains('manual-assembly-item--disabled')) return;

    if (selectedOrigin && selectedOrigin.playerId === playerId && selectedOrigin.listKey === listKey) {
      selectedOrigin = null;
      renderLists(container, balanceChecked);
      return;
    }

    const isOriginList = selectedOrigin && selectedOrigin.listKey === listKey;
    if (isOriginList) return;

    if (!selectedOrigin) {
      selectedOrigin = { playerId, listKey };
      renderLists(container, balanceChecked);
      return;
    }

    if (selectedOrigin.listKey === listKey) return;
    if (!isDestinationAllowed(playerId, balanceChecked)) return;

    swapPlayers(selectedOrigin.playerId, selectedOrigin.listKey, playerId, listKey);
    selectedOrigin = null;
    renderLists(container, balanceChecked);
  });
}

function open() {
  const { teams: stateTeams, players } = getState();
  if (!players.length) return;

  localTeams = {
    teamA: [...(stateTeams.teamA || [])],
    teamB: [...(stateTeams.teamB || [])],
    reserves: [...(stateTeams.reserves || [])],
  };
  selectedOrigin = null;

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay manual-assembly-overlay';
  overlay.setAttribute('role', 'presentation');

  const modal = document.createElement('div');
  modal.className = 'dialog-modal manual-assembly-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'manual-assembly-title');

  const balanceId = 'manual-assembly-balance';
  modal.innerHTML = `
    <h2 id="manual-assembly-title" class="dialog-title manual-assembly-title">Montagem manual</h2>
    <label class="manual-assembly-balance-label">
      <input type="checkbox" id="${balanceId}" class="manual-assembly-balance-checkbox" checked aria-label="Manter equilíbrio: só permite trocar com jogadores do mesmo grupo">
      Manter equilíbrio
    </label>
    <p class="manual-assembly-hint">Toque em um jogador (origem), depois em outro de outra lista (destino) para trocar.</p>
    <div class="manual-assembly-lists"></div>
    <div class="dialog-actions manual-assembly-actions">
      <button type="button" class="btn btn-primary" id="manual-assembly-close">Fechar</button>
    </div>
  `;

  const listsContainer = modal.querySelector('.manual-assembly-lists');
  const balanceCheckbox = modal.querySelector(`#${balanceId}`);

  renderLists(listsContainer, balanceCheckbox.checked);
  setupListClicks(listsContainer, balanceCheckbox);

  balanceCheckbox.addEventListener('change', () => {
    if (balanceCheckbox.checked) {
      renderLists(listsContainer, true);
      return;
    }
    dialog.open({
      title: 'Desmarcar "Manter equilíbrio"?',
      message: 'Isso pode desequilibrar o nível de jogo, criar panelinhas ou fazer com que alguém jogue mais que os outros. Deseja mesmo desmarcar?',
      variant: 'alert',
      buttons: [
        { label: 'Manter marcado', primary: true, callback: () => {
          balanceCheckbox.checked = true;
          renderLists(listsContainer, true);
        } },
        { label: 'Desmarcar', primary: false, callback: () => {
          renderLists(listsContainer, false);
        } },
      ],
    });
  });

  const closeBtn = modal.querySelector('#manual-assembly-close');
  closeBtn.addEventListener('click', closeAndSave);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAndSave();
  });
  modal.addEventListener('click', (e) => e.stopPropagation());

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlayEl = overlay;

  escapeHandler = (e) => {
    if (e.key === 'Escape') closeAndSave();
  };
  document.addEventListener('keydown', escapeHandler);
}

export { open };
