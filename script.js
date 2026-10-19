// slow-motion background video (falls back to gradient if no video file)
const v = document.querySelector(".hero video");
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

document.querySelectorAll(".hero .text p, .hero .text h1, nav a:not(.home)").forEach(block => {
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

// startup: wait for video + fonts (plus a short buffer), then pour the hero in.
// The water is a 1D shallow-water simulation: water wells up, rolls out to the sides,
// laps against the walls and settles as it fills. The video is hidden behind a soft,
// blurred "cover" whose edge follows the water surface.
const reveal = document.querySelector(".reveal");
if (reveal) {
  const vid = document.querySelector(".hero video");
  const videoReady = new Promise(res => {
    if (!vid || vid.readyState >= 3) return res();
    vid.addEventListener("canplaythrough", res, { once: true });
    vid.addEventListener("error", res, { once: true });
    setTimeout(res, 4000); // don't wait forever
  });
  Promise.all([videoReady, document.fonts.ready]).then(() => setTimeout(pour, 500)); // 500ms buffer

  function pour() {
    const N = 120, dx = 1 / N;
    const G = 1.6;            // gravity: lower = slower, gentler waves
    const FRICTION = 1.1;     // how quickly the sloshing calms down (per second)
    const FLOW = 0.105;       // how fast water is poured in (area per second)
    const SURGE = 0.4;        // extra swell at the very start (0 = none)
    const SIGMA = 0.1;        // how wide the water wells up from
    const BLUR = 14;          // softness of the water's edge (px)
    const OFFSET = 30;        // px of extra depth so the soft edge starts below the frame
    const h = new Float64Array(N).fill(0.0005);
    const q = new Float64Array(N);
    const hs = new Float64Array(N), tmp = new Float64Array(N);       // smoothed copy for drawing
    const Fh = new Float64Array(N + 1), Fq = new Float64Array(N + 1); // fluxes at cell edges
    const xs = Array.from({ length: N }, (_, i) => (i + 0.5) * dx);
    // pouring rate over time: a gentle swell at first, breathing slowly as it goes
    const flow = t => FLOW * (1 + SURGE * Math.exp(-t / 1.5)) * (1 + 0.15 * Math.sin(t * 2.1));

    // the soft cover that hides the video until the water reaches it
    const hero = reveal.parentElement;
    const NSV = "http://www.w3.org/2000/svg";
    const cover = document.createElementNS(NSV, "svg");
    cover.setAttribute("class", "cover");
    const defs = document.createElementNS(NSV, "defs");
    const filt = document.createElementNS(NSV, "filter");
    filt.id = "softedge"; filt.setAttribute("x", "-20%"); filt.setAttribute("y", "-20%"); filt.setAttribute("width", "140%"); filt.setAttribute("height", "140%");
    const gb = document.createElementNS(NSV, "feGaussianBlur"); gb.setAttribute("stdDeviation", BLUR);
    filt.append(gb); defs.append(filt);
    const path = document.createElementNS(NSV, "path");
    path.setAttribute("filter", "url(#softedge)");
    path.setAttribute("fill", getComputedStyle(document.body).backgroundColor);
    cover.append(defs, path);
    hero.append(cover);
    path.setAttribute("d", "M-200 -200H3000V3000H-200Z"); // covers everything to start with
    reveal.classList.add("go");

    let t = 0, tStop = null, last = null;
    const frame = now => {
      if (last === null) last = now;                       // first frame: no time has passed yet
      const frameDt = Math.min(Math.max((now - last) / 1000, 0), 0.05); // never step backwards
      last = now;
      const rect = reveal.getBoundingClientRect();
      const W = rect.width, Hpx = rect.height, tank = Hpx / W; // tank height in width-units
      const steps = Math.max(1, Math.min(14, Math.round(frameDt / 0.0015)));
      const dt = frameDt / steps;

      for (let s = 0; s < steps; s++) {
        t += dt;
        // shallow-water step (Rusanov fluxes) with reflecting walls
        for (let k = 0; k <= N; k++) {
          const L = k === 0 ? 0 : k - 1, R = k === N ? N - 1 : k;
          const hL = h[L], qL = k === 0 ? -q[0] : q[L], hR = h[R], qR = k === N ? -q[N - 1] : q[R];
          const uL = qL / Math.max(hL, 0.01), uR = qR / Math.max(hR, 0.01);
          const a = Math.max(Math.abs(uL) + Math.sqrt(G * hL), Math.abs(uR) + Math.sqrt(G * hR));
          Fh[k] = 0.5 * (qL + qR) - 0.5 * a * (hR - hL);
          Fq[k] = 0.5 * (qL * uL + 0.5 * G * hL * hL + qR * uR + 0.5 * G * hR * hR) - 0.5 * a * (qR - qL);
        }
        let vol = 0;
        const calm = Math.exp(-FRICTION * dt);
        for (let i = 0; i < N; i++) {
          h[i] = Math.max(h[i] - dt / dx * (Fh[i + 1] - Fh[i]), 1e-4);
          const maxQ = 2.5 * h[i];          // cap velocity for stability
          q[i] = calm * Math.max(-maxQ, Math.min(maxQ, q[i] - dt / dx * (Fq[i + 1] - Fq[i])));
          vol += h[i] * dx;
        }
        // the water wells up from a slowly drifting spot, so the sloshing is never symmetrical
        if (tStop === null) {
          const x0 = 0.5 + 0.1 * Math.sin(t * 1.1) + 0.04 * Math.sin(t * 1.9);
          let sum = 0; const w = xs.map(x => { const v = Math.exp(-0.5 * ((x - x0) / SIGMA) ** 2); sum += v; return v; });
          for (let i = 0; i < N; i++) h[i] += flow(t) * dt * w[i] / (sum * dx);
          if (vol >= tank + (OFFSET + 75) / W) tStop = t;  // overfill so the soft edge rises out of frame
        } else if (t - tStop > 4) {
          for (let i = 0; i < N; i++) h[i] += 0.4 * dt; // make sure it ends full
        }
      }

      // smooth the surface a little more for drawing (a few passes of a small box blur)
      hs.set(h);
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < N; i++) {
          let s = 0, c = 0;
          for (let j = -3; j <= 3; j++) { const k = i + j; if (k >= 0 && k < N) { s += hs[k]; c++; } }
          tmp[i] = s / c;
        }
        hs.set(tmp);
      }

      // the cover: everything above the water surface (soft-edged by the blur filter)
      let d = `M-200 -200H${W + 200}V${(Hpx + OFFSET - hs[N - 1] * W).toFixed(1)}`;
      let min = Infinity;
      for (let i = N - 1; i >= 0; i--) {
        d += ` L${(xs[i] * W).toFixed(1)} ${(Hpx + OFFSET - hs[i] * W).toFixed(1)}`;
        min = Math.min(min, hs[i]);
      }
      d += ` L-200 ${(Hpx + OFFSET - hs[0] * W).toFixed(1)}Z`;
      path.setAttribute("d", d);

      if (tStop !== null && min * W >= Hpx + OFFSET + 55) { // the cover is fully out of frame
        cover.remove();
        reveal.classList.add("done");
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
