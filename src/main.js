const CHAMPIONS = [
  { id: 'master-yi', name: 'Master Yi', ability: 'Meditate reset', key: 'W', autoMs: 650, resetWindowMs: 240, color: '#f6d365', accent: '#9ef7ff', hint: 'Auto attack, then tap W/Meditate right as the sword spark lands to cancel downtime and restart your swing.' },
  { id: 'nasus', name: 'Nasus', ability: 'Siphoning Strike', key: 'Q', autoMs: 720, resetWindowMs: 260, color: '#b48cff', accent: '#ffe8a3', hint: 'Use Q immediately after the hit confirms to cancel downtime and chain the empowered attack.' },
  { id: 'jax', name: 'Jax', ability: 'Empower', key: 'W', autoMs: 690, resetWindowMs: 250, color: '#c084fc', accent: '#7dd3fc', hint: 'Strike first, then W during the reset timing window to keep pressure without wasted backswing.' },
  { id: 'renekton', name: 'Renekton', ability: 'Ruthless Predator', key: 'W', autoMs: 710, resetWindowMs: 250, color: '#fb923c', accent: '#fde68a', hint: 'Click the dummy, wait for impact, and buffer W just after damage appears.' },
];

const RESULTS = {
  idle: ['Ready', 'ready'], early: ['Too Early', 'early'], perfect: ['Perfect Reset', 'perfect'], late: ['Too Late', 'late'], missed: ['Missed Reset', 'missed'],
};

const RIOT_ASSET_BASE = 'https://ddragon.leagueoflegends.com/cdn/15.24.1/img';
const CDRAGON_CHARACTER_BASE = 'https://raw.communitydragon.org/latest/game/assets/characters';
const ASSET_URLS = {
  yi: `${RIOT_ASSET_BASE}/champion/MasterYi.png`,
  q: `${RIOT_ASSET_BASE}/spell/AlphaStrike.png`,
  w: `${RIOT_ASSET_BASE}/spell/Meditate.png`,
  e: `${RIOT_ASSET_BASE}/spell/WujuStyle.png`,
  smite: `${RIOT_ASSET_BASE}/spell/SummonerSmite.png`,
  blue: `${CDRAGON_CHARACTER_BASE}/sru_blue/hud/bluesentinel_square.png`,
  gromp: `${CDRAGON_CHARACTER_BASE}/sru_gromp/hud/gromp_square.png`,
  wolves: `${CDRAGON_CHARACTER_BASE}/sru_murkwolf/hud/murkwolf_square.png`,
  raptors: `${CDRAGON_CHARACTER_BASE}/sru_razorbeak/hud/razorbeak_square.png`,
  red: `${CDRAGON_CHARACTER_BASE}/sru_red/hud/redbrambleback_square.png`,
  krugs: `${CDRAGON_CHARACTER_BASE}/sru_krug/hud/krug_square.png`,
};
const assets = Object.fromEntries(Object.entries(ASSET_URLS).map(([key, src]) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = src;
  return [key, image];
}));

function drawAssetCircle(image, x, y, radius, fallbackColor, label) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  if (image?.complete && image.naturalWidth) {
    ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${Math.max(11, radius * 0.42)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 4);
  }
  ctx.restore();
}

function drawAssetBillboard(image, x, y, width, height, fallbackColor, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.beginPath();
  ctx.ellipse(0, height * 0.46, width * 0.55, height * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  const gradient = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.28)');
  gradient.addColorStop(0.18, fallbackColor);
  gradient.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = gradient;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  roundRect(ctx, -width / 2, -height / 2, width, height, 13);
  ctx.fill();
  ctx.stroke();
  if (image?.complete && image.naturalWidth) {
    ctx.save();
    roundRect(ctx, -width / 2 + 4, -height / 2 + 4, width - 8, height - 8, 10);
    ctx.clip();
    ctx.drawImage(image, -width / 2 + 4, -height / 2 + 4, width - 8, height - 8);
    ctx.restore();
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${Math.max(14, width * 0.26)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 5);
  }
  ctx.restore();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function physicalDamage(raw, armor) {
  return Math.round(raw * (100 / (100 + Math.max(0, armor))));
}

const $ = (id) => document.getElementById(id);
const state = { mode: 'reset', champion: CHAMPIONS[0], phase: 'idle', attackMovePrimed: false, attempts: 0, perfects: 0, streak: 0, bestStreak: 0, damage: 0, lastTiming: null, timers: [], activeAttempt: false, impactAt: 0, resetOpenAt: 0, resetCloseAt: 0 };

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
  if ($('resetKeyHud')) $('resetKeyHud').textContent = state.champion.key;
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

const audio = { ctx: null };
function playTone(kind = 'hit') {
  audio.ctx ||= new AudioContext();
  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  const frequencies = { hit: 230, perfect: 520, early: 130, spell: 740 };
  osc.type = kind === 'spell' ? 'sawtooth' : 'triangle';
  osc.frequency.setValueAtTime(frequencies[kind] || 260, now);
  osc.frequency.exponentialRampToValueAtTime((frequencies[kind] || 260) * 0.55, now + 0.16);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(gain).connect(audio.ctx.destination);
  osc.start(now);
  osc.stop(now + 0.19);
}

function burst(kind) {
  const spark = document.createElement('div');
  spark.className = `spark ${kind}`;
  spark.textContent = '⚡';
  $('arena').append(spark);
  playTone(kind);
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
  if (typeof resetJungle === 'function') resetJungle();
  document.querySelectorAll('.spark').forEach((spark) => spark.remove());
  setPhase('idle');
  setResult('idle');
  render();
}

$('arena').addEventListener('click', (event) => {
  if (state.mode !== 'reset') return;
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

const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');
const world = {
  minions: Array.from({ length: 8 }, (_, index) => ({ lane: index % 2, offset: index * 95, bob: Math.random() * Math.PI * 2 })),
  particles: Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random(), size: 1 + Math.random() * 2, speed: 0.15 + Math.random() * 0.45 })),
};

function sizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

let lastFrame = performance.now();
function drawGame(time = 0) {
  const dt = Math.min(0.05, (time - lastFrame) / 1000 || 0);
  lastFrame = time;
  updateJungle(dt);
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#143b46');
  gradient.addColorStop(0.42, '#1f3c2f');
  gradient.addColorStop(1, '#172554');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-0.18);
  ctx.fillStyle = 'rgba(88, 166, 114, 0.32)';
  ctx.fillRect(-width, -56, width * 2, 112);
  ctx.strokeStyle = 'rgba(234, 221, 173, 0.52)';
  ctx.lineWidth = 4;
  ctx.setLineDash([24, 18]);
  ctx.beginPath();
  ctx.moveTo(-width, 0);
  ctx.lineTo(width, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.fillStyle = 'rgba(18, 83, 70, 0.38)';
  for (let i = 0; i < 14; i += 1) {
    const x = ((i * 137 + time * 0.012) % (width + 160)) - 80;
    const y = 54 + (i % 4) * (height / 4.8);
    ctx.beginPath();
    ctx.ellipse(x, y, 46, 19, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  world.minions.forEach((minion, index) => {
    const direction = minion.lane ? -1 : 1;
    const x = minion.lane ? width - ((time * 0.035 + minion.offset) % (width + 120)) : ((time * 0.035 + minion.offset) % (width + 120)) - 60;
    const y = height * 0.52 + (index % 4 - 1.5) * 20 + Math.sin(time * 0.006 + minion.bob) * 5;
    ctx.fillStyle = minion.lane ? 'rgba(248, 113, 113, 0.88)' : 'rgba(96, 165, 250, 0.88)';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillRect(x - 9 * direction, y - 3, 18 * direction, 6);
  });

  if (state.mode === 'jungle') drawJungleActors(width, height);

  world.particles.forEach((particle) => {
    particle.y += particle.speed / 1000;
    if (particle.y > 1) particle.y = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
    ctx.beginPath();
    ctx.arc(particle.x * width, particle.y * height, particle.size, 0, Math.PI * 2);
    ctx.fill();
  });

  requestAnimationFrame(drawGame);
}

function drawJungleActors(width, height) {
  const scaleX = width / 960;
  const scaleY = height / 560;
  ctx.save();
  ctx.scale(scaleX, scaleY);
  jungle.camps.forEach((camp) => {
    if (camp.hp <= 0) return;
    ctx.strokeStyle = jungle.selectedCamp === camp ? '#fef08a' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 4;
    const radius = camp.id === 'blue' || camp.id === 'red' ? 38 : 30;
    const offsets = camp.units === 1 ? [[0, 0, radius]] : Array.from({ length: camp.units }, (_, index) => {
      const angle = (index / camp.units) * Math.PI * 2;
      return [Math.cos(angle) * 24, Math.sin(angle) * 18, index === 0 ? radius : radius * 0.62];
    });
    offsets.forEach(([ox, oy, unitRadius], index) => {
      drawAssetBillboard(assets[camp.id], camp.x + ox, camp.y + oy, unitRadius * 1.75, unitRadius * 2.15, camp.color, camp.name[0]);
      ctx.strokeRect(camp.x + ox - unitRadius * 0.9, camp.y + oy - unitRadius * 1.1, unitRadius * 1.8, unitRadius * 2.2);
    });
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(camp.x - 44, camp.y - 52, 88, 9);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(camp.x - 44, camp.y - 52, 88 * (camp.hp / camp.maxHp), 9);
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(camp.name, camp.x, camp.y + 55);
  });
  ctx.strokeStyle = 'rgba(158,247,255,0.42)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.tx, player.ty);
  ctx.stroke();
  ctx.strokeStyle = '#9ef7ff';
  ctx.lineWidth = 5;
  drawAssetBillboard(assets.yi, player.x, player.y, 58, 76, '#f6d365', 'Yi');
  ctx.strokeRect(player.x - 29, player.y - 38, 58, 76);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(player.x - 44, player.y - 44, 88, 8);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(player.x - 44, player.y - 44, 88 * (player.hp / player.maxHp), 8);
  ctx.restore();
}

window.addEventListener('resize', sizeCanvas);
sizeCanvas();
drawGame();


const ABILITY_SLOTS = [
  { key: 'Q', name: 'Alpha Strike', image: 'q', cooldown: () => player.qCooldown, max: 4.2 },
  { key: 'W', name: 'Meditate Reset', image: 'w', cooldown: () => player.wCooldown, max: 7 },
  { key: 'E', name: 'Wuju Style', image: 'e', cooldown: () => player.eTimer > 0 ? 0 : 0, max: 5 },
  { key: 'D', name: 'Smite', image: 'smite', cooldown: () => player.smiteCooldown, max: 15 },
];

function renderAbilityBar() {
  const bar = $('abilityBar');
  if (!bar || state.mode !== 'jungle') {
    if (bar) bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  bar.innerHTML = ABILITY_SLOTS.map((slot) => {
    const cd = slot.cooldown();
    const pct = slot.max ? clamp(cd / slot.max, 0, 1) : 0;
    const active = slot.key === 'E' && player.eTimer > 0;
    return `<div class="ability ${cd > 0 ? 'cooling' : ''} ${active ? 'active' : ''}">
      <img src="${assets[slot.image].src}" alt="${slot.name}" />
      <b>${slot.key}</b><span>${slot.name}</span>
      <em style="--cooldown:${pct}">${cd > 0 ? cd.toFixed(1) : active ? 'ON' : 'Ready'}</em>
    </div>`;
  }).join('');
}

const player = { x: 190, y: 310, tx: 190, ty: 310, hp: 760, maxHp: 760, ad: 65, bonusTrueDamage: 0, attackCooldown: 0, qCooldown: 0, wCooldown: 0, eTimer: 0, smiteCooldown: 0 };
const jungle = {
  modeStarted: performance.now(), selectedCamp: null,
  camps: [
    { id: 'blue', name: 'Blue Sentinel', x: 650, y: 170, hp: 2300, maxHp: 2300, damage: 66, armor: 42, mr: 42, respawn: 300, color: '#60a5fa', units: 1 },
    { id: 'gromp', name: 'Gromp', x: 825, y: 300, hp: 2050, maxHp: 2050, damage: 70, armor: 20, mr: 20, respawn: 135, color: '#34d399', units: 1 },
    { id: 'wolves', name: 'Murk Wolves', x: 565, y: 360, hp: 1650, maxHp: 1650, damage: 42, armor: 20, mr: 20, respawn: 135, color: '#94a3b8', units: 3 },
    { id: 'raptors', name: 'Raptors', x: 360, y: 270, hp: 1400, maxHp: 1400, damage: 38, armor: 20, mr: 20, respawn: 135, color: '#f97316', units: 6 },
    { id: 'red', name: 'Red Brambleback', x: 250, y: 440, hp: 2300, maxHp: 2300, damage: 66, armor: 42, mr: 42, respawn: 300, color: '#ef4444', units: 1 },
    { id: 'krugs', name: 'Krugs', x: 135, y: 215, hp: 1900, maxHp: 1900, damage: 55, armor: 20, mr: 20, respawn: 135, color: '#a16207', units: 2 },
  ],
};

function setMode(mode) {
  state.mode = mode;
  document.body.classList.toggle('jungle-mode', mode === 'jungle');
  document.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
  $('jungleOverlay').classList.toggle('hidden', mode !== 'jungle');
  $('keyHint').innerHTML = mode === 'jungle'
    ? '🧭 Right click move · <kbd>A</kbd> + click camps · <kbd>Q</kbd>/<kbd>W</kbd>/<kbd>E</kbd>/<kbd>D</kbd> clear'
    : `🖱️ Click dummy · <kbd>A</kbd> + click · <kbd id="resetKeyHud">${state.champion.key}</kbd> reset`;
  renderAbilityBar();
}

document.addEventListener('click', (event) => {
  const modeButton = event.target.closest('[data-mode]');
  if (!modeButton) return;
  setMode(modeButton.dataset.mode);
});

$('arena').addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  player.tx = event.clientX - rect.left;
  player.ty = event.clientY - rect.top;
});

function campAtPoint(x, y) {
  return jungle.camps.find((camp) => camp.hp > 0 && Math.hypot(camp.x - x, camp.y - y) < 42);
}

$('arena').addEventListener('pointerdown', (event) => {
  if (state.mode !== 'jungle') return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const camp = campAtPoint(x, y);
  if (camp) {
    jungle.selectedCamp = camp;
    player.tx = camp.x - 58;
    player.ty = camp.y;
  } else if (state.attackMovePrimed) {
    jungle.selectedCamp = nearestCamp(x, y);
    player.tx = x;
    player.ty = y;
  }
  state.attackMovePrimed = false;
  render();
});

function nearestCamp(x = player.x, y = player.y) {
  return jungle.camps.filter((camp) => camp.hp > 0).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] || null;
}

