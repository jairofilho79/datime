/**
 * Datime — entrada da aplicação.
 * Inicializa abas, carrega estado e delega renderização aos módulos.
 */

import * as state from './state.js';
import * as players from './players.js';
import * as teams from './teams.js';
import * as scoring from './scoring.js';
import dialog from './dialog.js';

const TAB_JOGADORES = 'jogadores';
const TAB_TIME = 'time';
const THEME_KEY = 'datime_theme';

function getTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  const iconEl = document.getElementById('theme-toggle-icon');
  const btn = document.getElementById('theme-toggle');
  if (iconEl) iconEl.textContent = theme === 'dark' ? '☀' : '🌙';
  if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Modo claro' : 'Modo escuro');
}

function initTheme() {
  const theme = getTheme();
  setTheme(theme);
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    setTheme(next);
  });
}

function initTabs() {
  const tabButtons = document.querySelectorAll('.tabs .tab');
  const panelJogadores = document.getElementById('panel-jogadores');
  const panelTime = document.getElementById('panel-time');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      if (tab === TAB_JOGADORES) {
        panelJogadores.classList.add('active');
        panelJogadores.removeAttribute('hidden');
        panelTime.classList.remove('active');
        panelTime.setAttribute('hidden', '');
        tabButtons[1].setAttribute('aria-selected', 'false');
        players.render();
      } else {
        panelTime.classList.add('active');
        panelTime.removeAttribute('hidden');
        panelJogadores.classList.remove('active');
        panelJogadores.setAttribute('hidden', '');
        tabButtons[0].setAttribute('aria-selected', 'false');
        teams.formTeamsIfNeeded();
        teams.renderTeamsPanel();
        scoring.renderScoreButtons();
        scoring.renderPointHistoryPanel();
        scoring.renderSetsHistory();
      }
    });
  });
}

function init() {
  initTheme();
  state.load();
  initTabs();
  players.render();
  document.getElementById('btn-regenerate-teams')?.addEventListener('click', () => {
    dialog.open({
      title: 'Gerar times novamente',
      message: 'A formação atual será substituída por uma nova mistura. Deseja continuar?',
      variant: 'alert',
      buttons: [
        { label: 'Cancelar', primary: false },
        { label: 'Gerar novamente', primary: true, callback: () => {
          teams.formTeamsIfNeeded(true);
          teams.renderTeamsPanel();
        } },
      ],
    });
  });
}

init();

// Exportar para outros módulos chamarem re-render quando necessário
export function switchToTimeTab() {
  document.querySelector('.tabs .tab[data-tab="time"]').click();
}

export { state, players, teams, scoring };
