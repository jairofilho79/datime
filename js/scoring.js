/**
 * Pontos da partida atual, fim de partida e histórico.
 */

import { getState, setState, getPlayerName, ensureCurrentSeries } from './state.js';
import * as teams from './teams.js';
import dialog from './dialog.js';
import * as partidaTimer from './partidaTimer.js';

// Controle apenas visual da ordem de exibição do placar (Time A x Time B vs Time B x Time A).
// Não afeta a forma como os pontos são armazenados em state/currentPartida/seriesHistory.
let invertScoreDisplay = false;

function getScorePresentation(scoreA, scoreB) {
  const firstTeam = invertScoreDisplay ? 'B' : 'A';
  const secondTeam = invertScoreDisplay ? 'A' : 'B';
  const firstScore = firstTeam === 'A' ? scoreA : scoreB;
  const secondScore = secondTeam === 'A' ? scoreA : scoreB;
  return { firstTeam, secondTeam, firstScore, secondScore };
}

function formatScoreLineWithTeams(scoreA, scoreB) {
  const { firstTeam, secondTeam, firstScore, secondScore } = getScorePresentation(scoreA, scoreB);
  return `Time ${firstTeam} (${firstScore}x${secondScore}) Time ${secondTeam}`;
}

function formatBareScore(scoreA, scoreB) {
  const { firstScore, secondScore } = getScorePresentation(scoreA, scoreB);
  return `${firstScore}x${secondScore}`;
}

function getTimerFinalAriaLabel(scoreA, scoreB) {
  const { firstTeam, secondTeam, firstScore, secondScore } = getScorePresentation(scoreA, scoreB);
  return `Placar final: Time ${firstTeam} ${firstScore} x ${secondScore} Time ${secondTeam}`;
}

function getNumTempos(config) {
  if (config?.partidaEndMode !== 'timeOrPoints') return 1;
  const n = Number(config?.numTempos);
  if (n === 2 || n === 4) return n;
  return 1;
}

function getPartidasHistoryShareText() {
  const { seriesHistory } = getState();
  const seriesWithPartidas = (seriesHistory || []).filter((s) => (s.partidas || []).length > 0);
  if (!seriesWithPartidas.length) return '';
  const lines = ['Datime — Histórico de partidas', ''];
  [...seriesWithPartidas].reverse().forEach((serie, reversedIndex) => {
    const serieNumber = seriesWithPartidas.length - reversedIndex;
    const bestOf = serie.bestOf ?? 1;
    const winnerLabel = serie.winner ? ` — Time ${serie.winner === 'A' ? 'A' : 'B'} venceu` : '';
    const ord = serieNumber === 1 ? '1ª' : serieNumber === 2 ? '2ª' : `${serieNumber}ª`;
    lines.push(`Melhor de ${bestOf} — ${ord}${winnerLabel}`);
    const namesA = (serie.teamAIds || []).map(getPlayerName).join(', ') || '—';
    const namesB = (serie.teamBIds || []).map(getPlayerName).join(', ') || '—';
    (serie.partidas || []).forEach((partida, i) => {
      const partidaScoreLine = formatScoreLineWithTeams(partida.scoreA, partida.scoreB);
      lines.push(`Partida ${i + 1}: ${partidaScoreLine}`);
      lines.push(`Time A: ${namesA}`);
      lines.push(`Time B: ${namesB}`);
      const tempos = Array.isArray(partida.tempos) ? partida.tempos : (Array.isArray(partida.partes) ? partida.partes : null);
      if (tempos && tempos.length > 1) {
        tempos.forEach((t, idx) => {
          const tempoScoreLine = formatScoreLineWithTeams(t.scoreA, t.scoreB);
          lines.push(`${idx + 1}º tempo: ${tempoScoreLine}`);
        });
      }
      const history = partida.pointHistory || [];
      const pointsStr = [...history].reverse().map((h, j) => {
        const upTo = history.length - j;
        const scoreA = history.slice(0, upTo).filter((x) => x.team === 'A').length;
        const scoreB = history.slice(0, upTo).filter((x) => x.team === 'B').length;
        return formatScoreLineWithTeams(scoreA, scoreB);
      }).join(', ');
      lines.push(`Pontos (último primeiro): ${pointsStr || '—'}`);
      lines.push('');
    });
    lines.push('');
  });
  return lines.join('\n').trim();
}

