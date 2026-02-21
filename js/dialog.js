/**
 * Dialog/modal reutilizável: info, alerta, erro; dismissível ao clicar fora; botões com callback.
 */

let overlayEl = null;
let onCloseCallback = null;
let escapeHandler = null;

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

function close() {
  if (!overlayEl) return;
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
    escapeHandler = null;
  }
  overlayEl.remove();
  overlayEl = null;
  if (onCloseCallback) {
    onCloseCallback();
    onCloseCallback = null;
  }
}

function open(options) {
  const {
    title = '',
    message = '',
    variant = 'info',
    buttons = [],
    onClose,
  } = options;

  close();

  onCloseCallback = onClose || null;

  const effectiveButtons = buttons.length > 0
    ? buttons
    : [{ label: 'OK', primary: true, callback: null }];

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.setAttribute('role', 'presentation');

  const modal = document.createElement('div');
  modal.className = `dialog-modal dialog-modal--${variant}`;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  if (title) modal.setAttribute('aria-labelledby', 'dialog-title');

  modal.innerHTML = `
    ${title ? `<h2 id="dialog-title" class="dialog-title">${escapeHtml(title)}</h2>` : ''}
    <p class="dialog-message">${escapeHtml(message)}</p>
    <div class="dialog-actions"></div>
  `;

  const actionsEl = modal.querySelector('.dialog-actions');
  effectiveButtons.forEach((btn) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn' + (btn.primary ? ' btn-primary' : ' btn-outlined');
    button.textContent = btn.label;
    button.addEventListener('click', () => {
      if (typeof btn.callback === 'function') btn.callback();
      close();
    });
    actionsEl.appendChild(button);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  modal.addEventListener('click', (e) => e.stopPropagation());

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlayEl = overlay;

  escapeHandler = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', escapeHandler);
}

function info(message, title) {
  open({ message, title, variant: 'info' });
}

function alertDialog(message, title) {
  open({ message, title, variant: 'alert' });
}

function error(message, title) {
  open({ message, title, variant: 'error' });
}

export default {
  open,
  close,
  info,
  alert: alertDialog,
  error,
};
