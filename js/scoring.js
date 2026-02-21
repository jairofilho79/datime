/**
 * Pontos do set atual, fim de set e histórico.
 */

import { getState, setState } from './state.js';
import * as teams from './teams.js';
import dialog from './dialog.js';

function getSetsHistoryShareText() {
  const { setsHistory, players } = getState();
  const getName = (id) => players.find((p) => p.id === id)?.name ?? '—';
  if (!setsHistory.length) return '';
  const lines = ['Datime — Histórico de sets', ''];
  setsHistory.forEach((set, i) => {
    const namesA = (set.teamAIds || []).map(getName).join(', ') || '—';
    const namesB = (set.teamBIds || []).map(getName).join(', ') || '—';
    lines.push(`Set ${i + 1}: Time A (${set.scoreA}x${set.scoreB}) Time B`);
    lines.push(`Time A: ${namesA}`);
    lines.push(`Time B: ${namesB}`);
    const history = set.pointHistory || [];
    const pointsStr = [...history].reverse().map((h, j) => {
      const upTo = history.length - j;
      const scoreA = history.slice(0, upTo).filter((x) => x.team === 'A').length;
      const scoreB = history.slice(0, upTo).filter((x) => x.team === 'B').length;
      return `Time A (${scoreA}x${scoreB}) Time B`;
    }).join(', ');
    lines.push(`Pontos (último primeiro): ${pointsStr || '—'}`);
    lines.push('');
  });
  return lines.join('\n').trim();
}

async function shareSetsHistory() {
  const text = getSetsHistoryShareText();
  if (!text) return;
  try {
    if (navigator.share) {
      await navigator.share({
        text,
        title: 'Datime — Histórico de sets',
      });
    } else {
      await navigator.clipboard.writeText(text);
      dialog.info('Histórico copiado! Cole no WhatsApp, Telegram ou e-mail.');
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      try {
        await navigator.clipboard.writeText(text);
        dialog.info('Histórico copiado! Cole no WhatsApp, Telegram ou e-mail.');
      } catch {
        dialog.error('Não foi possível compartilhar. Tente copiar manualmente.');
      }
    }
  }
}

let showingHistoryFor = null; // 'A' | 'B' | null

function addPoint(team) {
  const { currentSet, config } = getState();
  const pointHistory = [...currentSet.pointHistory, { team, timestamp: Date.now() }];
  let teamAPoints = currentSet.teamAPoints;
  let teamBPoints = currentSet.teamBPoints;
  if (team === 'A') teamAPoints += 1;
  else teamBPoints += 1;
  setState({
    currentSet: {
      teamAPoints,
      teamBPoints,
      pointHistory,
    },
  });
  const max = config.maxPointsPerSet;
  if (teamAPoints >= max || teamBPoints >= max) {
    endSet();
  }
}

function undoLastPoint() {
  const { currentSet } = getState();
  const history = [...currentSet.pointHistory];
  const lastUndoneIndex = history.map((p, i) => i).reverse().find((i) => !history[i].undone);
  if (lastUndoneIndex == null) return;
  const point = history[lastUndoneIndex];
  const updated = history.map((p, i) => (i === lastUndoneIndex ? { ...p, undone: true } : p));
  let teamAPoints = currentSet.teamAPoints;
  let teamBPoints = currentSet.teamBPoints;
  if (point.team === 'A') teamAPoints -= 1;
  else teamBPoints -= 1;
  setState({
    currentSet: {
      teamAPoints,
      teamBPoints,
      pointHistory: updated,
    },
  });
  renderScoreButtons();
  renderPointHistoryPanel();
}

function endSet() {
  const { currentSet, teams: teamsState, config, setsHistory } = getState();
  const record = {
    teamAIds: [...teamsState.teamA],
    teamBIds: [...teamsState.teamB],
    reservesIds: [...teamsState.reserves],
    scoreA: currentSet.teamAPoints,
    scoreB: currentSet.teamBPoints,
    pointHistory: [...currentSet.pointHistory],
    collapsed: true,
  };
  setState({
    setsHistory: [...setsHistory, record],
    currentSet: { teamAPoints: 0, teamBPoints: 0, pointHistory: [] },
  });
  teams.remix();
  teams.renderTeamsPanel();
  renderScoreButtons();
  renderPointHistoryPanel();
  renderSetsHistory();
}

function togglePointHistory(team) {
  showingHistoryFor = showingHistoryFor === team ? null : team;
  renderPointHistoryPanel();
  renderScoreButtons();
}

