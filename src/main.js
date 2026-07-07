import * as THREE from 'https://esm.sh/three@0.160.0';

const RIOT_ASSET_BASE = 'https://ddragon.leagueoflegends.com/cdn/15.24.1/img';
const CDRAGON_CHARACTER_BASE = 'https://raw.communitydragon.org/latest/game/assets/characters';
const ASSETS = {
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

const CAMP_DATA = [
  { id: 'blue', name: 'Blue Sentinel', position: [13, 0, -8], maxHp: 2300, damage: 66, armor: 42, respawn: 300, units: 1, color: 0x4aa3ff, radius: 1.35 },
  { id: 'gromp', name: 'Gromp', position: [18, 0, -1], maxHp: 2050, damage: 70, armor: 20, respawn: 135, units: 1, color: 0x34d399, radius: 1.2 },
  { id: 'wolves', name: 'Murk Wolves', position: [9, 0, 4], maxHp: 1650, damage: 42, armor: 20, respawn: 135, units: 3, color: 0x94a3b8, radius: 0.92 },
  { id: 'raptors', name: 'Raptors', position: [-4, 0, 1], maxHp: 1400, damage: 38, armor: 20, respawn: 135, units: 6, color: 0xf97316, radius: 0.78 },
  { id: 'red', name: 'Red Brambleback', position: [-11, 0, 9], maxHp: 2300, damage: 66, armor: 42, respawn: 300, units: 1, color: 0xef4444, radius: 1.35 },
  { id: 'krugs', name: 'Krugs', position: [-18, 0, -4], maxHp: 1900, damage: 55, armor: 20, respawn: 135, units: 2, color: 0xa16207, radius: 1.05 },
];

const SPELLS = [
  { key: 'Q', id: 'q', name: 'Alpha Strike', cooldown: 4.2, cast: castQ },
  { key: 'W', id: 'w', name: 'Meditate Reset', cooldown: 7, cast: castW },
  { key: 'E', id: 'e', name: 'Wuju Style', cooldown: 8, cast: castE },
  { key: 'D', id: 'smite', name: 'Smite', cooldown: 15, cast: castSmite },
];

const el = (id) => document.getElementById(id);
const viewport = el('game');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111f);
scene.fog = new THREE.Fog(0x07111f, 30, 78);

const camera = new THREE.OrthographicCamera(-18, 18, 10, -10, 0.1, 200);
camera.position.set(18, 20, 18);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.append(renderer.domElement);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textures = Object.fromEntries(Object.entries(ASSETS).map(([key, src]) => [key, textureLoader.load(src)]));

const state = {
  startedAt: performance.now(), totalDamage: 0, selectedCamp: null, attackMove: false, cleared: 0,
  player: { hp: 760, maxHp: 760, ad: 65, x: 0, z: 0, targetX: 0, targetZ: 0, attackTimer: 0, attackSpeed: 0.68, eActive: 0 },
  cooldowns: { Q: 0, W: 0, E: 0, D: 0 },
};

const audio = { ctx: null };
function tone(kind = 'hit') {
  audio.ctx ||= new AudioContext();
  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = kind === 'spell' ? 'sawtooth' : 'triangle';
  osc.frequency.value = kind === 'crit' ? 520 : kind === 'spell' ? 760 : 240;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  osc.connect(gain).connect(audio.ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

function createWorld() {
  scene.add(new THREE.HemisphereLight(0xbfe7ff, 0x0b2f1f, 2.2));
  const sun = new THREE.DirectionalLight(0xfff4d6, 2.6);
  sun.position.set(-16, 28, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 34, 18, 12),
    new THREE.MeshStandardMaterial({ color: 0x1f5f3b, roughness: 0.95, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  const river = new THREE.Mesh(new THREE.PlaneGeometry(56, 5), new THREE.MeshStandardMaterial({ color: 0x1d4f69, roughness: 0.6 }));
  river.rotation.x = -Math.PI / 2;
  river.rotation.z = -0.38;
  river.position.y = 0.012;
  scene.add(river);

  for (let i = 0; i < 46; i += 1) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.9, 7), new THREE.MeshStandardMaterial({ color: 0x4b2d17 }));
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.72 + Math.random() * 0.35, 1.8 + Math.random(), 8), new THREE.MeshStandardMaterial({ color: [0x0f4d2d, 0x166534, 0x14532d][i % 3] }));
    leaves.position.y = 1.18;
    trunk.castShadow = leaves.castShadow = true;
    tree.add(trunk, leaves);
    const side = i % 4;
    tree.position.set(side < 2 ? -24 + Math.random() * 48 : (side === 2 ? -25 : 25), 0.45, side < 2 ? (side === 0 ? -15 : 15) : -15 + Math.random() * 30);
    scene.add(tree);
  }
}

function makeSprite(texture, scale = 2.2) {
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  sprite.position.y = scale * 0.56;
  return sprite;
}

