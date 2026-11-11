const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.innerWidth <= 760;

gsap.registerPlugin(ScrollTrigger);

/* Big type fills its box without wrapping */

function textWidth(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width;
}

function fitType() {
  const pad = parseFloat(getComputedStyle(document.querySelector('.wordmark')).left);
  const width = window.innerWidth - pad * 2;

  const wordmark = document.querySelector('.js-wordmark');
  wordmark.style.fontSize = '100px';
  wordmark.style.fontSize = `${Math.min((100 * width) / textWidth(wordmark), 420)}px`;

  const fruitTitle = document.querySelector('.js-fruit-title');
  fruitTitle.style.fontSize = '100px';
  fruitTitle.style.fontSize = `${(100 * width * (isMobile() ? 1 : 0.74)) / textWidth(fruitTitle.firstElementChild)}px`;

  // every state shares one size, set by the longest word
  const states = [...document.querySelectorAll('.js-state')];
  states.forEach((el) => { el.style.fontSize = '100px'; });
  const room = isMobile() ? width : window.innerWidth * 0.74;
  const size = Math.min(isMobile() ? 120 : 210, ...states.map((el) => (100 * room) / textWidth(el)));
  states.forEach((el) => {
    el.style.fontSize = `${size}px`;
    el.closest('.layer').style.setProperty('--words-height', `${el.parentElement.offsetHeight + 24}px`);
  });
}

/* Rotating bottle: 72 decoded frames, a full background plate and a matching cut-out */

const SPIN_FRAMES = 72;
const plates = [];
const cutouts = [];
const plateCanvases = [...document.querySelectorAll('.js-spin')];
const cutCanvas = document.querySelector('.js-spin-cut');
let spinIdle = 0;
let spinScroll = 0;
let drawnIndex = -1;

async function loadFrames(folder, store) {
  for (let i = 0; i < SPIN_FRAMES; i++) {
    const img = new Image();
    img.src = `assets/seq/${folder}/${String(i).padStart(3, '0')}.webp`;
    await img.decode();
    store[i] = await createImageBitmap(img);
    if (i === 0) drawnIndex = -1;
  }
}

function sizeCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio, 1.5);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}

function paint(canvas, frame) {
  if (!frame || !canvas.width) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
}

/* The sip: each taste rises over the last one like soda filling a glass */

const sip = document.querySelector('.sip');
const stage = document.querySelector('.sip__stage');
const layers = [...document.querySelectorAll('.layer')];
const inners = layers.map((layer) => layer.querySelector('.layer__inner'));
const waves = [...document.querySelectorAll('.wave')];
const header = document.querySelector('.header');
const STEPS = 4;
const START = 0.12;
const LENGTH = 0.15;
const GAP = 0.2;
const levels = new Array(STEPS + 1).fill(-1);
let progress = 0;
let headerOverride = null;

const smoothstep = (x) => x * x * (3 - 2 * x);
const level = (i) => smoothstep(gsap.utils.clamp(0, 1, (progress - START - (i - 1) * GAP) / LENGTH));

function pour() {
  const height = stage.clientHeight;
  let active = 0;
  for (let i = 1; i <= STEPS; i++) {
    const r = level(i);
    if (r > 0.5) active = i;
    if (r === levels[i]) continue;
    levels[i] = r;
    const y = (1 - r) * height;
    layers[i].style.transform = `translate3d(0, ${y}px, 0)`;
    inners[i].style.transform = `translate3d(0, ${-y}px, 0)`;
    waves[i - 1].style.transform = `translate3d(0, ${y - 24}px, 0)`;
    waves[i - 1].style.visibility = r > 0 && r < 1 ? 'visible' : 'hidden';
  }
  header.style.setProperty('--header-ink', headerOverride || layers[active].dataset.ink);
}

function spin() {
  const index = Math.floor(spinIdle + spinScroll) % SPIN_FRAMES;
  if (index === drawnIndex) return;
  drawnIndex = index;
  if (levels[1] < 1) {
    paint(plateCanvases[0], plates[index]);
    paint(cutCanvas, cutouts[index]);
  }
  if (levels[STEPS] > 0) paint(plateCanvases[1], plates[index]);
}

ScrollTrigger.create({
  trigger: sip,
  start: 'top top',
  end: 'bottom bottom',
  onUpdate: (self) => {
    progress = self.progress;
    spinScroll = self.progress * SPIN_FRAMES * 2;
    pour();
  },
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

gsap.ticker.add((time, deltaTime) => {
  if (!reducedMotion) spinIdle = (spinIdle + (deltaTime / 1000) * (SPIN_FRAMES / 9)) % SPIN_FRAMES;
  spin();
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
  fitType();
  [...plateCanvases, cutCanvas].forEach(sizeCanvas);
  levels.fill(-1);
  drawnIndex = -1;
  pour();
}

choose(selected);
resize();
window.addEventListener('resize', resize);
document.fonts.ready.then(() => { resize(); ScrollTrigger.refresh(); });
loadFrames('spin-bg', plates);
loadFrames('spin', cutouts);
