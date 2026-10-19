// slow-motion background video (falls back to gradient if no video file)
const v = document.querySelector(".hero video");
if (v) {
  v.playbackRate = 0.4;
  v.addEventListener("error", () => v.remove(), true);
  v.querySelector("source")?.addEventListener("error", () => v.remove());
}

// underwater ripple: only the letter under the cursor moves, then drifts back slowly.
// Every touch is different (random pattern, direction, strength, speed).
document.getElementById("ripple")?.closest("svg").remove();
const NS = "http://www.w3.org/2000/svg";
const host = document.createElementNS(NS, "svg");
host.setAttribute("width", "0"); host.setAttribute("height", "0");
host.style.position = "absolute"; host.setAttribute("aria-hidden", "true");
document.body.append(host);

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

    const e = st.energy;
    st.turb.setAttribute("baseFrequency", `${(st.fx + Math.sin(st.t * 0.7) * 0.004).toFixed(5)} ${(st.fy + Math.cos(st.t * 0.9) * 0.01).toFixed(5)}`);
    st.disp.setAttribute("scale", (e * Math.cos(st.t * 1.6 + st.phase)).toFixed(2));
    // gentle float: sway + tiny tilt, fading with the energy
    const k = e / st.max;
    st.el.style.transform = `translate(${(Math.sin(st.t + st.phase) * st.sway * k).toFixed(2)}px, ${(Math.cos(st.t * 0.8) * st.sway * k).toFixed(2)}px) rotate(${(Math.sin(st.t * 0.6 + st.phase) * 3 * st.dir * k).toFixed(2)}deg)`;

    if (!st.hover && e < 0.03) {
      st.el.style.filter = ""; st.el.style.transform = "";
      active.delete(st);
    }
  }
  raf = active.size ? requestAnimationFrame(tick) : null;
};

let n = 0;
document.querySelectorAll(".hero .text p, .hero .text h1").forEach(block => {
  const text = block.textContent;
  block.setAttribute("aria-label", text);
  block.textContent = "";
  for (const c of text) {
    if (c === " ") { block.append(" "); continue; }
    const el = document.createElement("span");
    el.className = "ch"; el.textContent = c; el.setAttribute("aria-hidden", "true");
    block.append(el);

    const id = "rip" + n++;
    const f = document.createElementNS(NS, "filter");
    f.id = id;
    for (const [k, v] of Object.entries({ x: "-30%", y: "-30%", width: "160%", height: "160%", "color-interpolation-filters": "sRGB" })) f.setAttribute(k, v);
    const turb = document.createElementNS(NS, "feTurbulence");
    turb.setAttribute("type", "turbulence"); turb.setAttribute("numOctaves", "1"); turb.setAttribute("result", "w");
    const disp = document.createElementNS(NS, "feDisplacementMap");
    disp.setAttribute("in", "SourceGraphic"); disp.setAttribute("in2", "w"); disp.setAttribute("scale", "0");
    disp.setAttribute("xChannelSelector", "R"); disp.setAttribute("yChannelSelector", "G");
    f.append(turb, disp); host.append(f);

    const st = { el, turb, disp, energy: 0, hover: false, t: 0, phase: 0, speed: 1, power: 1, dir: 1, sway: 0, max: 0, fx: 0.02, fy: 0.06 };
    el.addEventListener("mouseenter", () => {
      const size = parseFloat(getComputedStyle(el).fontSize);
      st.max = size * 0.08;                    // scales with letter size
      st.power = rand(0.7, 1.4);               // how hard this touch is
      st.speed = rand(0.7, 1.4);               // how fast it wobbles
      st.phase = rand(0, 6.28);
      st.dir = Math.random() < 0.5 ? -1 : 1;   // tilt direction
      st.sway = size * 0.04;                   // float distance
      st.fx = rand(0.012, 0.03); st.fy = rand(0.04, 0.08);
      st.turb.setAttribute("seed", Math.floor(rand(1, 9999)));
      st.hover = true;
      el.style.filter = `url(#${id})`;
      if (!active.has(st)) { st.energy = Math.max(st.energy, st.max * 0.3); st.t = rand(0, 6); active.add(st); }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    });
    el.addEventListener("mouseleave", () => { st.hover = false; });
  }
});