function createChampion() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.15, 6, 12), new THREE.MeshStandardMaterial({ color: 0xf6d365, roughness: 0.42, metalness: 0.25 }));
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.8), new THREE.MeshStandardMaterial({ color: 0x9ef7ff, emissive: 0x16677a, emissiveIntensity: 0.6 }));
  blade.position.set(0.72, 0.9, 0.18);
  blade.rotation.z = -0.7;
  body.castShadow = blade.castShadow = true;
  group.add(body, blade, makeSprite(textures.yi, 1.45));
  group.position.set(0, 0.8, 0);
  scene.add(group);
  return group;
}

function createCamp(data) {
  const group = new THREE.Group();
  const offsets = data.units === 1 ? [[0, 0, data.radius]] : Array.from({ length: data.units }, (_, i) => {
    const a = (i / data.units) * Math.PI * 2;
    return [Math.cos(a) * 1.15, Math.sin(a) * 0.92, i === 0 ? data.radius : data.radius * 0.72];
  });
  offsets.forEach(([x, z, radius]) => {
    const monster = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius * 0.52, radius * 0.95, 6, 12),
      new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.58, metalness: 0.08 })
    );
    monster.position.set(x, radius * 0.72, z);
    monster.castShadow = true;
    const sprite = makeSprite(textures[data.id], radius * 1.6);
    sprite.position.set(x, radius * 1.55, z + 0.06);
    group.add(monster, sprite);
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(data.radius * 1.05, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0 }));
  ring.rotation.x = Math.PI / 2;
  ring.name = 'selectionRing';
  group.add(ring);
  group.position.set(...data.position);
  group.userData.camp = { ...data, hp: data.maxHp, clearedAt: 0, group, ring };
  scene.add(group);
  return group.userData.camp;
}

createWorld();
const champion = createChampion();
const camps = CAMP_DATA.map(createCamp);
const ground = scene.getObjectByName('ground');

function resize() {
  const rect = viewport.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  const aspect = rect.width / rect.height;
  camera.left = -16 * aspect;
  camera.right = 16 * aspect;
  camera.top = 16;
  camera.bottom = -16;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function screenPick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(scene.children, true);
}

viewport.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const hit = screenPick(event).find((item) => item.object === ground);
  if (!hit) return;
  moveTo(hit.point.x, hit.point.z);
});

viewport.addEventListener('pointerdown', (event) => {
  const hits = screenPick(event);
  const campHit = hits.map((hit) => findCampFromObject(hit.object)).find(Boolean);
  if (campHit) {
    state.selectedCamp = campHit;
    moveTo(campHit.group.position.x - 2.15, campHit.group.position.z);
    log(`Targeting ${campHit.name}`);
  } else if (state.attackMove) {
    const groundHit = hits.find((hit) => hit.object === ground);
    if (groundHit) {
      state.selectedCamp = nearestCamp(groundHit.point.x, groundHit.point.z);
      moveTo(groundHit.point.x, groundHit.point.z);
    }
  }
  state.attackMove = false;
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toUpperCase();
  if (key === 'A') {
    state.attackMove = true;
    log('Attack-move primed');
    return;
  }
  const spell = SPELLS.find((item) => item.key === key);
  if (spell) {
    event.preventDefault();
    if (state.cooldowns[key] <= 0) spell.cast();
  }
});

function findCampFromObject(object) {
  let current = object;
  while (current) {
    if (current.userData?.camp) return current.userData.camp;
    current = current.parent;
  }
  return null;
}

function moveTo(x, z) {
  state.player.targetX = THREE.MathUtils.clamp(x, -23, 23);
  state.player.targetZ = THREE.MathUtils.clamp(z, -15, 15);
}

function nearestCamp(x = state.player.x, z = state.player.z) {
  return camps.filter((camp) => camp.hp > 0).sort((a, b) => distance2(a, x, z) - distance2(b, x, z))[0] || null;
}

function distance2(camp, x, z) {
  return (camp.group.position.x - x) ** 2 + (camp.group.position.z - z) ** 2;
}

function physicalDamage(raw, armor) {
  return Math.round(raw * (100 / (100 + Math.max(0, armor))));
}

function damageCamp(camp, amount, source = 'Hit') {
  if (!camp || camp.hp <= 0) return;
  camp.hp = Math.max(0, camp.hp - amount);
  state.totalDamage += amount;
  tone(source === 'Smite' || source === 'Alpha Strike' ? 'spell' : 'hit');
  log(`${source}: ${amount} to ${camp.name}`);
  if (camp.hp === 0) {
    camp.clearedAt = performance.now();
    state.cleared += 1;
    camp.group.visible = false;
    log(`${camp.name} cleared`);
    state.selectedCamp = nearestCamp();
  }
}