async function sharePartidasHistory() {
  const text = getPartidasHistoryShareText();
  if (!text) return;
  try {
    if (navigator.share) {
      await navigator.share({
        text,
        title: 'Datime — Histórico de partidas',
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
let timerRunningForPartidaStartedAt = null; // evita reiniciar o timer a cada onTick

function addPoint(team) {
  const { currentPartida, config } = getState();
  const numTempos = getNumTempos(config);
  const pointHistory = [...currentPartida.pointHistory, { team, timestamp: Date.now() }];
  let teamAPoints = currentPartida.teamAPoints;
  let teamBPoints = currentPartida.teamBPoints;
  if (team === 'A') teamAPoints += 1;
  else teamBPoints += 1;
  const isFirstPoint = pointHistory.length === 1;
  setState({
    currentPartida: {
      ...currentPartida,
      teamAPoints,
      teamBPoints,
      pointHistory,
    },
    ...(isFirstPoint ? { remixCardCollapsed: true } : {}),
  });
  const endByPoints = config.partidaEndMode === 'points' || config.partidaEndMode === 'timeOrPoints';
  const max = config.maxPointsPerPartida;
  if (endByPoints && max > 0) {
    const maxPerTempo = numTempos > 1 ? Math.ceil(max / numTempos) : max;
    if (teamAPoints >= maxPerTempo || teamBPoints >= maxPerTempo) {
      if (config.partidaEndMode === 'timeOrPoints') partidaTimer.stop();
      if (numTempos > 1) {
        endCurrentTempo();
      } else {
        endPartida();
      }
      return;
    }
  } else if (isFirstPoint) {
    teams.renderTeamsPanel();
  }
}

function undoLastPoint() {
  const { currentPartida } = getState();
  const history = [...currentPartida.pointHistory];
  const lastUndoneIndex = history.map((p, i) => i).reverse().find((i) => !history[i].undone);
  if (lastUndoneIndex == null) return;
  const point = history[lastUndoneIndex];
  const updated = history.map((p, i) => (i === lastUndoneIndex ? { ...p, undone: true } : p));
  let teamAPoints = currentPartida.teamAPoints;
  let teamBPoints = currentPartida.teamBPoints;
  if (point.team === 'A') teamAPoints -= 1;
  else teamBPoints -= 1;
  setState({
    currentPartida: {
      ...currentPartida,
      teamAPoints,
      teamBPoints,
      pointHistory: updated,
    },
  });
  renderScoreButtons();
  renderPointHistoryPanel();
}

function endCurrentTempo() {
  const state = getState();
  const { currentPartida, config } = state;
  const numTempos = getNumTempos(config);
  const currentIndex = Number.isFinite(currentPartida.currentTempoIndex) ? currentPartida.currentTempoIndex : 0;
  const existingTempos = Array.isArray(currentPartida.tempos) ? currentPartida.tempos : [];
  const thisTempo = {
    scoreA: currentPartida.teamAPoints,
    scoreB: currentPartida.teamBPoints,
    pointHistory: [...currentPartida.pointHistory],
  };
  const updatedTempos = [...existingTempos, thisTempo];
  const isLastTempo = currentIndex + 1 >= numTempos;

  partidaTimer.stop();
  timerRunningForPartidaStartedAt = null;

  if (isLastTempo || numTempos === 1) {
    setState({
      currentPartida: {
        ...currentPartida,
        tempos: updatedTempos,
        currentTempoIndex: currentIndex,
      },
    });
    endPartida();
    return;
  }

  const nextIndex = currentIndex + 1;
  setState({
    currentPartida: {
      teamAPoints: 0,
      teamBPoints: 0,
      pointHistory: [],
      timerStartedAt: null,
      timerEnded: false,
      tempos: updatedTempos,
      currentTempoIndex: nextIndex,
    },
  });
  renderScoreButtons();
  renderPointHistoryPanel();
}

function endPartida() {
  partidaTimer.stop();
  timerRunningForPartidaStartedAt = null;
  const { currentPartida, seriesHistory, config } = getState();
  if (!seriesHistory.length) return;
  const lastSerie = seriesHistory[seriesHistory.length - 1];
  const temposArr = Array.isArray(currentPartida.tempos) ? currentPartida.tempos : [];
  let partidaRecord;
  if (temposArr.length > 0) {
    const totalScoreA = temposArr.reduce((sum, p) => sum + (p.scoreA || 0), 0);
    const totalScoreB = temposArr.reduce((sum, p) => sum + (p.scoreB || 0), 0);
    const flatHistory = temposArr.flatMap((p) => p.pointHistory || []);
    partidaRecord = {
      scoreA: totalScoreA,
      scoreB: totalScoreB,
      pointHistory: flatHistory,
      tempos: temposArr,
    };
  } else {
    partidaRecord = {
      scoreA: currentPartida.teamAPoints,
      scoreB: currentPartida.teamBPoints,
      pointHistory: [...currentPartida.pointHistory],
    };
  }
  const updatedPartidas = [...(lastSerie.partidas || []), partidaRecord];
  const winsA = updatedPartidas.filter((p) => p.scoreA > p.scoreB).length;
  const winsB = updatedPartidas.filter((p) => p.scoreB > p.scoreA).length;
  const bestOf = lastSerie.bestOf ?? 1;
  const winsNeeded = Math.ceil(bestOf / 2);
  const seriesWon = bestOf === 1 || winsA >= winsNeeded || winsB >= winsNeeded;
  const winner = seriesWon ? (winsA >= winsNeeded ? 'A' : 'B') : null;

  const updatedSerie = { ...lastSerie, partidas: updatedPartidas, winner: winner ?? lastSerie.winner };
  const newSeriesHistory = [...seriesHistory.slice(0, -1), updatedSerie];

  setState({
    seriesHistory: newSeriesHistory,
    currentPartida: {
      teamAPoints: 0,
      teamBPoints: 0,
      pointHistory: [],
      timerStartedAt: null,
      timerEnded: false,
      tempos: [],
      currentTempoIndex: 0,
    },
  });

  if (seriesWon) {
    teams.remix();
    ensureCurrentSeries();
    teams.renderTeamsPanel();
  }
  renderScoreButtons();
  renderPointHistoryPanel();
  renderPartidasHistory();
}

function togglePointHistory(team) {
  showingHistoryFor = showingHistoryFor === team ? null : team;
  renderPointHistoryPanel();
  renderScoreButtons();
}

function ensureTimerRunning() {
  const { currentPartida, config } = getState();
  const mode = config.partidaEndMode;
  if (mode !== 'time' && mode !== 'timeOrPoints') return;
  if (currentPartida.timerEnded) return;
  const numTempos = getNumTempos(config);
  const minutosPorTempo = config.partidaDurationMinutes ?? 5;
  const durationSeconds = Math.max(1, Math.min(7200, Math.round((minutosPorTempo || 1) * 60)));
  const timerStartedAt = currentPartida.timerStartedAt ?? null;
  if (timerStartedAt == null || timerRunningForPartidaStartedAt === timerStartedAt) return;
  timerRunningForPartidaStartedAt = timerStartedAt;
  partidaTimer.start({
    durationSeconds,
    startedAt: timerStartedAt,
    onTick: () => setTimeout(() => renderScoreButtons(), 0),
    onEnd: () => {
      partidaTimer.stop();
      timerRunningForPartidaStartedAt = null;
      const latestState = getState();
      const latestConfig = latestState.config;
      const temposCount = getNumTempos(latestConfig);
      if (temposCount > 1) {
        endCurrentTempo();
      } else {
        setState({ currentPartida: { ...latestState.currentPartida, timerEnded: true } });
        setTimeout(() => renderScoreButtons(), 0);
      }
    },
  });
}

function renderScoreButtons() {
  const container = document.getElementById('score-buttons-container');
  if (!container) return;
  const { currentPartida, config } = getState();
  const mode = config.partidaEndMode === 'time' || config.partidaEndMode === 'timeOrPoints' ? config.partidaEndMode : 'points';
  const numTempos = getNumTempos(config);
  const minutosPorTempo = Math.max(1, Math.min(120, config.partidaDurationMinutes ?? 5));
  const durationSeconds = Math.max(1, Math.round(minutosPorTempo * 60));
  const timerStartedAt = currentPartida.timerStartedAt ?? null;
  const timerEnded = currentPartida.timerEnded === true;
  const hasPoints = currentPartida.pointHistory.length > 0;

  container.innerHTML = '';

  const addEndPartidaButtons = (parentEl, showUndo) => {
    const endPartidaWrap = document.createElement('div');
    endPartidaWrap.className = 'end-partida-wrap';
    endPartidaWrap.innerHTML = showUndo
      ? `<button type="button" class="btn btn-outlined" id="btn-undo-point">Desfazer o ponto</button>
         <button type="button" class="btn btn-danger" id="btn-end-partida">Encerrar partida</button>`
      : '<button type="button" class="btn btn-danger" id="btn-end-partida">Encerrar partida</button>';
    if (showUndo) {
      endPartidaWrap.querySelector('#btn-undo-point').addEventListener('click', () => {
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
    }
    endPartidaWrap.querySelector('#btn-end-partida').addEventListener('click', () => {
      dialog.open({
        title: 'Encerrar partida',
        message: 'O placar atual será salvo e os times serão remisturados. Deseja encerrar a partida?',
        variant: 'alert',
        buttons: [
          { label: 'Cancelar', primary: false },
          { label: 'Encerrar partida', primary: true, callback: endPartida },
        ],
      });
    });
    parentEl.appendChild(endPartidaWrap);
  };

  if (mode === 'time' || mode === 'timeOrPoints') {
    if (!timerEnded) ensureTimerRunning();
    const timerCard = document.createElement('div');
    timerCard.className = 'partida-timer-card config-block';
    const displayRemaining = timerStartedAt != null && !timerEnded
      ? partidaTimer.remainingSeconds(timerStartedAt, durationSeconds)
      : durationSeconds;
    const displayText = partidaTimer.formatMinutesSeconds(displayRemaining);
    const scoreA = currentPartida.teamAPoints;
    const scoreB = currentPartida.teamBPoints;
    const endedAriaLabel = mode === 'timeOrPoints'
      ? getTimerFinalAriaLabel(scoreA, scoreB)
      : 'Tempo esgotado';
    const { firstTeam, secondTeam, firstScore, secondScore } = getScorePresentation(scoreA, scoreB);
    const firstClass = firstTeam === 'A' ? 'partida-timer-display-score-a' : 'partida-timer-display-score-b';
    const secondClass = secondTeam === 'A' ? 'partida-timer-display-score-a' : 'partida-timer-display-score-b';
    const endedDisplayHtml = mode === 'timeOrPoints'
      ? `<span class="partida-timer-display-score ${firstClass}">${firstScore}</span><span class="partida-timer-display-sep"> x </span><span class="partida-timer-display-score ${secondClass}">${secondScore}</span>`
      : 'ACABOU';
    const displayContent = timerEnded ? endedDisplayHtml : displayText;
    timerCard.innerHTML = `
      <div class="score-card-header partida-timer-card-header">
        <span class="label-text">Tempo da partida</span>
      </div>
      <div class="partida-timer-display" aria-live="polite" aria-label="${timerEnded ? endedAriaLabel : 'Tempo restante: ' + displayText}">${displayContent}</div>
      <div class="partida-timer-actions"></div>
    `;
    const actionsEl = timerCard.querySelector('.partida-timer-actions');
    if (timerStartedAt == null) {
      const startBtn = document.createElement('button');
      startBtn.type = 'button';
      startBtn.className = 'btn btn-primary';
      startBtn.textContent = 'Começar';
      startBtn.setAttribute('aria-label', 'Iniciar cronômetro da partida');
      startBtn.addEventListener('click', () => {
        setState({ currentPartida: { ...getState().currentPartida, timerStartedAt: Date.now() } });
        renderScoreButtons();
      });
      actionsEl.appendChild(startBtn);
    } else if (timerEnded) {
      const newPartidaBtn = document.createElement('button');
      newPartidaBtn.type = 'button';
      newPartidaBtn.className = 'btn btn-primary';
      newPartidaBtn.textContent = 'Nova partida';
      newPartidaBtn.setAttribute('aria-label', 'Encerrar partida e iniciar nova');
      newPartidaBtn.addEventListener('click', () => {
        endPartida();
      });
      actionsEl.appendChild(newPartidaBtn);
    } else {
      const restartBtn = document.createElement('button');
      restartBtn.type = 'button';
      restartBtn.className = 'btn btn-outlined';
      restartBtn.textContent = 'Reiniciar';
      restartBtn.setAttribute('aria-label', 'Reiniciar cronômetro');
      restartBtn.addEventListener('click', () => {
        dialog.open({
          title: 'Reiniciar cronômetro',
          message: 'O tempo da partida será zerado e iniciado de novo. Deseja reiniciar?',
          variant: 'alert',
          buttons: [
            { label: 'Cancelar', primary: false },
            {
              label: 'Reiniciar',
              primary: true,
              callback: () => {
                partidaTimer.stop();
                timerRunningForPartidaStartedAt = null;
                setState({ currentPartida: { ...getState().currentPartida, timerStartedAt: Date.now() } });
                renderScoreButtons();
              },
            },
          ],
        });
      });
      actionsEl.appendChild(restartBtn);
    }
    container.appendChild(timerCard);
  }

  const showPointsCard = mode === 'points' || (mode === 'timeOrPoints' && timerStartedAt != null && !timerEnded);
  if (showPointsCard) {
    const card = document.createElement('div');
    card.className = 'score-card config-block';
    const currentTempoIndex = Number.isFinite(currentPartida.currentTempoIndex) ? currentPartida.currentTempoIndex : 0;
    const tempoLabel = numTempos > 1 ? ` — ${currentTempoIndex + 1}º tempo de ${numTempos}` : '';
     const scoreA = currentPartida.teamAPoints;
     const scoreB = currentPartida.teamBPoints;
     const buttonAHtml = `
        <button type="button" class="score-btn team-a" data-team="A">
          <span class="score-label">Time A</span>
          <span class="score-value">${scoreA}</span>
        </button>`;
     const buttonBHtml = `
        <button type="button" class="score-btn team-b" data-team="B">
          <span class="score-label">Time B</span>
          <span class="score-value">${scoreB}</span>
        </button>`;
     const buttonsHtml = invertScoreDisplay ? `${buttonBHtml}${buttonAHtml}` : `${buttonAHtml}${buttonBHtml}`;
     const orderLabelText = invertScoreDisplay ? 'Time B x Time A' : 'Time A x Time B';
    card.innerHTML = `
      <div class="score-card-header">
        <span class="label-with-info" id="score-card-info-trigger" role="button" tabindex="0" aria-label="Como marcar pontos?">
          <span class="label-text">Pontuação da partida${tempoLabel}</span>
          <span class="info-icon" aria-hidden="true">!</span>
        </span>
        <button
          type="button"
          class="btn btn-outlined score-order-toggle"
          id="score-order-toggle"
          aria-pressed="${invertScoreDisplay ? 'true' : 'false'}"
          aria-label="Inverter ordem de exibição entre Time A e Time B"
        >
          ${orderLabelText}
        </button>
      </div>
      <div class="score-buttons">
        ${buttonsHtml}
      </div>
      <div class="tempos-summary"></div>
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
    const orderToggle = card.querySelector('#score-order-toggle');
    if (orderToggle) {
      orderToggle.addEventListener('click', (e) => {
        e.preventDefault();
        invertScoreDisplay = !invertScoreDisplay;
        teams.setInvertTeamsDisplay(invertScoreDisplay);
        renderScoreButtons();
        renderPointHistoryPanel();
        renderPartidasHistory();
        teams.renderTeamsPanel();
      });
    }
    const infoTrigger = card.querySelector('#score-card-info-trigger');
    if (infoTrigger) {
      const openScoreInfo = () => {
        dialog.info(
          'Clique no retângulo grande azul para marcar ponto do Time A e no retângulo verde para marcar ponto do Time B.',
          'Pontuação da partida'
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
    if (numTempos > 1) {
      const temposSummaryEl = card.querySelector('.tempos-summary');
      const temposArr = Array.isArray(currentPartida.tempos) ? currentPartida.tempos : [];
      if (temposSummaryEl && temposArr.length > 0) {
        const temposText = temposArr
          .map((p, idx) => `${idx + 1}º tempo: ${p.scoreA}x${p.scoreB}`)
          .join(' · ');
        temposSummaryEl.textContent = temposText;
      }
    }
    container.appendChild(card);
  }

  if (mode === 'points' && hasPoints) {
    addEndPartidaButtons(container.lastElementChild, true);
  } else if (mode === 'time' && !timerEnded && timerStartedAt != null) {
    addEndPartidaButtons(container.querySelector('.partida-timer-card'), false);
  } else if (mode === 'timeOrPoints' && !timerEnded && (timerStartedAt != null || hasPoints)) {
    const wrapContainer = document.createElement('div');
    wrapContainer.className = 'end-partida-wrap-container';
    container.appendChild(wrapContainer);
    addEndPartidaButtons(wrapContainer, hasPoints);
  }
}

function renderPointHistoryPanel() {
  const container = document.getElementById('point-history-container');
  if (!container) return;
  const { currentPartida } = getState();
  container.innerHTML = '';
  if (currentPartida.pointHistory.length === 0) return;
  const history = currentPartida.pointHistory;
  const reversed = [...history].reverse();
  const countActive = (arr) => ({ a: arr.filter((x) => !x.undone && x.team === 'A').length, b: arr.filter((x) => !x.undone && x.team === 'B').length });
  const items = reversed.map((h, j) => {
    const upTo = history.length - j;
    const slice = history.slice(0, upTo);
    const { a: scoreA, b: scoreB } = countActive(slice);
    const undoneClass = h.undone ? ' point-undone' : '';
    const line = formatScoreLineWithTeams(scoreA, scoreB);
    return `<li class="point-${h.team.toLowerCase()}${undoneClass}">${line}</li>`;
  });
  const panel = document.createElement('div');
  panel.className = 'point-history-panel';
  panel.innerHTML = `
    <h3>Histórico de pontos na partida (últimos pontos no topo)</h3>
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

function renderPartidasHistory() {
  const container = document.getElementById('partidas-history-container');
  if (!container) return;
  const { seriesHistory } = getState();
  const seriesWithPartidas = (seriesHistory || []).filter((s) => (s.partidas || []).length > 0);
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'partidas-history';
  wrap.innerHTML = '<h3>Histórico de partidas</h3>';
  if (seriesWithPartidas.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Nenhuma partida finalizada ainda.';
    wrap.appendChild(empty);
  } else {
    const countActive = (arr) => ({ a: arr.filter((x) => !x.undone && x.team === 'A').length, b: arr.filter((x) => !x.undone && x.team === 'B').length });
    [...seriesWithPartidas].reverse().forEach((serie, reversedIndex) => {
      const serieNumber = seriesWithPartidas.length - reversedIndex;
      const bestOf = serie.bestOf ?? 1;
      const winnerLabel = serie.winner ? ` — Time ${serie.winner === 'A' ? 'A' : 'B'} venceu` : ' (em andamento)';
      const ord = serieNumber === 1 ? '1ª' : serieNumber === 2 ? '2ª' : `${serieNumber}ª`;
      const namesA = (serie.teamAIds || []).map(getPlayerName).join(', ') || '—';
      const namesB = (serie.teamBIds || []).map(getPlayerName).join(', ') || '—';
      const partidasHtml = (serie.partidas || []).map((partida, i) => {
        const history = partida.pointHistory || [];
        const pointsListItems = [...history].reverse().map((h, j) => {
          const upTo = history.length - j;
          const slice = history.slice(0, upTo);
          const { a: scoreA, b: scoreB } = countActive(slice);
          const undoneClass = h.undone ? ' point-undone' : '';
          const line = formatScoreLineWithTeams(scoreA, scoreB);
          return `<li class="point-${h.team.toLowerCase()}${undoneClass}">${line}</li>`;
        });
        const pointsHtml = pointsListItems.length
          ? `<ul class="partida-points-list">${pointsListItems.join('')}</ul>`
          : '<p>—</p>';
        const temposArr = Array.isArray(partida.tempos) ? partida.tempos : (Array.isArray(partida.partes) ? partida.partes : []);
        const temposSummary = temposArr.length > 1
          ? `<p class="partida-tempos-resumo">${temposArr
              .map((p, idx) => `${idx + 1}º tempo: ${formatBareScore(p.scoreA, p.scoreB)}`)
              .join(' · ')}</p>`
          : '';
        return `
          <details class="partida-item serie-partida">
            <summary>Partida ${i + 1}: ${formatScoreLineWithTeams(partida.scoreA, partida.scoreB)}</summary>
            <div class="partida-detail">
              <div class="partida-detail-teams">
                <p><strong>Time A:</strong> ${escapeHtml(namesA)}</p>
                <p><strong>Time B:</strong> ${escapeHtml(namesB)}</p>
              </div>
              <div class="partida-detail-points">
                <strong>Pontos (último primeiro):</strong>
                ${pointsHtml}
                ${temposSummary}
              </div>
            </div>
          </details>`;
      }).join('');
      const serieDetails = document.createElement('details');
      serieDetails.className = 'serie-item';
      serieDetails.innerHTML = `
        <summary>Melhor de ${bestOf} — ${ord}${winnerLabel}</summary>
        <div class="serie-detail">
          ${partidasHtml}
        </div>
      `;
      wrap.appendChild(serieDetails);
    });
    const shareWrap = document.createElement('div');
    shareWrap.className = 'partidas-history-share';
    shareWrap.innerHTML = '<button type="button" class="btn btn-outlined" id="btn-share-partidas">Compartilhar histórico</button>';
    shareWrap.querySelector('#btn-share-partidas').addEventListener('click', sharePartidasHistory);
    wrap.appendChild(shareWrap);
  }
  container.appendChild(wrap);
}

export { addPoint, endPartida, togglePointHistory, renderScoreButtons, renderPointHistoryPanel, renderPartidasHistory };
