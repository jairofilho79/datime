/**
 * Datime — entrada da aplicação.
 * Inicializa abas, carrega estado e delega renderização aos módulos.
 */

import * as state from './state.js';
import * as players from './players.js';
import * as teams from './teams.js';
import * as scoring from './scoring.js';
import * as manualAssembly from './manualAssembly.js';
import dialog from './dialog.js';

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

function showPartidaPage() {
  const panelJogadores = document.getElementById('panel-jogadores');
  const panelTime = document.getElementById('panel-time');
  panelJogadores.classList.remove('active');
  panelJogadores.setAttribute('hidden', '');
  panelTime.classList.add('active');
  panelTime.removeAttribute('hidden');
  teams.formTeamsIfNeeded();
  teams.renderTeamsPanel();
  scoring.renderScoreButtons();
  scoring.renderPointHistoryPanel();
  scoring.renderPartidasHistory();
}

function showConfiguracoesPage() {
  const panelJogadores = document.getElementById('panel-jogadores');
  const panelTime = document.getElementById('panel-time');
  panelTime.classList.remove('active');
  panelTime.setAttribute('hidden', '');
  panelJogadores.classList.add('active');
  panelJogadores.removeAttribute('hidden');
  players.render();
}

function init() {
  initTheme();
  state.load();
  players.setOnPlayMatchClick(showPartidaPage);
  players.render();
  document.getElementById('btn-back-to-config')?.addEventListener('click', showConfiguracoesPage);
  document.getElementById('btn-manual-assembly')?.addEventListener('click', () => manualAssembly.open());
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
  showPartidaPage();
}

export { state, players, teams, scoring };
