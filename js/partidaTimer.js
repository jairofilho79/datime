/**
 * Cronômetro para duração da partida. Apenas conta tempo e notifica via callbacks.
 * Não conhece "partida", placar nem endPartida.
 */

let intervalId = null;
let startedAt = null;
let durationSeconds = null;
let onTickCallback = null;
let onEndCallback = null;

function remainingSeconds(startedAtMs, durationSec) {
  return Math.max(0, Math.ceil(durationSec - (Date.now() - startedAtMs) / 1000));
}

function tick() {
  if (startedAt == null || durationSeconds == null) return;
  const remaining = remainingSeconds(startedAt, durationSeconds);
  if (typeof onTickCallback === 'function') {
    onTickCallback(remaining);
  }
  if (remaining <= 0) {
    const cb = onEndCallback;
    stop();
    if (typeof cb === 'function') {
      cb();
    }
  }
}

function start(options) {
  const { durationSeconds: duration, startedAt: startedAtOption, onTick, onEnd } = options ?? {};
  stop();
  if (duration == null || duration <= 0) return;
  startedAt = startedAtOption != null && typeof startedAtOption === 'number' ? startedAtOption : Date.now();
  durationSeconds = duration;
  onTickCallback = typeof onTick === 'function' ? onTick : null;
  onEndCallback = typeof onEnd === 'function' ? onEnd : null;
  tick();
  intervalId = setInterval(tick, 1000);
}

function stop() {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  startedAt = null;
  durationSeconds = null;
  onTickCallback = null;
  onEndCallback = null;
}

function restart(durationSec, onTick, onEnd) {
  start({
    durationSeconds: durationSec,
    startedAt: Date.now(),
    onTick,
    onEnd,
  });
}

/**
 * Formata segundos como "MM:SS" (ex.: 90 → "01:30").
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatMinutesSeconds(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export { start, stop, restart, formatMinutesSeconds, remainingSeconds };
