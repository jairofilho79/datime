/**
 * Formação e remistura de times (balanceamento por grupo).
 */

import { getState, setState } from './state.js';

function formTeamsIfNeeded(forceShuffle = false) {
  const { players, config, teams } = getState();
  if (players.length === 0) {
    setState({ teams: { teamA: [], teamB: [], reserves: [] } });
    return;
  }
  const groups = getState().groups;
  const { teamA, teamB, reserves } = buildTeams(players, config.playersPerTeam, forceShuffle, groups);
  setState({ teams: { teamA, teamB, reserves } });
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Conta quantos sets cada jogador jogou (titular), a partir do histórico. */
function getSetsPlayed(setsHistory) {
  const count = new Map();
  if (!setsHistory || !setsHistory.length) return count;
  for (const set of setsHistory) {
    const ids = [...(set.teamAIds || []), ...(set.teamBIds || [])];
    for (const id of ids) count.set(id, (count.get(id) || 0) + 1);
  }
  return count;
}

/** Extrai o número do nome do grupo (ex.: "Grupo 1" -> 1). Sem número ou inválido -> 0. */
function getGroupNumber(group) {
  const num = parseInt(group.name.replace(/^Grupo\s*/i, ''), 10);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Ordem dos grupos pelo número no nome (1, 2, 3...) e força por grupo (Grupo 1 = maior força).
 * Retorna { groupIdToStrength: Map<string, number>, orderedGroupIds: string[] }.
 */
function getGroupOrderAndStrength(groups) {
  if (!groups || groups.length === 0) return { groupIdToStrength: new Map(), orderedGroupIds: [] };
  const sorted = [...groups].sort((a, b) => getGroupNumber(a) - getGroupNumber(b));
  const N = sorted.length;
  const groupIdToStrength = new Map();
  const orderedGroupIds = sorted.map((g) => g.id);
  sorted.forEach((g, index) => {
    groupIdToStrength.set(g.id, N - index - 1);
  });
  return { groupIdToStrength, orderedGroupIds };
}

/**
 * Ordem dos IDs de grupo para rodízio: por número no nome se groups existir, senão por string.
 */
function getGroupOrderForRoundRobin(byGroupKeys, groups) {
  const list = [...byGroupKeys];
  if (groups && groups.length > 0) {
    return list.sort((a, b) => {
      const ga = groups.find((g) => g.id === a);
      const gb = groups.find((g) => g.id === b);
      const na = ga ? getGroupNumber(ga) : 0;
      const nb = gb ? getGroupNumber(gb) : 0;
      return na - nb || String(a).localeCompare(String(b));
    });
  }
  return list.sort((a, b) => String(a).localeCompare(String(b)));
}

/**
 * Seleciona titulares em rodízio por grupo (mesma chance por grupo) e priorizando quem jogou menos sets.
 * Depois divide titulares em A/B por força (se groups) ou alternando (senão). Reservas = resto.
 */
function buildTeams(players, playersPerTeam, shuffleWithinGroups = false, groups = null) {
  const totalSlots = Math.min(players.length, 2 * playersPerTeam);
  const maxA = totalSlots === 0 ? 0 : Math.ceil(totalSlots / 2);
  const maxB = totalSlots === 0 ? 0 : Math.floor(totalSlots / 2);

  const setsPlayed = getSetsPlayed(getState().setsHistory || []);
  const byGroup = new Map();
  for (const p of players) {
    if (!byGroup.has(p.groupId)) byGroup.set(p.groupId, []);
    byGroup.get(p.groupId).push(p);
  }
  for (const gid of byGroup.keys()) {
    const list = byGroup.get(gid);
    list.sort((a, b) => (setsPlayed.get(a.id) || 0) - (setsPlayed.get(b.id) || 0));
    byGroup.set(gid, list);
  }

  const groupOrder = getGroupOrderForRoundRobin([...byGroup.keys()], groups);
  const indices = new Map(groupOrder.map((gid) => [gid, 0]));
  const titularPlayers = [];
  while (titularPlayers.length < totalSlots) {
    let added = false;
    for (const gid of groupOrder) {
      if (titularPlayers.length >= totalSlots) break;
      const list = byGroup.get(gid) || [];
      const idx = indices.get(gid) ?? 0;
      if (idx < list.length) {
        titularPlayers.push(list[idx]);
        indices.set(gid, idx + 1);
        added = true;
      }
    }
    if (!added) break;
  }

  const hasStrength = groups && groups.length > 0;
  if (hasStrength) {
    const { groupIdToStrength } = getGroupOrderAndStrength(groups);
    const withStrength = titularPlayers.map((p) => ({
      player: p,
      strength: groupIdToStrength.has(p.groupId) ? groupIdToStrength.get(p.groupId) : 0,
    }));
    withStrength.sort((a, b) => b.strength - a.strength);
    if (shuffleWithinGroups) {
      let i = 0;
      while (i < withStrength.length) {
        let j = i;
        while (j < withStrength.length && withStrength[j].strength === withStrength[i].strength) j++;
        if (j - i > 1) {
          const chunk = withStrength.splice(i, j - i);
          withStrength.splice(i, 0, ...shuffleArray(chunk));
        }
        i = j;
      }
    }
    const teamA = [];
    const teamB = [];
    let sumA = 0;
    let sumB = 0;
    let nextToA = true;
    for (const { player, strength } of withStrength) {
      const canA = teamA.length < maxA;
      const canB = teamB.length < maxB;
      if (!canA && !canB) break;
      const toA = !canB || (canA && (sumA < sumB || (sumA === sumB && nextToA)));
      if (toA && canA) {
        teamA.push(player.id);
        sumA += strength;
        nextToA = false;
      } else if (canB) {
        teamB.push(player.id);
        sumB += strength;
        nextToA = true;
      }
    }
    const used = new Set([...teamA, ...teamB]);
    const reserves = players.filter((p) => !used.has(p.id)).map((p) => p.id);
    return { teamA, teamB, reserves };
  }

  const teamA = [];
  const teamB = [];
  let nextToA = true;
  for (const p of titularPlayers) {
    if (teamA.length < maxA && (nextToA || teamB.length >= maxB)) {
      teamA.push(p.id);
      nextToA = false;
    } else if (teamB.length < maxB) {
      teamB.push(p.id);
      nextToA = true;
    }
  }
  const used = new Set([...teamA, ...teamB]);
  const reserves = players.filter((p) => !used.has(p.id)).map((p) => p.id);
  return { teamA, teamB, reserves };
}

/**
 * Remistura ao final do set: pouco (só reservas ou 20%), normal (40–60%), muito (80%).
 * Reservas têm prioridade para entrar nos titulares.
 */
function remix() {
  const { players, config, teams } = getState();
  if (players.length === 0) return;
  const n = config.playersPerTeam;
  const level = config.remixLevel || 'normal';
  const titularesArray = [...teams.teamA, ...teams.teamB];
  const numTitulares = titularesArray.length;
  const numReservas = teams.reserves.length;

  let numToRotate;
  if (level === 'pouco') {
    numToRotate = numReservas > 0 ? Math.min(numReservas, numTitulares) : Math.max(1, Math.floor(numTitulares * 0.2));
  } else if (level === 'normal') {
    numToRotate = Math.max(1, Math.floor(numTitulares * 0.5));
  } else {
    numToRotate = Math.max(1, Math.floor(numTitulares * 0.8));
  }

  const setsPlayed = getSetsPlayed(getState().setsHistory || []);
  const titularesByMostPlayed = [...titularesArray].sort((a, b) => (setsPlayed.get(b) || 0) - (setsPlayed.get(a) || 0));
  const toRemove = titularesByMostPlayed.slice(0, numToRotate);
  const stayTitulares = titularesArray.filter((id) => !toRemove.includes(id));
  const poolIds = [...teams.reserves, ...toRemove];
  const poolPlayers = poolIds.map((id) => players.find((p) => p.id === id)).filter(Boolean);
  const groups = getState().groups;
  const { teamA: newA, teamB: newB, reserves: newReserves } = buildTeamsWithReservePriority(poolPlayers, stayTitulares, n, groups);
  setState({ teams: { teamA: newA, teamB: newB, reserves: newReserves } });
}

/**
 * Monta times na remistura: quem entra como titular na pool é quem jogou MENOS sets (sem privilégio por força).
 * Depois divide titulares (stay + escolhidos da pool) em A/B por força. Reservas = resto da pool.
 */
function buildTeamsWithReservePriority(poolPlayers, stayIds, playersPerTeam, groups = null) {
  const totalPeople = poolPlayers.length + stayIds.length;
  const totalSlots = Math.min(totalPeople, 2 * playersPerTeam);
  const maxA = totalSlots === 0 ? 0 : Math.ceil(totalSlots / 2);
  const maxB = totalSlots === 0 ? 0 : Math.floor(totalSlots / 2);

  const numNewFromPool = Math.max(0, totalSlots - stayIds.length);
  const setsPlayed = getSetsPlayed(getState().setsHistory || []);
  const poolSorted = [...poolPlayers].sort((a, b) => (setsPlayed.get(a.id) || 0) - (setsPlayed.get(b.id) || 0));
  const selectedFromPool = poolSorted.slice(0, numNewFromPool);
  const allPlayers = getState().players || [];
  const stayPlayers = stayIds.map((id) => allPlayers.find((p) => p.id === id)).filter(Boolean);
  const titularPlayers = [...stayPlayers, ...selectedFromPool];

  const teamA = [];
  const teamB = [];
  const hasStrength = groups && groups.length > 0;

  if (hasStrength) {
    const { groupIdToStrength } = getGroupOrderAndStrength(groups);
    const withStrength = titularPlayers.map((p) => ({
      player: p,
      strength: groupIdToStrength.has(p.groupId) ? groupIdToStrength.get(p.groupId) : 0,
    }));
    withStrength.sort((a, b) => b.strength - a.strength);
    let sumA = 0;
    let sumB = 0;
    let nextToA = true;
    for (const { player, strength } of withStrength) {
      const canA = teamA.length < maxA;
      const canB = teamB.length < maxB;
      if (!canA && !canB) break;
      const toA = !canB || (canA && (sumA < sumB || (sumA === sumB && nextToA)));
      if (toA && canA) {
        teamA.push(player.id);
        sumA += strength;
        nextToA = false;
      } else if (canB) {
        teamB.push(player.id);
        sumB += strength;
        nextToA = true;
      }
    }
  } else {
    let nextToA = true;
    for (const p of titularPlayers) {
      if (teamA.length < maxA && (nextToA || teamB.length >= maxB)) {
        teamA.push(p.id);
        nextToA = false;
      } else if (teamB.length < maxB) {
        teamB.push(p.id);
        nextToA = true;
      }
    }
  }

  const used = new Set([...teamA, ...teamB]);
  const reserves = [
    ...poolPlayers.filter((p) => !used.has(p.id)).map((p) => p.id),
    ...stayIds.filter((id) => !used.has(id)),
  ];
  return { teamA, teamB, reserves };
}

function renderTeamsPanel() {
  const container = document.getElementById('teams-display-container');
  if (!container) return;
  const { players, groups, teams } = getState();
  const escapeHtml = (s) => {
    const div = document.createElement('div');
    div.textContent = s ?? '—';
    return div.innerHTML;
  };
  const getName = (id) => players.find((p) => p.id === id)?.name ?? '—';

  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'teams-display';

  const teamABlock = document.createElement('div');
  teamABlock.className = 'team-block team-a';
  teamABlock.innerHTML = `
    <h3>Time A</h3>
    <div class="team-members">${teams.teamA.length ? teams.teamA.map((id) => `<span>${escapeHtml(getName(id))}</span>`).join('') : '<span>—</span>'}</div>
  `;
  wrap.appendChild(teamABlock);

  const teamBBlock = document.createElement('div');
  teamBBlock.className = 'team-block team-b';
  teamBBlock.innerHTML = `
    <h3>Time B</h3>
    <div class="team-members">${teams.teamB.length ? teams.teamB.map((id) => `<span>${escapeHtml(getName(id))}</span>`).join('') : '<span>—</span>'}</div>
  `;
  wrap.appendChild(teamBBlock);

  const reservesBlock = document.createElement('div');
  reservesBlock.className = 'reserves-block';
  reservesBlock.innerHTML = `
    <h3>Reservas</h3>
    <div class="reserves-list">${teams.reserves.length ? teams.reserves.map((id) => escapeHtml(getName(id))).join(', ') : 'Nenhuma'}</div>
  `;
  wrap.appendChild(reservesBlock);

  container.appendChild(wrap);
}

export { formTeamsIfNeeded, buildTeams, buildTeamsWithReservePriority, remix, renderTeamsPanel };
