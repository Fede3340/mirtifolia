const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

gsap.registerPlugin(ScrollTrigger);

/* Rotating bottle: 72 decoded frames, a full background plate and a matching cut-out */

const SPIN_FRAMES = 144;
const spinFrames = [];
const spinCanvases = [...document.querySelectorAll('.js-spin')];
let spinIdle = 0;
let spinScroll = 0;
let spinScrollTarget = 0;
let drawnPosition = -1;

// coarse frames first, so the bottle turns as soon as a few are in
function loadOrder(count) {
  const order = [];
  for (const step of [16, 8, 4, 2, 1]) {
    for (let i = 0; i < count; i += step) if (!order.includes(i)) order.push(i);
  }
  return order;
}

function loadSpin() {
  loadOrder(SPIN_FRAMES).forEach((i) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = `assets/seq/spin/${String(i).padStart(3, '0')}.webp`;
    img.decode().then(() => { spinFrames[i] = img; }, () => {});
  });
}

function sizeCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}

// blends the two nearest loaded frames, so the turn stays smooth at any speed
function paintSpin(canvas, position) {
  if (!canvas.width) return;
  let before = Math.floor(position);
  let after = before + 1;
  while (!spinFrames[before % SPIN_FRAMES] && before > position - SPIN_FRAMES) before--;
  while (!spinFrames[after % SPIN_FRAMES] && after < position + SPIN_FRAMES) after++;
  const frame = spinFrames[before % SPIN_FRAMES];
  const next = spinFrames[after % SPIN_FRAMES];
  if (!frame || !next) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = (position - before) / (after - before);
  ctx.drawImage(next, 0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  canvas.parentElement.classList.add('is-live');
}

/* The sip: each taste rises over the last one like soda filling a glass */

const sip = document.querySelector('.sip');
const stage = document.querySelector('.sip__stage');
const layers = [...document.querySelectorAll('.layer')];
const inners = layers.map((layer) => layer.querySelector('.layer__inner'));
const waves = [...document.querySelectorAll('.wave')];
const header = document.querySelector('.header');
const STEPS = 4;
const START = 0.18;
const LENGTH = 0.15;
const GAP = 0.2;
const levels = new Array(STEPS + 1).fill(-1);
let progress = 0;
let progressTarget = 0;
let sipVisible = true;
let headerOverride = null;
let headerInk = '';

const smoothstep = (x) => x * x * (3 - 2 * x);
const level = (i) => smoothstep(gsap.utils.clamp(0, 1, (progress - START - (i - 1) * GAP) / LENGTH));

function pour() {
  const height = stage.clientHeight;
  let active = 0;
  for (let i = 1; i <= STEPS; i++) {
    const r = level(i);
    if (r > 0.5) active = i;
    if (Math.abs(r - levels[i]) < 0.0005) continue;
    levels[i] = r;
    const y = (1 - r) * height;
    layers[i].style.transform = `translate3d(0, ${y}px, 0)`;
    inners[i].style.transform = `translate3d(0, ${-y}px, 0)`;
    waves[i - 1].style.transform = `translate3d(0, ${y - 24}px, 0)`;
    waves[i - 1].style.visibility = r > 0.001 && r < 0.999 ? 'visible' : 'hidden';
  }
  const ink = headerOverride || layers[active].dataset.ink;
  if (ink !== headerInk) {
    headerInk = ink;
    header.style.setProperty('--header-ink', ink);
  }
}

ScrollTrigger.create({
  trigger: sip,
  start: 'top top',
  end: 'bottom bottom',
  onUpdate: (self) => {
    progressTarget = self.progress;
    spinScrollTarget = self.progress * SPIN_FRAMES * 6;
  },
});

ScrollTrigger.create({
  trigger: sip,
  start: 'top bottom',
  end: 'bottom top',
  onToggle: (self) => { sipVisible = self.isActive; },
});

document.querySelectorAll('[data-header]').forEach((section) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top 40px',
    end: 'bottom 40px',
    onToggle: (self) => {
      headerOverride = self.isActive ? section.dataset.header : null;
      pour();
    },
  });
});

// scroll is eased so wheel steps turn into one continuous movement
gsap.ticker.add((time, deltaTime) => {
  if (!sipVisible) return;
  const dt = deltaTime / 1000;
  const ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
  progress += (progressTarget - progress) * ease;
  spinScroll += (spinScrollTarget - spinScroll) * ease;
  if (!reducedMotion) spinIdle = (spinIdle + dt * (SPIN_FRAMES / 6)) % SPIN_FRAMES;
  pour();

  const position = (spinIdle + spinScroll) % SPIN_FRAMES + SPIN_FRAMES;
  if (Math.abs(position - drawnPosition) < 0.01) return;
  drawnPosition = position;
  if (levels[1] < 1) paintSpin(spinCanvases[0], position);
  if (levels[STEPS] > 0) paintSpin(spinCanvases[1], position);
});

/* Crate: missing bottles leave empty slots */

const COLUMNS = [0.269, 0.4178, 0.5649, 0.7151];
const ROWS = [0.219, 0.3363, 0.4537, 0.5715, 0.6912];
const slots = document.querySelector('.js-slots');
ROWS.forEach((y) => COLUMNS.forEach((x) => {
  const slot = document.createElement('i');
  slot.className = 'crate__slot';
  slot.style.left = `${x * 100}%`;
  slot.style.top = `${y * 100}%`;
  slots.append(slot);
}));

const crownPath = Array.from({ length: 43 }, (_, i) => {
  const a = (i / 42) * Math.PI * 2;
  const r = i % 2 ? 53 : 58;
  return `${i ? 'L' : 'M'}${(60 + r * Math.sin(a)).toFixed(2)} ${(60 - r * Math.cos(a)).toFixed(2)}`;
}).join('') + 'Z';
document.querySelectorAll('.option path').forEach((path) => path.setAttribute('d', crownPath));

const options = [...document.querySelectorAll('.option')];
const priceEl = document.querySelector('.js-price');
const cartCount = document.querySelector('.js-cart-count');
let selected = options.find((o) => o.getAttribute('aria-checked') === 'true');
let cart = 0;

function choose(option) {
  selected = option;
  options.forEach((o) => o.setAttribute('aria-checked', o === option));
  priceEl.textContent = option.dataset.price;
  const count = Number(option.dataset.count);
  [...slots.children].forEach((slot, k) => {
    slot.style.transitionDelay = `${Math.abs(k - count) * 22}ms`;
    slot.classList.toggle('is-empty', k >= count);
  });
}

options.forEach((o) => o.addEventListener('click', () => choose(o)));

document.querySelector('.options').addEventListener('keydown', (e) => {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const next = options[(options.indexOf(selected) + step + options.length) % options.length];
  choose(next);
  next.focus();
});

document.querySelector('.js-add').addEventListener('click', () => {
  cart += Number(selected.dataset.count);
  cartCount.textContent = cart;
  gsap.fromTo(cartCount, { yPercent: -60, rotate: -20 }, { yPercent: 0, rotate: 0, duration: 0.9, ease: 'expo.out' });
});

function resize() {
  spinCanvases.forEach(sizeCanvas);
  levels.fill(-1);
  drawnPosition = -1;
  pour();
}

const fontsReady = Promise.race([
  Promise.all([document.fonts.load('900 1em Anybody'), document.fonts.load('400 1em "Schibsted Grotesk"')]),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]);

choose(selected);
resize();
loadSpin();
window.addEventListener('resize', resize);
fontsReady.then(() => ScrollTrigger.refresh());