function renderScoreButtons() {
  const container = document.getElementById('score-buttons-container');
  if (!container) return;
  const { currentSet } = getState();
  container.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'score-card config-block';
  card.innerHTML = `
    <div class="score-card-header">
      <span class="label-with-info" id="score-card-info-trigger" role="button" tabindex="0" aria-label="Como marcar pontos?">
        <span class="label-text">Pontuação do set</span>
        <span class="info-icon" aria-hidden="true">!</span>
      </span>
    </div>
    <div class="score-buttons">
      <button type="button" class="score-btn team-a" data-team="A">
        <span class="score-label">Time A</span>
        <span class="score-value">${currentSet.teamAPoints}</span>
      </button>
      <button type="button" class="score-btn team-b" data-team="B">
        <span class="score-label">Time B</span>
        <span class="score-value">${currentSet.teamBPoints}</span>
      </button>
    </div>
  `;
  const scoreButtonsEl = card.querySelector('.score-buttons');
  scoreButtonsEl.querySelectorAll('.score-btn').forEach((btn) => {
    const team = btn.getAttribute('data-team');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      addPoint(team);
      renderScoreButtons();
      renderPointHistoryPanel();
    });
  });
  const infoTrigger = card.querySelector('#score-card-info-trigger');
  if (infoTrigger) {
    const openScoreInfo = () => {
      dialog.info(
        'Clique no retângulo grande azul para marcar ponto do Time A e no retângulo verde para marcar ponto do Time B.',
        'Pontuação do set'
      );
    };
    infoTrigger.addEventListener('click', openScoreInfo);
    infoTrigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openScoreInfo();
      }
    });
  }
  container.appendChild(card);

  if (currentSet.pointHistory.length > 0) {
    const endSetWrap = document.createElement('div');
    endSetWrap.className = 'end-set-wrap';
    endSetWrap.innerHTML = `
      <button type="button" class="btn btn-outlined" id="btn-undo-point">Desfazer o ponto</button>
      <button type="button" class="btn btn-danger" id="btn-end-set">Encerrar set</button>
    `;
    endSetWrap.querySelector('#btn-undo-point').addEventListener('click', () => {
      dialog.open({
        title: 'Desfazer o ponto',
        message: 'O último ponto marcado será removido do placar. Deseja desfazer?',
        variant: 'alert',
        buttons: [
          { label: 'Cancelar', primary: false },
          { label: 'Desfazer', primary: true, callback: undoLastPoint },
        ],
      });
    });
    endSetWrap.querySelector('#btn-end-set').addEventListener('click', () => {
      dialog.open({
        title: 'Encerrar set',
        message: 'O placar atual será salvo e os times serão remisturados. Deseja encerrar o set?',
        variant: 'alert',
        buttons: [
          { label: 'Cancelar', primary: false },
          { label: 'Encerrar set', primary: true, callback: endSet },
        ],
      });
    });
    card.appendChild(endSetWrap);
  }
}

function renderPointHistoryPanel() {
  const container = document.getElementById('point-history-container');
  if (!container) return;
  const { currentSet } = getState();
  container.innerHTML = '';
  if (currentSet.pointHistory.length === 0) return;
  const history = currentSet.pointHistory;
  const reversed = [...history].reverse();
  const countActive = (arr) => ({ a: arr.filter((x) => !x.undone && x.team === 'A').length, b: arr.filter((x) => !x.undone && x.team === 'B').length });
  const items = reversed.map((h, j) => {
    const upTo = history.length - j;
    const slice = history.slice(0, upTo);
    const { a: scoreA, b: scoreB } = countActive(slice);
    const undoneClass = h.undone ? ' point-undone' : '';
    return `<li class="point-${h.team.toLowerCase()}${undoneClass}">Time A (${scoreA}x${scoreB}) Time B</li>`;
  });
  const panel = document.createElement('div');
  panel.className = 'point-history-panel';
  panel.innerHTML = `
    <h3>Histórico de pontos no set (últimos primeiro)</h3>
    <ul>
      ${items.join('')}
    </ul>
  `;
  container.appendChild(panel);
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

function renderSetsHistory() {
  const container = document.getElementById('sets-history-container');
  if (!container) return;
  const { setsHistory, players } = getState();
  const getName = (id) => players.find((p) => p.id === id)?.name ?? '—';
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'sets-history';
  wrap.innerHTML = '<h3>Histórico de sets</h3>';
  if (setsHistory.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Nenhum set finalizado ainda.';
    wrap.appendChild(empty);
  } else {
    setsHistory.forEach((set, i) => {
      const namesA = (set.teamAIds || []).map(getName).join(', ') || '—';
      const namesB = (set.teamBIds || []).map(getName).join(', ') || '—';
      const history = set.pointHistory || [];
      const countActive = (arr) => ({ a: arr.filter((x) => !x.undone && x.team === 'A').length, b: arr.filter((x) => !x.undone && x.team === 'B').length });
      const pointsListItems = [...history].reverse().map((h, j) => {
        const upTo = history.length - j;
        const slice = history.slice(0, upTo);
        const { a: scoreA, b: scoreB } = countActive(slice);
        const undoneClass = h.undone ? ' point-undone' : '';
        return `<li class="point-${h.team.toLowerCase()}${undoneClass}">Time A (${scoreA}x${scoreB}) Time B</li>`;
      });
      const pointsHtml = pointsListItems.length
        ? `<ul class="set-points-list">${pointsListItems.join('')}</ul>`
        : '<p>—</p>';
      const details = document.createElement('details');
      details.className = 'set-item';
      details.innerHTML = `
        <summary>Set ${i + 1}: Time A (${set.scoreA}x${set.scoreB}) Time B</summary>
        <div class="set-detail">
          <div class="set-detail-teams">
            <p><strong>Time A:</strong> ${escapeHtml(namesA)}</p>
            <p><strong>Time B:</strong> ${escapeHtml(namesB)}</p>
          </div>
          <div class="set-detail-points">
            <strong>Pontos (último primeiro):</strong>
            ${pointsHtml}
          </div>
        </div>
      `;
      wrap.appendChild(details);
    });
    const shareWrap = document.createElement('div');
    shareWrap.className = 'sets-history-share';
    shareWrap.innerHTML = '<button type="button" class="btn btn-outlined" id="btn-share-sets">Compartilhar histórico</button>';
    shareWrap.querySelector('#btn-share-sets').addEventListener('click', shareSetsHistory);
    wrap.appendChild(shareWrap);
  }
  container.appendChild(wrap);
}

export { addPoint, endSet, togglePointHistory, renderScoreButtons, renderPointHistoryPanel, renderSetsHistory };
