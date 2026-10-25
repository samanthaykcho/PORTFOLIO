// slow-motion background video (falls back to gradient if no video file)
const v = document.querySelector(".hero video, .pvideo video");
if (v) {
  v.playbackRate = 0.4;
  v.addEventListener("error", () => v.remove(), true);
  v.querySelector("source")?.addEventListener("error", () => v.remove());
}

// underwater wobble: only the letter under the cursor moves, then drifts back slowly.
// Pure transforms (no pixel filters), so it stays smooth and crisp. Every touch is different.
document.getElementById("ripple")?.closest("svg").remove();

const DECAY = 0.992;   // per frame at 60fps: closer to 1 = takes longer to settle
const rand = (a, b) => a + Math.random() * (b - a);

const active = new Set();
let raf = null, last = 0;
const tick = (now) => {
  const dt = Math.min((now - last) / 16.67 || 1, 4);
  last = now;
  for (const st of active) {
    st.t += 0.035 * st.speed * dt;
    if (st.hover) st.energy += (st.max * st.power - st.energy) * 0.08 * dt;
    else st.energy *= Math.pow(DECAY, dt);

    const e = st.energy, k = e / st.max, a = st.t * 1.6 + st.phase;
    const dx = Math.sin(a * 0.7 + st.phase) * e * 0.5 + Math.sin(st.t + st.phase) * st.sway * k;
    const dy = Math.sin(a) * e * 0.9 + Math.cos(st.t * 0.8) * st.sway * k;
    const rot = Math.sin(st.t * 0.6 + st.phase) * 3 * st.dir * k;
    const skew = Math.sin(a * 1.3) * e * 0.8;
    const sc = 1 + Math.sin(a * 0.9 + 1) * 0.03 * k;
    st.el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) skewX(${skew.toFixed(2)}deg) scale(${sc.toFixed(3)})`;

    if (!st.hover && e < 0.03) {
      st.el.style.transform = "";
      active.delete(st);
    }
  }
  raf = active.size ? requestAnimationFrame(tick) : null;
};

document.querySelectorAll(".hero .text p, .hero .text h1, .ptitle, nav a:not(.home)").forEach(block => {
  const text = block.textContent;
  block.setAttribute("aria-label", text);
  block.textContent = "";
  for (const c of text) {
    if (c === " ") { block.append(" "); continue; }
    const el = document.createElement("span");
    el.className = "ch"; el.textContent = c; el.setAttribute("aria-hidden", "true");
    block.append(el);

    const st = { el, energy: 0, hover: false, t: 0, phase: 0, speed: 1, power: 1, dir: 1, sway: 0, max: 0 };
    el.addEventListener("mouseenter", () => {
      const size = parseFloat(getComputedStyle(el).fontSize);
      st.max = Math.max(size * 0.08, 1.8);     // scales with letter size (with a floor for small text)
      st.power = rand(0.7, 1.4);               // how hard this touch is
      st.speed = rand(0.7, 1.4);               // how fast it wobbles
      st.phase = rand(0, 6.28);
      st.dir = Math.random() < 0.5 ? -1 : 1;   // tilt direction
      st.sway = Math.max(size * 0.04, 0.9);    // float distance
      st.hover = true;
      if (!active.has(st)) { st.energy = Math.max(st.energy, st.max * 0.3); st.t = rand(0, 6); active.add(st); }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    });
    el.addEventListener("mouseleave", () => { st.hover = false; });
  }
});

// startup: wait for video + fonts (plus a short buffer), then fade the hero in.
const reveal = document.querySelector(".reveal, .pbanner");
if (reveal) {
  const vid = document.querySelector(".hero video, .pvideo video");
  const videoReady = new Promise(res => {
    if (!vid || vid.readyState >= 3) return res();
    vid.addEventListener("canplaythrough", res, { once: true });
    vid.addEventListener("error", res, { once: true });
    setTimeout(res, 4000); // don"t wait forever
  });
  const loader = document.documentElement.classList.contains("noloader") ? null : document.querySelector(".loader");
  const gifs = ["FISH", "RAY", "WHALE"];
  const pick = gifs[Math.floor(Math.random() * gifs.length)];
  const loaderImg = loader?.querySelector("img");
  if (loaderImg) loaderImg.src = `assets/PORTFOLIO%20ELEMENTS/${pick}.GIF`;
  const minShow = new Promise(res => setTimeout(res, loader ? 2500 : 0)); // loading screen stays at least this long
  Promise.all([videoReady, document.fonts.ready, minShow]).then(() => {
    loader?.classList.add("out");
    reveal.classList.add("go");
    if (!document.documentElement.classList.contains("noloader")) setTimeout(dropTitle, 1000); // as the fade nears its end
    fadeProjectText();
    setTimeout(() => loader?.remove(), 1000);
  });
}

// PORTFOLIO drops in letter by letter like ice cubes into water: they plunge,
// sink a little, then bob back up and float into place.
function dropTitle() {
  document.querySelectorAll('.hero h1 .ch, .ptitle .ch').forEach((el, i) => {
    const r = rand(10, 28) * (Math.random() < 0.5 ? -1 : 1), x = rand(-14, 14);
    const anim = el.animate([
      // one fast, unbroken plunge that the water slows down (no pause on the way in)
      { transform: `translate(${x}px, -170%) rotate(${r}deg)`, opacity: 0, offset: 0, easing: 'cubic-bezier(.25,.8,.4,1)' },
      { opacity: 1, offset: 0.05 },
      { transform: `translate(${x * 0.6}px, 30%) rotate(${r * 0.5}deg)`, offset: 0.2, easing: 'ease-in-out' },       // deepest point
      { transform: `translate(${-x * 0.3}px, -10%) rotate(${-r * 0.3}deg)`, offset: 0.55, easing: 'ease-in-out' },   // floats back up
      { transform: `translate(${x * 0.1}px, 3%) rotate(${r * 0.08}deg)`, offset: 0.8, easing: 'ease-in-out' },
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, offset: 1 }
    ], { duration: rand(2000, 2600), delay: i * 130 + rand(0, 160), fill: 'both' });
    anim.onfinish = () => { el.style.opacity = 1; anim.cancel(); };
  });
}

// inner pages: fade the page's elements in one by one (headings/text first, then each card)
document.querySelectorAll("main:not(.project)").forEach(main => {
  [...main.children].flatMap(el => el.classList.contains("grid") ? [...el.children] : [el])
    .forEach((el, i) => { el.style.setProperty("--i", i); el.classList.add("fade-in"); });
});

// project pages: the meta row and paragraphs fade in one by one after the banner reveals
function fadeProjectText() {
  document.querySelectorAll("main.project > :not(.pbanner):not(.ptitle)").forEach((el, i) => {
    el.style.setProperty("--i", i + 4); el.classList.add("fade-in");
  });
}

// works grid: cards pop up as they scroll into view; cards entering together (a row) pop in sequence
const cardObserver = new IntersectionObserver(entries => {
  entries.filter(e => e.isIntersecting).forEach((e, i) => {
    e.target.style.setProperty("--d", i * 150 + "ms");
    e.target.classList.add("in");
    cardObserver.unobserve(e.target);
  });
}, { threshold: 0.2 });
document.querySelectorAll(".pcard").forEach(c => cardObserver.observe(c));

// clicking the ray replays the loading screen on the home page
document.querySelector("nav a.home")?.addEventListener("click", () => {
  try { sessionStorage.setItem("replay", "1"); } catch (e) {}
});