function damageCamp(camp, amount, label = 'hit') {
  if (!camp || camp.hp <= 0) return;
  camp.hp = Math.max(0, camp.hp - amount);
  state.damage += amount;
  if (camp.hp === 0) {
    state.perfects += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    camp.deadAt = performance.now();
    jungle.selectedCamp = nearestCamp();
  }
  burst(label);
  render();
}

function castJungleSpell(key) {
  const camp = jungle.selectedCamp || nearestCamp();
  const inRange = camp && Math.hypot(camp.x - player.x, camp.y - player.y) < 120;
  if (key === 'q' && camp && player.qCooldown <= 0) {
    player.x = camp.x - 44;
    player.y = camp.y;
    player.tx = player.x;
    player.ty = player.y;
    player.qCooldown = 4.2;
    playTone('spell');
    damageCamp(camp, physicalDamage(155, camp.armor) + physicalDamage(player.ad, camp.armor), 'perfect');
  }
  if (key === 'w' && player.wCooldown <= 0) {
    playTone('spell');
    player.wCooldown = 7;
    player.hp = Math.min(player.maxHp, player.hp + 95);
    player.attackCooldown = 0;
    setResult('perfect');
  }
  if (key === 'e') { playTone('spell'); player.eTimer = 5; player.bonusTrueDamage = 30; }
  if (key === 'd' && inRange && player.smiteCooldown <= 0) {
    playTone('spell');
    player.smiteCooldown = 15;
    damageCamp(camp, 600, 'perfect');
  }
}

