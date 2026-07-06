const CHAMPIONS = [
  { id: 'master-yi', name: 'Master Yi', ability: 'Wuju Style', key: 'E', autoMs: 650, resetWindowMs: 240, color: '#f6d365', accent: '#9ef7ff', hint: 'Auto attack, then press E right as the sword spark lands to instantly start the next swing.' },
  { id: 'nasus', name: 'Nasus', ability: 'Siphoning Strike', key: 'Q', autoMs: 720, resetWindowMs: 260, color: '#b48cff', accent: '#ffe8a3', hint: 'Use Q immediately after the hit confirms to cancel downtime and chain the empowered attack.' },
  { id: 'jax', name: 'Jax', ability: 'Empower', key: 'W', autoMs: 690, resetWindowMs: 250, color: '#c084fc', accent: '#7dd3fc', hint: 'Strike first, then W during the reset timing window to keep pressure without wasted backswing.' },
  { id: 'renekton', name: 'Renekton', ability: 'Ruthless Predator', key: 'W', autoMs: 710, resetWindowMs: 250, color: '#fb923c', accent: '#fde68a', hint: 'Click the dummy, wait for impact, and buffer W just after damage appears.' },
];

const RESULTS = {
  idle: ['Ready', 'ready'], early: ['Too Early', 'early'], perfect: ['Perfect Reset', 'perfect'], late: ['Too Late', 'late'], missed: ['Missed Reset', 'missed'],
};

const $ = (id) => document.getElementById(id);
const state = { champion: CHAMPIONS[0], phase: 'idle', attackMovePrimed: false, attempts: 0, perfects: 0, streak: 0, bestStreak: 0, damage: 0, lastTiming: null, timers: [], activeAttempt: false, impactAt: 0, resetOpenAt: 0, resetCloseAt: 0 };

function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function formatMs(value) { return value === null || Number.isNaN(value) ? '—' : `${Math.round(value)} ms`; }
function schedule(fn, ms) { const timer = setTimeout(fn, ms); state.timers.push(timer); }
function clearTimers() { state.timers.forEach(clearTimeout); state.timers = []; }

function renderChampionButtons() {
  $('championGrid').innerHTML = CHAMPIONS.map((champion) => `
    <button class="champion ${state.champion.id === champion.id ? 'active' : ''}" data-champion="${champion.id}">
      <strong>${champion.name}</strong><span>${champion.key} · ${champion.ability}</span>
    </button>`).join('');
}

function render() {
  document.documentElement.style.setProperty('--champion', state.champion.color);
  document.documentElement.style.setProperty('--accent', state.champion.accent);
  renderChampionButtons();
  $('resetKeyInline').textContent = state.champion.key;
  $('resetKeyHud').textContent = state.champion.key;
  $('championHint').textContent = state.champion.hint;
  $('avatarName').textContent = state.champion.name;
  $('resetWindowLabel').textContent = `Reset window: ${state.champion.resetWindowMs} ms`;
  $('attempts').textContent = state.attempts;
  $('perfects').textContent = state.perfects;
  $('streak').textContent = state.streak;
  $('bestStreak').textContent = state.bestStreak;
  $('lastTiming').textContent = formatMs(state.lastTiming);
  $('damageText').textContent = `${state.damage} damage dealt`;
  $('healthBar').style.width = `${clamp(100 - state.damage / 18, 8, 100)}%`;
  const accuracy = state.attempts ? Math.round((state.perfects / state.attempts) * 100) : 0;
  $('accuracy').textContent = `${accuracy}% accuracy`;
  $('accuracyDetail').textContent = `${state.perfects}/${state.attempts} perfect resets`;
  $('arena').classList.toggle('primed', state.attackMovePrimed);
  $('attackMoveRing').classList.toggle('hidden', !state.attackMovePrimed);
}

function setPhase(phase) {
  state.phase = phase;
  $('championAvatar').className = `champion-avatar ${phase}`;
  $('dummy').className = `dummy ${phase}`;
  $('barFill').style.width = phase === 'windup' ? '48%' : phase === 'impact' ? '100%' : '0%';
}

function setResult(result) {
  const [label, className] = RESULTS[result];
  $('status').textContent = label;
  $('status').className = `status ${className}`;
}

function burst(kind) {
  const spark = document.createElement('div');
  spark.className = `spark ${kind}`;
  spark.textContent = '⚡';
  $('arena').append(spark);
  schedule(() => spark.remove(), 900);
}

function completeAttempt(outcome, timing) {
  state.activeAttempt = false;
  state.attempts += 1;
  state.lastTiming = timing;
  setResult(outcome);
  setPhase('recovery');
  if (outcome === 'perfect') {
    state.perfects += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.damage += 92;
    burst('perfect');
  } else {
    state.streak = 0;
    if (outcome === 'early') burst('early');
  }
  render();
  schedule(() => { setPhase('idle'); setResult('idle'); }, 720);
}

function beginAttack() {
  if (state.phase !== 'idle' && state.phase !== 'recovery') return;
  clearTimers();
  const now = performance.now();
  state.activeAttempt = true;
  state.impactAt = now + state.champion.autoMs * 0.48;
  state.resetOpenAt = state.impactAt;
  state.resetCloseAt = state.impactAt + state.champion.resetWindowMs;
  state.lastTiming = null;
  state.attackMovePrimed = false;
  setPhase('windup');
  setResult('idle');
  render();

  schedule(() => { setPhase('impact'); state.damage += 64; burst('hit'); render(); }, state.champion.autoMs * 0.48);
  schedule(() => { if (state.activeAttempt) completeAttempt('missed', null); }, state.champion.autoMs * 0.48 + state.champion.resetWindowMs);
}

function triggerReset() {
  if (!state.activeAttempt) return;
  const now = performance.now();
  const timing = now - state.resetOpenAt;
  clearTimers();
  if (now < state.resetOpenAt) completeAttempt('early', timing);
  else if (now <= state.resetCloseAt) completeAttempt('perfect', timing);
  else completeAttempt('late', timing);
}

function resetStats() {
  clearTimers();
  Object.assign(state, { phase: 'idle', attackMovePrimed: false, attempts: 0, perfects: 0, streak: 0, bestStreak: 0, damage: 0, lastTiming: null, activeAttempt: false });
  document.querySelectorAll('.spark').forEach((spark) => spark.remove());
  setPhase('idle');
  setResult('idle');
  render();
}

$('arena').addEventListener('click', (event) => {
  if (event.target.closest('[data-dummy]') || state.attackMovePrimed) beginAttack();
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-champion]');
  if (!button) return;
  state.champion = CHAMPIONS.find((champion) => champion.id === button.dataset.champion);
  resetStats();
});

$('resetButton').addEventListener('click', resetStats);

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'a') { event.preventDefault(); state.attackMovePrimed = true; render(); }
  if (key === state.champion.key.toLowerCase()) { event.preventDefault(); triggerReset(); }
  if (key === 'escape') { state.attackMovePrimed = false; render(); }
});

render();
