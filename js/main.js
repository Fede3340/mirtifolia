const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.innerWidth <= 760;

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis({ anchors: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

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

/* Rotating bottle: 72 frames, idle spin plus scroll */

const SPIN_FRAMES = 72;
const spinFrames = [];
const spinCanvases = [...document.querySelectorAll('.spin__canvas')];
let spinIdle = 0;
let spinScroll = 0;

for (let i = 0; i < SPIN_FRAMES; i++) {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => { spinFrames[i] = img; };
  img.src = `assets/seq/spin/${String(i).padStart(3, '0')}.webp`;
}

function sizeSpin() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  spinCanvases.forEach((canvas) => {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  });
}

function drawSpin() {
  const index = Math.floor(spinIdle + spinScroll) % SPIN_FRAMES;
  const img = spinFrames[index];
  if (!img) return;
  spinCanvases.forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  });
}

/* The sip: each taste rises over the last one like soda filling a glass */

const sip = document.querySelector('.sip');
const layers = [...document.querySelectorAll('.layer')];
const foams = [...document.querySelectorAll('.foam')];
const header = document.querySelector('.header');
const inkSections = [...document.querySelectorAll('[data-ink]:not(.layer)')];
const STEPS = 4;
const START = 0.12;
const LENGTH = 0.15;
const GAP = 0.2;
let progress = 0;

const smoothstep = (x) => x * x * (3 - 2 * x);
const level = (i) => smoothstep(gsap.utils.clamp(0, 1, (progress - START - (i - 1) * GAP) / LENGTH));

function wave(r, t, lift) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const amp = Math.sin(Math.PI * r) * Math.min(26, h * 0.03);
  const base = h * (1 - r) - lift;
  const points = [];
  for (let k = 0; k <= 24; k++) {
    const x = (w * k) / 24;
    const y = base + amp * Math.sin((x / w) * 7.5 + t * 2.1) + amp * 0.45 * Math.sin((x / w) * 15 - t * 3.3);
    points.push(`${x.toFixed(1)}px ${y.toFixed(1)}px`);
  }
  return points;
}

function pour(t) {
  let active = 0;
  for (let i = 1; i <= STEPS; i++) {
    const r = level(i);
    const layer = layers[i];
    const foam = foams[i - 1];
    if (r <= 0) {
      layer.style.clipPath = foam.style.clipPath = 'inset(100% 0 0 0)';
      continue;
    }
    if (r >= 1) {
      layer.style.clipPath = 'none';
      foam.style.clipPath = 'inset(100% 0 0 0)';
      active = i;
      continue;
    }
    if (r > 0.5) active = i;
    const edge = wave(r, t, 0);
    const top = wave(r, t, 12);
    layer.style.clipPath = `polygon(0px ${window.innerHeight}px, ${edge.join(',')}, ${window.innerWidth}px ${window.innerHeight}px)`;
    foam.style.clipPath = `polygon(${top.join(',')}, ${edge.reverse().join(',')})`;
  }

  let ink = layers[active].dataset.ink;
  inkSections.forEach((section) => {
    const box = section.getBoundingClientRect();
    if (box.top <= 40 && box.bottom > 40) ink = section.dataset.ink;
  });
  header.style.setProperty('--header-ink', ink);
}

ScrollTrigger.create({
  trigger: sip,
  start: 'top top',
  end: 'bottom bottom',
  onUpdate: (self) => {
    progress = self.progress;
    spinScroll = self.progress * SPIN_FRAMES * 2;
  },
});

gsap.ticker.add((time, deltaTime) => {
  if (!reducedMotion) spinIdle = (spinIdle + (deltaTime / 1000) * (SPIN_FRAMES / 9)) % SPIN_FRAMES;
  drawSpin();
  pour(time);
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

choose(selected);
fitType();
sizeSpin();
document.fonts.ready.then(() => { fitType(); ScrollTrigger.refresh(); });
window.addEventListener('resize', () => { fitType(); sizeSpin(); });