function castQ() {
  const camp = state.selectedCamp || nearestCamp();
  if (!camp) return;
  champion.position.set(camp.group.position.x - 1.2, 0.8, camp.group.position.z);
  state.player.x = champion.position.x;
  state.player.z = champion.position.z;
  state.player.targetX = state.player.x;
  state.player.targetZ = state.player.z;
  state.cooldowns.Q = 4.2;
  damageCamp(camp, physicalDamage(155 + state.player.ad, camp.armor), 'Alpha Strike');
}

function castW() {
  state.cooldowns.W = 7;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 95);
  state.player.attackTimer = 0;
  tone('spell');
  log('Meditate reset: attack timer refreshed');
}

function castE() {
  state.cooldowns.E = 8;
  state.player.eActive = 5;
  tone('spell');
  log('Wuju Style active: autos deal bonus true damage');
}

function castSmite() {
  const camp = state.selectedCamp || nearestCamp();
  if (!camp || distance2(camp, state.player.x, state.player.z) > 18) return;
  state.cooldowns.D = 15;
  damageCamp(camp, 600, 'Smite');
}

function update(dt) {
  Object.keys(state.cooldowns).forEach((key) => { state.cooldowns[key] = Math.max(0, state.cooldowns[key] - dt); });
  state.player.eActive = Math.max(0, state.player.eActive - dt);
  state.player.attackTimer = Math.max(0, state.player.attackTimer - dt);

  const dx = state.player.targetX - state.player.x;
  const dz = state.player.targetZ - state.player.z;
  const distance = Math.hypot(dx, dz);
  const speed = state.player.eActive > 0 ? 7.1 : 6.2;
  if (distance > 0.05) {
    const step = Math.min(distance, speed * dt);
    state.player.x += (dx / distance) * step;
    state.player.z += (dz / distance) * step;
  }
  champion.position.x = state.player.x;
  champion.position.z = state.player.z;
  champion.rotation.y = Math.atan2(dx, dz);

  const camp = state.selectedCamp || nearestCamp();
  if (camp && camp.hp > 0 && distance2(camp, state.player.x, state.player.z) < 7.5 && state.player.attackTimer <= 0) {
    state.player.attackTimer = state.player.eActive > 0 ? 0.48 : 0.68;
    const damage = physicalDamage(state.player.ad, camp.armor) + (state.player.eActive > 0 ? 30 : 0);
    damageCamp(camp, damage, state.player.eActive > 0 ? 'Wuju auto' : 'Auto');
    state.player.hp = Math.max(0, state.player.hp - camp.damage * 0.18);
  }

  camps.forEach((camp) => {
    camp.ring.material.opacity = state.selectedCamp === camp && camp.hp > 0 ? 0.95 : 0;
    if (camp.hp === 0 && performance.now() - camp.clearedAt > camp.respawn * 1000) {
      camp.hp = camp.maxHp;
      camp.group.visible = true;
      state.cleared = Math.max(0, state.cleared - 1);
    }
  });
}

function renderHud() {
  const elapsed = Math.floor((performance.now() - state.startedAt) / 1000);
  el('clearTime').textContent = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  el('campScore').textContent = `${state.cleared} / ${camps.length}`;
  el('dpsText').textContent = Math.round(state.totalDamage / Math.max(1, elapsed));
  const target = state.selectedCamp;
  el('targetCard').innerHTML = target && target.hp > 0
    ? `<span>${target.name}</span><strong>${Math.ceil(target.hp)} / ${target.maxHp} HP</strong><div class="target-health"><i style="width:${(target.hp / target.maxHp) * 100}%"></i></div>`
    : '<span>No target</span><strong>Click a jungle camp</strong><div class="target-health"><i style="width:0%"></i></div>';
  el('abilityBar').innerHTML = SPELLS.map((spell) => {
    const cd = state.cooldowns[spell.key];
    const active = spell.key === 'E' && state.player.eActive > 0;
    const pct = THREE.MathUtils.clamp(cd / spell.cooldown, 0, 1);
    return `<div class="ability ${cd > 0 ? 'cooling' : ''} ${active ? 'active' : ''}">
      <img src="${ASSETS[spell.id]}" alt="${spell.name}" />
      <b>${spell.key}</b><span>${spell.name}</span>
      <em style="--cooldown:${pct}">${cd > 0 ? cd.toFixed(1) : active ? 'ON' : 'Ready'}</em>
    </div>`;
  }).join('');
  el('minimap').innerHTML = camps.map((camp) => `<i class="${camp.hp <= 0 ? 'dead' : ''}" style="left:${((camp.group.position.x + 24) / 48) * 100}%;top:${((camp.group.position.z + 16) / 32) * 100}%"></i>`).join('') + `<b style="left:${((state.player.x + 24) / 48) * 100}%;top:${((state.player.z + 16) / 32) * 100}%"></b>`;
}

function log(message) {
  const item = document.createElement('p');
  item.textContent = message;
  el('combatLog').prepend(item);
  while (el('combatLog').children.length > 5) el('combatLog').lastElementChild.remove();
}

function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  update(dt);
  renderHud();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

log('Load in. Right click to path toward your first camp. W is the reset.');
animate();