window.addEventListener('keydown', (event) => {
  if (state.mode !== 'jungle') return;
  const key = event.key.toLowerCase();
  if (['q', 'w', 'e', 'd'].includes(key)) {
    event.preventDefault();
    castJungleSpell(key);
  }
});

function updateJungle(dt) {
  if (state.mode !== 'jungle') return;
  const dx = player.tx - player.x;
  const dy = player.ty - player.y;
  const dist = Math.hypot(dx, dy);
  const speed = player.eTimer > 0 ? 265 : 230;
  if (dist > 3) {
    const step = Math.min(dist, speed * dt);
    player.x += (dx / dist) * step;
    player.y += (dy / dist) * step;
  }
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.qCooldown = Math.max(0, player.qCooldown - dt);
  player.wCooldown = Math.max(0, player.wCooldown - dt);
  player.smiteCooldown = Math.max(0, player.smiteCooldown - dt);
  player.eTimer = Math.max(0, player.eTimer - dt);
  if (player.eTimer === 0) player.bonusTrueDamage = 0;

  const camp = jungle.selectedCamp || nearestCamp();
  if (camp && camp.hp > 0 && Math.hypot(camp.x - player.x, camp.y - player.y) < 86 && player.attackCooldown <= 0) {
    player.attackCooldown = player.eTimer > 0 ? 0.48 : 0.68;
    damageCamp(camp, physicalDamage(player.ad, camp.armor) + (player.eTimer > 0 ? player.bonusTrueDamage : 0), 'hit');
    player.hp = Math.max(0, player.hp - camp.damage * 0.18);
  }
  renderAbilityBar();
  jungle.camps.forEach((camp) => {
    if (camp.hp === 0 && performance.now() - camp.deadAt > camp.respawn * 1000) camp.hp = camp.maxHp;
  });
}

function resetJungle() {
  player.x = 190;
  player.y = 310;
  player.tx = 190;
  player.ty = 310;
  player.hp = player.maxHp;
  player.attackCooldown = 0;
  player.qCooldown = 0;
  player.wCooldown = 0;
  player.eTimer = 0;
  player.bonusTrueDamage = 0;
  player.smiteCooldown = 0;
  jungle.selectedCamp = null;
  jungle.camps.forEach((camp) => { camp.hp = camp.maxHp; camp.deadAt = 0; });
  renderAbilityBar();
}
