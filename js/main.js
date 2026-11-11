const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

gsap.registerPlugin(ScrollTrigger);

/* Rotating bottle: 72 decoded frames, a full background plate and a matching cut-out */

const SPIN_FRAMES = 144;
const spinFrames = [];
const spinCanvases = [...document.querySelectorAll('.js-spin')];
let spinIdle = 0;
let spinScroll = 0;
let spinScrollTarget = 0;
let drawnIndex = -1;

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
  const dpr = Math.min(window.devicePixelRatio, 1.5);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}

// draws the exact frame when it is loaded, otherwise the closest one already in
function paintSpin(canvas, index) {
  if (!canvas.width) return;
  let i = index;
  while (!spinFrames[i % SPIN_FRAMES] && i > index - SPIN_FRAMES) i--;
  const frame = spinFrames[i % SPIN_FRAMES];
  if (!frame) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
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
    waves[i - 1].classList.toggle('is-active', r > 0.001 && r < 0.999);
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
    spinScrollTarget = self.progress * SPIN_FRAMES * 10;
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
/* Chromium plays the transparent WebM: one file, decoded by the video hardware.
   Other browsers fall back to the frame sequence on canvas. */
const spinVideos = [...document.querySelectorAll('.js-spin-video')];
const useVideo = Boolean(navigator.userAgentData) && spinVideos[0].canPlayType('video/webm; codecs="vp9"') !== '';
let lastScroll = window.scrollY;
let spinRate = 1;

if (useVideo) {
  spinVideos.forEach((video, i) => {
    video.src = 'assets/video/spin.webm';
    video.hidden = false;
    spinCanvases[i].hidden = true;
    video.addEventListener('playing', () => video.parentElement.classList.add('is-live'), { once: true });
  });
} else {
  loadSpin();
}

function playVisible() {
  const show = [sipVisible && levels[1] < 1, sipVisible && levels[STEPS] > 0];
  spinVideos.forEach((video, i) => {
    if (show[i] && video.paused) video.play().catch(() => {});
    if (!show[i] && !video.paused) video.pause();
  });
}

gsap.ticker.add((time, deltaTime) => {
  if (useVideo) {
    const speed = Math.abs(window.scrollY - lastScroll) / Math.max(deltaTime, 1);
    lastScroll = window.scrollY;
    spinRate += (Math.min(4, 1 + speed * 1.5) - spinRate) * 0.1;
    spinVideos.forEach((video) => { if (!video.paused && Math.abs(video.playbackRate - spinRate) > 0.05) video.playbackRate = spinRate; });
    playVisible();
  }
  if (!sipVisible) return;
  const dt = deltaTime / 1000;
  const ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
  progress += (progressTarget - progress) * ease;
  spinScroll += (spinScrollTarget - spinScroll) * ease;
  if (!reducedMotion) spinIdle = (spinIdle + dt * (SPIN_FRAMES / 4)) % SPIN_FRAMES;
  pour();

  if (useVideo) return;
  const index = Math.floor(spinIdle + spinScroll) % SPIN_FRAMES + SPIN_FRAMES;
  if (index === drawnIndex) return;
  drawnIndex = index;
  if (levels[1] < 1) paintSpin(spinCanvases[0], index);
  if (levels[STEPS] > 0) paintSpin(spinCanvases[1], index);
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

/* Phone menu and newsletter */

const menu = document.getElementById('menu');
const menuToggle = document.querySelector('.js-menu-toggle');

function setMenu(open) {
  menu.hidden = !open;
  menuToggle.setAttribute('aria-expanded', open);
  menuToggle.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
  document.documentElement.classList.toggle('menu-open', open);
}

menuToggle.addEventListener('click', () => setMenu(menu.hidden));
menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

document.querySelector('.js-newsletter').addEventListener('submit', (e) => {
  e.preventDefault();
  e.target.querySelector('.newsletter__row').hidden = true;
  e.target.querySelector('.newsletter__done').hidden = false;
});

function resize() {
  spinCanvases.forEach(sizeCanvas);
  levels.fill(-1);
  drawnIndex = -1;
  pour();
}

const fontsReady = Promise.race([
  Promise.all([document.fonts.load('900 1em Anybody'), document.fonts.load('400 1em "Schibsted Grotesk"')]),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]);

choose(selected);
resize();
window.addEventListener('resize', resize);
fontsReady.then(() => ScrollTrigger.refresh());
