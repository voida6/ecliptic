/* Ecliptic: an orbital start screen. Each top-level folder is a dot orbiting a
   stippled planet. Drag to turn the system, click the planet for Today, a dot
   for that folder's page, and the date to travel to another world.
   Plain CommonJS, no build step. */
const obsidian = require("obsidian");

const VIEW_TYPE = "ecliptic-home";
const HOME = "home"; // the planet's own page (Today)


/* Worlds. Each one is four colours: a near-black ground tinted toward the
   world, an ink (an r,g,b triplet, used at opacity steps), one signal colour
   and a warning red. world() derives the rest the scene needs (bg, accent,
   accent2, tones). size scales the body; axial tilts its spin axis; atmo is
   the strength of the lit-side haze; surface picks the texture; kind marks
   the two worlds that are not planets. moons are [orbit radius in body
   radii, size, speed (negative is retrograde), start angle, inclination,
   colour]. */
function world(w) {
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mx = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const str = (a) => a.map(Math.round).join(",");
  const g = hex(w.ground), s = hex(w.signal), ink = w.ink.split(",").map(Number), soft = mx(s, ink, 0.5);
  return { ...w, bg: str(g), accent: str(s), accent2: str(soft),
    tones: [str(s), str(soft), str(mx(s, [255, 255, 255], 0.35)), str(mx(s, g, 0.45)), str(mx(ink, s, 0.3)), w.ink] };
}
const WORLDS = [
  world({ id: "earth", name: "Earth", ground: "#070a0d", ink: "227,235,238", signal: "#6cc2ae", warn: "#e0685f",
    size: 0.95, dial: 1.05, axial: 0.41, atmo: 0.95, surface: "earth",
    moons: [[1.95, 2.4, 0.18, 0.6, 0.09, "206,204,198"]] }),
  world({ id: "jupiter", name: "Jupiter", ground: "#0c0908", ink: "240,228,214", signal: "#d98a57", warn: "#e0554a",
    size: 1.45, axial: 0.05, atmo: 0.3, surface: "jupiter",
    moons: [[1.3, 1.3, 0.55, 0.4, 0.01, "232,210,130"], [1.47, 1.2, 0.4, 2.2, 0.01, "222,216,204"],
      [1.68, 1.6, 0.3, 4.0, 0.01, "172,162,150"], [1.9, 1.5, 0.2, 5.4, 0.01, "132,122,114"]] }),
  world({ id: "saturn", name: "Saturn", ground: "#0b0a09", ink: "239,232,220", signal: "#e0b872", warn: "#d9604f",
    size: 0.8, dial: 0.74, axial: 0.47, atmo: 0.3, surface: "saturn", rings: true, reach: 1.2,
    moons: [[2.85, 2.2, 0.14, 2.0, 0.03, "228,170,98"]] }),
  world({ id: "neptune", name: "Neptune", ground: "#06080e", ink: "226,232,242", signal: "#6f9fe8", warn: "#e0636b",
    size: 0.9, dial: 1.0, axial: 0.49, atmo: 0.9, surface: "neptune",
    moons: [[1.95, 1.8, -0.22, 1.0, 0.4, "222,198,192"]] }),
  world({ id: "pluto", name: "Pluto", ground: "#0a090b", ink: "236,230,226", signal: "#d6a49b", warn: "#e0584f",
    size: 0.42, dial: 0.74, axial: 0.9, atmo: 0.25, surface: "pluto",
    moons: [[2.1, 3.4, 0.12, 3.0, 0.05, "178,172,168"]] }),
  // A shadow disc with a thin bright ring, gas orbiting it, the far side of the gas lensed over the top.
  world({ id: "blackhole", name: "Black hole", ground: "#050506", ink: "229,227,236", signal: "#b98ae0", warn: "#e0617a",
    size: 0.72, dial: 0.64, axial: 0, atmo: 0, surface: "blackhole", kind: "blackhole", glow: 0.07, reach: 1.35, halo: 2.4,
    moons: [[3.5, 1.8, 0.16, 0.8, 0.1, "190,178,214"], [3.95, 1.4, -0.12, 3.4, 0.2, "150,140,176"]] }),
  // A red supergiant: it shines, so the fixed sun does not light it.
  world({ id: "betelgeuse", name: "Betelgeuse", ground: "#0d0a09", ink: "240,227,216", signal: "#d4644a", warn: "#f0506a",
    size: 1.25, axial: 0.3, atmo: 0, surface: "star", kind: "star", glow: 0.14, reach: 1.1,
    moons: [[2.5, 1.7, 0.1, 1.2, 0.08, "206,150,126"], [2.85, 1.3, -0.08, 4.2, 0.18, "170,120,104"]] }),
];

const TILT = 0.36; // resting camera tilt above the orbit plane
const HOME_CLEAR = 16; // desktop home: least gap (px) between the first moon's orbit and the world's outline
const HOME_SCALE = 1.25, HOME_WIDE = 1.04; // desktop home: size of the system vs before, and how much more of the pane's width its outer orbit may take
const DIAL_TILT = 0.5; // phone: looking further down, so the one ring reads as a dial
const DIAL_CARD = 270; // phone: height of the selected section's card
const STAGE_UP = 1.5, STAGE_GAP = 60; // phone: the dial's centre sits this many R below the date; the snap row starts this many px under the front moon
const SUN = norm([-0.85, 0.42, 0.32]); // light from the upper left, slightly in front
const K_FLY = 2.2; // how far the camera flies in when a page opens
const SWAP = 0.44; // world switch: the share of the glide at which the scene is a point
const SWITCH_S = 1.5; // world switch: seconds the glide takes
const easeOutBack = (u) => { const t = Math.max(0, Math.min(1, u)) - 1; return 1 + 1.9 * t * t * t + 0.9 * t * t; };
const smoothstep = (u) => { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); };
const DRAG = 0.0051; // radians of turn per pixel dragged
const TAU = Math.PI * 2;
const SERIF = '"Iowan Old Style","Source Serif 4","Source Serif Pro","Palatino Linotype",Georgia,serif';

// Seeded RNG so every world looks the same each time it is drawn.
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 3D value noise, enough for patches and maria on a sphere.
function hash3(a, b, c) {
  let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = (t) => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm(v, s) {
  return 0.55 * noise3(v[0] * s + 11, v[1] * s, v[2] * s) +
    0.3 * noise3(v[0] * s * 2, v[1] * s * 2 + 7, v[2] * s * 2) +
    0.15 * noise3(v[0] * s * 4, v[1] * s * 4, v[2] * s * 4 + 3);
}
const rgb = (s) => s.split(",").map(Number);
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const angle = (a, b) => { const d = (a - b) % TAU; return d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d; };

/* Surfaces, in the planet's own frame (v is a unit vector, y is the spin
   axis). Each returns [albedo, r, g, b]: albedo thins the stipple, the
   colour paints it. The section textures (bands, craters, haze, patches)
   are single-colour, in the world's ink. */
function makeSurface(world) {
  const ink = rgb(world.ink || "232,226,212");
  const mono = (f) => (v) => [f(v), ink[0], ink[1], ink[2]];
  switch (world.surface) {
    case "earth": {
      // Drawn the way Saturn is: one cool hue, bright dots on the dark, and density doing the work. Land is dense and pale, ocean is a sparse
      // teal sprinkle with a lighter shelf along the coasts, the ice caps are the brightest, and cloud is a few thin bands that thicken the dots.
      const sea = [70, 156, 168], shelf = [128, 214, 196], land = [206, 240, 200], dry = [236, 230, 186], ice = [244, 250, 252];
      return (v) => {
        const lat = Math.abs(v[1]), n = fbm(v, 1.15), rag = fbm(v, 6);
        let c, a;
        if (lat > 0.93 + 0.04 * (rag - 0.5) * 2) { c = ice; a = 1; }
        else if (n > 0.5) { c = mixc(land, dry, clamp((0.4 - Math.abs(lat - 0.32)) * 2.2, 0, 0.8)); a = 0.92 + 0.08 * clamp((n - 0.5) / 0.1, 0, 1); }
        else {
          const sh = clamp((n - 0.45) / 0.05, 0, 1);
          c = mixc(sea, shelf, sh); a = 0.26 + 0.14 * clamp((n - 0.3) / 0.14, 0, 1) + 0.34 * sh;
        }
        const cl = fbm([v[0] * 0.9 + 5, v[1] * 5.2, v[2] * 0.9], 2.1);
        if (cl > 0.6) { const k = clamp((cl - 0.6) / 0.07, 0, 1) * 0.85; c = mixc(c, ice, k); a += (1 - a) * k * 0.8; }
        return [a, c[0], c[1], c[2]];
      };
    }
    case "jupiter": case "saturn": {
      const jup = world.surface === "jupiter";
      const cols = jup
        ? [[242, 232, 212], [176, 116, 72], [236, 220, 188], [138, 82, 56], [244, 230, 204], [164, 108, 70], [226, 204, 164]]
        : [[238, 224, 188], [222, 200, 150], [232, 214, 172], [206, 180, 128], [236, 220, 180]];
      const turb = jup ? 0.07 : 0.025, freq = jup ? 5.2 : 3.4;
      const at = (i) => cols[((i % cols.length) + cols.length) % cols.length];
      return (v) => {
        const y = v[1] + turb * (fbm(v, 3.4) - 0.5) * 2;
        const b = (y + 1) * freq, i = Math.floor(b), t = b - i;
        let c = mixc(at(i), at(i + 1), t * t * (3 - 2 * t));
        const lon = Math.atan2(v[2], v[0]);
        if (jup) {
          // The Great Red Spot, south of the equator.
          const e = (angle(lon, 1.1) / 0.3) ** 2 + ((v[1] + 0.36) / 0.1) ** 2;
          if (e < 1) c = mixc(c, [198, 90, 62], (1 - e) * 0.95);
        } else if (v[1] > 0.84) c = mixc(c, [196, 168, 118], clamp((v[1] - 0.8) / 0.12, 0, 0.7)); // the pole: a deeper gold, no blue
        const lum = (c[0] + c[1] + c[2]) / 765; // belts thin the stipple so the bands read
        return [jup ? 0.3 + 0.75 * lum : 0.8 + 0.2 * (c[0] / 255), c[0], c[1], c[2]];
      };
    }
    case "neptune": {
      const base = [52, 92, 204], light = [96, 146, 236], spot = [26, 42, 124], streak = [232, 240, 255];
      return (v) => {
        let c = mixc(base, light, 0.5 + 0.5 * Math.sin(v[1] * 9 + fbm(v, 2) * 2));
        const lon = Math.atan2(v[2], v[0]);
        const e = (angle(lon, 2.0) / 0.34) ** 2 + ((v[1] + 0.32) / 0.12) ** 2;
        if (e < 1) c = mixc(c, spot, (1 - e) * 0.9);
        // Thin white cloud streaks, stretched along the latitude lines.
        const s = noise3(Math.cos(lon) * 2, v[1] * 26, Math.sin(lon) * 2);
        if (s > 0.74) c = mixc(c, streak, clamp((s - 0.74) / 0.1, 0, 1));
        return [0.72, c[0], c[1], c[2]];
      };
    }
    case "pluto": {
      const tan = [214, 184, 154], dark = [118, 62, 50], heart = [246, 238, 228], cap = [168, 122, 108];
      return (v) => {
        const lon = Math.atan2(v[2], v[0]), n = fbm(v, 2.6);
        let c = mixc(tan, [196, 156, 128], n), a = 0.78;
        // The dark equatorial belt, and the bright heart beside it.
        if (Math.abs(v[1]) < 0.32 && angle(lon, -0.9) ** 2 < 0.55 && n > 0.38) { c = mixc(c, dark, 0.85); a = 0.5; }
        const h1 = (angle(lon, 0.45) / 0.42) ** 2 + ((v[1] - 0.18) / 0.36) ** 2;
        const h2 = (angle(lon, 0.95) / 0.3) ** 2 + ((v[1] - 0.05) / 0.3) ** 2;
        if (h1 < 1 || h2 < 1) { c = mixc(c, heart, 0.9); a = 1; }
        if (v[1] > 0.78) c = mixc(c, cap, 0.6);
        return [a, c[0], c[1], c[2]];
      };
    }
    case "star": {
      // Betelgeuse: a few huge convection cells with dark lanes between them, mottled finely, deep red to hot orange.
      const seeds = [], r = rng(77);
      for (let i = 0; i < 14; i++) { const y = r() * 2 - 1, th = r() * TAU, rr = Math.sqrt(1 - y * y); seeds.push([rr * Math.cos(th), y, rr * Math.sin(th)]); }
      const dark = [128, 34, 26], mid = [224, 88, 52], hot = [255, 170, 100];
      return (v) => {
        let d1 = 9, d2 = 9, id = 0;
        for (let i = 0; i < seeds.length; i++) {
          const q = seeds[i], d = (v[0] - q[0]) ** 2 + (v[1] - q[1]) ** 2 + (v[2] - q[2]) ** 2;
          if (d < d1) { d2 = d1; d1 = d; id = i; } else if (d < d2) d2 = d;
        }
        const lane = clamp((Math.sqrt(d2) - Math.sqrt(d1)) / 0.22, 0, 1), cell = 0.35 + 0.65 * ((id * 0.618) % 1);
        const t = clamp((0.25 + 0.5 * cell) * (0.35 + 0.65 * lane) + 0.35 * (fbm(v, 5) - 0.5), 0, 1);
        const c = t < 0.5 ? mixc(dark, mid, t * 2) : mixc(mid, hot, (t - 0.5) * 2);
        return [0.45 + 0.55 * t, c[0], c[1], c[2]];
      };
    }
    case "bands":
      return mono((v) => 0.82 + 0.18 * Math.sin(v[1] * 23 + Math.sin(v[1] * 7) * 2));
    case "haze":
      return mono((v) => 0.9 + 0.07 * Math.sin(v[1] * 9) + 0.2 * Math.pow(Math.abs(v[1]), 4));
    case "patches":
      return mono((v) => 0.32 + 0.85 * clamp((fbm(v, 3.2) - 0.47) / 0.06, 0, 1));
    default: {
      // craters: dark maria from noise, then bowls with a bright rim.
      const r = rng(99), craters = [];
      for (let i = 0; i < 34; i++) {
        const y = r() * 2 - 1, th = r() * TAU, rr = Math.sqrt(1 - y * y);
        craters.push({ c: [rr * Math.cos(th), y, rr * Math.sin(th)], rad: 0.04 + Math.pow(r(), 2.4) * 0.22 });
      }
      return mono((v) => {
        let m = 0.8 + 0.9 * (fbm(v, 2.1) - 0.5);
        for (const k of craters) {
          const d = Math.acos(clamp(dot(v, k.c), -1, 1));
          if (d < k.rad * 0.8) m *= 0.3;
          else if (d < k.rad) m *= 1.9;
        }
        return m;
      });
    }
  }
}

// Saturn's rings: density and colour by radius (in planet radii), with the
// Cassini division and the Encke gap.
function ringDensity(r) {
  if (r < 1.53) return 0.16;
  if (r < 1.95) return 0.78 + 0.18 * Math.sin(r * 70);
  if (r < 2.03) return 0.03;
  if (Math.abs(r - 2.21) < 0.008) return 0.04;
  return 0.5 + 0.1 * Math.sin(r * 90);
}
function ringColour(r) {
  if (r < 1.53) return [150, 140, 126];
  if (r < 1.95) return [230, 214, 180];
  return [204, 188, 156];
}

/* Everything is night: the world's own ground is the sky. Weather (Earth
   only, opt-in, from Open-Meteo's WMO codes) is an overlay on it: clouds,
   rain, snow, fog or a storm. It never changes the ground, so the pane keeps
   matching the app. */
const WEATHER = {
  clear: { name: "Clear" },
  partly: { name: "Partly cloudy", clouds: 0.35 },
  cloud: { name: "Overcast", clouds: 0.7 },
  fog: { name: "Fog", fog: 1 },
  rain: { name: "Rain", clouds: 0.7, rain: 1 },
  snow: { name: "Snow", clouds: 0.6, snow: 1 },
  storm: { name: "Thunderstorm", clouds: 0.9, rain: 1.4, bolt: 1 },
};
function weatherKind(code) {
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "rain"; // drizzle, rain, showers
}

// Only Earth has weather; the other worlds hang in space.
const hasWeather = (world) => !!world && world.id === "earth";

// The weather to draw: a kind plus the reading it came from (or none).
function skySpec(wx) {
  return { kind: wx && WEATHER[wx.kind] ? wx.kind : "clear", wx: wx || null };
}

// What the night looks like over a world: every number the scene needs, so
// two looks can be blended while the weather changes.
function skyLook(spec, pal) {
  const w = WEATHER[spec.kind] || WEATHER.clear;
  return {
    top: pal.bg, bot: pal.bg, bg: pal.bg, ink: pal.ink, accent: pal.accent,
    sun: [255, 255, 255], L: SUN,
    stars: (1 - 0.6 * (w.clouds || 0)) * (w.fog ? 0.3 : 1),
    clouds: w.clouds || 0, rain: w.rain || 0, snow: w.snow || 0, fog: w.fog || 0, bolt: w.bolt || 0,
  };
}
const NO_WEATHER = skySpec();

function lerpLook(a, b, t) {
  const out = {};
  for (const k in b) {
    const x = a[k], y = b[k];
    if (Array.isArray(y) && Array.isArray(x)) out[k] = x.map((v, i) => v + (y[i] - v) * t);
    else if (typeof y === "number" && typeof x === "number") out[k] = x + (y - x) * t;
    else out[k] = y;
  }
  out.L = norm(out.L);
  return out;
}
const css = (c) => c.map(Math.round).join(",");

/* Scene: pure canvas renderer with no Obsidian dependency, so it can be
   exercised in a plain browser page. */
const setCursor = (cv, kind) => { cv.classList.toggle("is-grab", kind === "grab"); cv.classList.toggle("is-pointer", kind === "pointer"); cv.classList.toggle("is-grabbing", kind === "grabbing"); }; // the canvas cursor, by class
class EclipticScene {
  constructor(host, opts) {
    this.host = host;
    this.onOpenSection = opts.onOpenSection || (() => {});
    this.onOpenNote = opts.onOpenNote || (() => {});
    this.onOpenToday = opts.onOpenToday || (() => {});
    this.onWorld = opts.onWorld || (() => {});
    this.onOpenHome = opts.onOpenHome || (() => {});
    this.onNewFolder = opts.onNewFolder || (() => {});
    this.onMore = opts.onMore || (() => {});
    this.moreN = 0; // top-level folders the Home cap leaves out (a quiet "+N more" says so)
    this.moreRect = null;
    this.sections = [];
    this.today = null; // { short, long, path }; drawn as the accent moon
    this.moonPhase = 2.2;
    this.moonT = Math.asin((2.2 - Math.PI / 2) / 1.15); // Today's moon swings back and forth over the near half of its orbit
    this.hover = -1;
    this.overPlanet = false;
    this.pinned = -1; // touch: first tap pins the card, second tap opens
    this.t = 0;
    this.last = 0;
    this.raf = 0;
    this.mouse = { x: 0, y: 0, nx: 0, ny: 0 };
    this.reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Camera: drag turns the whole system (yaw) and tips it (tilt); the
    // planet also turns slowly on its own axis under a fixed sun. k zooms
    // toward `focus` when a page opens, redrawn each frame so it stays sharp.
    this.yaw = 0; this.yawVel = 0;
    this.tilt = TILT; this.spin = 0;
    this.drag = null;
    this.k = 1; this.focus = null; this.flight = null;
    this.restTilt = TILT; this.dialMode = false; this.dialTarget = null; this.dialShown = -9;

    this.worlds = opts.worlds && opts.worlds.length ? opts.worlds : WORLDS;
    this.worldIndex = Math.max(0, this.worlds.findIndex((w) => w.id === opts.world));
    this.fade = 1; // 0..1 crossfade from the previous world
    this.from = this.to = palette(this.world);
    // The sky cross-fades on its own clock, independent of world travel.
    this.sky = opts.sky || NO_WEATHER; this.skyFrom = null; this.skyFade = 1;
    this.flash = 0; this.nextFlash = 6;
    this.tasks = { done: 0, open: [] };

    host.classList.add("ecl-host");
    this.canvas = host.appendChild(document.createElement("canvas"));
    this.canvas.className = "ecl-canvas";
    this.card = document.createElement("div");
    this.card.className = "ecl-card";
    host.appendChild(this.card);
    // The empty-vault next step: a real button (keyboard reachable) positioned by draw() under the planet.
    this.emptyBtn = host.appendChild(document.createElement("button"));
    this.emptyBtn.className = "ecl-empty-open";
    this.emptyBtn.type = "button";
    this.emptyBtn.textContent = "OPEN TODAY";
    this.emptyBtn.classList.add("ecl-off");
    this.emptyBtn.addEventListener("click", () => this.onOpenHome(this.project(0, 0, 0)));
    // ...and a quieter second action: make a folder (with a first note, so it shows up as a moon straight away).
    this.emptyNew = host.appendChild(document.createElement("button"));
    this.emptyNew.className = "ecl-empty-new";
    this.emptyNew.type = "button";
    this.emptyNew.textContent = "NEW FOLDER";
    this.emptyNew.classList.add("ecl-off");
    this.emptyNew.addEventListener("click", () => this.onNewFolder());
    this.ctx = this.canvas.getContext("2d");
    // Keyboard path through the canvas: one real button per moon (Today first), visually hidden. Focus does what a hover does and draws a hairline gold ring.
    this.kbFocus = -1;
    this.kbEl = host.appendChild(document.createElement("div"));
    this.kbEl.className = "ecl-kb";
    this.kbEl.setAttribute("role", "group");
    this.kbEl.setAttribute("aria-label", "Folders");

    this.planetLayer = document.createElement("canvas");
    this.oldLayer = document.createElement("canvas");

    this._move = (e) => this.pointerMove(e);
    // Moving between the canvas and the card is not leaving.
    this._leave = (e) => {
      const to = e && e.relatedTarget;
      if (to && (to === this.canvas || this.card.contains(to))) return;
      this.overPlanet = false; this.overDate = false;
      if (this.pinned < 0) this.setHover(-1);
    };
    this._down = (e) => this.pointerDown(e);
    this._up = (e) => this.pointerUp(e);
    this.canvas.addEventListener("pointermove", this._move);
    this.canvas.addEventListener("pointerleave", this._leave);
    this.canvas.addEventListener("pointerdown", this._down);
    this.canvas.addEventListener("pointerup", this._up);
    this.canvas.addEventListener("pointercancel", this._up);
    this.canvas.addClass("is-grab");
    this.card.addEventListener("pointerleave", this._leave);
    // Phone: the selected section's card, below the dial. Tapping it opens
    // the section; tapping one of its notes opens the note.
    this.dialEl = document.createElement("div");
    this.dialEl.className = "ecl-dial";
    this.dialEl.classList.add("ecl-off");
    host.appendChild(this.dialEl);
    this.dialEl.addEventListener("click", () => { if (this.dialMode && this.k === 1 && !this.flight && !this.suppressClick) this.open(this.dialSel()); });
    // Phone: a snap row of moons, Today first. Swipe it or tap one to choose.
    this.rowEl = document.createElement("div");
    this.rowEl.className = "ecl-dial-strip";
    this.rowEl.classList.add("ecl-off");
    host.appendChild(this.rowEl);
    this.rowEl.addEventListener("scroll", () => {
      const r = this.rowEl;
      r.classList.toggle("is-past", r.scrollLeft > 2); // Today is pinned over the row once it has scrolled
      r.classList.toggle("is-end", r.scrollLeft + r.clientWidth >= r.scrollWidth - 2); // nothing more to the right: no edge fade
      // A name that is not wholly in view (cut at the right edge, or running under Today) hides; its moon may still show as a sliver that says there is more.
      const rb = r.getBoundingClientRect();
      for (let j = 1; j < r.children.length; j++) {
        const c = r.children[j], nm = c.lastElementChild;
        if (!nm || !c.classList.contains("ecl-dial-chip")) continue;
        const nb = nm.getBoundingClientRect();
        const cutR = nb.right > rb.right + 0.5;
        c.classList.toggle("is-cut", cutR || nb.left < rb.left + 72 - 0.5);
        c.classList.toggle("is-cut-r", cutR); // the moon of a chip cut at the right edge leans in so more of its disc shows: a quiet "more this way"
        // A moon sliding in under Today fades out before it reaches the Today dot, so Today needs no backing box that would show against the sky (ON7 polish).
        c.style.setProperty("--ecl-slide", String(clamp((c.getBoundingClientRect().left - rb.left - 36) / 28, 0, 1)));
      }
      // The row only scrolls; the chosen moon changes on a tap on a chip or a swipe on the card, so scrolling to look never changes the page.
    }, { passive: true });
    // Swipes that start on the card drive the dial too: sideways turns it,
    // up lifts the card and opens the section.
    this.dialEl.addEventListener("pointerdown", (e) => this.pointerDown(e, true));
    this.dialEl.addEventListener("pointermove", this._move);
    this.dialEl.addEventListener("pointerup", this._up);
    this.dialEl.addEventListener("pointercancel", this._up);

    this.applyCss();
    // A tab coming back into view resizes the host from nothing. The resize itself waits for the next frame: sizing the canvas inside the
    // observer's own callback can change the host's size again, which logs "ResizeObserver loop completed with undelivered notifications".
    this.ro = new ResizeObserver(() => {
      if (this._roRaf) return;
      this._roRaf = requestAnimationFrame(() => { this._roRaf = 0; this.resize(); this.start(); });
    });
    this.ro.observe(host);
    this._wake = () => this.start(); // the window came back (shown or focused)
    document.addEventListener("visibilitychange", this._wake);
    window.addEventListener("focus", this._wake);
    this.resize();
  }

  get world() { return this.worlds[this.worldIndex] || this.worlds[0]; }

  // Replace the rotation of worlds (the settings list). Keeps the current
  // world when it is still in the list, otherwise lands on `id` or the first.
  setWorlds(list, id) {
    const cur = this.world;
    this.worlds = list && list.length ? list : WORLDS;
    const at = this.worlds.findIndex((w) => w.id === (id || cur.id));
    this.worldIndex = Math.max(0, at);
    if (this.world === cur) return;
    this.from = this.to = palette(this.world);
    this.fade = 1;
    this.lblFit = null;
    if (!this.dialMode && this.w) this.fitGeo(); // orbits and body shrink are per world
    this.buildPlanet(); this.drawPlanet(); this.applyCss();
    this.onWorld(this.world);
    this.start();
    if (this.reduced) this.draw();
  }

  setSections(sections) {
    const prev = new Map(this.sections.map((s) => [s.folder, s.phase]));
    const r = rng(7), n = sections.length;
    // New moons start evenly round the ring (neighbouring orbits a few slots apart), never in a clump.
    let stp = Math.max(1, Math.round(n * 0.38)); while (n > 1 && gcd(stp, n) !== 1) stp++;
    this.sections = sections.map((s, i) => ({
      ...s,
      phase: prev.has(s.folder) ? prev.get(s.folder) : 0.4 + (((i * stp) % n) * TAU) / n + r() * 0.12,
    }));
    if (this.dialMode) this.dialPhases();
    else if (this.w) {
      const was = this.geo && this.geo.R, wbk = this.geo && this.geo.bk;
      this.fitGeo();
      if (was !== this.geo.R || wbk !== this.geo.bk) { for (const l of [this.planetLayer, this.oldLayer]) l._css = 0; this.buildPlanet(); this.drawPlanet(); }
    }
    this.dialShown = -9; // force the dial card to redraw (an emptied vault needs its hint)
    if (this.hover >= 0) this.renderCard();
    this.syncKb();
  }

  setToday(today) {
    this.today = today;
    if (this.hover >= 0) this.renderCard();
    this.syncKb();
  }

  // Rebuilt only when the set of moons changes, so a refresh never drops the focused button.
  syncKb() {
    const items = [];
    if (this.today) items.push({ i: this.sections.length, label: "Today" });
    this.sections.forEach((s, i) => items.push({ i, label: s.label }));
    const key = items.map((x) => x.i + ":" + x.label).join("|");
    if (key === this.kbKey) return;
    this.kbKey = key;
    this.kbEl.replaceChildren();
    for (const it of items) {
      const b = el(this.kbEl, "button", "ecl-kb-btn", "Open " + it.label);
      b.type = "button";
      b.addEventListener("focus", () => { this.kbFocus = it.i; if (!this.dialMode && this.k === 1) this.setHover(it.i); if (this.reduced) this.draw(); });
      b.addEventListener("blur", () => { if (this.kbFocus !== it.i) return; this.kbFocus = -1; if (this.pinned < 0 && !this.card.contains(document.activeElement)) this.setHover(-1); if (this.reduced) this.draw(); });
      b.addEventListener("click", () => { if (this.k === 1 && !this.flight) { this.open(it.i); } });
    }
    const w = el(this.kbEl, "button", "ecl-kb-btn", "Travel to the next world");
    w.type = "button";
    w.addEventListener("click", () => this.nextWorld());
  }

  // Dial: sections evenly round the ring, so yaw = i * step brings
  // section i to the front.
  dialPhases() { const n = this.sections.length || 1; this.sections.forEach((s, i) => (s.phase = Math.PI / 2 + (i * TAU) / n)); }
  dialStep() { return TAU / Math.max(1, this.sections.length); }
  dialIndex() { const n = this.sections.length; return n ? ((Math.round(this.yaw / this.dialStep()) % n) + n) % n : -1; }
  // The phone's choice: -1 is Today, else the section at the front of the dial.
  dialSelIndex() { return this.dialToday ? -1 : this.dialIndex(); }
  // The item index `open` wants (sections.length is the Today moon).
  dialSel() { return this.dialToday ? this.sections.length : this.dialIndex(); }
  selectDial(i, fromRow) {
    this.dialShown = -9;
    if (i < 0) { this.dialToday = true; this.todayYaw = this.yaw; }
    else { this.dialToday = false; this.dialTurnTo(i); }
    if (!fromRow) this.rowTo(i);
    this.start();
    if (this.reduced) { this.step(0); this.draw(); }
  }
  // Scroll the row so a choice sits in the middle (without it choosing again).
  rowTo(i) {
    const c = this.rowEl.children[i + 1];
    if (!c) return;
    this.rowLock = performance.now() + 600;
    // Today is pinned (sticky) once the row is scrolled, so its offset is not its place in the row: it centres at scroll 0.
    this.rowEl.scrollTo({ left: i < 0 ? 0 : c.offsetLeft + c.offsetWidth / 2 - this.rowEl.clientWidth / 2, behavior: this.reduced ? "auto" : "smooth" });
  }
  rowKeyNow() { return `${this.world.id}|${this.sections.map((s) => s.label).join(",")}|${this.fade < 1 ? 1 : 0}|${this.moreN | 0}`; }
  buildRow(ink) {
    const row = this.rowEl, items = [{ label: "Today", today: true }, ...this.sections];
    row.replaceChildren();
    const lit = this.colours().accent;
    items.forEach((s, j) => {
      const b = el(row, "button", "ecl-dial-chip");
      const cv = el(el(b, "span", "ecl-dial-chip-art"), "canvas", ""); // the art box is a fixed height, so every name shares one baseline
      if (s.today) {
        const S = 34; cv.width = S * this.dpr; cv.height = S * this.dpr; cv.style.width = cv.style.height = S + "px";
        const g = cv.getContext("2d"); g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        // ON7 Y2: the chip is the leader's landing point, so it is a plain dot: the glowing ring is the marker on the orbit above, and there is only one of those.
        // AA6: with no folders yet the leader lands on the label itself (the strip holds only Today), so no free dot sits under it.
        if (this.sections.length) { g.fillStyle = `rgb(${lit})`; g.beginPath(); g.arc(S / 2, S / 2, 3.5, 0, TAU); g.fill(); }
      } else {
        const sp = this.sprite(9, -0.7, -0.7, ink, this.bgP || "10,10,12", this.objSeed(j - 1, j));
        cv.width = sp.c.width; cv.height = sp.c.height; cv.style.width = cv.style.height = sp.S + "px";
        cv.getContext("2d").drawImage(sp.c, 0, 0);
      }
      el(b, "span", "ecl-dial-chip-name", s.label);
      b.addEventListener("click", () => { this.selectDial(j - 1); });
    });
    if (this.moreN > 0 && this.sections.length) {
      // The folders the cap leaves out: one quiet chip at the end of the row, same pitch as the moons. A tap opens the folder list in settings.
      const b = el(row, "button", "ecl-dial-chip ecl-dial-chip-more");
      el(el(b, "span", "ecl-dial-chip-art"), "span", "ecl-dial-more-n", `+${this.moreN}`);
      el(b, "span", "ecl-dial-chip-name", "More");
      b.title = `${this.moreN} more ${this.moreN === 1 ? "folder" : "folders"}, in settings`;
      b.addEventListener("click", () => this.onMore());
    }
    this.rowKey = this.rowKeyNow();
    this.rowSynced = false;
    // The row snaps to chip boundaries, so at rest a chip is either fully in view or fully under Today (never a clipped word beside it).
    // That only holds at the far end if the longest scroll is a whole number of chips, so a spacer pads the end of the row to make it so.
    const pad = el(row, "span", "ecl-dial-pad");
    window.requestAnimationFrame(() => {
      if (!pad.isConnected) return;
      const far = row.scrollWidth - row.clientWidth;
      if (far > 1) pad.style.flexBasis = Math.ceil((72 - (far % 72)) % 72) + "px";
      row.dispatchEvent(new Event("scroll")); // sets the edge fade / Today scrim for the fresh row
    });
  }
  // Where Today's chip draws its dot, in canvas coordinates (read from the DOM, refreshed a few times a second).
  // ON7 Y2: j is the chip's place in the row (0 = Today, else folder + 1); it also gives the art's height so a leader can land just above it.
  // While the row is still scrolling to the chosen chip the position is read every frame, so the line follows the chip in.
  chipDot(j = 0) {
    const now = performance.now(), cc = this._cd && this._cd.j === j ? this._cd : null;
    if (cc && now - cc.t < (now < (this.rowLock || 0) + 250 ? 0 : 300)) return cc.v;
    const ch = this.rowEl && this.rowEl.children[j], cv = ch && ch.querySelector("canvas");
    let v = null;
    if (cv) { const a = cv.getBoundingClientRect(), b = this.canvas.getBoundingClientRect(); if (a.width) v = { x: a.left + a.width / 2 - b.left, y: a.top + a.height / 2 - b.top, h: a.height }; }
    this._cd = { t: now, v, j };
    return v;
  }
  // Where Today's label sits (canvas coordinates: its centre and top), read like chipDot.
  chipLabel(j = 0) {
    const now = performance.now(), cc = this._cl && this._cl.j === j ? this._cl : null;
    if (cc && now - cc.t < (now < (this.rowLock || 0) + 250 ? 0 : 300)) return cc.v;
    const ch = this.rowEl && this.rowEl.children[j], nm = ch && ch.querySelector(".ecl-dial-chip-name");
    let v = null;
    if (nm) { const a = nm.getBoundingClientRect(), b = this.canvas.getBoundingClientRect(); if (a.width) v = { x: a.left + a.width / 2 - b.left, top: a.top - b.top, rule: this.rowEl.getBoundingClientRect().bottom - b.top }; }
    this._cl = { t: now, v, j };
    return v;
  }
  // The near-side phase on Today's orbit whose screen x is closest to x (first run on the phone: the moon sits straight above its label).
  phaseAtX(x) {
    const r = this.geo.moon * this.geo.R;
    let best = this.moonPhase, bd = 1e9;
    for (let k = 0; k < 180; k++) {
      const a = (k / 180) * TAU, p = this.project(r * Math.cos(a), 0, r * Math.sin(a));
      if (p.z < 0) continue;
      const d = Math.abs(p.x - x);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  dialTurnTo(i) { const base = i * this.dialStep(); this.dialTarget = base + Math.round((this.yaw - base) / TAU) * TAU; this.start(); if (this.reduced) { this.step(0); this.draw(); } }

  // Index sections.length is the today moon.
  item(i) {
    if (i < this.sections.length) return this.sections[i];
    const t = this.today;
    return t && { label: "Today", recent: t.recent || [], meta: t.meta || t.long, path: t.path, isToday: true };
  }

  open(i) {
    const s = this.item(i);
    if (!s) return;
    s.isToday ? this.onOpenToday(this.today, this.dotPos(i)) : this.onOpenSection(s, this.dotPos(i));
  }

  nextWorld(target) {
    const before = this.look();
    this.from = palette(this.colours());
    // Switching again before the previous new planet was ever shown (it is drawn only after the swap): the old planet's image is still the one on screen, so keep it.
    const unseen = this.fade < SWAP;
    if (!unseen) this.prevWorld = this.world;
    const at = target ? this.worlds.findIndex((w) => w.id === target) : -1;
    this.worldIndex = at >= 0 ? at : (this.worldIndex + 1) % this.worlds.length;
    this.to = palette(this.world);
    if (hasWeather(this.prevWorld) !== hasWeather(this.world)) { this.skyFrom = before; this.skyFade = this.reduced ? 1 : 0; }
    // Keep the old planet on its own layer and fade it out under the new one.
    if (!unseen) [this.oldLayer, this.planetLayer] = [this.planetLayer, this.oldLayer];
    // Orbits and the body shrink are fitted to each world (a big world pushes its first orbit out), so refit before the new planet is built.
    this.lblFit = null; // the label fit belongs to one world's orbits; the next world measures its own
    if (!this.dialMode && this.w) this.fitGeo();
    // The new planet is only seen after the swap, so it is built (50 to 140 ms) in slices while the old one collapses (stepPlanetJob in draw).
    if (this.reduced) { this.buildPlanet(); this.drawPlanet(); } else this.startPlanetJob();
    this.fade = this.reduced ? 1 : 0;
    this.applyCss();
    this.onWorld(this.world);
    this.start();
    if (this.reduced) this.draw();
  }

  // Current colours, mid-crossfade if a switch is running.
  colours() {
    const lk = this.look();
    return { bg: css(lk.bg), ink: css(lk.ink), accent: css(lk.accent) };
  }

  // The full look: the world's colours (mid-travel if travelling), with the
  // weather blended from the previous weather while it changes.
  look() {
    // The colours change around the flare, not at the start: eased over the middle of the switch.
    const k = this.fade >= 1 ? 1 : smoothstep((this.fade - 0.28) / 0.5), mix = (a, b) => a.map((x, i) => x + (b[i] - x) * k);
    const pal = { bg: mix(this.from.bg, this.to.bg), ink: mix(this.from.ink, this.to.ink), accent: mix(this.from.accent, this.to.accent) };
    const now = skyLook(hasWeather(this.world) ? this.sky : NO_WEATHER, pal);
    return this.skyFrom && this.skyFade < 1 ? lerpLook(this.skyFrom, now, this.skyFade) : now;
  }

  setSky(spec) {
    if (this.sky && spec.kind === this.sky.kind) { this.sky = spec; return; }
    this.skyFrom = this.look();
    this.sky = spec;
    this.skyFade = this.reduced ? 1 : 0;
    this.applyCss();
    this.start();
    if (this.reduced) this.draw();
  }

  setTasks(tasks) { this.tasks = tasks || { done: 0, open: [] }; this.makeBelt(); }

  // Ambient: how much debris drifts round the system (0 none) and how fast the moons turn.
  setAmbient(a) {
    const was = this.amb && this.amb.debris;
    this.amb = { debris: 1, speed: 2.6, ...(a || {}) };
    if (was !== this.amb.debris && this.w) { this.makeBelt(); this.makeDebris(); }
  }

  /* The task belt, between the first two orbits: loose rubble, with open
     tasks as rocks lit in the accent (brightest when due within two days). */
  makeBelt() {
    const d = this.amb ? this.amb.debris : 1, r = rng(311), rocks = [];
    if (!d) { this.belt = []; return; }
    const loose = Math.round(140 * d), done = Math.min(120, Math.round((this.tasks.done || 0) * 0.5 * d));
    for (let i = 0; i < loose + done; i++) rocks.push({ a: r() * TAU, dr: (r() - 0.5) * 0.3, dy: (r() - 0.5) * 0.06, s: 0.6 + r() * 1.0, a0: 0.12 + r() * 0.2 + (i >= loose ? 0.1 : 0) });
    (this.tasks.open || []).slice(0, 24).forEach((t, i) => rocks.push({ a: (i * 2.39996 + 0.4) % TAU, dr: (r() - 0.5) * 0.14, dy: 0, s: t.soon ? 1.9 : 1.3, open: t }));
    this.belt = rocks;
  }

  /* Debris: a few loose clumps of rock and dust drifting slowly round the
     system, well outside the folder orbits and a little above and below them. */
  makeDebris() {
    const d = this.amb ? this.amb.debris : 1, r = rng(97), out = [];
    if (d && this.geo) {
      const o = this.geo.orbits, inner = o[0] - 0.2, outer = o[o.length - 1] + 1.6;
      const clumps = Math.round(4 + 3 * d);
      for (let c = 0; c < clumps; c++) {
        const ca = r() * TAU, cr = inner + r() * (outer - inner), cy = (r() - 0.5) * 0.9, n = Math.round((22 + r() * 34) * d), spread = 0.18 + r() * 0.4;
        for (let i = 0; i < n; i++) {
          const big = r() < 0.08;
          out.push({ a: ca + (r() - 0.5) * spread * 2.2, rr: cr + (r() - 0.5) * spread, y: cy + (r() - 0.5) * spread * 0.5, w: 0.004 + r() * 0.01, s: big ? 1.6 + r() * 1.2 : 0.5 + r() * 0.7, a0: big ? 0.45 + r() * 0.25 : 0.16 + r() * 0.3, big, ph: r() * TAU });
        }
      }
      // A thin scatter of single grains anywhere in the system.
      for (let i = 0; i < Math.round(70 * d); i++) out.push({ a: r() * TAU, rr: inner + r() * (outer - inner + 1), y: (r() - 0.5) * 1.4, w: 0.006 + r() * 0.01, s: 0.5 + r() * 0.5, a0: 0.08 + r() * 0.16, big: false, ph: r() * TAU });
    }
    this.debris = out;
  }

  drawDebris(ink, alpha, side) {
    if (!this.debris || !this.debris.length || alpha < 0.01) return;
    const g = this.ctx, R = this.geo.R, t = this.t * (this.amb ? Math.sqrt(this.amb.speed) : 1);
    for (const b of this.debris) {
      const a = b.a + t * b.w, p = this.project(b.rr * R * Math.cos(a), b.y * R, b.rr * R * Math.sin(a));
      if (side === "back" ? p.z >= 0 : p.z < 0) continue;
      const tw = b.big ? 1 : 0.8 + 0.2 * Math.sin(this.t * 0.7 + b.ph);
      g.fillStyle = `rgba(${ink},${b.a0 * tw * alpha})`;
      if (b.big) {
        // A lumpy rock: two offset grains, lit on one side.
        g.fillRect(p.x, p.y, b.s, b.s * 0.75);
        g.fillStyle = `rgba(${ink},${b.a0 * 0.5 * alpha})`;
        g.fillRect(p.x + b.s * 0.6, p.y + b.s * 0.4, b.s * 0.6, b.s * 0.5);
      } else g.fillRect(p.x, p.y, b.s, b.s);
    }
  }

  beltR() { const o = this.geo.orbits; return ((o[0] + o[1]) / 2) * this.geo.R; }

  drawBelt(ink, accent, alpha, side) {
    if (!this.belt || !this.belt.length || alpha < 0.01) return;
    const g = this.ctx, rb = this.beltR(), R = this.geo.R, turn = this.t * 0.03 * (this.amb ? this.amb.speed : 1);
    for (const b of this.belt) {
      const a = b.a + turn, rr = rb + b.dr * R, p = this.project(rr * Math.cos(a), b.dy * R, rr * Math.sin(a));
      if (side === "back" ? p.z >= 0 : p.z < 0) continue;
      if (b.open) {
        const soon = b.open.soon, gr = soon ? 8 : 5;
        const gl = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
        gl.addColorStop(0, `rgba(${accent},${(soon ? 0.55 : 0.28) * alpha})`);
        gl.addColorStop(1, `rgba(${accent},0)`);
        g.fillStyle = gl; g.fillRect(p.x - gr, p.y - gr, gr * 2, gr * 2);
        g.fillStyle = `rgba(${accent},${0.85 * alpha})`;
        g.fillRect(p.x - b.s / 2, p.y - b.s / 2, b.s, b.s);
      } else {
        g.fillStyle = `rgba(${ink},${b.a0 * alpha})`;
        g.fillRect(p.x, p.y, b.s, b.s * 0.8);
      }
    }
  }

  // A moon's wake: a short fading dust trail along its orbit, so the motion reads.
  wake(i, ink, alpha, side) {
    const g = this.ctx, R = this.geo.R, r = this.geo.orbits[i] * R, s = this.sections[i], on = i === this.hover;
    const len = 1.3;
    for (let k = 0; k <= 44; k++) {
      const t = k / 44, a = s.phase - len * (1 - t), p = this.project(r * Math.cos(a), 0, r * Math.sin(a));
      if (side === "back" ? p.z >= 0 : p.z < 0) continue;
      g.fillStyle = `rgba(${ink},${(0.02 + (on ? 0.45 : 0.3) * t * t) * alpha})`;
      g.fillRect(p.x - 0.5, p.y - 0.5, 1, 1);
      if (k % 3 === 0 && t > 0.3) { const j = ((k * 7919) % 13) / 13 - 0.5; g.fillRect(p.x + j * 4, p.y - j * 3, 0.8, 0.8); }
    }
  }

  applyCss() {
    const lk = this.look();
    // Set on the scene's host and on its parent, so the landing pages beside
    // the scene pick up the same colours.
    const view = this.host.parentElement; // the pane's content; its parent also holds the header
    for (const t of [this.host, view, view && view.parentElement]) {
      if (!t) continue;
      t.style.setProperty("--ecl-ink", css(lk.ink));
      t.style.setProperty("--ecl-accent", css(lk.accent));
      t.style.setProperty("--ecl-bg", `rgb(${css(lk.bg)})`);
      t.style.setProperty("--ecl-top", `rgb(${css(lk.top)})`);
      t.style.setProperty("--ecl-sky", `linear-gradient(rgb(${css(lk.top)}), rgb(${css(lk.bot)}))`);
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this._roRaf);
    this.ro.disconnect();
    document.removeEventListener("visibilitychange", this._wake);
    window.removeEventListener("focus", this._wake);
    this.canvas.remove();
    this.card.remove();
    if (this.emptyBtn) this.emptyBtn.remove();
    if (this.emptyNew) this.emptyNew.remove();
    this.dialEl.remove();
    window.clearTimeout(this.rowT);
    this.rowEl.remove();
  }

  // ---- geometry -------------------------------------------------------
  // World: y is up, the orbit plane is x/z, +z points at the viewer. The
  // system is turned by `yaw`, the camera looks down at the plane by
  // `tilt`, then the image is rolled. The centre drifts a little with the
  // pointer, like the stars, so the planet sits in the scene, not on it.
  // Last, the image is scaled by k about the focus while flying in.
  project(x, y, z) {
    // The trig of the camera pose is the same for every point of a frame (thousands of calls), so it is kept until the pose changes.
    const { roll } = this.geo, f = this.focus;
    let p = this._pose;
    if (!p || p.yaw !== this.yaw || p.tilt !== this.tilt || p.roll !== roll) {
      p = this._pose = { yaw: this.yaw, tilt: this.tilt, roll, cy0: Math.cos(this.yaw), sy0: Math.sin(this.yaw), ct: Math.cos(this.tilt), st: Math.sin(this.tilt), cr: Math.cos(roll), sr: Math.sin(roll), ver: ((p && p.ver) || 0) + 1 };
    }
    const xr = x * p.cy0 + z * p.sy0, zr = z * p.cy0 - x * p.sy0;
    const up = y * p.ct - zr * p.st;
    const depth = y * p.st + zr * p.ct; // positive is toward the viewer
    let sx = this.cx() + xr * p.cr - up * p.sr, sy = this.cy() - (xr * p.sr + up * p.cr);
    if (this.k !== 1 && f) {
      sx = f.x + (sx - f.x) * this.k;
      sy = f.y + (sy - f.y) * this.k;
    }
    return { x: sx, y: sy, z: depth };
  }
  cx() { return this.geo.cx - this.mouse.x * 16; }
  cy() { return this.geo.cy - this.mouse.y * 11; }
  // A world's size on screen: on the phone dial the small worlds (`dial`) are drawn larger to fill the stage.
  bodySize(w) { return ((this.dialMode && w.dial) || w.size) * ((!this.dialMode && this.geo && this.geo.bk) || 1); } // bk: home fit's body shrink so the first orbit clears it
  planetR() { return this.geo.R * this.bodySize(this.world) * this.k * this.breath(); }

  // Where light comes from at a point on screen: the fixed sun for planets,
  // the centre for the two worlds that shine or lens their own light.
  lightAt(x, y) {
    if (!this.world.kind) return this.sunDir();
    const c = this.project(0, 0, 0), dx = c.x - x, dy = c.y - y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }

  // Where the sun sits on screen, as a unit direction from a body's centre.
  sunDir() {
    const ct = Math.cos(this.tilt), st = Math.sin(this.tilt), cr = Math.cos(this.geo.roll), sr = Math.sin(this.geo.roll);
    const S = this.lk ? this.lk.L : SUN;
    const up = S[1] * ct - S[2] * st;
    const x = S[0] * cr - up * sr, y = -(S[0] * sr + up * cr), l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  }

  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";

    // A tall, narrow screen (the phone) gets the dial: one ring, swiped a
    // section at a time, with the selected section's card below it.
    const dial = obsidian.Platform.isPhone || (w < 560 && h > w * 1.15);
    if (dial !== this.dialMode) { this.dialMode = dial; this.pinned = -1; this.setHover(-1); this.dialShown = -9; }
    const view = this.host.closest(".ecl-view");
    if (view) view.classList.toggle("is-dial", dial);
    this.dialEl.classList.toggle("ecl-off", !dial);
    this.rowEl.classList.toggle("ecl-off", !dial);
    this.kbEl.classList.toggle("ecl-off", dial);
    if (dial) {
      // The card is a fixed height at the bottom with the snap row of moons
      // above it; the dial is centred in the space between the date pill and the row.
      const nb = obsidian.Platform.isPhone && document.querySelector(".mobile-navbar");
      const navClear = nb ? Math.max(0, Math.round(this.host.getBoundingClientRect().bottom - nb.getBoundingClientRect().top) + 8 - 16) : 0;
      const bot = h - navClear;
      const cardTop0 = bot - 16 - DIAL_CARD, rowTop0 = cardTop0 - 66;
      const R = Math.max(30, Math.min(w / 5.2, (rowTop0 - 80) / 2.6));
      // The stage hugs the world: a modest gap under the date, the orbit and its name, then the row
      // and the card straight after it, so the folder's notes sit high and any spare height falls below.
      const cy = Math.min(Math.round((56 + rowTop0) / 2), Math.round(56 + 26 + R * STAGE_UP));
      // The front moon sits ring x sin(tilt) below the centre; its name and the short stem under it need about STAGE_GAP.
      const rowTop = Math.min(rowTop0, Math.round(cy + Math.min(w * 0.42, R * 2.6) * Math.sin(DIAL_TILT) + STAGE_GAP));
      this.rowEl.style.top = rowTop + 6 + "px";
      this.dialEl.style.top = rowTop + 66 + "px";
      this.dialEl.style.height = Math.min(DIAL_CARD, bot - 16 - (rowTop + 66)) + "px";
      this.geo = { R, roll: 0, cx: w / 2, cy, cardTop: rowTop };
      this.rowKey = null;
      const ring = Math.min(w * 0.42, R * 2.6) / R;
      this.geo.orbits = new Array(12).fill(ring);
      this.geo.moon = ring;
      this.restTilt = this.tilt = DIAL_TILT;
      this.dialPhases();
    } else {
      this.lblFit = null; // a new pane size: the label fit (made for the old size's fonts and room) is measured again
      this.fitGeo();
      this.restTilt = TILT;
    }

    this.makeStars();
    this.fade = 1;
    for (const l of [this.planetLayer, this.oldLayer]) l._css = 0; // dpr may have changed
    this.buildPlanet();
    this.drawPlanet();
    this.start();
  }

  // The home system: the outermost moon's orbit spans about 70 % of the pane, so the world is
  // as large as the room allows and the moons sit close around it.
  fitGeo() {
    const w = this.w, h = this.h;
    // The near half of an orbit swings in front of the world, so the orbit's screen height (radius x sin tilt)
    // must clear the disc: big worlds (Jupiter, Betelgeuse) push the whole set of orbits out, and the world
    // gets a little smaller in return, so no moon ever sits on the disc.
    // A world's `halo` is how far its art reaches above the plane, as a multiple of its size (the black hole's
    // lensed gas), so its orbits clear that outer bounding ellipse and not just the shadow.
    const sz = ((this.world && this.world.size) || 1) * ((this.world && this.world.halo) || 1), gap = 0.2;
    // The whole system is drawn HOME_SCALE larger than it was: the orbits close up a little (the near half still
    // clears the disc) so the outermost one takes the same width and the names keep their room.
    const m0 = Math.max(2.6, (sz + 0.1) / Math.sin(TILT) + gap), step = this.world && this.world.halo ? 0.16 : m0 > 3.1 ? 0.2 : 0.26;
    const orbits = [0, 1, 2, 3, 4, 5].map((i) => m0 + i * step);
    const n = Math.max(1, Math.min(this.sections.length || 5, orbits.length));
    const sizeR = () => {
      // (H3) The orbit may take most of the pane's width: the names only need about 130 px each side (the label fit below
      // shrinks it if they need more), where it used to keep 200 px, so Saturn sat in a third of a 1280 window.
      let R = Math.min(Math.min(w * 0.42, Math.max(w * 0.3, w / 2 - 130)) * HOME_WIDE / orbits[n - 1], h * HOME_SCALE / 6.0);
      // The names hang outside the outermost orbit, so its name ring's half-width (need x R, measured by leaderLabels)
      // plus the widest name must fit each side; on tall, wide panes the height-led size would push them in over the moons.
      this.unfitR = R; // the size without the label fit: leaderLabels needs it to tell whether letting the fit go would only bring it straight back
      if (this.lblFit && this.lblFit.n === n) R = Math.max(40, Math.min(R, (w / 2 - 24 - this.lblFit.w - 12) / this.lblFit.need));
      return R;
    };
    this.geo = { R: sizeR(), roll: 0.12, cx: w / 2, cy: h / 2, orbits, moon: m0 - gap, bk: 1 };
    // The gap above is a fixed share of R, so on a small pane it shrank to nothing. Measure how far the first orbit's
    // near half really clears the world's outline (rings and glow included) to a pixel margin. First the inner orbits
    // move out while the outermost stays put (they pack a little closer, down to MIN_STEP); if that is not enough the
    // world's own body gets smaller (to BODY_MIN at most). The system and its names keep their size either way.
    const MIN_STEP = 0.1, BODY_MIN = 0.72, last = n - 1, tz = Math.max(0.2, Math.sin(this.tilt));
    const clear0 = this.orbitClear(0);
    if (clear0 < HOME_CLEAR - 1 && last > 0) {
      const room = orbits[last] - last * MIN_STEP - orbits[0];
      const dm = Math.max(0, Math.min(room, (HOME_CLEAR - clear0) / (this.geo.R * tz)));
      if (dm > 0) {
        const m = orbits[0] + dm, st = (orbits[last] - m) / last;
        for (let i = 0; i < orbits.length; i++) orbits[i] = m + i * st;
        this.geo.moon += dm;
      }
    }
    for (let it = 0; it < 10; it++) {
      const clear = this.orbitClear(0);
      if (clear >= HOME_CLEAR - 1 || this.geo.bk <= BODY_MIN) break;
      const PR = this.geo.R * this.bodySize(this.world);
      this.geo.bk = Math.max(BODY_MIN, this.geo.bk * Math.max(0.85, 1 - (HOME_CLEAR - clear) / Math.max(1, PR * 2.4)));
    }
  }

  // Smallest screen distance (px) from the near half of orbit `oi` to the world's outline; negative when it overlaps.
  orbitClear(oi) {
    // Measured at the resting camera, so a fit run mid-travel (tilt swinging) gives the same answer as one at rest.
    const tilt = this.tilt; this.tilt = this.restTilt || TILT;
    try { return this.orbitClearAt(oi); } finally { this.tilt = tilt; }
  }

  orbitClearAt(oi) {
    const s = this.geo.R * this.bodySize(this.world), c = this.project(0, 0, 0), poly = this.planetClear(c, s, true);
    const ro = this.geo.orbits[oi] * this.geo.R;
    let worst = 1e9;
    for (let j = 0; j < 180; j++) {
      const a = (j / 180) * TAU, p = this.project(ro * Math.cos(a), 0, ro * Math.sin(a));
      if (p.z < 0) continue;
      let d = 1e9, inside = false;
      for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
        const A = poly[i], B = poly[k], vx = B.x - A.x, vy = B.y - A.y;
        const t = Math.max(0, Math.min(1, ((p.x - A.x) * vx + (p.y - A.y) * vy) / (vx * vx + vy * vy || 1)));
        d = Math.min(d, Math.hypot(p.x - A.x - t * vx, p.y - A.y - t * vy));
        if ((A.y > p.y) !== (B.y > p.y) && p.x < (B.x - A.x) * (p.y - A.y) / (B.y - A.y) + A.x) inside = !inside;
      }
      worst = Math.min(worst, inside ? -d : d);
    }
    return worst;
  }

  // Re-run the home fit after the label room changed; rebuild the planet only if the size moved.
  refitHome() {
    if (this.dialMode || !this.w) return;
    const was = this.geo && this.geo.R, wbk = this.geo && this.geo.bk;
    this.fitGeo();
    if (was !== this.geo.R || wbk !== this.geo.bk) { for (const l of [this.planetLayer, this.oldLayer]) l._css = 0; this.buildPlanet(); this.drawPlanet(); }
  }

  makeStars() {
    const r = rng(42);
    const n = Math.round((this.w * this.h) / 9000);
    this.stars = [];
    for (let i = 0; i < n; i++) {
      const big = r() < 0.05;
      this.stars.push({
        x: r() * this.w, y: r() * this.h,
        s: big ? 1.2 : 0.8,
        a: big ? 0.45 : 0.12 + r() * 0.25,
        depth: 0.2 + r() * 0.8,
      });
    }
    // Weather: a few soft clouds, and drops or flakes that fall and wrap.
    this.clouds = [];
    for (let i = 0; i < 9; i++) this.clouds.push({ x: r() * 1.4 - 0.2, y: r() * 0.75, w: 0.18 + r() * 0.22, sp: 0.6 + r() * 0.8 });
    this.drops = [];
    const nd = Math.round((this.w * this.h) / 2600);
    for (let i = 0; i < nd; i++) this.drops.push({ x: r(), y: r(), l: 6 + r() * 9, v: 0.8 + r() * 0.5, s: 0.6 + r() * 1.1, ph: r() * TAU });
    this.makeBelt(); this.makeDebris();
  }

  /* The planet is stippled: fixed dots on the sphere, each kept with a
     probability that follows light x albedo, so shading is density alone,
     and painted the surface's colour. The dots live in the planet's own
     frame and are re-lit every frame, so the surface turns under a fixed
     sun as the planet spins or is dragged. Rings are dots too. The two
     worlds that are not planets are dots as well: a star lights itself
     (darker toward its limb) and breathes, inside faint dust shells; a
     black hole is a shadow, a thin ring and gas that orbits it. */
  buildPlanet() {
    this.planetJob = null;
    const out = {};
    for (const _ of this.planetGen(out));
    this.planet = out.planet;
  }

  // The same build as a generator, so a world switch can run it in slices (stepPlanetJob) instead of freezing a frame.
  startPlanetJob() {
    const out = {};
    this.planetJob = { gen: this.planetGen(out), out };
  }

  // Runs the pending build for about `budget` ms (all of it if budget is 0); true when the planet is ready.
  stepPlanetJob(budget) {
    const job = this.planetJob;
    if (!job) return true;
    const t = performance.now();
    let r;
    do { r = job.gen.next(); } while (!r.done && (!budget || performance.now() - t < budget));
    if (!r.done) return false;
    this.planet = job.out.planet;
    this.planetJob = null;
    return true;
  }

  *planetGen(out) {
    const world = this.world, rand = rng(1234), R = this.geo.R * this.bodySize(world), layer = this.planetLayer;
    if (world.kind === "blackhole") {
      const hole = yield* this.buildHole(R, rand);
      out.planet = { world, R, ...hole, layer };
      return;
    }
    const surface = makeSurface(world);
    const n = Math.min(150000, Math.round(R * R * 9));
    const pts = new Float32Array(n * 8);
    for (let i = 0; i < n; i++) {
      if (i % 2000 === 1999) yield;
      const y = rand() * 2 - 1, th = rand() * TAU, rr = Math.sqrt(1 - y * y);
      const v = [rr * Math.cos(th), y, rr * Math.sin(th)], s = surface(v);
      pts.set([v[0], v[1], v[2], s[0], rand(), s[1], s[2], s[3]], i * 8);
    }
    let ring = null, rn = 0;
    if (world.rings) {
      rn = Math.min(60000, Math.round(R * R * 3.4));
      ring = new Float32Array(rn * 6);
      for (let k = 0; k < rn;) {
        const r = 1.24 + rand() * 1.03, th = rand() * TAU, d = ringDensity(r);
        if (rand() > d) continue;
        const c = ringColour(r);
        ring.set([r * Math.cos(th), r * Math.sin(th), d, c[0], c[1], c[2]], k * 6);
        k++;
        if (k % 2000 === 0) yield;
      }
    }
    const shell = world.kind === "star" ? yield* this.buildShells(R, rand) : { shells: null, sn: 0 };
    out.planet = { world, R, pts, n, ring, rn, ...shell, layer };
  }

  // The black hole's gas: dots in the disc plane at r (in shadow radii) and
  // angle th, kept by clumpy noise so the pattern is visible as it turns.
  *buildHole(R, rand) {
    const n = Math.min(140000, Math.round(R * R * 18)), disc = new Float32Array(n * 4);
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (i % 2000 === 1999) yield;
      const r = 1.22 + 1.88 * Math.pow(rand(), 1.5), th = rand() * TAU;
      const d = fbm([r * Math.cos(th) * 0.7, r * 0.3, r * Math.sin(th) * 0.7], 2.4);
      if (rand() > clamp((d - 0.28) / 0.4, 0.08, 1) * (0.55 + 0.45 * Math.pow(1.22 / r, 0.6))) continue;
      disc.set([r, th, clamp(0.35 + 0.8 * d, 0, 1), rand()], k * 4);
      k++;
    }
    return { pts: null, n: 0, ring: null, rn: 0, disc, dn: k, shells: null, sn: 0 };
  }

  // Betelgeuse's dust: patchy spherical shells round the star.
  *buildShells(R, rand) {
    const m = Math.min(60000, Math.round(R * R * 4)), sh = new Float32Array(m * 5), radii = [1.28, 1.58, 1.95];
    let k = 0;
    for (let i = 0; i < m; i++) {
      if (i % 2000 === 1999) yield;
      const s = Math.floor(rand() * 3), y = rand() * 2 - 1, th = rand() * TAU, rr = Math.sqrt(1 - y * y);
      const v = [rr * Math.cos(th), y, rr * Math.sin(th)];
      if (noise3(v[0] * 2.2 + s * 7, v[1] * 2.2, v[2] * 2.2) < 0.42 + rand() * 0.2) continue;
      sh.set([v[0], v[1], v[2], radii[s] * (1 + (rand() - 0.5) * 0.05), 0.5 + 0.5 * rand()], k * 5);
      k++;
    }
    return { shells: sh, sn: k };
  }

  // The star's slow breathing: a few percent in size over about 40 seconds.
  breath() { return this.world.kind === "star" ? 1 + 0.03 * Math.sin((this.t * TAU) / 42) : 1; }

  // The stippled planet is re-rasterised point by point, and its cost grows with the square of its size. When that is heavy (a big window) the
  // slow spin is repainted at most about every 28 ms, or 50 ms when heaviest (the layer keeps the last paint); a drag, a flight, a travel or any change of size or
  // angle repaints at once, so only the idle turn is thinned (it moves a fraction of a pixel per frame).
  drawPlanet() {
    const t0 = performance.now(), layer = this.planetLayer;
    const key = `${this.k}|${this.yaw}|${this.tilt}|${this.geo.R}|${this.geo.bk}|${this.geo.roll}|${this.dpr}`;
    const idle = (this.planetCost || 0) > 3 && this.planet && this.planet.world === this.world && this.planet.layer === layer && layer._css && !this.planetJob &&
      this.planetKeyLayer === layer && this.planetKey === key && !this.drag && !this.flight && this.fade >= 1;
    let rj = this.rasterJob;
    if (rj && !(idle && rj.planet === this.planet && rj.layer === layer && rj.key === key)) rj = this.rasterJob = null; // anything but the idle turn paints in one go
    if (idle) {
      // The idle turn of a heavy planet is painted in slices of a few ms spread over the next frames (a whole paint in one frame
      // would miss the display's frame), then shown at once. Its pose is read when it starts.
      if (!rj) {
        if (t0 - this.planetStamp < (this.planetCost > 5 ? 50 : 28)) return;
        rj = this.rasterJob = { gen: this.rasterGen(), planet: this.planet, layer, key, spent: 0 };
        this.planetStamp = t0;
      }
      const until = t0 + 2.5;
      let done;
      do { done = rj.gen.next().done; } while (!done && performance.now() < until);
      rj.spent += performance.now() - t0;
      if (done) { this.planetCost = 0.85 * this.planetCost + 0.15 * rj.spent; this.rasterJob = null; }
      return;
    }
    const built = this.planet;
    this.rasterPlanet();
    const t1 = performance.now();
    if (built === this.planet) this.planetCost = 0.85 * (this.planetCost || 0) + 0.15 * (t1 - t0); // a build inside the call is not the per-frame cost
    this.planetStamp = t1; this.planetKey = key; this.planetKeyLayer = layer;
  }

  rasterPlanet() {
    if (!this.planet || this.planet.world !== this.world || this.planet.layer !== this.planetLayer) this.buildPlanet();
    for (const _ of this.rasterGen());
  }

  // The same paint as a generator: the pose is read once at the start and the dots go in the same order, so a paint that is spread over
  // several frames (the idle turn of a big planet) ends exactly as one painted in a single call; it yields every few thousand dots.
  *rasterGen() {
    const { world, pts, n, ring, rn, disc, dn, shells, sn } = this.planet;
    const hole = world.kind === "blackhole", star = world.kind === "star";
    const R = this.planet.R * this.k * this.breath(), dpr = this.dpr, layer = this.planetLayer;
    const ext = hole ? 3.2 : star ? 2.15 : ring ? 2.3 : 1;
    // The layer only grows; each frame clears and uploads just the square
    // the planet (and its rings) can reach.
    const need = Math.ceil((R * ext + 16) * 2);
    if (!layer._css || layer._css < need) {
      layer._css = Math.ceil(need * 1.1);
      layer.width = layer.height = Math.round(layer._css * dpr);
      layer._img = layer.getContext("2d").createImageData(layer.width, layer.height);
      layer._dirty = null;
    }
    const W = layer.width, half = layer._css / 2, hc = half * dpr, d = layer._img.data;
    const rr = Math.ceil((R * ext + 16) * dpr);
    const reg = [Math.max(0, Math.floor(hc - rr)), Math.min(W, Math.ceil(hc + rr))];
    const clr = layer._dirty ? [Math.min(reg[0], layer._dirty[0]), Math.max(reg[1], layer._dirty[1])] : [0, W];
    for (let y = clr[0]; y < clr[1]; y++) d.fill(0, (y * W + clr[0]) * 4, (y * W + clr[1]) * 4);
    layer._dirty = reg;

    // Accumulate a dot: alpha adds up, colour blends by contribution.
    const plot = (px, py, sz, a, r, g, b) => {
      for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) {
        const k = ((py + dy) * W + px + dx) * 4, oa = d[k + 3] / 255, w = a / (oa + a);
        d[k] += (r - d[k]) * w; d[k + 1] += (g - d[k + 1]) * w; d[k + 2] += (b - d[k + 2]) * w;
        d[k + 3] = Math.min(1, oa + a) * 255;
      }
    };

    // Planet frame -> view: spin about the axis, tilt the axis, turn by yaw.
    const spin0 = this.spin, yaw0 = this.yaw, tilt0 = this.tilt, time0 = this.t; // read once: a paint spread over frames must not follow them
    const cs = Math.cos(this.spin), ss = Math.sin(this.spin);
    // On the phone dial the one orbit is drawn close to the planet, so a ring turned off the orbit plane cuts through the moons on it:
    // a ringed world lies nearly in the orbit plane there (the axis stays a little off true), and the ring stays inside the orbit.
    const axial = this.dialMode && world.rings ? world.axial * 0.2 : world.axial;
    const ca = Math.cos(axial), sa = Math.sin(axial);
    const cyw = Math.cos(this.yaw), syw = Math.sin(this.yaw);
    const ct = Math.cos(this.tilt), st = Math.sin(this.tilt);
    const cr = Math.cos(this.geo.roll), sr = Math.sin(this.geo.roll);
    const L = this.lk ? this.lk.L : SUN, tint = this.lk ? this.lk.sun.map((x) => x / 255) : [1, 1, 1];
    const sz = Math.max(1, Math.round(Math.max(0.8, this.planet.R / 110) * dpr));
    const a0 = 0.3, a1 = 0.6;
    const pulse = star ? 1 + 0.1 * Math.sin((this.t * TAU) / 42 + 0.6) : 1; // the star's brightness breathes with its size
    // The whole chain is linear, so it is folded into rows once per frame (view x, y, z of a unit vector v are dot products)
    // and the far half of the sphere is dropped after one dot product instead of after the full chain.
    const chain = (x, y, z) => {
      const x1 = x * cs + z * ss, z1 = z * cs - x * ss;
      const x2 = x1 * ca - y * sa, y2 = x1 * sa + y * ca;
      return [x2 * cyw + z1 * syw, y2, z1 * cyw - x2 * syw];
    };
    const ex = chain(1, 0, 0), ey = chain(0, 1, 0), ez = chain(0, 0, 1);
    const rowOf = (k) => [ex[k], ey[k], ez[k]];
    const rx = rowOf(0), ry = rowOf(1), rz = rowOf(2);
    const dp = [0, 1, 2].map((j) => ry[j] * st + rz[j] * ct), upr = [0, 1, 2].map((j) => ry[j] * ct - rz[j] * st);
    const sxr = [0, 1, 2].map((j) => rx[j] * cr - upr[j] * sr), syr = [0, 1, 2].map((j) => rx[j] * sr + upr[j] * cr);
    const ll = [0, 1, 2].map((j) => rx[j] * L[0] + ry[j] * L[1] + rz[j] * L[2]);
    const d0 = dp[0], d1 = dp[1], d2 = dp[2], l0 = ll[0], l1 = ll[1], l2 = ll[2];
    const sx0 = sxr[0], sx1 = sxr[1], sx2 = sxr[2], sy0 = syr[0], sy1 = syr[1], sy2 = syr[2];
    const Rd = R * dpr, hs = sz / 2, tr = tint[0], tg = tint[1], tb = tint[2];
    for (let i = 0; i < n; i++) {
      if ((i & 8191) === 8191) yield;
      const o = i * 8;
      const x = pts[o], y = pts[o + 1], z = pts[o + 2];
      const depth = x * d0 + y * d1 + z * d2;
      if (depth <= 0) continue;
      // A planet is lit by the fixed sun; a star lights itself and thins toward its limb.
      const lit = star ? Math.sqrt(depth) : Math.max(0, x * l0 + y * l1 + z * l2);
      const keep = (0.015 + 0.985 * (lit * Math.sqrt(Math.sqrt(lit)))) * pts[o + 3] * pulse; // lit^1.25 without a pow call per point
      if (pts[o + 4] > keep) continue;
      const f = star ? 0.55 + 0.45 * depth : 1;
      const px = Math.round(hc + (x * sx0 + y * sx1 + z * sx2) * Rd - hs);
      const py = Math.round(hc - (x * sy0 + y * sy1 + z * sy2) * Rd - hs);
      const pa = a0 + a1 * Math.min(1, keep), pr = pts[o + 5] * tr * f, pg = pts[o + 6] * tg * f, pb = pts[o + 7] * tb * f;
      if (sz === 1) {
        // The common one-pixel dot, blended exactly as plot() does, without the call.
        const k = (py * W + px) * 4, oa = d[k + 3] / 255, w = pa / (oa + pa);
        d[k] += (pr - d[k]) * w; d[k + 1] += (pg - d[k + 1]) * w; d[k + 2] += (pb - d[k + 2]) * w;
        d[k + 3] = Math.min(1, oa + pa) * 255;
      } else plot(px, py, sz, pa, pr, pg, pb);
    }
    if (shells) {
      // Dust shells turn slowly, a little faster the closer in.
      const dust = rgb(world.accent), dm = mixc(dust, [120, 60, 46], 0.5);
      const c2 = Math.cos(spin0 * 0.5), s2 = Math.sin(spin0 * 0.5);
      for (let i = 0; i < sn; i++) {
        if ((i & 8191) === 8191) yield;
        const o = i * 5, rad = shells[o + 3], x = shells[o] * c2 + shells[o + 2] * s2, y = shells[o + 1];
        if ((x * x + y * y) * rad * rad < 1.1) continue; // in front of or behind the star itself
        plot(Math.round(hc + x * rad * R * dpr), Math.round(hc - y * rad * R * dpr), Math.max(1, Math.round(dpr * 0.8)),
          (0.05 + 0.1 * shells[o + 4]) * clamp((2.15 - rad) * 1.2, 0.2, 1), dm[0], dm[1], dm[2]);
      }
    }
    if (hole) {
      // Gas in orbit. In the plane it is an ellipse: the near half passes in
      // front of the shadow, and the far half is lensed up over the top as an
      // arc of the same radius. Inner gas is hotter and faster; the
      // approaching side is brighter.
      const sig = rgb(world.accent), hot = mixc(sig, [255, 246, 255], 0.6), cold = mixc(sig, [30, 14, 70], 0.45);
      const lut = [];
      for (let k = 0; k <= 32; k++) lut.push(mixc(hot, cold, Math.pow(k / 32, 0.8)));
      const it = Math.sin(tilt0), rsz = Math.max(1, Math.round(dpr * 0.9)), t = time0;
      for (let i = 0; i < dn; i++) {
        if ((i & 8191) === 8191) yield;
        const o = i * 4, r = disc[o], th = disc[o + 1] + (0.18 / (r * Math.sqrt(r))) * t - yaw0;
        const c = Math.cos(th), s = Math.sin(th);
        const ups = s < 0 ? -r * s : -r * s * it, x = r * c, k = clamp((r - 1.22) / 1.88, 0, 1);
        const bright = clamp(disc[o + 2] * (1 + 0.5 * c) * (1.15 - 0.85 * Math.sqrt(k)), 0, 1.3);
        const col = lut[Math.round(k * 32)], big = disc[o + 3] > 0.94 && k < 0.5 ? 2 : 1;
        const px = Math.round(hc + (x * cr - ups * sr) * R * dpr), py = Math.round(hc - (x * sr + ups * cr) * R * dpr);
        plot(px, py, rsz * big, 0.14 + 0.5 * Math.min(1, bright), col[0], col[1], col[2]);
      }
    }
    if (ring) {
      const rsz = Math.max(1, Math.round(dpr * 0.9));
      for (let i = 0; i < rn; i++) {
        if ((i & 8191) === 8191) yield;
        const o = i * 6, x = ring[o], z = ring[o + 1];
        const x2 = x * ca, y2 = x * sa;
        const x3 = x2 * cyw + z * syw, z3 = z * cyw - x2 * syw;
        const depth = y2 * st + z3 * ct, up = y2 * ct - z3 * st;
        const sx = x3 * cr - up * sr, sy = -(x3 * sr + up * cr);
        if (depth < 0 && sx * sx + sy * sy < 1) continue; // behind the planet
        // In the planet's shadow?
        const pl = x3 * L[0] + y2 * L[1] + z3 * L[2];
        let shade = 1;
        if (pl < 0) {
          const qx = x3 - pl * L[0], qy = y2 - pl * L[1], qz = z3 - pl * L[2];
          if (qx * qx + qy * qy + qz * qz < 1) shade = 0.1;
        }
        plot(Math.round(hc + sx * R * dpr), Math.round(hc + sy * R * dpr), rsz, 0.42 * ring[o + 2] * shade, ring[o + 3], ring[o + 4], ring[o + 5]);
      }
    }
    const g = layer.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.putImageData(layer._img, 0, 0, clr[0], clr[0], clr[1] - clr[0], clr[1] - clr[0]);

    // Atmosphere: thin concentric arcs on the lit limb, fading outward and
    // toward the terminator, tinted with the world's signal colour.
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (world.atmo) {
      const sd = this.sunDir(), sun = Math.atan2(sd.y, sd.x);
      for (let k = 0; k < 7; k++) {
        const fall = Math.pow(1 - k / 7, 2) * world.atmo;
        for (let j = -24; j < 24; j++) {
          const a0 = sun + (j / 24) * 1.9, a1 = sun + ((j + 1) / 24) * 1.9;
          const face = Math.cos(((j + 0.5) / 24) * 1.9 * 0.82);
          g.strokeStyle = `rgba(${world.accent},${0.32 * fall * face * face})`;
          g.lineWidth = 0.8;
          g.beginPath(); g.arc(half, half, R + 0.8 + k * 1.15, a0, a1); g.stroke();
        }
      }
    }
    if (hole) {
      // The photon ring: a thin bright line at the shadow's edge, brighter on the approaching side.
      const N = 90;
      for (let j = 0; j < N; j++) {
        const a = (j / N) * TAU, b = ((j + 1.3) / N) * TAU, beam = 0.5 + 0.5 * Math.cos(a - this.geo.roll);
        g.strokeStyle = `rgba(${world.accent},${0.06 + 0.16 * beam})`; g.lineWidth = 3.4;
        g.beginPath(); g.arc(half, half, R * 1.004, a, b); g.stroke();
        g.strokeStyle = `rgba(${world.ink},${0.38 + 0.57 * beam})`; g.lineWidth = 1.1;
        g.beginPath(); g.arc(half, half, R * 1.004, a, b); g.stroke();
      }
    }
  }

  idle() {
    if (this.host.offsetParent === null || this.paused || document.hidden) return true;
    return !document.hasFocus() && !this.flight && this.fade >= 1 && !this.drag;
  }

  start() {
    if (this.raf) return;
    const tick = (now) => {
      this.raf = 0;
      if (!this.host.isConnected) return;
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
      this.last = now;
      // Stop (not spin) while the tab is hidden behind another view, a page covers the orbit, the window is minimised, or the window has lost focus
      // (a flight or world change still finishes). The loop restarts from the host resizing into view, a page closing, or the window coming back.
      if (this.idle()) { this.last = 0; return; }
      this.step(dt);
      this.draw();
      if (!this.reduced || this.flight) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  // Fly the camera toward (or back from) a point on screen.
  flyTo(focus, k, seconds, done) {
    if (focus) this.focus = { x: focus.x, y: focus.y };
    if (!this.focus) this.focus = { x: this.w / 2, y: this.h / 2 };
    this.paused = false;
    if (this.reduced) { this.k = k; if (k === 1) this.focus = null; this.flight = null; if (done) done(); this.draw(); return; }
    this.flight = { from: this.k, to: k, t: 0, dur: seconds, done };
    this.start();
  }

  step(dt) {
    this.t += dt;
    const { orbits } = this.geo;
    if (!this.dialMode) this.sections.forEach((s, i) => {
      if (i === this.hover) return; // hold still while hovered
      const r = orbits[i % orbits.length];
      s.phase += dt * 0.55 * Math.pow(r / orbits[0], -1.5) * 0.25 * (this.amb ? this.amb.speed : 2.6);
    });
    if (this.dialMode && this.dialToday) {
      // Chosen on the phone, Today's moon comes round to the near side, half a step beside the front slot, so it is never behind the planet.
      const lab = !this.sections.length ? this.chipLabel(0) : null;
      const want = lab ? this.phaseAtX(lab.x) : this.yaw + Math.PI / 2 - this.dialStep() / 2, d =((want - this.moonPhase + Math.PI) % TAU + TAU) % TAU - Math.PI;
      this.moonPhase += this.reduced ? d : d * (1 - Math.pow(0.004, dt));
    } else {
      // Today's moon is the one destination that must always be seen: it swings over the near half of its orbit
      // (never round behind the world) and the folder moons make way for it.
      if (this.hover !== this.sections.length) this.moonT += dt * 0.05;
      this.moonPhase = Math.PI / 2 + 1.15 * Math.sin(this.moonT);
    }
    if (!this.dialMode) this.spreadMoons();
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / SWITCH_S);
      this.applyCss();
    }
    if (this.skyFade < 1) {
      this.skyFade = Math.min(1, this.skyFade + dt / 2.4);
      this.applyCss();
    }
    // Lightning: now and then, a quick double flash.
    if (this.lk && this.lk.bolt > 0.5 && !this.reduced) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) { this.flashT = 0; this.nextFlash = 7 + Math.random() * 9; }
      if (this.flashT != null) {
        this.flashT += dt;
        const f = this.flashT;
        this.flash = f < 0.08 ? 1 : f < 0.16 ? 0.25 : f < 0.24 ? 0.8 : Math.max(0, 0.8 - (f - 0.24) * 2.2);
        if (this.flash <= 0) this.flashT = null;
      }
    } else this.flash = 0;
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - Math.pow(-2 * f.t + 2, 3) / 2;
      this.k = f.from + (f.to - f.from) * e;
      if (f.t >= 1) {
        this.flight = null;
        if (this.k !== 1 && this.dialEl.style.transform) this.liftCard(0); // in close, out of sight
        if (this.k === 1) this.focus = null;
        if (f.done) f.done();
      }
    }
    this.mouse.x += (this.mouse.nx - this.mouse.x) * 0.04;
    this.mouse.y += (this.mouse.ny - this.mouse.y) * 0.04;
    this.spin += dt * 0.05;
    if (!this.drag) {
      if (this.dialMode) {
        // Settle on the nearest section, or the one a flick or tap chose.
        const step = this.dialStep(), to = this.dialTarget != null ? this.dialTarget : Math.round(this.yaw / step) * step;
        this.yaw += (to - this.yaw) * (this.reduced ? 1 : 1 - Math.pow(0.002, dt));
        if (Math.abs(to - this.yaw) < 1e-4) { this.yaw = to; this.dialTarget = null; }
        this.yawVel = 0;
      } else {
        // Let a flick coast.
        this.yaw += this.yawVel * dt;
        this.yawVel *= Math.pow(0.06, dt);
      }
      // The camera settles back to its resting tilt.
      this.tilt += (this.restTilt - this.tilt) * (1 - Math.pow(0.25, dt));
    }
  }

  // The folder moons and Today's moon turn at their own speeds, so left alone they drift into clumps.
  // Keep a minimum angular gap between neighbours round the ring: a moon that catches another is held
  // back (and the other nudged on) rather than passing over it.
  spreadMoons() {
    const n = this.sections.length;
    if (n < 1) return;
    const body = this.sections.map((s) => ({ s, k: "phase" })); body.push({ s: this, k: "moonPhase" });
    const m = body.length, gap = Math.min(0.8, 0.7 * TAU / m), held = this.hover, today = m - 1; // Today's moon (last) keeps its own course
    const pos = (b) => ((b.s[b.k] % TAU) + TAU) % TAU;
    for (let pass = 0; pass < 3; pass++) {
      const ord = body.map((b, i) => ({ b, i, p: pos(b) })).sort((a, c) => a.p - c.p);
      let moved = false;
      for (let q = 0; q < m; q++) {
        const a = ord[q], b = ord[(q + 1) % m], d = (b.p - a.p + TAU) % TAU || (m > 1 ? 0 : TAU), def = gap - d;
        if (m < 2 || def <= 0) continue;
        const ha = a.i === held || a.i === today, hb = b.i === held || b.i === today;
        if (ha && hb) continue;
        a.b.s[a.b.k] -= ha ? 0 : hb ? def : def / 2;
        b.b.s[b.b.k] += hb ? 0 : ha ? def : def / 2;
        moved = true;
      }
      if (!moved) break;
    }
  }

  dotPos(i) {
    if (i >= this.sections.length) return this.moonPos();
    const s = this.sections[i];
    const r = this.geo.orbits[i % this.geo.orbits.length] * this.geo.R;
    return this.project(r * Math.cos(s.phase), 0, r * Math.sin(s.phase));
  }

  moonPos() {
    const r = this.geo.moon * this.geo.R;
    return this.project(r * Math.cos(this.moonPhase), 0, r * Math.sin(this.moonPhase));
  }

  // An orbit line. side "back" or "front" draws only that half, so the far
  // half can pass behind the planet and the near half in front of it.
  ellipse(r, ink, alpha, width, side) {
    const g = this.ctx, R = this.geo.R;
    g.strokeStyle = `rgba(${ink},${alpha})`;
    g.lineWidth = width;
    g.beginPath();
    // The projected points of an orbit are kept (the back and the front half are drawn from the same ones) while the camera, size and
    // centre stay as they were, which is most frames.
    this.project(0, 0, 0);
    const f = this.focus, fx = f ? f.x : 0, fy = f ? f.y : 0, cx = this.cx(), cy = this.cy();
    const memo = this._ellMemo || (this._ellMemo = new Map());
    let e = memo.get(r);
    if (!e || e.ver !== this._pose.ver || e.R !== R || e.cx !== cx || e.cy !== cy || e.k !== this.k || e.fx !== fx || e.fy !== fy) {
      if (!e) { if (memo.size > 24) memo.clear(); e = { px: new Float64Array(201), py: new Float64Array(201), pz: new Float64Array(201) }; memo.set(r, e); }
      for (let j = 0; j <= 200; j++) {
        const a = (j / 200) * TAU;
        const p = this.project(r * R * Math.cos(a), 0, r * R * Math.sin(a));
        e.px[j] = p.x; e.py[j] = p.y; e.pz[j] = p.z;
      }
      e.ver = this._pose.ver; e.R = R; e.cx = cx; e.cy = cy; e.k = this.k; e.fx = fx; e.fy = fy;
    }
    let pen = false;
    for (let j = 0; j <= 200; j++) {
      const z = e.pz[j];
      const show = !side || (side === "back" ? z < 0 : z >= 0);
      if (!show) { pen = false; continue; }
      pen ? g.lineTo(e.px[j], e.py[j]) : g.moveTo(e.px[j], e.py[j]);
      pen = true;
    }
    g.stroke();
  }

  draw() {
    const g = this.ctx;
    const { R } = this.geo;
    const lk = (this.lk = this.look());
    const ink = css(lk.ink), accent = css(lk.accent);
    const PR = this.planetR();
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const c = this.project(0, 0, 0);
    this.drawSky(lk, c, PR, accent);

    // The ground behind the planet. Its night side is a solid body a little
    // darker than that (a black hole's shadow is nearly black, a star's is dark red).
    const behind = mixc(lk.top, lk.bot, clamp(c.y / this.h, 0, 1));
    const bg = css(behind);
    this.bgP = bg;
    const kind = this.world.kind;
    const body = css(kind === "blackhole" ? [2, 2, 4] : kind === "star" ? mixc(behind, [118, 30, 22], 0.5) : mixc(behind, [4, 6, 12], 0.3));
    const travel = this.fade < 1 ? this.fade : 1;
    // Streaks: while travelling between worlds, and while flying in or out.
    const fly = this.flight ? Math.sin(Math.PI * this.flight.t) : 0;
    // World switch: the stars streak in toward the point while the scene folds, then out as it opens.
    const sx = travel < SWAP ? Math.pow(travel / SWAP, 2) : Math.pow(1 - (travel - SWAP) / (1 - SWAP), 1.6);
    const warp = Math.max(travel < 1 ? sx * 0.9 : 0, fly * 1.4);
    const sgn = travel < SWAP ? -1 : 1;
    const from = this.flight && this.focus ? this.focus : c;
    // Labels and dots step back while the camera is in close.
    // A world switch: everything but the sky folds to a point at SWAP (ease-in, with a slight spiral),
    // then blooms out of it (ease-out with a little overshoot), the moons following the world.
    const bl = travel < SWAP ? 0 : clamp((travel - SWAP) / (1 - SWAP), 0, 1);
    const cl = travel < SWAP ? travel / SWAP : 1;
    const pinch = travel < 1 ? (travel < SWAP ? 1 - 0.985 * Math.pow(cl, 2.3) : 0.015 + 0.985 * easeOutBack(bl)) : 1;
    const spin = travel < 1 ? (travel < SWAP ? 1.1 * cl * cl : -1.1 * Math.pow(1 - bl, 2.4)) : 0;
    const moonK = travel < 1 && travel >= SWAP ? 1 - Math.pow(1 - clamp((bl - 0.1) / 0.7, 0, 1), 3) : 1;
    const calm = clamp(1 - (this.k - 1) * 1.6, 0, 1) * clamp((pinch - 0.55) / 0.45, 0, 1) * (travel >= SWAP && travel < 1 ? clamp((bl - 0.62) / 0.3, 0, 1) : 1);

    // Sparse, still stars with a little parallax toward the pointer and the
    // drag.
    // A star never sits on a name: the labels drawn last frame (and the footer) keep a clear margin round them (ON4 T3).
    const W = this.w + 40, KEEP = 12, avoid = [];
    if (this.lblDebug) for (const q of this.lblDebug) if (!q.hidden && q.a > 0.05) avoid.push(q.rect);
    if (this.footRect) avoid.push(this.footRect);
    if (this.moreRect) avoid.push(this.moreRect);
    if (lk.stars > 0.01) for (const st of this.stars) {
      const x = ((st.x - this.mouse.x * 10 * st.depth - this.yaw * 60 * st.depth) % W + W) % W - 20;
      const y = st.y - this.mouse.y * 7 * st.depth + (this.tilt - TILT) * 50 * st.depth;
      let hit = false;
      for (let q = 0; q < avoid.length; q++) { const r = avoid[q]; if (x > r[0] - KEEP && x < r[0] + r[2] + KEEP && y > r[1] - KEEP && y < r[1] + r[3] + KEEP) { hit = true; break; } }
      if (hit) continue;
      if (warp > 0.02) {
        const k = warp * 0.09 * st.depth;
        g.strokeStyle = `rgba(${ink},${st.a * lk.stars * (1 + 0.5 * warp)})`;
        g.lineWidth = st.s;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + sgn * (x - from.x) * k, y + sgn * (y - from.y) * k); g.stroke();
      } else {
        g.fillStyle = `rgba(${ink},${st.a * lk.stars})`;
        g.fillRect(x, y, st.s, st.s);
      }
    }

    if (lk.clouds > 0.01) this.drawClouds(lk);
    if (pinch !== 1) { g.save(); g.translate(c.x, c.y); g.rotate(spin); g.scale(pinch, pinch); g.translate(-c.x, -c.y); }

    // Far halves of the orbits first; the planet will cover them. In fog
    // the outer ones fade into it.
    const n = Math.min(this.sections.length, this.geo.orbits.length);
    const fogK = (i) => 1 - lk.fog * 0.85 * (n > 1 ? i / (n - 1) : 0);
    const orbits = (side) => {
      // AA6: with no folders the far half of the track is left out (it only showed through the ring's dust); the near half passes in front.
      if (this.dialMode) { if (side === "back" && !this.sections.length) return; this.ellipse(this.geo.orbits[0], ink, 0.11 * (0.4 + 0.6 * calm), 0.8, side); return; }
      // One faint line per moon; the hovered moon's is a little clearer.
      for (let i = 0; i < n; i++) this.ellipse(this.geo.orbits[i], ink, (i === this.hover ? 0.3 : 0.03) * (0.4 + 0.6 * calm) * fogK(i), 0.7, side);
      const deb = this.amb ? this.amb.debris : 1;
      if (!deb) return;
      const da = Math.min(1, 0.55 + 0.35 * deb) * (0.4 + 0.6 * calm);
      this.drawDebris(ink, da * fogK(0.7), side);
      this.drawBelt(ink, accent, da * fogK(0.3), side);
      for (let i = 0; i < n; i++) this.wake(i, ink, da * fogK(i), side);
    };
    orbits("back");
    // The moons: depth decides size and dimness; the far half goes behind the planet, the near half in front.
    const moons = this.dialMode ? [] : this.moonItems(c, PR, calm);
    // The moons fly out to their orbits a beat after the world has opened.
    if (moonK < 1) for (const m of moons) m.p = { ...m.p, x: c.x + (m.p.x - c.x) * moonK, y: c.y + (m.p.y - c.y) * moonK };
    this.drawMoonItems(moons, ink, accent, false);

    // A faint wash of scattered light around the planet ties it to the sky.

    // The new planet is built in slices during the collapse and drawn only once it can be seen (after the swap).
    if (this.planetJob) this.stepPlanetJob(travel < SWAP - 0.03 ? 7 : 0);
    if (!this.planetJob && travel >= SWAP && (!this.reduced || !this.planet || this.flight || this.drag)) this.drawPlanet();

    // Travel: the old world falls away, the new one arrives from close by,
    // and a ripple in the new accent runs out across the orbits.
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const layer = (img, scale, alpha, r) => {
      if (alpha <= 0.01 || !img._css) return;
      g.save();
      g.translate(c.x, c.y); g.scale(scale, scale);
      // The night side is solid: it hides the stars and far orbits behind
      // it, with a soft edge rather than a cut-out one.
      const shade = g.createRadialGradient(0, 0, r * 0.96, 0, 0, r * 1.02);
      shade.addColorStop(0, `rgba(${body},${alpha})`);
      shade.addColorStop(1, `rgba(${body},0)`);
      g.fillStyle = shade;
      g.beginPath(); g.arc(0, 0, r * 1.02, 0, TAU); g.fill();
      g.globalAlpha = alpha;
      g.drawImage(img, -img._css / 2, -img._css / 2, img._css, img._css);
      g.restore();
    };
    if (travel < 1) {
      // The old world is already drawn collapsing (see `pinch`), so the swap
      // happens at the point and the new one opens out of it.
      const inn = clamp((travel - SWAP) / (1 - SWAP), 0, 1);
      if (travel < SWAP) layer(this.oldLayer, 1, 1, R * (this.prevWorld ? this.bodySize(this.prevWorld) : 1) * this.k);
      else {
        layer(this.planetLayer, 1, 1, PR);
        if (inn > 0.04) this.ellipse(1.3 + ease(inn) * 5.2, accent, 0.4 * (1 - inn), 0.9);
      }
    } else layer(this.planetLayer, 1, 1, PR);
    orbits("front");
    this.drawMoonItems(moons, ink, accent, true);
    this.drawWeather(lk, c, PR);
    if (pinch !== 1) {
      g.restore();
      // The one lit point the scene folds into and opens out of.
      // A brief flare at the swap: it swells quickly, then the ring runs out.
      const pa = clamp(1 - Math.abs(travel - SWAP) / 0.13, 0, 1), pe = pa * pa * (3 - 2 * pa);
      if (pa > 0.01) {
        const fr = 14 + 78 * pe;
        g.save(); g.globalCompositeOperation = "lighter";
        const gl = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, fr);
        gl.addColorStop(0, `rgba(255,252,240,${0.9 * pe})`); gl.addColorStop(0.18, `rgba(${accent},${0.55 * pe})`); gl.addColorStop(1, `rgba(${accent},0)`);
        g.fillStyle = gl; g.fillRect(c.x - fr, c.y - fr, fr * 2, fr * 2);
        g.restore();
        g.fillStyle = `rgba(255,252,240,${pa})`;
        g.beginPath(); g.arc(c.x, c.y, 2.4 + 1.6 * pe, 0, TAU); g.fill();
      }
      const rr = clamp((travel - SWAP) / 0.3, 0, 1);
      if (rr > 0 && rr < 1) {
        g.strokeStyle = `rgba(${accent},${0.5 * Math.pow(1 - rr, 1.5)})`; g.lineWidth = 1.2;
        g.beginPath(); g.arc(c.x, c.y, 8 + (1 - Math.pow(1 - rr, 3)) * this.geo.R * 1.8, 0, TAU); g.stroke();
      }
    }
    if (this.emptyBtn) this.emptyBtn.classList.add("ecl-off");
    if (this.emptyNew) this.emptyNew.classList.add("ecl-off");
    if (this.dialMode) { this.drawDial(c, PR, ink, accent, calm); return; }

    // Names hang on leader lines, pushed apart so none overlap or clip.
    const fs = Math.min(24, Math.max(10, Math.round(R * 0.13)));
    g.textBaseline = "middle";
    this.hits = [];
    this.emptyKeep = !this.sections.length && !this.drag && calm > 0.01 ? this.emptyLayout(c, PR, fs) : null; // first run: the action block is placed first and the names go around it
    this.leaderLabels(moons, c, fs, ink, accent, calm);
    g.font = `${fs}px ${SERIF}`;
    if ("letterSpacing" in g) g.letterSpacing = "0.22em";

    // Planet hover: the planet opens Today.
    const below = c.y + PR * (this.world.reach || 1);
    if (this.overPlanet && this.hover < 0 && !this.drag && calm > 0.99 && this.sections.length) {
      g.textAlign = "center";
      g.fillStyle = `rgba(${accent},0.9)`;
      g.fillText("TODAY", c.x, below + 26);
      if ("letterSpacing" in g) g.letterSpacing = "0.16em";
      g.font = `${Math.max(9, fs - 2)}px ${SERIF}`;
      g.fillStyle = `rgba(${ink},0.4)`;
      g.fillText("CLICK TO LAND, DRAG TO TURN", c.x, below + 44);
      g.textAlign = "left";
    }

    // First run: no top-level folders yet. One clear next step under the planet, "Open Today" (a real button, so Tab reaches it; the
    // same action as clicking the planet), then a small dim caption and a quiet text action, "New folder" (also a real button).
    // The block sits in the same place in every world (see emptyLayout) and was already reserved before the names were laid out.
    const eb = this.emptyBtn, nb = this.emptyNew, E = this.emptyKeep;
    if (E) {
      g.textAlign = "center";
      g.globalAlpha = calm;
      this.emptyBlock = [E.x, E.top, E.w, E.h];
      g.font = `${E.cfs}px ${SERIF}`;
      if ("letterSpacing" in g) g.letterSpacing = "0.02em";
      g.fillStyle = `rgba(${ink},0.88)`; // ON7 Y4: the hint one step brighter
      g.textBaseline = "middle";
      E.cap.forEach((t, k) => g.fillText(t, c.x, E.top + E.bh + E.nGap + E.nh + E.hGap + E.lh * (k + 0.5)));
      g.globalAlpha = 1;
      g.textAlign = "left";
      const place = (b, w, y, h, font) => {
        b.classList.remove("ecl-off");
        b.style.left = `${Math.round(c.x - w / 2)}px`; b.style.top = `${Math.round(y)}px`;
        b.style.width = `${Math.round(w)}px`; b.style.setProperty("height", `${h}px`, "important");
        b.style.font = font; b.style.setProperty("--eo-c", accent);
        b.style.opacity = String(calm);
      };
      if (eb) place(eb, E.lw, E.top, E.bh, `${E.ps}px ${SERIF}`);
      if (nb) place(nb, E.nw, E.top + E.bh + E.nGap, E.nh, `${E.nfs}px ${SERIF}`);
    } else { if (eb) eb.classList.add("ecl-off"); if (nb) nb.classList.add("ecl-off"); }

    // Footer: the date and the world, bottom left, and on Earth the weather
    // when it is switched on. Clicking the date or world travels to the next
    // world, which re-themes the app.
    if ("letterSpacing" in g) g.letterSpacing = "0.18em";
    g.font = `${Math.max(11.5, fs + 1)}px ${SERIF}`;
    g.textBaseline = "alphabetic";
    this.footRect = null;
    if (this.today) {
      g.globalAlpha = calm;
      const fa = 0.8; // (ON2 P3: up from 0.66 to the label step)
      const y = this.h - 26, date = upper(`${this.today.long}, `), name = upper(this.world.name), wx = hasWeather(this.world) && this.sky.label ? upper(`, ${this.sky.label}`) : "";
      const dw = g.measureText(date).width, nw = g.measureText(name).width, sw = g.measureText(wx).width;
      g.fillStyle = `rgba(${ink},${this.overDate ? 0.7 : fa})`;
      g.fillText(date, 28, y);
      g.fillStyle = this.overDate ? `rgb(${accent})` : `rgba(${ink},${fa})`;
      g.fillText(name, 28 + dw, y);
      g.fillStyle = `rgba(${ink},${fa})`;
      g.fillText(wx, 28 + dw + nw, y);
      const hint = this.overDate ? `  ${this.worldIndex + 1} of ${this.worlds.length}, next world ›` : "";
      if (hint) g.fillText(upper(hint), 28 + dw + nw + sw, y);
      this.footRect = [16, this.h - 46, dw + nw + 12, 32];
      g.globalAlpha = 1;
    }
    // Folders the cap leaves out: a small "+N more folders" at the right end of the footer line (a click opens the folder list in settings).
    this.moreRect = null;
    if (this.moreN > 0 && this.sections.length) {
      if ("letterSpacing" in g) g.letterSpacing = "0.18em";
      g.font = `${Math.max(11.5, fs + 1)}px ${SERIF}`;
      g.textAlign = "right"; g.textBaseline = "alphabetic";
      const t = upper(`+${this.moreN} more ${this.moreN === 1 ? "folder" : "folders"}`), tw = g.measureText(t).width;
      g.globalAlpha = calm; g.fillStyle = this.overMore ? `rgb(${accent})` : `rgba(${ink},0.6)`;
      g.fillText(t, this.w - 28, this.h - 26);
      g.globalAlpha = 1; g.textAlign = "left";
      this.moreRect = [this.w - 28 - tw - 12, this.h - 46, tw + 24, 32];
    }
    if ("letterSpacing" in g) g.letterSpacing = "0px";

    // Keyboard focus: a hairline gold ring round the moon and its label.
    if (this.kbFocus >= 0 && !this.dialMode && this.k === 1) {
      const h = (this.hits || []).find((x) => x.i === this.kbFocus);
      if (h) {
        g.lineWidth = 1;
        g.strokeStyle = `rgba(${accent},0.95)`; g.beginPath(); g.arc(h.x, h.y, 17, 0, TAU); g.stroke();
        // The box round the label only while the label is there: the hover card replaces it, and a ring round nothing looks empty.
        g.strokeStyle = `rgba(${accent},0.5)`; if (this.hover !== this.kbFocus) g.strokeRect(Math.round(h.box[0]) + 0.5, Math.round(h.box[1]) + 0.5, Math.round(h.box[2]), Math.round(h.box[3]));
      }
    }
    if (this.hover >= 0) this.placeCard();
  }

  // ---- night sky and weather --------------------------------------------
  // The sky is the world's own ground; the pane's CSS background matches it.
  drawSky(lk, c, PR, accent) {
    // The gradient is painted once into a canvas of the pane's size and copied each frame: filling it afresh every frame cost
    // about 8 ms of raster time at 1920x1080 (it grows with the pane's area) and the colours only change while a world is switching.
    // The wash of scattered light round the planet is a big radial gradient (about 6.4 radii across, 8 to 10 ms of raster time for Jupiter
    // at 2560 wide) and it does not move while the world is at rest, so it is painted into the same bitmap, under the stars and orbits.
    // During a flight, a zoom or a world switch it is filled directly each frame as before.
    const g = this.ctx, top = css(lk.top), bot = css(lk.bot), dpr = this.dpr, ga = this.world.glow || 0.05;
    const still = this.fade >= 1 && !this.flight && this.k === 1, gr = still ? PR / this.breath() : 0;
    const key = `${top}|${bot}|${this.w}|${this.h}|${dpr}` + (still ? `|${accent}|${ga}|${c.x.toFixed(2)}|${c.y.toFixed(2)}|${gr.toFixed(2)}` : "");
    let sc = this.skyCache;
    if (!sc || sc.key !== key) {
      if (!sc) sc = this.skyCache = { c: document.createElement("canvas"), key: "" };
      sc.key = key;
      sc.c.width = Math.round(this.w * dpr); sc.c.height = Math.round(this.h * dpr);
      const k = sc.c.getContext("2d"), sky = k.createLinearGradient(0, 0, 0, sc.c.height);
      sky.addColorStop(0, `rgb(${top})`);
      sky.addColorStop(1, `rgb(${bot})`);
      k.fillStyle = sky; k.fillRect(0, 0, sc.c.width, sc.c.height);
      if (still) this.paintGlow(k, c, gr, accent, ga, dpr);
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(sc.c, 0, 0);
    g.restore();
    if (!still) this.paintGlow(g, c, PR, accent, ga, dpr);
  }

  paintGlow(g, c, PR, accent, a, dpr) {
    g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const glow = g.createRadialGradient(c.x, c.y, PR * 0.9, c.x, c.y, PR * 3.2);
    glow.addColorStop(0, `rgba(${accent},${a})`);
    glow.addColorStop(1, `rgba(${accent},0)`);
    g.fillStyle = glow;
    g.fillRect(c.x - PR * 3.2, c.y - PR * 3.2, PR * 6.4, PR * 6.4);
    g.restore();
  }

  wind() { const wx = this.sky.wx; return 0.4 + Math.min(2, ((wx && wx.wind) || 8) / 15); }

  // Soft flat veils drifting with the wind, pale against the night; they hide some of the stars.
  drawClouds(lk) {
    const g = this.ctx, w = this.w, h = this.h, k = lk.clouds, wind = this.wind(), col = css(lk.ink), a = 0.07;
    for (const cl of this.clouds) {
      const x = ((((cl.x + this.t * 0.004 * cl.sp * wind) % 1.4) + 1.4) % 1.4 - 0.2) * w, y = cl.y * h, rw = cl.w * w;
      g.save(); g.translate(x, y); g.scale(1, 0.28);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rw);
      gr.addColorStop(0, `rgba(${col},${a * k})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rw, 0, TAU); g.fill();
      g.restore();
    }
  }

  // Over everything but the labels: rain or snow, fog, and lightning.
  drawWeather(lk, c, PR) {
    const g = this.ctx, w = this.w, h = this.h, ink = css(lk.ink);
    if (lk.rain > 0.01) {
      const n = Math.round(this.drops.length * Math.min(1, lk.rain * 0.7)), slant = 0.18 * this.wind();
      g.strokeStyle = `rgba(${ink},${0.16 + 0.05 * lk.rain})`;
      g.lineWidth = 0.6;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const d = this.drops[i], y = ((d.y * (h + 40) + this.t * d.v * 560) % (h + 40)) - 20;
        const x = ((d.x * (w + 80) - y * slant) % (w + 80) + w + 80) % (w + 80) - 40, l = d.l * (0.8 + 0.3 * lk.rain);
        g.moveTo(x, y); g.lineTo(x - l * slant, y + l);
      }
      g.stroke();
    }
    if (lk.snow > 0.01) {
      const n = Math.round(this.drops.length * 0.45 * lk.snow);
      g.fillStyle = `rgba(${ink},0.5)`;
      for (let i = 0; i < n; i++) {
        const d = this.drops[i], y = ((d.y * (h + 20) + this.t * d.v * 34) % (h + 20)) - 10;
        const x = ((d.x * w + Math.sin(this.t * 0.7 + d.ph) * 9 + this.t * 6 * this.wind()) % w + w) % w;
        g.beginPath(); g.arc(x, y, d.s, 0, TAU); g.fill();
      }
    }
    if (lk.fog > 0.01) {
      const f = lk.fog, col = css(mixc(lk.bot, lk.ink, 0.3));
      const fg = g.createLinearGradient(0, 0, 0, h);
      fg.addColorStop(0, `rgba(${col},${0.03 * f})`);
      fg.addColorStop(1, `rgba(${col},${0.2 * f})`);
      g.fillStyle = fg; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 4; k++) {
        const y = h * (0.3 + k * 0.17) + Math.sin(this.t * 0.05 + k) * 10, bh = 26 + k * 8;
        const b = g.createLinearGradient(0, y - bh, 0, y + bh);
        b.addColorStop(0, `rgba(${col},0)`); b.addColorStop(0.5, `rgba(${col},${0.08 * f})`); b.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = b; g.fillRect(0, y - bh, w, bh * 2);
      }
    }
    if (this.flash > 0.01) {
      const f = this.flash, fx = w * 0.78;
      const gl = g.createRadialGradient(fx, h * 0.12, 0, fx, h * 0.12, Math.max(w, h) * 0.6);
      gl.addColorStop(0, `rgba(210,200,255,${0.32 * f})`);
      gl.addColorStop(1, "rgba(210,200,255,0)");
      g.fillStyle = gl; g.fillRect(0, 0, w, h);
      // The flash catches the planet's far edge.
      g.strokeStyle = `rgba(226,220,255,${0.6 * f})`; g.lineWidth = 1.4;
      g.beginPath(); g.arc(c.x, c.y, PR + 1, -1.3, 0.3); g.stroke();
    }
  }

  // ---- around the planet ---------------------------------------------
  // On Home the moons grow with the system (H2: they were tiny at 2560 beside a big planet).
  moonR(s) { return (7.2 + Math.min(5.4, Math.sqrt(s.count || 0) * 0.8)) * (this.dialMode ? 1 : 1.12 * clamp(((this.geo && this.geo.R) || 0) / 115, 1, 1.9)); }

  // Every moon on the orbits this frame: position, depth (u: 0 far side, 1 near side), size and dimness from it.
  moonItems(c, PR) {
    const ct = Math.cos(this.tilt), R = this.geo.R, n = this.geo.orbits.length, out = [];
    // The black hole's gas covers an ellipse (lensed up to 3.1 shadow radii, hanging down by the foreshortened
    // disc, rolled with the view): a moon that would be drawn inside it passes behind the gas and is hidden, like
    // a moon behind the world.
    const hole = this.world.kind === "blackhole", cr = Math.cos(this.geo.roll), sr = Math.sin(this.geo.roll), st = Math.sin(this.tilt);
    // Returns 0 inside the gas, rising to 1 a little outside its edge, so a moon fades out before it reaches it.
    // (Disabled: on this world every folder stays visible, drawn in front of the gas; see drawMoonItems.)
    const gasFade = (p, rad) => {
      if (hole) return 1;
      return 1;
      const dx = p.x - c.x, dy = c.y - p.y, x = dx * cr + dy * sr, y = dy * cr - dx * sr;
      const ry = y > 0 ? 3.1 * PR : 3.1 * st * PR, e = Math.hypot(x / (3.1 * PR + rad), y / (ry + rad));
      return clamp((e - 1) / 0.25, 0, 1);
    };
    const add = (i, p, base, orbitR, today) => {
      const u = clamp(0.5 + (0.5 * p.z) / Math.max(1, orbitR * ct), 0, 1);
      // fx: the moon a page flight is folding into a dot (or unfolding from one) shrinks and fades by k.
      const fk = this.fx && this.fx.i === i ? this.fx.k : 1, gf = today ? 1 : gasFade(p, base);
      out.push({ i, p, base, u, s: (0.72 + 0.28 * u) * (0.4 + 0.6 * fk), a: (0.5 + 0.5 * u) * fk * gf, fk, gf, today, on: i === this.hover, front: today || p.z >= 0, hidden: !today && ((p.z < 0 && Math.hypot(p.x - c.x, p.y - c.y) < PR * 1.05) || gf < 0.06) });
    };
    this.sections.forEach((s, i) => add(i, this.dotPos(i), this.moonR(s), this.geo.orbits[i % n] * R, false));
    if (this.today) add(this.sections.length, this.moonPos(), 8.2,this.geo.moon * R, true);
    return out;
  }

  // The far half draws behind the planet, the near half in front of it.
  drawMoonItems(items, ink, accent, front) {
    const g = this.ctx, calm = clamp(1 - (this.k - 1) * 1.6, 0, 1);
    // On the black hole nothing passes behind the gas: far-side folders are drawn in the front pass too, over it.
    const holeW = this.world.kind === "blackhole";
    for (const m of items) {
      if (holeW ? (!front || m.hidden) : m.front !== front) continue;
      const { p } = m, r = m.base * m.s + (m.on ? 0.8 : 0), al = m.a * calm;
      if (m.today) {
        g.globalAlpha = al;
        const gl = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
        gl.addColorStop(0, `rgba(${accent},${m.on ? 0.6 : 0.42})`); // ON2 A4: glow up from 0.28 so Earth's teal Today moon reads against the dark
        gl.addColorStop(1, `rgba(${accent},0)`);
        g.fillStyle = gl; g.fillRect(p.x - r * 3, p.y - r * 3, r * 6, r * 6);
        // The lit side is the accent lifted a third of the way to the ink so it stays bright on dim accents (Earth's teal).
        const ac = accent.split(",").map(Number), ic = ink.split(",").map(Number);
        const litC = ac.length === 3 && ic.length === 3 && !ac.concat(ic).some(isNaN) ? ac.map((v, k) => Math.round(v + (ic[k] - v) * 0.33)).join(",") : accent;
        this.phaseMoon(p.x, p.y, r, this.today.age, litC, this.bgP);
        g.globalAlpha = 1;
        m.ring = r;
        continue;
      }
      this.body(p.x, p.y, r, ink, al, this.objSeed(m.i, m.i + 1), m.base);
      m.ring = r;
      if (m.on && m.ring === r) {
        g.strokeStyle = `rgba(${ink},${0.4 * al})`; g.lineWidth = 0.7;
        g.beginPath(); g.arc(p.x, p.y, r + 5, 0, TAU); g.stroke();
      }
    }
  }

  // Names hang around the outside of the whole system on a ring of their own, each near its moon's
  // angle. They keep the moons' order around the system and are spread along the ring only as far as
  // it takes for no label to touch another label or another leader, so leaders stay short and never
  // cross. A name sits beside its anchor on the left and right and above or below it at the top and
  // bottom, blending between the two, so it moves continuously as its moon goes round. If two moons
  // trade places the two names swap with a quick fade rather than sliding through each other.
  // First run (no folders yet): where the "Open Today" / "New folder" / hint block goes. One place in every world: a fixed share of the
  // pane's height below the planet's centre (deep enough for the tallest world, Betelgeuse's glow), at least 48 px under the
  // planet's own outline or rings in a small pane. The names are laid out around this rect (leaderLabels), so the Today label stays clear of it.
  emptyLayout(c, PR, fs) {
    const g = this.ctx, ps = Math.max(11, fs), cfs = Math.max(13, fs + 1), nfs = Math.max(10, fs - 1.5); // ON7 Y4: the hint one step bigger
    const ls = (v) => { if ("letterSpacing" in g) g.letterSpacing = v; };
    g.font = `${ps}px ${SERIF}`; ls("0.2em");
    const lw = g.measureText("OPEN TODAY").width + 4, bh = Math.round(ps * 2.1);
    // The hint (ON4 R3): sentence case, one step bigger and brighter, two lines, and below both actions so it never splits them.
    // While the light-mode note is showing it is the one instruction on the page, so the hint steps aside (AA7).
    const cap = this.footNote ? [] : ["Create a folder, then add a note inside it.", "Folders appear here as moons once they hold a note."], lh = Math.round(cfs * 1.6);
    g.font = `${nfs}px ${SERIF}`; ls("0.18em");
    const nw = g.measureText("NEW FOLDER").width + 4, nh = Math.round(nfs * 2.3);
    g.font = `${cfs}px ${SERIF}`; ls("0.02em");
    const tw = Math.max(...cap.map((t) => g.measureText(t).width), lw), nGap = 8, hGap = 16;
    ls("0px");
    const h = bh + nGap + nh + (cap.length ? hGap + lh * cap.length : 0), w = tw + 8;
    const lo = 12, hi = this.h - 64 - h - (this.footNote ? 48 : 0);
    const ext = Math.max(...this.planetClear(c, PR).map((p) => p.y)) - c.y;
    let top = c.y + Math.max(ext + 48, this.h * 0.19);
    if (top > hi) { const up = c.y - ext - 28 - h; top = hi < c.y + ext + 20 && up >= lo ? up : Math.max(lo, hi); }
    return { x: c.x - w / 2, top, w, h, ps, cfs, nfs, lw, bh, nw, nh, cap, lh, nGap, hGap };
  }

  leaderLabels(items, c, fs, ink, accent, calm) {
    // The name and its sub-line are stacked from their own font sizes, so a big pane (bigger fs) keeps a clear gap between them.
    const nfs = Math.max(12.5, fs + 1.5), sfs = Math.max(11.5, fs), lgap = Math.max(5, Math.round(nfs * 0.4));
    const g = this.ctx, nf = `${nfs}px ${SERIF}`, sf = `${sfs}px ${SERIF}`;
    const B = { l: 24, r: this.w - 24, t: 26, b: this.h - 64 };
    const ls = (v) => { if ("letterSpacing" in g) g.letterSpacing = v; };
    const wid = (s, f, l) => { g.font = f; ls(l); const w = g.measureText(s).width; ls("0px"); return w; };
    const st = (this.lblSt = this.lblSt || {});
    const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - (this.lblT || now)) / 1000));
    this.lblT = now;
    const snap = this.reduced || !!this.flight;

    // The ring the names sit on: the outermost orbit's screen extent plus room.
    const { orbits, R } = this.geo, no = Math.min(this.sections.length, orbits.length) || 1, ro = orbits[no - 1] * R;
    let hw = 0, hh = 0;
    for (let k = 0; k < 24; k++) {
      const q = this.project(ro * Math.cos((k / 24) * TAU), 0, ro * Math.sin((k / 24) * TAU));
      hw = Math.max(hw, Math.abs(q.x - c.x)); hh = Math.max(hh, Math.abs(q.y - c.y));
    }
    const list = [];
    for (const m of items) {
      const sec = m.today ? null : this.sections[m.i];
      // A very long folder name is cut to a moon-sized label (the page and the dial card keep the full name); left whole it spilled off the pane and shrank the orbit to fit.
      const name = m.today ? "TODAY" : upper([...sec.label].length > 26 ? [...sec.label].slice(0, 25).join("").trimEnd() + "…" : sec.label);
      const sub = m.today ? `${this.today.short}  ·  ${moonPhase(this.today.age).name.toLowerCase()}` : sec.live || sec.meta || "";
      const wn = wid(name, nf, "0.22em"), ws = sub ? wid(sub, sf, "0.04em") : 0;
      list.push({ m, name, sub, wn, ws, late: !m.today && sec.liveKind === "overdue", bw: Math.max(wn, ws), bh: sub ? nfs + lgap + sfs : nfs + 6 });
    }
    const maxw = Math.max(0, ...list.map((i) => i.bw));
    const avail = Math.min(B.r - c.x, c.x - B.l) - maxw - 12;
    // Names stay clear of the world's bright art: the real outer radius, including the black hole's lensed
    // gas above and below the shadow (planets' rings are flat, so only the disc counts vertically).
    const PRn = this.planetR(), artV = this.world.kind === "blackhole" ? PRn * 2.9 : PRn, artH = PRn * ((this.world.reach || 1) * (this.world.kind === "blackhole" ? 2.3 : 1));
    this.lblArt = { v: artV, h: artH };
    const room = Math.min(c.y - B.t, B.b - c.y);
    // The fixed-pixel gaps below grow with the system on big panes (H2): the name ring is an ellipse hugging the orbit,
    // and a gap that stays 46 px while the orbit grows makes it ever wider, which used to hold the whole system small at 1920-2560.
    const ks = clamp(this.geo.R / 115, 1, 2.2);
    const by = Math.max(hh + 19 * ks, Math.min(hh + 46 * ks, room - 16), Math.min(artV + 16 * ks, room - 40));
    // The orbit is rolled, so the name ring must clear its real outline (plus a moon and a gap), not just
    // its bounding box: near the sides a tall name ring otherwise runs through the outer orbit and a
    // name lands on its own moon. If the pane has no room for that, fitGeo shrinks the system (at rest only).
    const mr = Math.max(8, ...items.map((m) => m.ring || 0)) + 10 * ks;
    let bxNeed = hw * 0.6;
    for (let k = 0; k < 48; k++) {
      const q = this.project(ro * Math.cos((k / 48) * TAU), 0, ro * Math.sin((k / 48) * TAU));
      const dx = q.x - c.x, dy = q.y - c.y, d = Math.hypot(dx, dy) || 1, X = Math.abs(dx) * (1 + mr / d), Y = Math.abs(dy) * (1 + mr / d);
      if (Y < by * 0.985) bxNeed = Math.max(bxNeed, X / Math.sqrt(1 - (Y / by) ** 2));
    }
    if (!this.flight && this.k === 1 && !this.drag && R > 0) {
      const f = this.lblFit, need = bxNeed / R, short = bxNeed > avail + 1;
      const release = f && avail - bxNeed * Math.max(1, (this.unfitR || R) / R) > 40, stale = f && !release && Math.abs(f.w - maxw) > 6; // (a fit made for wider names, e.g. before the pane shrank, would hold the system small: keep its need, take the current width)
      if (short ? !f || f.n !== no || Math.abs(f.w - maxw) > 6 || need > f.need + 0.03 : release || stale) { // (perf: letting the fit go is judged at the size it would return to; judged at the fitted size it flipped every frame and rebuilt the planet each time)
        this.lblFit = short ? { w: maxw, need: Math.max(need, (f && f.n === no && f.need) || 0), n: no } : stale ? { w: maxw, need: f.need, n: f.n } : null;
        window.setTimeout(() => this.refitHome(), 0);
      }
    }
    const bx = Math.max(Math.min(bxNeed, avail), Math.min(hw * 0.6, avail));

    // Where a name sits for a given angle on the ring: the anchor, the box and the leader end.
    const lay = (it, phi) => {
      const co = Math.cos(phi), si = Math.sin(phi);
      const ax = c.x + bx * co, ay = c.y + by * si;
      const t = clamp(co * 1.8, -1, 1), u = clamp(si * 1.8, -1, 1);
      const cx = ax + t * (it.bw / 2 + 15), cy = ay + u * (it.bh / 2 + 10);
      const rx = cx - it.bw / 2, ry = cy - it.bh / 2;
      const ex = clamp(ax, rx - 3, rx + it.bw + 3), ey = clamp(ay, ry - 3, ry + it.bh + 3);
      return { ax, ay, t, rx, ry, ex, ey };
    };
    const segSeg = (a, b2, c2, d) => {
      const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      return o(a, b2, c2) * o(a, b2, d) < 0 && o(c2, d, a) * o(c2, d, b2) < 0;
    };
    const segRect = (a, b2, r) => {
      const [x, y, w, h] = r;
      if (Math.max(a[0], b2[0]) < x || Math.min(a[0], b2[0]) > x + w || Math.max(a[1], b2[1]) < y || Math.min(a[1], b2[1]) > y + h) return false;
      const inside = (p) => p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + h;
      if (inside(a) || inside(b2)) return true;
      const k = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
      for (let q = 0; q < 4; q++) if (segSeg(a, b2, k[q], k[(q + 1) % 4])) return true;
      return false;
    };
    // On the black hole the names are held further apart (a dozen folders crowd the right side otherwise).
    const MG = this.world.kind === "blackhole" ? 16 : 5;
    const clash = (a, pa, b2, pb) => {
      const A = lay(a, pa), Bq = lay(b2, pb);
      if (A.rx < Bq.rx + b2.bw + MG && Bq.rx < A.rx + a.bw + MG && A.ry < Bq.ry + b2.bh + MG && Bq.ry < A.ry + a.bh + MG) return true;
      const sa = [[a.m.p.x, a.m.p.y], [A.ax, A.ay], [A.ex, A.ey]], sb = [[b2.m.p.x, b2.m.p.y], [Bq.ax, Bq.ay], [Bq.ex, Bq.ey]];
      const rA = [A.rx - 2, A.ry - 2, a.bw + 4, a.bh + 4], rB = [Bq.rx - 2, Bq.ry - 2, b2.bw + 4, b2.bh + 4];
      for (let q = 0; q < 2; q++) {
        if (segRect(sa[q], sa[q + 1], rB) || segRect(sb[q], sb[q + 1], rA)) return true;
        for (let r = 0; r < 2; r++) if (segSeg(sa[q], sa[q + 1], sb[r], sb[r + 1])) return true;
      }
      return false;
    };
    // The smallest turn along the ring that clears b2 away from a, with a at phi a0.
    const need = (a, a0, b2) => { for (let d = 0; d < 2.4; d += 0.015) if (!clash(a, a0, b2, a0 + d)) return d; return 2.4; };

    // Order by angle, break the circle at its widest gap, then spread each crowd about its own centre.
    const wrap = (v) => { v %= TAU; return v < -Math.PI ? v + TAU : v >= Math.PI ? v - TAU : v; };
    list.forEach((it) => { it.psi = Math.atan2((it.m.p.y - c.y) / by, (it.m.p.x - c.x) / bx); });
    list.sort((a, b2) => a.psi - b2.psi);
    const n = list.length;
    let cut = 0, best = -1;
    for (let k = 0; k < n; k++) { const d = (list[(k + 1) % n].psi - list[k].psi + TAU) % TAU; if (d > best) { best = d; cut = (k + 1) % n; } }
    const seq = [];
    for (let k = 0; k < n; k++) { const it = list[(cut + k) % n]; it.p0 = it.psi; if (k && it.p0 < seq[0].p0) it.p0 += TAU; seq.push(it); }
    for (let k = 1; k < n; k++) while (seq[k].p0 < seq[k - 1].p0) seq[k].p0 += TAU;
    const cl = [];
    for (let k = 0; k < n; k++) {
      let cur = { its: [seq[k]], off: [0] };
      const pos = (q) => q.its.reduce((s, it, j) => s + it.p0 - q.off[j], 0) / q.its.length;
      cur.x = pos(cur);
      while (cl.length) {
        const pv = cl[cl.length - 1], last = pv.its[pv.its.length - 1], lo = pv.off[pv.off.length - 1];
        const gap = need(last, pv.x + lo, cur.its[0]);
        if (pv.x + lo + gap <= cur.x + 1e-6) break;
        cl.pop();
        const base = lo + gap;
        pv.its.push(...cur.its); pv.off.push(...cur.off.map((o) => o + base));
        cur = pv; cur.x = pos(cur);
      }
      cl.push(cur);
    }
    for (const q of cl) q.its.forEach((it, j) => { it.phi = q.x + q.off[j]; });
    // The gaps above were measured before each crowd was centred; settle what is left exactly,
    // pushing each clashing neighbour pair (also across the break in the circle) half and half.
    for (let pass = 0; pass < 40; pass++) {
      let moved = false;
      for (let k = 0; k < n && n > 1; k++) {
        const a = seq[k], b2 = seq[(k + 1) % n], wrapPair = k === n - 1, pb = wrapPair ? b2.phi + TAU : b2.phi;
        if (!clash(a, a.phi, b2, pb)) continue;
        const d = need(a, a.phi, b2), push = a.phi + d + 0.002 - pb;
        if (push > 0) { a.phi -= push / 2; b2.phi += push / 2; moved = true; }
      }
      if (!moved) break;
    }

    // First run: the action block is fixed, so a name that would land on it (or whose leader would cross it) slides along the ring to the nearest clear angle.
    const K = this.emptyKeep;
    if (K) {
      const kr = [K.x - 18, K.top - 14, K.w + 36, K.h + 28];
      const bad = (it, phi) => {
        const L = lay(it, phi);
        return !(L.rx + it.bw < kr[0] || L.rx > kr[0] + kr[2] || L.ry + it.bh < kr[1] || L.ry > kr[1] + kr[3]) || segRect([it.m.p.x, it.m.p.y], [L.ax, L.ay], kr) || segRect([L.ax, L.ay], [L.ex, L.ey], kr);
      };
      for (const it of list) {
        if (!bad(it, it.phi)) continue;
        for (let d = 0.03; d < Math.PI; d += 0.03) {
          if (!bad(it, it.phi + d)) { it.phi += d; break; }
          if (!bad(it, it.phi - d)) { it.phi -= d; break; }
        }
      }
    }

    // Draw state per name: follow the target; after a swap fade out, move, fade in.
    const placed = [], cr = this.hover >= 0 && this.cardRect;
    this.lblDebug = [];
    for (const it of list) {
      const { m } = it, on = m.on, sv = st[m.i] || (st[m.i] = { phi: it.phi, a: 0, tp: false });
      const tgt = lay(it, it.phi), cur = lay(it, sv.phi);
      // A name that jumps (two moons trading places) fades out, moves and fades in. How far it moved is judged against
      // how far its own moon moved this frame, so a slow frame (the moons travel further per frame) is not read as a jump.
      const mv = sv.mx === undefined ? 0 : Math.hypot(m.p.x - sv.mx, m.p.y - sv.my);
      sv.mx = m.p.x; sv.my = m.p.y;
      if (!snap && !sv.tp && Math.hypot(tgt.rx - cur.rx, tgt.ry - cur.ry) > (this.drag ? 70 : 24) + mv * 1.6 && sv.a > 0.05) sv.tp = true;
      if (snap) { sv.phi = it.phi; sv.tp = false; sv.a = m.hidden ? 0 : 1; }
      else if (sv.tp) { sv.a = Math.max(0, sv.a - dt / 0.12); if (sv.a <= 0.02) { sv.tp = false; sv.phi = it.phi; sv.a = 0; } }
      else {
        sv.phi = it.phi;
        sv.a = m.hidden ? Math.max(0, sv.a - dt / 0.2) : Math.min(1, sv.a + dt / 0.25);
      }
      // Depth shows in the moon and the sub-line; the name keeps a floor so far-side destinations still read.
      const L = lay(it, sv.phi), vis = sv.a * calm * m.fk * m.fk * m.gf * m.gf, far = m.front ? 1 : 0.78;
      const rect = [L.rx, L.ry, it.bw, it.bh];
      if (!m.hidden) {
        placed.push([L.rx, L.ry + (it.sub ? nfs / 2 : it.bh / 2) - 6, it.bw]);
        this.hits.push({ i: m.i, x: m.p.x, y: m.p.y, box: [Math.min(L.rx, L.ax) - 4, L.ry - 3, Math.max(L.rx + it.bw, L.ax) - Math.min(L.rx, L.ax) + 8, it.bh + 6] });
      }
      const dm = Math.hypot(L.ax - m.p.x, L.ay - m.p.y) || 1, mx = m.p.x + ((L.ax - m.p.x) / dm) * (m.ring + 3), my = m.p.y + ((L.ay - m.p.y) / dm) * (m.ring + 3);
      this.lblDebug.push({ i: m.i, name: it.name, hidden: !!m.hidden, a: sv.a, rect, s1: [mx, my, L.ax, L.ay], s2: [L.ax, L.ay, L.ex, L.ey] });
      const covered = cr && L.rx < cr[0] + cr[2] && L.rx + it.bw > cr[0] && L.ry + it.bh > cr[1] && L.ry < cr[1] + cr[3];
      if (covered || m.hidden || vis < 0.01) continue;
      const dim = this.hover >= 0 && !on || this.overPlanet ? 0.45 : 1;
      const col = m.today ? accent : ink;
      g.save();
      g.globalAlpha = vis * dim * far;
      g.strokeStyle = `rgba(${col},${on ? 0.6 : m.today ? 0.5 : 0.26})`; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(mx, my); g.lineTo(L.ax, L.ay); g.lineTo(L.ex, L.ey); g.stroke();
      g.globalAlpha = vis * dim * (m.front ? 1 : 0.94);
      g.textAlign = "left";
      const al = 0.5 - 0.5 * L.t;
      g.font = nf; ls("0.22em");
      g.fillStyle = on ? `rgba(${ink},0.97)` : m.today ? `rgba(${accent},0.95)` : `rgba(${ink},0.9)`;
      g.fillText(it.name, L.rx + (it.bw - it.wn) * al, L.ry + (it.sub ? nfs / 2 : it.bh / 2));
      if (it.sub) {
        g.globalAlpha = vis * dim * Math.max(far, 0.92);
        g.font = sf; ls("0.04em");
        g.fillStyle = m.today ? `rgba(${accent},0.9)` : it.late ? this.world.warn : `rgba(${ink},${on ? 0.9 : 0.78})`;
        g.fillText(it.sub, L.rx + (it.bw - it.ws) * al, L.ry + nfs + lgap + sfs / 2);
      }
      ls("0px");
      g.restore();
    }
    return placed;
  }

  // A small stippled sphere, cached per size, light direction and ground: dots kept by
  // probability from the light, so shading is density alone, tinted in bands toward the accent.
  sprite(base, lx, ly, ink, ground, seed) {
    const dpr = this.dpr, ang = ((Math.round((Math.atan2(ly, lx) / TAU) * 12) % 12) + 12) % 12;
    const kind = objectKind(this.world), acc = this.colours().accent;
    const key = `${kind}|${base}|${kind === "star" ? 0 : ang}|${ink}|${ground}|${seed}|${dpr}|${kind === "moon" ? "" : acc}`;
    this.sprites = this.sprites || new Map();
    let sp = this.sprites.get(key);
    if (sp) return sp;
    if (this.sprites.size > 90) this.sprites.clear();
    if (kind !== "moon") {
      // Star and cloud sprites carry their glow, so the canvas is wider than the body; body() scales by S/base, so they still grow with the folder.
      const S = Math.ceil((base * 2.7 + 2) * 2), c = document.createElement("canvas"), m = S / 2;
      c.width = Math.ceil(S * dpr); c.height = Math.ceil(S * dpr);
      const g = c.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (kind === "star") {
        const T = STAR_TINTS[seed % STAR_TINTS.length].join(","), s = base * 0.38;
        const glow = (r, col, a) => { const gr = g.createRadialGradient(m, m, 0, m, m, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.beginPath(); g.arc(m, m, r, 0, TAU); g.fill(); };
        glow(Math.min(m, s * 7), acc, 0.18); glow(s * 2.4, T, 0.6);
        g.fillStyle = "rgb(255,252,255)"; g.beginPath(); g.arc(m, m, s * 0.8, 0, TAU); g.fill();
      } else {
        const a = (ang / 12) * TAU;
        // A floor on the size: a cloud must read as a cloud (not a scratch) at a dozen folders.
        for (const _ of dustCloudGen(g, { cx: m, cy: m, S: base * 1.8, seed, lx: Math.cos(a), ly: Math.sin(a), accent: acc, ink: rgb(ink), n: Math.round(base * base * 6), gain: 1.75, dot: 0.35, dv: 0.4, glow: 0.12, round: true }));
      }
      sp = { c, S };
      this.sprites.set(key, sp);
      return sp;
    }
    const a = (ang / 12) * TAU, L = norm([Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0.66]);
    const S = Math.ceil((base + 2) * 2), c = document.createElement("canvas");
    c.width = Math.ceil(S * dpr); c.height = Math.ceil(S * dpr);
    const g = c.getContext("2d"), m = S / 2, rand = rng(40 + seed * 7);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = `rgb(${ground})`; g.beginPath(); g.arc(m, m, base, 0, TAU); g.fill();
    g.fillStyle = `rgba(${ink},0.07)`; g.fill();
    const tint = mixc(rgb(ink), rgb(this.colours().accent), 0.55), n = Math.round(base * base * 3.4);
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 60) {
      tries++;
      const px = rand() * 2 - 1, py = rand() * 2 - 1, d2 = px * px + py * py;
      if (d2 > 1) continue;
      const b = Math.max(0, px * L[0] + py * L[1] + Math.sqrt(1 - d2) * L[2]);
      if (rand() > 0.035 + 0.965 * Math.pow(b, 0.85)) continue;
      placed++;
      const band = clamp(0.5 + 0.4 * Math.sin(py * 5 + seed), 0, 1) * 0.55;
      g.fillStyle = `rgba(${css(mixc(rgb(ink), tint, band))},${0.3 + 0.7 * b})`;
      g.beginPath(); g.arc(m + px * base, m + py * base, 0.62 * (0.7 + 0.55 * rand()), 0, TAU); g.fill();
    }
    sp = { c, S };
    this.sprites.set(key, sp);
    return sp;
  }

  // Seed for a folder's object: moons keep their old index seed; stars and clouds use the folder path, as the folder page does.
  objSeed(i, fallback) {
    const s = this.sections[i];
    return objectKind(this.world) === "moon" || !s ? fallback : hashOf(s.folder || s.label || String(i));
  }

  // A small shaded sphere, lit from the same sun as the planet.
  body(x, y, r, ink, alpha, seed = 0, base) {
    const g = this.ctx, sd = this.lightAt(x, y), b = base || Math.max(2, Math.round(r * 2) / 2);
    const sp = this.sprite(b, sd.x, sd.y, ink, this.bgP, seed), s = (r / b) * sp.S;
    const a0 = g.globalAlpha;
    g.globalAlpha = a0 * alpha;
    g.drawImage(sp.c, x - s / 2, y - s / 2, s, s);
    g.globalAlpha = a0;
  }

  /* Today's note is drawn as tonight's moon, in its real phase. In the
     southern hemisphere a waxing moon is lit on the left. */
  phaseMoon(x, y, r, age, lit, dark) {
    const g = this.ctx, f = ((age || 0) / 29.530588853) % 1, k = Math.cos(f * TAU);
    let right = f < 0.5;
    if (this.today && this.today.south) right = !right;
    g.fillStyle = `rgb(${dark})`;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = `rgb(${lit})`;
    g.beginPath(); g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !right); g.fill();
    g.fillStyle = k > 0 ? `rgb(${dark})` : `rgb(${lit})`;
    g.beginPath(); g.ellipse(x, y, Math.abs(k) * r + 0.01, r, 0, 0, TAU); g.fill();
    g.strokeStyle = `rgba(${lit},0.7)`; g.lineWidth = 0.9; // ON2 A4: a clearer rim so the dark side still reads as a moon
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  }

  /* Phone: the ring as a dial. The front moon is the selection; its card
     sits below, tied to it by a fading line. The two neighbours are
     labelled so it is clear what a swipe brings round. The date and world
     sit in a pill at the top; tapping it travels to the next world. */
  drawDial(c, PR, ink, accent, calm) {
    const g = this.ctx, n = this.sections.length;
    if (this.dialToday && Math.abs(this.yaw - this.todayYaw) > 0.12) this.dialToday = false; // the dial was turned: back to a section
    const sel = this.dialSelIndex();
    if (this.rowKey !== this.rowKeyNow()) { this.buildRow(ink); this.rowSel = -9; }
    if (sel !== this.rowSel) {
      this.rowSel = sel;
      [...this.rowEl.children].forEach((c, j) => c.classList.toggle("is-on", j - 1 === sel));
      this.rowTo(sel);
    }
    const r = this.geo.orbits[0] * this.geo.R, ct = Math.cos(this.tilt);
    let selP = null;
    const fs = Math.max(10, Math.round(this.geo.R * 0.17));
    const cardTop = this.geo.cardTop;
    g.textBaseline = "middle";
    g.font = `${fs}px ${SERIF}`;
    if ("letterSpacing" in g) g.letterSpacing = "0.2em";
    this.hits = [];
    const order = this.sections.map((s, i) => ({ i, p: this.dotPos(i) })).sort((a, b) => a.p.z - b.p.z);
    // The chosen moon's lit dot and ring keep clear ground: any neighbour that would crowd them fades out
    // (fully gone when its edge is within 18px of the chosen centre, back to full 10px further).
    const chosen = sel >= 0 ? this.dotPos(sel) : this.today ? this.moonPos() : null;
    const clearOf = (p, mr) => (chosen ? clamp((Math.hypot(p.x - chosen.x, p.y - chosen.y) - mr - 18) / 10, 0, 1) : 1);
    for (const { i, p } of order) {
      if (p.z < 0 && Math.hypot(p.x - c.x, p.y - c.y) < PR * 1.05) continue; // behind the planet
      const near = clamp(p.z / (r * ct), -1, 1), f = (near + 1) / 2;
      const front = this.dialToday ? 0 : clamp((near - 0.9) / 0.1, 0, 1); // 1 only in the front slot
      // fx: while a page flight picks this moon up (or puts it down) it shrinks and fades by k.
      const fk = this.fx && this.fx.i === i ? this.fx.k : 1, fa = calm * fk * (i === sel ? 1 : clearOf(p, 3.5));
      if (fa < 0.01) { this.hits.push({ i, x: p.x, y: p.y, box: [p.x - 26, p.y - 26, 52, 52] }); continue; }
      g.globalAlpha = fa;
      if (i === sel) selP = { x: p.x, y: p.y, name: this.sections[i].label, sub: `${this.sections[i].count || 0} notes`, f: f, fk, tail: front > 0.5 };
      if (front > 0) {
        const gl = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18);
        gl.addColorStop(0, `rgba(${accent},${0.55 * front})`);
        gl.addColorStop(1, `rgba(${accent},0)`);
        g.fillStyle = gl; g.fillRect(p.x - 18, p.y - 18, 36, 36);
        g.strokeStyle = `rgba(${accent},${0.5 * front})`; g.lineWidth = 1;
        g.beginPath(); g.arc(p.x, p.y, 9, 0, TAU); g.stroke();
        // ON7 Y2: the leader runs from the moon to the top of its own chip in the row below and lands on it (the chip need not sit under the moon).
        const cd = this.chipDot(i + 1), tx = cd ? cd.x : p.x, ty = cd ? cd.y - cd.h / 2 - 3 : cardTop;
        const tl = g.createLinearGradient(p.x, p.y + 12, tx, ty);
        tl.addColorStop(0, `rgba(${accent},${0.5 * front})`);
        tl.addColorStop(1, `rgba(${accent},${0.4 * front})`);
        g.strokeStyle = tl; g.beginPath(); g.moveTo(p.x, p.y + 12); g.lineTo(tx, ty); g.stroke();
      }
      // Shaded moons, a little bigger for fuller sections; the front one is lit in the accent.
      const mr = (2.3 + 1.7 * f + 1.2 * front) * (0.8 + Math.min(0.6, Math.sqrt(this.sections[i].count || 0) * 0.06)) * (0.4 + 0.6 * fk); // AA4: one step bigger (was 1.6 + 1.4f) so the orbit carries the planet-and-moons idea on a phone
      if (front > 0.5) { g.fillStyle = `rgb(${accent})`; g.beginPath(); g.arc(p.x, p.y, mr, 0, TAU); g.fill(); }
      else this.body(p.x, p.y, mr, ink, (0.5 + 0.5 * f) * fa, this.objSeed(i, 0));
      g.globalAlpha = 1;
      this.hits.push({ i, x: p.x, y: p.y, box: [p.x - 26, p.y - 26, 52, 52] });
    }
    // Today is a moon on the same ring: small and lit, ringed when chosen.
    if (this.today) {
      const q = this.moonPos(), behind = q.z < 0 && Math.hypot(q.x - c.x, q.y - c.y) < PR * 1.05;
      if (!behind) {
        const on = sel < 0, fk = this.fx && this.fx.i === n ? this.fx.k : 1, fa = calm * fk * (on ? 1 : clearOf(q, 3));
        g.globalAlpha = fa * (q.z < 0 ? 0.6 : 1);
        // ON7 Y2: only the chosen marker is lit (glow, ring, accent). Today, when a folder is chosen, is a plain small moon like the rest, so there is one marker on the ring.
        if (on) {
          const gl = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, 20);
          gl.addColorStop(0, `rgba(${accent},0.55)`); gl.addColorStop(1, `rgba(${accent},0)`);
          g.fillStyle = gl; g.fillRect(q.x - 20, q.y - 20, 40, 40);
        }
        if (on && this.today) {
          // AA6: the chosen marker is tonight's real phase (lit limb up, as on the phone Today page), not a ring-and-dot glyph.
          const ac = accent.split(",").map(Number), ic = ink.split(",").map(Number);
          const litC = ac.length === 3 && ic.length === 3 && !ac.concat(ic).some(isNaN) ? ac.map((v, k) => Math.round(v + (ic[k] - v) * 0.33)).join(",") : accent;
          const f0 = ((this.today.age || 0) / 29.530588853) % 1, waxR = this.today.south ? f0 >= 0.5 : f0 < 0.5;
          g.save(); g.translate(q.x, q.y); g.rotate(waxR ? -Math.PI / 2 : Math.PI / 2); g.translate(-q.x, -q.y);
          this.phaseMoon(q.x, q.y, 6 * (0.4 + 0.6 * fk), this.today.age, litC, this.bgP || "10,10,12");
          g.restore();
        } else { g.fillStyle = on ? `rgb(${accent})` : `rgba(${ink},0.8)`; g.beginPath(); g.arc(q.x, q.y, (on ? 3 : 2.8) * (0.4 + 0.6 * fk), 0, TAU); g.fill(); }
        if (on) {
          g.strokeStyle = `rgba(${accent},0.55)`; g.lineWidth = 1; g.beginPath(); g.arc(q.x, q.y, 10, 0, TAU); g.stroke();
          // The leader runs from the moon to the ring of Today's own chip in the row below, and lands on it (ON5 U3): marker, line and chip read as one object.
          // AA6: no folders yet - the leader is plumb and ends on the TODAY label (no dot under it).
          const lab = !n ? this.chipLabel(0) : null, td = this.chipDot(0), tx = lab ? q.x : td ? td.x : q.x, ty = lab ? lab.rule : td ? td.y - 8 : cardTop;
          const tl = g.createLinearGradient(q.x, q.y + 13, tx, ty);
          tl.addColorStop(0, `rgba(${accent},0.5)`); tl.addColorStop(1, `rgba(${accent},0.4)`);
          g.strokeStyle = tl; g.beginPath(); g.moveTo(q.x, q.y + 13); g.lineTo(tx, ty); g.stroke();
          selP = { x: q.x, y: q.y, name: "Today", sub: this.today.short || "", f: 1, lit: true, fk, tail: true };
        }
        g.globalAlpha = 1;
        this.hits.push({ i: n, x: q.x, y: q.y, box: [q.x - 24, q.y - 24, 48, 48] });
      }
    }
    // No name beside the moon here: the snap row and the heading below carry it.
    this.dlabRect = null;

    // The date and world: plain type on a hairline; a tap on it travels to the next world.
    this.footRect = null;
    if (this.today) {
      const wx = hasWeather(this.world) && this.sky.wx, temp = wx && wx.temp != null ? `, ${Math.round(wx.temp)}°` : "";
      const text = upper(`${this.today.long}, ${this.world.name}${temp}`);
      g.font = `${Math.max(9, fs - 2)}px ${SERIF}`;
      const tw = g.measureText(text).width, tx = (this.w - tw) / 2 + 6, ty = 22;
      g.globalAlpha = calm;
      g.strokeStyle = `rgba(${ink},${this.overDate ? 0.3 : 0.12})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(20, 38.5); g.lineTo(this.w - 20, 38.5); g.stroke();
      g.fillStyle = `rgb(${accent})`;
      g.beginPath(); g.arc(tx - 12, ty, 2.2, 0, TAU); g.fill();
      g.textAlign = "left";
      g.fillStyle = `rgba(${ink},${this.overDate ? 0.95 : 0.8})`; // (ON2 P3: up from 0.62 to the label step)
      g.fillText(text, tx, ty + 1);
      g.globalAlpha = 1;
      this.footRect = [tx - 26, 4, tw + 38, 36]; // a fingertip's worth around it
    }
    g.textAlign = "left";
    if ("letterSpacing" in g) g.letterSpacing = "0px";

    this.dialEl.style.opacity = String(calm);
    if (calm < 0.02 && !this.flight && !this.drag && this.dialEl.style.transform) this.liftCard(0);
    this.dialEl.style.pointerEvents = calm > 0.99 ? "" : "none";
    if (sel !== this.dialShown) this.renderDial(sel);
  }

  // The outline (a polygon) of what the planet and its rings cover on screen. Saturn's rings are projected the way drawPlanet does it.
  // `orbit`: the outline the home orbits must clear - a star's far glow is left out, its bright body and corona stay.
  planetClear(c, PR, orbit) {
    const w = this.world, poly = [];
    if (w.rings) {
      const ca = Math.cos(w.axial), sa = Math.sin(w.axial), cyw = Math.cos(this.yaw), syw = Math.sin(this.yaw);
      const ct = Math.cos(this.tilt), st = Math.sin(this.tilt), cr = Math.cos(this.geo.roll), sr = Math.sin(this.geo.roll);
      const r = 2.27 + 10 / Math.max(20, PR);
      for (let j = 0; j < 72; j++) {
        const th = (j / 72) * TAU, x = r * Math.cos(th), z = r * Math.sin(th), x2 = x * ca, y2 = x * sa;
        const x3 = x2 * cyw + z * syw, z3 = z * cyw - x2 * syw, up = y2 * ct - z3 * st;
        poly.push({ x: c.x + (x3 * cr - up * sr) * PR, y: c.y - (x3 * sr + up * cr) * PR });
      }
    } else {
      const a = PR * (w.kind === "blackhole" ? 2.3 : w.kind === "star" ? (orbit ? 1.3 : 1.7) : 1.08) + 6;
      // The black hole's gas is lensed up over the shadow but, in front, only hangs down by the disc's foreshortened width.
      const down = w.kind === "blackhole" ? PR * 3.1 * Math.sin(this.tilt) + 6 : a;
      for (let j = 0; j < 48; j++) { const sn = Math.sin((j / 48) * TAU); poly.push({ x: c.x + a * Math.cos((j / 48) * TAU), y: c.y + (sn > 0 ? down : a) * sn }); }
    }
    return poly;
  }

  // Phone: the chosen moon's name goes where nothing else is. Boxes round the moon, nearest first, are scored
  // against the planet and its rings, the orbit, the other moons, the line down to the card and the pane's edges.
  dialSpot(m, c, PR, bw, bh) {
    const w = this.w, lo = 46, hi = this.geo.cardTop - 8, ro = this.geo.orbits[0] * this.geo.R;
    const pl = this.planetClear(c, PR), orbit = [];
    for (let j = 0; j < 140; j++) { const a = (j / 140) * TAU; orbit.push(this.project(ro * Math.cos(a), 0, ro * Math.sin(a))); }
    const others = (this.hits || []).filter((h) => Math.hypot(h.x - m.x, h.y - m.y) > 3);
    const tail = [];
    if (m.tail) for (let y = m.y + 12; y < this.geo.cardTop; y += 8) tail.push({ x: m.x, y });
    const inPl = (x, y) => inPoly(pl, x, y);
    const inBox = (x, y, x0, y0, mg) => x > x0 - mg && x < x0 + bw + mg && y > y0 - mg && y < y0 + bh + mg;
    const last = this.dlab && this.dlab.key === m.name ? this.dlab : null;
    let best = null;
    for (let ai = 0; ai < 24; ai++) {
      const th = (ai / 24) * TAU, dx = Math.cos(th), dy = Math.sin(th);
      for (const d of [16, 26, 38, 52, 70]) {
        const x0 = m.x + dx * d + (dx - 1) * bw / 2, y0 = m.y + dy * d + (dy - 1) * bh / 2;
        let cost = d + 5 * Math.abs(dy);
        if (x0 < 12 || x0 + bw > w - 12 || y0 < lo || y0 + bh > hi) cost += 5000 + Math.max(0, 12 - x0) + Math.max(0, x0 + bw - w + 12) + Math.max(0, lo - y0) + Math.max(0, y0 + bh - hi);
        if (polyHitsBox(pl, x0 - 3, y0 - 3, bw + 6, bh + 6)) cost += 4000;
        for (const q of orbit) if (inBox(q.x, q.y, x0, y0, 5)) cost += 300;
        for (const h of others) if (inBox(h.x, h.y, x0, y0, 14)) cost += 3000;
        for (const q of tail) if (inBox(q.x, q.y, x0, y0, 5)) cost += 600;
        // the leader from the moon to the box
        const lx = clamp(m.x, x0, x0 + bw), ly = clamp(m.y, y0, y0 + bh);
        for (let s = 1; s <= 6; s++) {
          const qx = m.x + ((lx - m.x) * s) / 6, qy = m.y + ((ly - m.y) * s) / 6;
          if (Math.hypot(qx - m.x, qy - m.y) > 14 && inPl(qx, qy)) { cost += 150; break; }
          if (others.some((h) => Math.hypot(h.x - qx, h.y - qy) < 10)) { cost += 2500; break; }
        }
        if (last) cost += 0.04 * Math.hypot(last.bx - x0, last.by - y0);
        if (!best || cost < best.cost) best = { x: x0, y: y0, cost };
      }
    }
    return best;
  }

  dialLabel(selP, c, PR, ink, accent, calm, fs) {
    const g = this.ctx, lb = (this.dlab = this.dlab || { a: 0, key: null });
    const now = performance.now(), dt = Math.min(0.1, (now - (lb.t || now)) / 1000);
    lb.t = now;
    const sf = Math.max(9, fs - 3);
    let fk = 1;
    if (selP) {
      fk = selP.fk;
      g.font = `${fs}px ${SERIF}`; const nw = g.measureText(upper(selP.name)).width;
      g.font = `${sf}px ${SERIF}`; const sw = selP.sub ? g.measureText(selP.sub).width : 0;
      const bw = Math.max(nw, sw), bh = fs + (selP.sub ? sf + 6 : 0);
      const spot = this.dialSpot(selP, c, PR, bw, bh);
      if (lb.key !== selP.name) {
        // A different moon: the old name fades, then the new one comes up where it belongs.
        if (lb.a > 0.03 && !this.reduced) lb.a = Math.max(0, lb.a - dt * 7);
        else Object.assign(lb, { key: selP.name, name: selP.name, sub: selP.sub, lit: !!selP.lit, mx: selP.x, my: selP.y, bx: spot.x, by: spot.y, bw, bh, a: this.reduced ? 1 : 0.001 });
      } else {
        lb.a = this.reduced ? 1 : Math.min(1, lb.a + dt * 4);
        const k = this.reduced ? 1 : 1 - Math.pow(0.0005, dt);
        lb.bx += (spot.x - lb.bx) * k; lb.by += (spot.y - lb.by) * k;
        Object.assign(lb, { mx: selP.x, my: selP.y, bw, bh, sub: selP.sub });
      }
      this.dlabCost = spot.cost;
    } else if (lb.a > 0) lb.a = this.reduced ? 0 : Math.max(0, lb.a - dt * 7);
    const al = calm * lb.a * fk * fk * fk;
    if (al < 0.01 || !lb.key) return;
    const dx = lb.bx + lb.bw / 2 - lb.mx, left = dx > 14, right = dx < -14;
    const tx = left ? lb.bx : right ? lb.bx + lb.bw : lb.bx + lb.bw / 2;
    g.globalAlpha = al;
    const nx = clamp(lb.mx, lb.bx - 3, lb.bx + lb.bw + 3), ny = clamp(lb.my, lb.by - 3, lb.by + lb.bh + 3), ll = Math.hypot(nx - lb.mx, ny - lb.my);
    if (ll > 16) {
      g.strokeStyle = `rgba(${accent},0.4)`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(lb.mx + ((nx - lb.mx) / ll) * 10, lb.my + ((ny - lb.my) / ll) * 10); g.lineTo(nx - ((nx - lb.mx) / ll) * 3, ny - ((ny - lb.my) / ll) * 3); g.stroke();
    }
    g.textAlign = left ? "left" : right ? "right" : "center";
    g.font = `${fs}px ${SERIF}`;
    g.fillStyle = lb.lit ? `rgb(${accent})` : `rgba(${ink},0.92)`;
    g.fillText(upper(lb.name), tx, lb.by + fs / 2);
    if (lb.sub) {
      g.font = `${sf}px ${SERIF}`;
      g.fillStyle = `rgba(${ink},0.5)`;
      g.fillText(lb.sub, tx, lb.by + fs + 6 + sf / 2);
    }
    g.globalAlpha = 1; g.textAlign = "left";
    this.dlabRect = [lb.bx, lb.by, lb.bw, lb.bh];
  }

  renderDial(sel) {
    this.dialShown = sel;
    const box = this.dialEl, t = this.today;
    const s = sel < 0 ? (t && { label: "Today", summary: t.long, meta: t.meta || "", recent: t.recent || [], wide: t.wide || [] }) : this.sections[sel];
    box.replaceChildren();
    box.classList.toggle("is-empty", sel < 0 && !this.sections.length);
    if (!s) return;
    const num = (String(s.folder).match(/^(\d+)/) || [])[1];
    if (num) el(box, "div", "ecl-dial-num", num);
    // An empty vault with no note for today: the chip above already says "Today", so the heading is the date, and one line says there is no note (ON5 U3).
    const bare = sel < 0 && !this.sections.length && !(s.recent || []).length && !!s.summary;
    const day = sel < 0 && !!s.summary; // Today's card: the heading is the weekday (AA6, AA10), the header above already carries the full date, so no lede repeats it
    el(box, "div", bare ? "ecl-dial-title is-date" : "ecl-dial-title", day ? String(s.summary).split(",")[0] : s.label);
    const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
    const lede = s.summary && !same(s.summary, s.label) && !day ? s.summary : ""; // (ON2 P4: no italic line that just repeats the title)
    if (lede && !bare) el(box, "div", "ecl-dial-lede", lede);
    if (!bare) el(box, "div", "ecl-dial-meta", sectionMeta(s));
    const rows = el(box, "div", "ecl-dial-rows");
    const lone = sel < 0 && !this.sections.length; // an empty vault's card also holds the hint and button, so it lists one note
    const recent = ((lone ? s.recent : s.wide && s.wide.length ? s.wide : s.recent) || []).filter((n) => sel < 0 || !same(n.title, s.label)); // the folder's own note is the title already
    const rowEls = [];
    for (const note of recent.slice(0, lone ? 1 : 6)) { // up to six; the ones that do not fit the card are dropped below
      const row = el(rows, "div", note.when ? "ecl-dial-row" : "ecl-dial-row is-bare");
      if (note.when) el(row, "span", "ecl-dial-when", note.when);
      el(row, "span", "ecl-dial-what", note.title);
      row.addEventListener("click", (ev) => { ev.stopPropagation(); if (!this.suppressClick) this.onOpenNote(note.path); });
      rowEls.push(row);
    }
    if (!recent.length) el(rows, "div", "ecl-dial-empty", bare ? "No note yet" : "Nothing here yet");
    // The count above lists every note; say how many the rows leave out (ON2). The card shows as many rows as fit its height (ON7 polish), at least two.
    const sayMore = () => {
      const old = rows.querySelector(".ecl-dial-more"); if (old) old.remove();
      // The way to the full page is always spelled out on a folder's card (R2.7): "View all N notes" when rows are left out, "Open <folder>" when they all fit.
      if (sel >= 0) el(rows, "div", "ecl-dial-more", (s.count || 0) - rowEls.length > 0 ? `View all ${s.count} notes ›` : `Open ${s.label} ›`);
    };
    sayMore();
    if (!lone && box.clientHeight > 60) {
      // The card's own height, and the floating toolbar (--ecl-nav-clear) that sits over the pane's foot: rows stop above whichever comes first.
      const probe = document.body.createDiv(); probe.addClass("ecl-probe");
      const navClear = probe.offsetHeight; probe.remove();
      const room = Math.min(box.getBoundingClientRect().top + box.clientHeight - 14, window.innerHeight - navClear - 12) - 4;
      const over = () => { const last = rows.lastElementChild; return !!last && last.getBoundingClientRect().bottom - 5 > room; }; // (-5: the card's children start the fade-in 5 px low)
      while (rowEls.length > (lede ? 1 : 2) && over()) { rowEls.pop().remove(); sayMore(); }
    }
    // Empty vault on the phone: say what the moons will be and keep the one next step in reach (a real button, same action as the Today ring).
    if (sel < 0 && !this.sections.length) {
      const b = el(box, "button", "ecl-dial-open", "Open Today");
      b.type = "button";
      b.addEventListener("click", (ev) => { ev.stopPropagation(); if (!this.suppressClick) this.open(this.dialSel()); });
      const nf = el(box, "button", "ecl-dial-new", "New folder");
      nf.type = "button";
      nf.addEventListener("click", (ev) => { ev.stopPropagation(); if (!this.suppressClick) this.onNewFolder(); });
      const hint = el(box, "div", "ecl-dial-hint"); // below both actions, so it never splits them (ON4 R3)
      el(hint, "span", "", "Create a folder, then add a note inside it.");
      el(hint, "span", "", "Folders appear here as moons once they hold a note.");
    }
    box.classList.remove("is-in");
    void box.offsetWidth; // restart the fade
    box.classList.add("is-in");
  }

  // ---- interaction ----------------------------------------------------
  hitTest(x, y) {
    let best = -1, bd = 22;
    for (const h of this.hits || []) {
      const d = Math.hypot(x - h.x, y - h.y);
      if (d < bd) { bd = d; best = h.i; }
      const [bx, by, bw, bh] = h.box;
      if (best < 0 && x >= bx && x <= bx + bw && y >= by && y <= by + bh) best = h.i;
    }
    // Hold on to the hovered dot until the pointer is clearly away from it,
    // so neighbours drifting past and the gap to the card do not flicker.
    if (this.hover >= 0 && best !== this.hover) {
      const h = (this.hits || []).find((x2) => x2.i === this.hover);
      if (h) {
        const [bx, by, bw, bh] = h.box;
        const inBox = x >= bx - 10 && x <= bx + bw + 10 && y >= by - 10 && y <= by + bh + 10;
        if (Math.hypot(x - h.x, y - h.y) < 40 || inBox) best = this.hover;
      }
    }
    return best;
  }

  onPlanet(x, y) {
    const c = this.project(0, 0, 0);
    return Math.hypot(x - c.x, y - c.y) < this.planetR();
  }

  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  pointerMove(e) {
    const { x, y } = this.local(e);
    // The scene leans toward the pointer; not on the phone, where it is a finger.
    if (!this.dialMode) { this.mouse.nx = x / this.w - 0.5; this.mouse.ny = y / this.h - 0.5; }
    if (this.k !== 1 || this.flight) return; // flying: hands off
    const d = this.drag;
    if (d) {
      const dx = x - d.x, dy = y - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 5) {
        d.moved = true;
        // On the phone the first movement decides: sideways turns the dial,
        // up lifts the card.
        if (this.dialMode) d.axis = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
        if (d.card) try { this.dialEl.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ }
        this.pinned = -1; this.setHover(-1); this.overPlanet = false;
        setCursor(this.canvas, "grabbing");
      }
      if (d.moved && d.axis === "y") {
        // The card follows the finger up; pulled down, it barely gives.
        const now = performance.now(), lift = dy < 0 ? dy : dy * 0.15;
        d.vy = d.vy * 0.6 + ((lift - d.lift) / Math.max(0.008, (now - d.lt) / 1000)) * 0.4;
        d.lt = now; d.lift = lift;
        this.liftCard(lift);
        return;
      }
      if (d.moved) {
        // The dial follows the finger: the front moon stays under it.
        const now = performance.now(), yaw = this.dialMode ? d.yaw + dx / (this.geo.orbits[0] * this.geo.R) : d.yaw + dx * DRAG;
        const dt = Math.max(0.008, (now - d.lt) / 1000);
        d.vel = d.vel * 0.6 + ((yaw - this.yaw) / dt) * 0.4;
        d.lt = now;
        this.yaw = yaw;
        if (!this.dialMode) this.tilt = clamp(d.tilt + dy * DRAG * 0.67, 0.06, 1.15);
        if (this.reduced) this.draw();
      }
      return;
    }
    if (this.dialMode) {
      const i = this.hitTest(x, y);
      this.overPlanet = i < 0 && this.onPlanet(x, y);
      this.overDate = i < 0 && !this.overPlanet && this.onDate(x, y);
      setCursor(this.canvas, i >= 0 || this.overPlanet || this.overDate ? "pointer" : "grab");
      return;
    }
    if (e.pointerType === "touch" || this.pinned >= 0) return;
    const i = this.hitTest(x, y);
    this.setHover(i);
    this.overPlanet = i < 0 && this.onPlanet(x, y);
    this.overDate = i < 0 && !this.overPlanet && this.onDate(x, y);
    this.overMore = i < 0 && !this.overPlanet && this.onMoreHint(x, y);
    setCursor(this.canvas, i >= 0 || this.overPlanet || this.overDate || this.overMore ? "pointer" : "grab");
    if (this.reduced) this.draw();
  }

  onDate(x, y) {
    const r = this.footRect;
    return !!r && x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
  }
  onMoreHint(x, y) {
    const r = this.moreRect;
    return !this.dialMode && !!r && x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
  }

  // Press starts a possible drag; a press that does not move is a click.
  pointerDown(e, card) {
    if (e.button > 0 || this.k !== 1 || this.flight) return;
    const { x, y } = this.local(e);
    const d = (this.drag = { x, y, yaw: this.yaw, tilt: this.tilt, moved: false, vel: 0, lt: performance.now(), card: !!card, lift: 0, vy: 0 });
    this.yawVel = 0; this.dialTarget = null;
    // A press on the card is only captured once it moves, so a plain tap
    // still clicks the card or one of its notes.
    if (!card) try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ }
  }

  pointerUp(e) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    try { (d.card ? this.dialEl : this.canvas).releasePointerCapture(e.pointerId); } catch (_) { /* not captured */ }
    if (d.card && !d.moved) return; // a tap on the card: its own click handles it
    if (d.moved) { this.suppressClick = true; window.setTimeout(() => (this.suppressClick = false), 0); }
    if (d.moved && d.axis === "y") {
      // Let go high enough, or flick up, and the section opens.
      const fling = performance.now() - d.lt < 80 && d.vy < -700;
      if (e.type !== "pointercancel" && (d.lift < -70 || fling)) this.liftOpen();
      else this.liftCard(0, true);
      return;
    }
    if (d.moved && this.dialMode) {
      // A flick carries on round; then it settles on a section.
      const step = this.dialStep(), v = performance.now() - d.lt < 80 ? clamp(d.vel, -14, 14) : 0;
      this.dialTarget = Math.round((this.yaw + v * 0.12) / step) * step;
      setCursor(this.canvas, "grab");
      this.start();
      if (this.reduced) { this.step(0); this.draw(); }
      return;
    }
    if (d.moved) {
      // Only coast if the pointer was still moving when it let go.
      this.yawVel = performance.now() - d.lt < 80 ? clamp(d.vel, -3.4, 3.4) : 0;
      setCursor(this.canvas, "grab");
      return;
    }
    if (e.type === "pointercancel") return;
    this.click(d.x, d.y, e.pointerType);
  }

  // Phone: the section card, lifted by a swipe up. ease springs it there.
  liftCard(lift, ease) {
    const box = this.dialEl, k = clamp(-lift / 180, 0, 1);
    box.classList.add("is-lifted"); box.classList.toggle("is-eased", !!ease); // transitions live in the stylesheet
    box.style.transform = lift ? `translateY(${Math.round(lift)}px) scale(${1 + 0.025 * k})` : "";
  }

  // Swiped up far enough: the card carries on up and fades while the camera
  // flies into the front moon and its page comes up.
  liftOpen() {
    this.liftCard(-Math.min(260, this.geo.cardTop * 0.6), true);
    this.open(this.dialSel());
  }

  click(x, y, type) {
    if (this.dialMode) {
      // Planet: home. Pill: next world. A moon: the front one opens, any
      // other turns the dial to it.
      if (this.onPlanet(x, y)) { this.onOpenHome(this.project(0, 0, 0)); return; }
      if (this.onDate(x, y)) { this.nextWorld(); return; }
      const i = this.hitTest(x, y);
      if (i >= 0) {
        if (i === this.sections.length) { if (this.dialToday) this.open(i); else this.selectDial(-1); }
        else if (!this.dialToday && i === this.dialIndex()) this.open(i);
        else this.selectDial(i);
      }
      return;
    }
    const i = this.hitTest(x, y);
    if (i < 0 && this.onPlanet(x, y)) { this.pinned = -1; this.setHover(-1); this.onOpenHome(this.project(0, 0, 0)); return; }
    if (i < 0 && this.onDate(x, y)) { this.nextWorld(); return; }
    if (i < 0 && this.onMoreHint(x, y)) { this.onMore(); return; }
    if (type === "touch") {
      if (i >= 0 && i === this.pinned) { this.open(i); return; }
      this.pinned = i;
      this.setHover(i);
      return;
    }
    this.pinned = -1;
    if (i >= 0) { this.open(i); this.setHover(-1); }
  }

  setHover(i) {
    if (i === this.hover) return;
    this.hover = i;
    if (i < 0) { this.card.classList.remove("is-on"); this.cardRect = null; }
    else { this.renderCard(); this.card.classList.add("is-on"); }
    if (this.reduced) this.draw();
  }

  renderCard() {
    const s = this.item(this.hover);
    if (!s) return;
    this.card.replaceChildren();
    this.card.classList.toggle("is-today", !!s.isToday);
    el(this.card, "div", "ecl-card-title", s.label);
    if ((s.subs || []).length) el(this.card, "div", "ecl-card-subs", s.subs.map((n) => n.replace(/^\d+\s+/, "")).join(", "));
    const list = el(this.card, "div", "ecl-card-notes");
    s.recent.forEach((n) => {
      const a = el(list, "a", "ecl-card-note", n.title);
      a.addEventListener("click", (ev) => { ev.preventDefault(); this.onOpenNote(n.path); });
    });
    if (!s.recent.length && !s.isToday) el(list, "span", "ecl-card-empty", "Nothing here yet");
    el(this.card, "div", "ecl-card-meta", sectionMeta(s));
  }

  placeCard() {
    const h = (this.hits || []).find((x) => x.i === this.hover);
    if (!h) return;
    const cw = this.card.offsetWidth, ch = this.card.offsetHeight;
    // Past the dot's label on its outer side, vertically centred on it, so
    // the card never sits on the dot itself.
    const c = this.project(0, 0, 0);
    const [bx, , bw] = h.box;
    let x = h.x < c.x ? Math.min(bx, h.x - 14) - cw - 10 : Math.max(bx + bw, h.x + 14) + 10;
    let y = clamp(h.y - ch / 2, 8, this.h - ch - 8);
    x = clamp(x, 8, this.w - cw - 8);
    this.card.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    this.cardRect = [x - 4, y - 4, cw + 8, ch + 8];
  }
}

// "Set a place for sunrise and sunset": a link that opens Ecliptic's settings (where the place is chosen), not plain text (R2.8, F1 polish 9).
function setPlaceLink(parent, plugin) {
  const a = parent.createEl("a", { cls: "ecl-t-setplace", text: "Set a place for sunrise and sunset", attr: { role: "button", tabindex: "0" } });
  const go = () => { try { plugin.app.setting.open(); plugin.app.setting.openTabById(plugin.manifest.id); } catch (e) { new obsidian.Notice("Open Settings, then Ecliptic, to set a place"); } };
  a.onclick = (ev) => { ev.preventDefault(); go(); };
  a.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } };
  return a;
}
// The meta line under a folder's name on the phone dial and the Home hover card: the same live fact as the moon's label on Home
// (overdue, next due, shift, edited), then the note count. Today's card has no live line and keeps its own meta.
function sectionMeta(s) {
  return s.live && s.meta ? `${s.live}  ·  ${s.meta}` : s.live || s.meta || "";
}
function palette(w) {
  const arr = (s) => s.split(",").map(Number);
  return { bg: arr(w.bg), ink: arr(w.ink), accent: arr(w.accent) };
}
function norm(v) { const l = Math.hypot(...v); return v.map((x) => x / l); }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function shortDate(d) { return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }); }
function upper(s) { return String(s).toUpperCase(); }
function inPoly(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}
// Does a polygon touch the box (x0, y0, w, h)?
function polyHitsBox(poly, x0, y0, w, h) {
  if (poly.some((p) => p.x >= x0 && p.x <= x0 + w && p.y >= y0 && p.y <= y0 + h)) return true;
  for (let x = x0; x <= x0 + w + 9; x += 9) for (let y = y0; y <= y0 + h + 9; y += 9) if (inPoly(poly, Math.min(x, x0 + w), Math.min(y, y0 + h))) return true;
  return false;
}
function el(parent, tag, cls, text) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
}

// ---- Obsidian glue ----------------------------------------------------
// Accent variables the chosen world re-tints, on body so they beat the theme.
const ACCENT_VARS = ["--color-accent", "--interactive-accent", "--text-accent", "--link-color", "--link-external-color",
  "--tag-color", "--checkbox-color", "--nav-item-color-active"];
const ACCENT_SOFT_VARS = ["--text-selection", "--text-highlight-bg"];

// The tokens the whole-app theme publishes on body (as --ecl-t-*); styles.css maps them onto Obsidian's variables.
const APP_TOKENS = ["ground", "ink", "signal", "signal-rgb", "warn"];
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// A stippled world with moons on a tilted orbit, drawn into a canvas for a
// hero. The moons themselves are buttons over the canvas; this returns
// where they go.
// Long stipple draws run as generators so a page can build them in slices (sliceRun) while an animation plays;
// the plain functions just run them to the end.
function sliceRun(gen, done, budget = 6) {
  let dead = false, raf = 0;
  const tick = () => {
    if (dead) return;
    const t = performance.now();
    let r;
    do { r = gen.next(); } while (!r.done && performance.now() - t < budget);
    if (r.done) { if (done) done(); } else raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { cancel() { dead = true; cancelAnimationFrame(raf); } };
}
function drawWorldArt(canvas, opts) { const out = {}; for (const _ of worldArtGen(canvas, opts, out)); return out.items; }
function* worldArtGen(canvas, opts, out) {
  const { w, h, ink, accent, tone, surface, moons, seed } = opts;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Compact (stacked) layouts push the planet right and bunch the moons so their labels fit on the left.
  const compact = !!opts.compact;
  const R = Math.min(w * (compact ? 0.26 : 0.36), h * 0.36), cx = w * (compact ? 0.76 : 0.62), cy = h * 0.46;
  const tilt = 0.3, roll = -0.16;
  const proj = (x, y, z) => {
    const up = y * Math.cos(tilt) - z * Math.sin(tilt), d = y * Math.sin(tilt) + z * Math.cos(tilt);
    return { x: cx + x * Math.cos(roll) - up * Math.sin(roll), y: cy - (x * Math.sin(roll) + up * Math.cos(roll)), z: d };
  };
  const rand = rng(seed || 5);
  const hole = surface === "blackhole", star = surface === "star";
  const surf = hole ? null : makeSurface({ surface, ink });
  const L = norm([-0.8, 0.45, 0.4]);
  const body = tone ? mixc(rgb(ink), rgb(tone), 0.45).map(Math.round).join(",") : ink;
  const Rb = star ? R * 0.92 : R; // a star's disc a little smaller, so its dust fits
  const ring = (r, a) => {
    g.strokeStyle = `rgba(${ink},${a})`; g.lineWidth = 0.7; g.beginPath();
    for (let j = 0; j <= 240; j++) { const t = (j / 240) * TAU; const p = proj(r * Math.cos(t), 0, r * Math.sin(t)); j ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }
    g.stroke();
  };
  // Moons sit around the far-left point of their orbits, clear of the disc.
  const n = Math.min(7, moons.length);
  const placed = moons.slice(0, n).map((m, i) => {
    const k = compact ? 1.35 + i * 0.13 : 1.4 + i * 0.22, a = Math.PI + (i - (n - 1) / 2) * (compact ? 0.24 : 0.28);
    return { ...m, k, p: proj(R * k * Math.cos(a), 0, R * k * Math.sin(a)) };
  });
  out.items = placed.map((m) => ({ ...m, x: m.p.x, y: m.p.y }));
  yield;
  placed.forEach((m) => ring(R * m.k, 0.07));
  if (hole) {
    // A shadow, a thin bright ring, and gas whose far half is lensed up over the top.
    const rs = R * 0.38, cr = Math.cos(roll), sr = Math.sin(roll), it = Math.sin(tilt);
    const sig = rgb(accent), hot = mixc(sig, [255, 246, 255], 0.6), cold = mixc(sig, [30, 14, 70], 0.45);
    g.fillStyle = "rgb(2,2,4)"; g.beginPath(); g.arc(cx, cy, rs, 0, TAU); g.fill();
    const count = Math.round(rs * rs * 45);
    for (let i = 0; i < count; i++) {
      if ((i & 255) === 255) yield;
      const r = 1.22 + 1.88 * Math.pow(rand(), 1.5), th = rand() * TAU, c = Math.cos(th), s = Math.sin(th);
      const d = fbm([r * c * 0.7, r * 0.3, r * s * 0.7], 2.4);
      if (rand() > clamp((d - 0.28) / 0.4, 0.08, 1) * (0.55 + 0.45 * Math.pow(1.22 / r, 0.6))) continue;
      const ups = s < 0 ? -r * s : -r * s * it, x = r * c, k = clamp((r - 1.22) / 1.88, 0, 1);
      const col = mixc(hot, cold, Math.pow(k, 0.8)).map(Math.round).join(",");
      g.fillStyle = `rgba(${col},${0.16 + 0.5 * clamp(clamp(0.35 + 0.8 * d, 0, 1) * (1 + 0.5 * c) * (1.15 - 0.85 * Math.sqrt(k)), 0, 1)})`;
      g.fillRect(cx + (x * cr - ups * sr) * rs - 0.6, cy - (x * sr + ups * cr) * rs - 0.6, 1.2, 1.2);
    }
    for (let j = 0; j < 90; j++) {
      const a = (j / 90) * TAU, beam = 0.5 + 0.5 * Math.cos(a - roll);
      g.strokeStyle = `rgba(${ink},${0.38 + 0.57 * beam})`; g.lineWidth = 1;
      g.beginPath(); g.arc(cx, cy, rs * 1.004, a, a + (1.3 / 90) * TAU); g.stroke();
    }
  } else {
    const count = Math.round(Rb * Rb * (star ? 7 : 3));
    for (let i = 0; i < count; i++) {
      if ((i & 511) === 511) yield;
      const y = rand() * 2 - 1, th = rand() * TAU, rr = Math.sqrt(1 - y * y);
      const v = [rr * Math.cos(th), y, rr * Math.sin(th)];
      const p = proj(v[0] * Rb, v[1] * Rb, v[2] * Rb);
      if (p.z <= 0) continue;
      if (star) {
        // Self-lit: thinner and redder toward the limb, with big dark-laned cells.
        const s = surf(v), depth = p.z / Rb, keep = Math.sqrt(depth) * s[0], f = 0.55 + 0.45 * depth;
        if (rand() > keep) continue;
        g.fillStyle = `rgba(${Math.round(s[1] * f)},${Math.round(s[2] * f)},${Math.round(s[3] * f)},${0.3 + 0.6 * Math.min(1, keep)})`;
      } else {
        const keep = (0.003 + Math.pow(Math.max(0, dot(v, L)), 1.6)) * surf(v)[0];
        if (rand() > keep) continue;
        g.fillStyle = `rgba(${body},${0.3 + 0.55 * Math.min(1, keep)})`;
      }
      g.fillRect(p.x - 0.6, p.y - 0.6, 1.2, 1.2);
    }
    if (star) {
      for (let i = 0; i < Math.round(Rb * Rb * 1.2); i++) {
        if ((i & 255) === 255) yield;
        const y = rand() * 2 - 1, th = rand() * TAU, rr = Math.sqrt(1 - y * y), s = 1.28 + rand() * 0.67;
        const v = [rr * Math.cos(th), y, rr * Math.sin(th)];
        if (noise3(v[0] * 2.2 + s * 3, v[1] * 2.2, v[2] * 2.2) < 0.5) continue;
        const p = proj(v[0] * Rb * s, v[1] * Rb * s, v[2] * Rb * s);
        if (Math.hypot(p.x - cx, p.y - cy) < Rb * 1.05) continue;
        g.fillStyle = `rgba(${accent},${0.06 + 0.1 * rand()})`;
        g.fillRect(p.x - 0.5, p.y - 0.5, 1, 1);
      }
    } else {
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = `rgba(${accent},${0.12 * Math.pow(1 - k / 7, 2)})`; g.lineWidth = 1;
        g.beginPath(); g.arc(cx, cy, R + 1 + k * 1.6, Math.PI * 0.75, Math.PI * 1.75); g.stroke();
      }
    }
  }
}
// ---- Folder objects: a folder's moon (and below, its star or cloud) ------
// Drawn small on home and beside the title on the folder page (renderFolder).

// A full moon lit from the upper left, with soft maria and a few craters placed by the folder's seed.
// o: cx, cy, R, L (light vector, x right, y down, z toward the viewer), seed, ink [r,g,b], W, H (skip dots off the canvas),
// fade(x) -> 0..1 (how much of a dot survives at x), ground [r,g,b] (fills the disc so stars behind it never show).
function* folderMoonGen(ctx, o) {
  const R = o.R, cx = o.cx, cy = o.cy, rnd = todayRng(o.seed || 11), ink = o.ink.join(",");
  const ln = Math.hypot(o.L[0], o.L[1], o.L[2]), L = o.L.map((v) => v / ln), fade = o.fade || (() => 1);
  const W = o.W || 1e9, H = o.H || 1e9;
  const cr = [];
  for (let k = 0; k < 16; k++) { const a = rnd() * TAU, u = Math.sqrt(rnd()) * 0.85; cr.push([Math.cos(a) * u, Math.sin(a) * u, 0.04 + Math.pow(rnd(), 2) * 0.16]); }
  if (o.ground) {
    ctx.fillStyle = `rgb(${o.ground.join(",")})`;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  }
  // A faint glow just outside the limb, in the signal colour.
  if (o.accent) {
    const g = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22);
    g.addColorStop(0, `rgba(${o.accent},${o.glow || 0.05})`); g.addColorStop(1, `rgba(${o.accent},0)`);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.min(W, cx + R * 1.3), Math.min(H, cy + R * 1.3)); ctx.arc(cx, cy, R, 0, TAU, true); ctx.clip("evenodd");
    ctx.fillStyle = g; ctx.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6); ctx.restore();
  }
  const N = Math.round(R * R * 0.25 * (o.density || 1));
  let placed = 0, tries = 0;
  while (placed < N && tries < N * 80) {
    if ((++tries & 2047) === 2047) yield;
    const px = rnd() * 2 - 1, py = rnd() * 2 - 1, d2 = px * px + py * py;
    if (d2 > 1) continue;
    const pz = Math.sqrt(1 - d2), b = Math.max(0, px * L[0] + py * L[1] + pz * L[2]);
    const mar = 0.5 + 0.5 * Math.sin(px * 3.1 + 1.3) * Math.cos(py * 2.6 - 0.4) + 0.25 * Math.sin(px * 7 + py * 5);
    let m = 1 - 0.5 * Math.max(0, Math.min(1, mar));
    for (const c of cr) { const dd = Math.hypot(px - c[0], py - c[1]) / c[2]; if (dd < 1) m *= dd < 0.75 ? 0.55 : 1.35; }
    if (rnd() > 0.02 + 0.98 * Math.pow(b, 1.5) * m) continue;
    placed++;
    const x = cx + px * R, y = cy + py * R, rr = (o.dot || 0.6) * (0.7 + 0.55 * rnd());
    if (x < -2 || y < -2 || x > W + 2 || y > H + 2) continue;
    const f = fade(x);
    if (f < 0.02) continue;
    ctx.fillStyle = `rgba(${ink},${((0.15 + 0.85 * b) * f).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
  }
  // The limb: a hairline, so the night side still reads as a disc.
  ctx.strokeStyle = `rgba(${ink},0.08)`; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
}

// ---- Folder objects on the non-planet worlds --------------------------
// Moons make no sense round a black hole or a red supergiant, so there each
// folder is its own kind of object, drawn by the same code small (home) and
// huge (folder page), seeded by the folder path so the shape survives the flight.
// Black hole: a star in orbit, self-lit, tint and grain from the seed.
// Betelgeuse: a cloud of dust the star has thrown off, lit on the side facing it.
// The black hole's folders were glowing stars; reviewers read them as bright points, so they are stippled bodies like every other world's moons.
const objectKind = (world) => (world && world.kind === "star" ? "cloud" : "moon");
function valueNoise(seed) {
  const r = todayRng(seed), G = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) G[i] = r();
  const g = (i, j) => G[((i * 73856093) ^ (j * 19349663)) & 4095], sm = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j), a = g(i, j), b = g(i + 1, j), c = g(i, j + 1), d = g(i + 1, j + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  return (x, y) => n(x, y) * 0.6 + n(x * 2.1 + 7, y * 2.1 + 3) * 0.4;
}
const STAR_TINTS = [[255, 252, 255], [238, 228, 255], [255, 240, 248], [230, 234, 255], [248, 236, 255]];
// o: cx, cy, R, seed, ink [r,g,b], accent "r,g,b", ground [r,g,b], W, H, fade(x), dot, density, halo (0 = none).
function* orbitStarGen(ctx, o) {
  const { cx, cy, R } = o, rnd = todayRng(o.seed || 5), N = valueNoise((o.seed || 5) + 11), T = STAR_TINTS[(o.seed || 0) % STAR_TINTS.length];
  const W = o.W || 1e9, H = o.H || 1e9, fade = o.fade || (() => 1), acc = o.accent || "190,150,235";
  const grad = (r0, r1, stops) => { const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1); for (const s of stops) g.addColorStop(s[0], s[1]); return g; };
  // A star, not a lit disc: a hot near-white core, brightness falling steeply to a soft corona, no hard limb.
  const GR = R * 2.6;
  if (o.halo !== 0) { ctx.fillStyle = grad(R * 0.3, GR, [[0, `rgba(${acc},0.3)`], [0.35, `rgba(${acc},0.1)`], [1, `rgba(${acc},0)`]]); ctx.fillRect(cx - GR, cy - GR, GR * 2, GR * 2); }
  // A body with a soft edge, so whatever is behind the star (the hole's ring) passes behind its core.
  const base = o.ground || [5, 5, 6];
  ctx.fillStyle = grad(0, R * 0.95, [[0, `rgb(${base})`], [0.5, `rgb(${base})`], [1, `rgba(${base},0)`]]);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const n = Math.round(R * R * 0.9 * (o.density || 1));
  for (let i = 0, tries = 0; i < n && tries < n * 8; tries++) {
    if ((tries & 2047) === 2047) yield;
    const px = rnd() * 2 - 1, py = rnd() * 2 - 1, d2 = px * px + py * py;
    if (d2 > 1) continue;
    const gn = N(px * 2.6 + (o.seed || 0), py * 2.6), p = Math.pow(1 - d2, 3) * (0.8 + 0.4 * gn);
    if (rnd() > 0.03 + p) continue;
    i++;
    const x = cx + px * R, y = cy + py * R;
    if (x < -2 || y < -2 || x > W + 2 || y > H + 2) continue;
    const f = fade(x); if (f < 0.02) continue;
    const hot = Math.pow(1 - d2, 1.6), q = (c, k) => Math.round(c + (255 - c) * hot * k);
    ctx.fillStyle = `rgba(${q(T[0] - 40, 1)},${q(T[1] - 90, 1)},${q(T[2], 1)},${((0.06 + 0.5 * hot) * f).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x, y, (o.dot || 0.6) * (0.55 + 0.8 * rnd()), 0, TAU); ctx.fill();
  }
  // The core and the glow round it, added to the light.
  ctx.fillStyle = grad(0, R * 1.05, [[0, "rgba(255,254,255,0.95)"], [0.16, "rgba(255,252,255,0.8)"], [0.4, `rgba(${T.join(",")},0.28)`], [0.75, `rgba(${acc},0.1)`], [1, `rgba(${acc},0)`]]);
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, TAU); ctx.fill();
  ctx.restore();
}
// A dust cloud: a few seeded lobes, a soft knot, two curling filaments. S is the scale (about the cloud's half-length / 1.5).
// o: cx, cy, S, seed, lx, ly (toward the star), accent "r,g,b", ink [r,g,b], W, H, fade, n, gain, dot.
function cloudShape(seed) {
  const r = todayRng(seed * 7 + 3), L = [], k = 3 + Math.floor(r() * 3);
  for (let i = 0; i < k; i++) L.push({ x: i ? (r() - 0.5) * 1.5 : (r() - 0.5) * 0.4, y: i ? (r() - 0.5) * 0.6 : 0, s: i ? 0.18 + r() * 0.24 : 0.16, w: i ? 0.6 + r() * 0.6 : 1 });
  const F = [0, 1].map((i) => ({ a: (r() - 0.5) * 2.6 + (i ? Math.PI : 0), bend: (r() - 0.5) * 1.4, len: 0.7 + r() * 0.5 }));
  return { L, F, ang: (r() - 0.5) * 1.6 };
}
function* dustCloudGen(ctx, o) {
  const sh = cloudShape(o.seed || 1), rnd = todayRng((o.seed || 1) + 101), ca = Math.cos(sh.ang), sa = Math.sin(sh.ang), S = o.S;
  const W = o.W || 1e9, H = o.H || 1e9, fade = o.fade || (() => 1), gain = o.gain || 1;
  const acc = (o.accent || "212,100,74").split(",").map(Number), ink = o.ink || [240, 227, 216];
  const dim = mixc(acc, ink, 0.25).map(Math.round), lit = mixc(acc, [255, 214, 180], 0.55).map(Math.round), cream = mixc(ink, [255, 240, 225], 0.5).map(Math.round);
  const ld = Math.hypot(o.lx || -1, o.ly || -1) || 1, lx = (o.lx || -1) / ld, ly = (o.ly || -1) / ld;
  const Wsum = sh.L.reduce((a, l) => a + l.w, 0);
  const put = (u, v, base, knot) => {
    const X = o.cx + (u * ca - v * sa) * S, Y = o.cy + (u * sa + v * ca) * S;
    if (X < -2 || Y < -2 || X > W + 2 || Y > H + 2) return;
    const f = fade(X); if (f < 0.02) return;
    const l = Math.max(0, (u * ca - v * sa) * lx + (u * sa + v * ca) * ly), sh2 = Math.min(1, 0.45 + l * 1.1);
    const c = knot ? cream : l > 0.45 && rnd() < l * 0.6 ? lit : dim;
    ctx.fillStyle = `rgba(${c.join(",")},${Math.min(1, base * sh2 * gain * f).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(X, Y, (o.dot || 0.3) + rnd() * (o.dv || 0.5), 0, TAU); ctx.fill();
  };
  const n = o.n || 600;
  if (o.round) {
    // A compact puff for the small home bodies: a stippled round body with a soft mottled edge and a bright core, so it reads as a body and not a streak.
    const rad = 0.55, ph = sh.ang * 5;
    for (let i = 0; i < n; i++) {
      if ((i & 2047) === 2047) yield;
      const t = rnd() * TAU, r = rad * Math.sqrt(rnd()), m = 0.62 + 0.38 * Math.sin(t * 3 + ph + r * 7) * Math.cos(t * 2 - r * 5 + ph);
      if (r > rad * (0.9 + 0.1 * m)) continue;
      // Shaded like the other bodies: dots kept by probability from the light, so the far side thins out.
      const wx = Math.cos(t) * r, wy = Math.sin(t) * r, lw = (wx * lx + wy * ly) / rad, k = 0.5 + 0.5 * lw;
      if (rnd() > (0.16 + 0.84 * Math.pow(k, 1.3)) * (0.7 + 0.3 * m)) continue;
      put(wx * ca + wy * sa, -wx * sa + wy * ca, 0.4 + 0.45 * k + rnd() * 0.15, k > 0.75 && r < rad * 0.5 && rnd() < 0.12);
    }
    const g = ctx.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, S * 0.9);
    g.addColorStop(0, `rgba(${acc.join(",")},${(o.glow || 0.1) * 0.8})`); g.addColorStop(1, `rgba(${acc.join(",")},0)`);
    ctx.fillStyle = g; ctx.fillRect(o.cx - S, o.cy - S, S * 2, S * 2);
    return;
  }
  for (let i = 0; i < n; i++) {
    if ((i & 2047) === 2047) yield;
    let q = rnd() * Wsum, l = sh.L[0];
    for (const c of sh.L) { q -= c.w; if (q <= 0) { l = c; break; } }
    const a = (rnd() + rnd() + rnd() - 1.5) * l.s * 1.9, b = (rnd() + rnd() + rnd() - 1.5) * l.s * 0.8, w = Math.sin((l.x + a) * 3.1) * 0.08;
    put(l.x + a, l.y + b + w, 0.16 + rnd() * 0.42, false);
  }
  // The knot leans toward the light (the star): its centre sits a little that way, in the cloud's own axes.
  const lu = lx * ca + ly * sa, lv = -lx * sa + ly * ca, kx = lu * 0.22, ky = lv * 0.14;
  for (let i = 0; i < n * 0.1; i++) { const a = (rnd() + rnd() + rnd() - 1.5) * 0.16, b = (rnd() + rnd() + rnd() - 1.5) * 0.09; put(sh.L[0].x + a + kx, b + ky, 0.22 + rnd() * 0.42, Math.hypot(a, b * 1.6) < 0.045 && rnd() < 0.7); }
  yield;
  for (const fl of sh.F) for (let i = 0; i < n * 0.07; i++) {
    const t = Math.pow(rnd(), 0.7) * fl.len, ang = fl.a + fl.bend * t, sp = 0.04 + t * 0.14;
    put(sh.L[0].x + Math.cos(ang) * t * 1.1 + (rnd() + rnd() - 1) * sp, Math.sin(ang) * t * 0.55 + (rnd() + rnd() - 1) * sp, 0.36 * (1 - t / fl.len) + rnd() * 0.2, false);
  }
  const g = ctx.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, S * 1.1);
  g.addColorStop(0, `rgba(${acc.join(",")},${o.glow || 0.1})`); g.addColorStop(1, `rgba(${acc.join(",")},0)`);
  ctx.fillStyle = g; ctx.fillRect(o.cx - S * 1.1, o.cy - S * 1.1, S * 2.2, S * 2.2);
}
// ---- Folder page: Ephemeris ---------------------------------------------
// One column, read top to bottom: the folder's own object (moon, star or
// cloud, by world) beside its title, a sentence on what is next and a row
// of numbers; the next seven days; a ledger with one line per subfolder
// (term progress in words, the next deadline, open tasks); then Due soon
// and Recent side by side. Gold marks only the next thing due. The folder
// note's `ecliptic-blocks` property picks and orders the blocks. "Show all"
// swaps the blocks for the whole list, filtered by subfolder.
const FOLDER_BLOCKS = ["summary", "week", "schedule", "subfolders", "loose", "due", "recent"];
// Folder types and the words the classifier looks for (see plugin.classify).
const FT_TYPES = ["course", "queue", "projects", "journal", "work", "plain"];
const FT_LABEL = { course: "course", queue: "reading queue", projects: "projects", journal: "journal", work: "work and career", plain: "plain folder" };
// A work folder: named Career / Work / Jobs (a leading number is ignored), or holding two or more notes typed job / work / roster.
const WORK_NAME = /^(careers?|work|jobs?|employment)$/;
const WORK_TYPES = new Set(["job", "work", "roster", "rota"]);
const stripNum = (s) => String(s).replace(/^\d+[\s._-]+/, "").trim().toLowerCase();
const DATED_NAME = /^(\d{4}-\d{2}-\d{2}|\d{4}-W\d{2}|\d{4}-\d{2})$/i;
const READ_DONE = new Set(["read", "finished", "dnf", "stopped"]);
const READ_OPEN = new Set(["unread", "to-read", "toread", "want-to-read", "queue", "queued", "inbox", "backlog", "reading", "currently-reading"]);
const LANES = { active: ["active", "in-progress", "planning", "ongoing", "doing", "wip", "started"], parked: ["on-hold", "paused", "backburner", "simmering", "parked", "someday", "later"],
  abandoned: ["abandoned", "cancelled", "canceled", "dropped", "dead"], done: ["done", "complete", "completed", "shipped", "released", "finished"] };
// A loose note that is the folder's own index ("Dev Overview", "Project Board") is not a project.
const INDEX_NOTE = /(^|[\s._-])(overview|index|board|dashboard|home|hub|moc|readme|contents)$/i;
function laneOf(status) {
  if (status == null) return null;
  const s = String(status).trim().toLowerCase().replace(/[\s_]+/g, "-");
  for (const k of Object.keys(LANES)) if (LANES[k].includes(s)) return k;
  return null;
}
const COURSE_CODE = /^[A-Za-z]{3,5}\s?\d{3,5}\b[\s._-]*/;
const COURSE_SUB = /^(lectures?|assignments?|assessments?|notes|readings?|exams?|weeks?|tutorials?)\b/;
const DONE_STATE = /^(done|complete|completed|submitted|graded|finished|closed|archived|marked)$/;
// A course code leads a name: "ABCD1234 C++ Studio" (letters and digits) or, inside a course, the short "1234 Weeks" (digits only).
function stripCode(name) {
  const m = String(name).match(COURSE_CODE) || String(name).match(/^\d{3,5}\b[\s._-]*/);
  return m ? String(name).slice(m[0].length) : String(name);
}
// "Due Sun 1 Nov 2026" in a note's text: an ISO day, or null.
function textDue(text, today) {
  const m = String(text).match(/\bdue\b[^\n]{0,40}?\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s+(\d{4}))?/i);
  if (!m) return null;
  const mo = MONTHS3.indexOf(m[2].toLowerCase()), y = m[3] ? +m[3] : +today.slice(0, 4);
  return mo < 0 ? null : `${y}-${pad2(mo + 1)}-${pad2(+m[1])}`;
}
// "Canvas window: available 27 Aug 09:00 – 20 Nov 23:59": the day the course closes in Canvas (the last date on that line), or null.
function canvasClose(text, today) {
  const m = String(text).match(/\bcanvas\b[^\n]{0,30}\b(?:window|access|clos\w*)\b[^\n]*/i);
  if (!m) return null;
  const ds = [...m[0].matchAll(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s+(\d{4}))?/gi)];
  if (!ds.length) return null;
  const l = ds[ds.length - 1], mo = MONTHS3.indexOf(l[2].toLowerCase());
  return mo < 0 ? null : `${l[3] ? +l[3] : +today.slice(0, 4)}-${pad2(mo + 1)}-${pad2(+l[1])}`;
}
// A course overview's "## Assessments" table: rows of { name, key, dueIso, weight } (title, due date and weight; any of the last two may be null).
// The title column is the first one; a numbered row ("1 - Learning LC-3") becomes "Assignment 1" (or "Test: ..." for an in-class test). Dates without a year take the term's.
function parseAssessTable(text, yearDefault) {
  const lines = String(text).split(/\r?\n/), out = [];
  let i = lines.findIndex((l) => /^#{1,6}\s*assessments?\s*$/i.test(l.trim()));
  if (i < 0) return out;
  const rows = [];
  // The first table under the heading only (later tables in the section are something else: checkpoints, a calendar).
  for (i++; i < lines.length && !/^#{1,6}\s/.test(lines[i]); i++) {
    if (/^\s*\|/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
    else if (rows.length) break;
  }
  if (rows.length < 3) return out;
  const clean = (s) => String(s).replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
  const head = rows[0].map((h) => clean(h).toLowerCase());
  const wi = head.findIndex((h) => /weight|worth|mark|%/.test(h)), di = head.findIndex((h) => /^(due|deadline|date)\b|\bdue\b/.test(h)), ti = head.findIndex((h) => /^(type|kind|format)/.test(h));
  for (const r of rows.slice(2)) {
    const first = clean(r[0] || "");
    if (!first) continue;
    const cell = (k) => (k >= 0 && r[k] != null ? clean(r[k]) : "");
    const num = first.match(/^(\d+)\s*(?:[-–—:.)]\s*(.*))?$/), isTest = /\b(test|exam|quiz)\b/i.test(cell(ti));
    let name = first, key = null;
    if (num) { key = ["assignment", +num[1]]; name = isTest && num[2] ? `Test: ${num[2]}` : `Assignment ${num[1]}`; }
    else { const k = first.match(/^(\D*?)\s*(\d+)/); if (k) key = [k[1].trim().toLowerCase(), +k[2]]; }
    const dm = cell(di).match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:,?\s+(\d{4}))?/i);
    const dueIso = dm ? `${dm[3] ? +dm[3] : yearDefault}-${pad2(MONTHS3.indexOf(dm[2].toLowerCase()) + 1)}-${pad2(+dm[1])}` : null;
    const wm = cell(wi).match(/(\d{1,3}(?:\.\d+)?)\s*%/), weight = wm && +wm[1] > 0 && +wm[1] <= 100 ? +wm[1] : null;
    out.push({ name, key, dueIso, weight, dueMin: dueIso ? clockIn(cell(di)) : null });
  }
  return out;
}
// A time of day in a due value or table cell ("17:00", "5pm", "2026-11-20 09:30"): minutes into the day, or null.
function clockIn(v) {
  const s = String(v == null ? "" : v);
  let m = s.match(/\b(\d{1,2}):(\d{2})\s*([ap]m)?(?![\p{L}\p{N}])/iu), h, mi, ap;
  if (m) { h = +m[1]; mi = +m[2]; ap = m[3]; }
  else { m = s.match(/\b(\d{1,2})\s*([ap]m)(?![\p{L}\p{N}])/iu); if (!m) return null; h = +m[1]; mi = 0; ap = m[2]; }
  if (ap) { if (h < 1 || h > 12) return null; h = (h % 12) + (/^p/i.test(ap) ? 12 : 0); }
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}
// An overview whose "## Assessments" heading is empty may keep the exam under its own heading ("## Final exam block ..." with "Wed 28 Oct 2026" in the text under it):
// one row { name: "Final exam", dueIso } from the first dated line under the first heading that says exam (the heading's own date, a post date, is not used).
function parseExamBlock(text, yearDefault) {
  const lines = String(text).split(/\r?\n/);
  const i = lines.findIndex((l) => /^#{1,6}\s.*\bexam\b/i.test(l.trim()) && !/assessments?\s*$/i.test(l.trim()));
  if (i < 0) return [];
  for (let j = i + 1; j < lines.length && !/^#{1,6}\s/.test(lines[j]); j++) {
    const dm = lines[j].match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:,?\s+(\d{4}))?/i);
    if (dm) return [{ name: "Final exam", key: null, dueIso: `${dm[3] ? +dm[3] : yearDefault}-${pad2(MONTHS3.indexOf(dm[2].toLowerCase()) + 1)}-${pad2(+dm[1])}`, weight: null }];
  }
  return [];
}
const ASSESS_SUB = /^(assignments?|assessments?|quiz(zes)?|exams?|labs?|projects?|reports?|tasks?)\b/;
const WEEKS_SUB = /^(weeks?|lectures?|tutorials?|notes|readings?)\b/;
const REVISE_NAME = /error log|exam intel|revision|revise|mock|cheat ?sheet|past paper/i;
const MONTHS3 = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// "Mon 10 Aug → Fri 30 Oct 2026", "2026-08-10 to 2026-10-30": { p (0..1 through the term), words, done } or null.
function parseRuns(line, today) {
  const s = String(line).replace(/[*_`=]/g, " "), hits = [];
  for (const m of s.matchAll(/(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?/g)) {
    if (m[1]) hits.push({ y: +m[1], mo: +m[2] - 1, d: +m[3] });
    else { const mo = MONTHS3.indexOf(m[5].slice(0, 3).toLowerCase()); if (mo >= 0) hits.push({ y: m[6] ? +m[6] : null, mo, d: +m[4] }); }
    if (hits.length === 2) break;
  }
  if (hits.length < 2) return null;
  const [a, b] = hits;
  b.y = b.y || a.y || +today.slice(0, 4);
  a.y = a.y || (a.mo > b.mo ? b.y - 1 : b.y);
  const start = new Date(a.y, a.mo, a.d), end = new Date(b.y, b.mo, b.d), now = dayDate(today);
  if (!(end > start)) return null;
  const span = Math.round((end - start) / 864e5), since = Math.round((now - start) / 864e5), left = span - since;
  const weeks = Math.max(1, Math.ceil((span + 1) / 7)), pl = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  let words;
  const week = since < 0 ? 0 : Math.min(weeks, Math.floor(since / 7) + 1);
  if (since < 0) words = `starts in ${pl(-since, "day")}`;
  else if (left >= 0) words = `week ${week}/${weeks} · ${left ? pl(left, "day") + " left" : "last day"}`;
  else words = "finished " + fmtDay(end, { day: "numeric", month: "short" });
  return { p: clamp(since / Math.max(1, span), 0, 1), words, done: left < 0, week, weeks, left, start: isoDay(start), end: isoDay(end) };
}
// "Nov 20", or "Nov 20, 1999" when the date is not in today's (pinned) year: a typo or an old task never passes for this year.
function dueDay(iso, today) {
  return fmtDay(iso, today && iso.slice(0, 4) !== today.slice(0, 4) ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
}
// A due date said the short way, from today: "today", "tomorrow", "Thu 20", "20 Nov", "3 days late".
function dueWords(iso, today) {
  const n = dayDiff(iso, today);
  if (n < 0) return `${-n} ${n === -1 ? "day" : "days"} late`;
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n < 7) return fmtDay(iso, { weekday: "short" }) + " " + dayDate(iso).getDate();
  return dueDay(iso, today);
}
// "due Thu 20", or for a date already past "due 4 Oct" (and "· 3 days late" when it is overdue): the date is never dropped.
function dueLine(iso, today, overdue) {
  if (dayDiff(iso, today) >= 0) return "due " + dueWords(iso, today);
  return "due " + dueDay(iso, today) + (overdue ? " · " + dueWords(iso, today) : "");
}
function dueIn(iso, today) {
  const n = dayDiff(iso, today);
  return n < 0 ? `${-n} ${n === -1 ? "day" : "days"} late` : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
}

// The folder's object (moon, star or cloud by world), drawn into a canvas of css size S; ring = 0..1 lights an arc round it.
function drawFolderObject(cv, o) {
  const S = o.S, dpr = Math.min(2, window.devicePixelRatio || 1), c = S / 2, R = o.R;
  cv.width = Math.round(S * dpr); cv.height = Math.round(S * dpr);
  cv.style.width = S + "px"; cv.style.height = S + "px";
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const small = R < 16, ink = o.ink, kind = objectKind(o.world);
  if (o.ring != null) {
    const rr = S / 2 - 1.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(${ink.join(",")},0.16)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, rr, 0, TAU); ctx.stroke();
    if (o.ring > 0.005) {
      ctx.strokeStyle = `rgba(${ink.join(",")},0.82)`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(c, c, rr, -Math.PI / 2, -Math.PI / 2 + TAU * o.ring); ctx.stroke();
    }
  }
  if (kind === "star") for (const _ of orbitStarGen(ctx, { cx: c, cy: c, R: R * 0.46, seed: o.seed, ink, ground: o.ground, accent: o.accent, dot: small ? 0.4 : 0.5, density: small ? 3 : 2.2, halo: small ? 0 : undefined }));
  else if (kind === "cloud") for (const _ of dustCloudGen(ctx, { cx: c, cy: c, S: R * 0.58, seed: o.seed, lx: -1, ly: -1.3, accent: o.accent, ink, n: Math.round(R * R * (small ? 4.5 : 3.2)), gain: 1.3, dot: small ? 0.28 : 0.35, dv: small ? 0.35 : 0.45 }));
  else for (const _ of folderMoonGen(ctx, { cx: c, cy: c, R, L: [-0.4, -0.3, 0.85], seed: o.seed, ink, dot: small ? 0.42 : 0.5, density: small ? 5 : 2.2, ground: o.ground, accent: o.accent, glow: small ? 0 : 0.12 }));
}

// ---- Small bodies ----------------------------------------------------------
// One small object per thing on a folder page (a course, a category, a project, a month, a subfolder), in
// the folder's world. How much of it is lit says how alive the thing is (term progress, share of notes
// touched this month, share read); dark is abandoned. Ticks round the limb count week notes; dots beside
// it count what is unread. The meaning is always printed in words next to it, never left to the picture.
// o: S (css size), R, seed, ink, ground, accent, world, frac (0..1 lit), dark, tick {n, total}, sats.
function sizeBody(cv, S) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(S * dpr); cv.height = Math.round(S * dpr);
  cv.style.width = S + "px"; cv.style.height = S + "px";
}
function* bodyGen(cv, o) {
  const S = o.S, dpr = Math.min(2, window.devicePixelRatio || 1), c = S / 2, R = o.R, ink = o.ink, ic = ink.join(",");
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, S, S);
  if (o.flip) { ctx.translate(S, 0); ctx.scale(-1, 1); } // lit on the right (a phase moon seen from the other hemisphere)
  const kind = objectKind(o.world), frac = o.dark ? 0 : clamp(o.frac == null ? 1 : o.frac, 0, 1), K = 1 - 2 * frac;
  // Idle: alive but nothing edited lately. A hairline rim with a faint stipple, no fill, so it is neither the dashed "abandoned/empty" rim nor a dark disc.
  const idle = !o.dark && frac < 0.02;
  if (kind === "star") yield* orbitStarGen(ctx, { cx: c, cy: c, R: R * 0.62, seed: o.seed, ink, ground: o.ground, accent: o.accent, dot: 0.4, density: 3, halo: 0 });
  else if (kind === "cloud") yield* dustCloudGen(ctx, { cx: c, cy: c, S: R * 0.7, seed: o.seed, lx: -1, ly: -0.3, accent: o.accent, ink, n: Math.round(R * R * 5), gain: 1.4, dot: 0.28, dv: 0.35 });
  else yield* folderMoonGen(ctx, { cx: c, cy: c, R, L: [-0.85, -0.1, 0.5], seed: o.seed, ink, dot: 0.42, density: 5, ground: o.ground, accent: o.accent, glow: 0 });
  // The night side: the disc minus the lit shape (lit from the left; the terminator is an ellipse arc).
  const term = (i, n) => { const k = Math.PI / 2 - (Math.PI * i) / n; return [c + R * -K * Math.cos(k), c + R * Math.sin(k)]; };
  if (frac < 0.999) {
    const nightPath = () => { ctx.beginPath(); ctx.arc(c, c, R, -Math.PI / 2, Math.PI / 2, false); for (let i = 0; i <= 28; i++) { const p = term(i, 28); ctx.lineTo(p[0], p[1]); } ctx.closePath(); };
    ctx.save(); ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "rgba(0,0,0,0.92)";
    nightPath(); ctx.fill(); ctx.restore();
    // The night side is a faint filled shape, so a lit share of 94% and one of 77% differ by the width of a visible crescent.
    if (!idle) { ctx.save(); ctx.fillStyle = `rgba(${ic},${o.dark ? 0.09 : 0.1})`; nightPath(); ctx.fill(); ctx.restore(); }
    // Earthshine: a few faint dots on the night side, none on an abandoned thing.
    if (!o.dark) {
      const rnd = todayRng((o.seed || 3) + 41);
      for (let i = 0, t = 0, n = Math.round(R * (idle ? 2.2 : 1.1)); i < n && t < n * 30; t++) {
        const px = rnd() * 2 - 1, py = rnd() * 2 - 1;
        if (px * px + py * py > 0.92 || -px > K * Math.sqrt(Math.max(0, 1 - py * py))) continue;
        i++;
        ctx.fillStyle = `rgba(${ic},${((idle ? 0.16 : 0.07) + rnd() * 0.12).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(c + px * R, c + py * R, 0.45, 0, TAU); ctx.fill();
      }
    }
  }
  // The limb, and the terminator: hairlines, so the night side still reads as a disc.
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = `rgba(${ic},${o.dark ? 0.42 : idle ? 0.4 : 0.3})`;
  if (o.dark) ctx.setLineDash([1.6, 2.4]);
  ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  if (frac > 0.03 && frac < 0.97) {
    ctx.strokeStyle = `rgba(${ic},0.8)`; ctx.lineWidth = 1; // the terminator: where the lit share ends has to read at 30 px
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) { const p = term(i, 28); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
    ctx.stroke();
  }
  // Ticks round the limb: bright for a week with notes, dim for a week still to come.
  const tk = o.tick;
  if (tk && (tk.n || tk.total)) {
    const n = Math.min(14, tk.n || 0), total = Math.min(18, Math.max(n, tk.total || 0));
    ctx.lineCap = "round";
    for (let i = 0; i < total; i++) {
      const a = -Math.PI / 2 + (TAU * i) / total, r1 = R + 3.5, r2 = R + (i < n ? 6.5 : 5);
      ctx.strokeStyle = `rgba(${ic},${i < n ? 0.8 : 0.2})`; ctx.lineWidth = i < n ? 1.2 : 0.9;
      ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); ctx.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2); ctx.stroke();
    }
  }
  // Satellites: one small dot per unread, no ring.
  const sats = Math.min(8, o.sats || 0);
  if (sats) {
    const a0 = ((o.seed || 0) % 628) / 100, rr = R * 1.36, dr = R < 16 ? 1.05 : 1.3;
    ctx.fillStyle = `rgba(${ic},0.78)`;
    for (let i = 0; i < sats; i++) { const a = a0 + (TAU * i) / sats; ctx.beginPath(); ctx.arc(c + Math.cos(a) * rr, c + Math.sin(a) * rr, dr, 0, TAU); ctx.fill(); }
  }
}
// "today", "yesterday", "5 days ago", "3 weeks ago", "4 months ago".
function agoLong(ms) {
  const d = Math.max(0, Math.floor((Date.now() - ms) / 864e5));
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return d + " days ago";
  if (d < 60) return Math.round(d / 7) + " weeks ago";
  return Math.round(d / 30) + " months ago";
}

function renderFolder(view, host, d, sliced) {
  const plugin = view.plugin, pal = plugin.palette(), world = WORLDS.find((x) => x.id === plugin.settings.world) || WORLDS[0];
  if (view.todayRO) { view.todayRO.disconnect(); view.todayRO = null; }
  if (view.artJob) { view.artJob.cancel(); view.artJob = null; }
  if (view.listIO) { view.listIO.disconnect(); view.listIO = null; }
  if (view.workTimer) { window.clearInterval(view.workTimer); view.workTimer = null; }
  // Which view of this folder is up (summary or the list, and its tab) survives a re-render of the same folder.
  const same = !!view.folderState && view.folderState.path === d.path;
  const st = same ? view.folderState : { path: d.path, list: false, tab: "", marked: new Set(), sel: "", all: false, done: false };
  view.folderState = st;
  // A re-render of the same page (a note was marked read, a file changed) keeps the scroll position.
  const prevEl = same ? host.querySelector(".ecl-f-scroll") : null, prevTop = prevEl ? prevEl.scrollTop : 0;
  host.empty();
  host.removeClass("is-home", "is-today", "is-compact", "is-mirror", "is-beside", "is-phone", "is-narrow", "is-tiny", "is-xs");
  host.addClass("is-folder");
  host.style.setProperty("--ecl-warn", world.warn);
  const sizeCls = (W) => { host.toggleClass("is-narrow", W < 700); host.toggleClass("is-tiny", W < 560); host.toggleClass("is-xs", W < 430); };
  sizeCls(host.clientWidth || (view.contentEl && view.contentEl.clientWidth) || 1000);
  const ink = pal.ink.split(",").map(Number);
  const themed = document.body.hasClass("ecl-themed"), ground = themed ? hexRgb(world.ground) : null;
  const today = d.today || isoDay(new Date());
  const gold = d.nextDue || null; // the one thing in gold: the next real deadline (a queue puts its first pick in gold instead)
  const nOver = d.tasks.filter((t) => t.overdue).length;
  const on = (b) => d.blocks.includes(b);
  const T = d.ftype || "plain", X = d.x;
  const isEdu = T === "course" && !!X && !!X.container; // a course collection: the Edu page
  const tiny = () => host.hasClass("is-tiny");
  let builtTiny = tiny();
  const weekOf = (t) => (t ? (t.done ? `Term ended ${fmtDay(t.end, { day: "numeric", month: "short" })}` : t.week ? `Week ${t.week} of ${t.weeks}${t.left >= 0 ? " · " + (t.left ? `${t.left} ${t.left === 1 ? "day" : "days"} left` : "last day") : ""}` : t.words) : "");
  // Small bodies are queued and drawn in slices after the page is up (see startBodies), so a click stays instant.
  const bodies = [];
  const bodyCv = (parent, S, R, o) => {
    const cv = parent.createEl("canvas", { cls: "ecl-f-bcv" });
    sizeBody(cv, S);
    bodies.push({ cv, o: { S, R, ink, ground, accent: pal.accent, world, ...o } });
    return cv;
  };
  const startBodies = () => {
    if (view.artJob) { view.artJob.cancel(); view.artJob = null; }
    const todo = bodies.filter((b) => !b.cv._done);
    if (!todo.length) return;
    const gen = (function* () { for (const b of todo) { yield* bodyGen(b.cv, b.o); b.cv._done = true; yield; } })();
    view.artJob = sliceRun(gen, () => { view.artJob = null; });
  };

  const sky = host.createEl("canvas", { cls: "ecl-f-sky" });
  const marksEl = host.createDiv("ecl-t-marks"); // the page flight fades this in with the object; folders have no marks
  const scrollEl = host.createDiv("ecl-f-scroll");
  const col = scrollEl.createDiv("ecl-f-col");
  const scroller = () => scrollEl;

  // ---- the head: crumb, object, eyebrow, title, summary ----------------
  // Open a folder as itself (not as its only child's contents).
  const asItself = (path) => { plugin.noUnwrap = path; if (view.section === path) view.renderSection(); else view.openLanding(path); };
  const crumb = col.createDiv({ cls: "ecl-caps ecl-back ecl-f-crumb" });
  const mark = crumb.createSpan({ cls: "ecl-back-mark", text: "‹" });
  mark.onclick = () => view.up();
  d.crumbs.forEach((c, i) => {
    if (i) crumb.createSpan({ cls: "ecl-f-sep", text: "/" });
    const a = crumb.createEl("a", { cls: "ecl-f-crumb-seg", text: c.label });
    a.onclick = () => (c.noUnwrap ? asItself(c.path) : c.path ? view.openLanding(c.path) : view.closeLanding());
  });
  const head = col.createDiv("ecl-f-head");
  const mini = head.createEl("canvas", { cls: "ecl-f-mini" });
  const ht = head.createDiv("ecl-f-headtext");
  // A folder holding only one folder shows that folder as itself: the eyebrow is the path (Parent / Child), the line under the title names the parent and links up to it.
  const nNotes = `${d.count} ${d.count === 1 ? "note" : "notes"}`;
  // The path already shows in the crumb above and in the "only folder inside" line, so the eyebrow never repeats it.
  const eb = ht.createDiv({ cls: "ecl-caps ecl-f-eyebrow", text: `Folder  ·  ${nNotes}` });
  if (d.edited) eb.createSpan({ cls: "ecl-f-eyebrow-x", text: "  ·  edited " + d.edited });
  ht.createEl("h1", { cls: "ecl-f-title", text: d.title });
  if (d.via) {
    const vi = ht.createDiv("ecl-f-via");
    vi.appendText("The only folder inside ");
    const va = vi.createEl("a", { cls: "ecl-f-vialink", text: d.via });
    if (d.viaPath) va.onclick = () => asItself(d.viaPath);
  }
  // One column for every type, so the back link and title keep their place between folders; journal and plain keep a narrower reading width inside it.
  col.addClass("is-wide");
  col.toggleClass("is-lean", !(T === "course" || T === "queue" || T === "projects" || T === "work"));
  col.toggleClass("is-work", T === "work" && !!X);
  col.toggleClass("is-edu", isEdu);
  let ledeEl = null, statsEl = null, detectEl = null, topEl = null;
  const detectIn = on("summary") ? eb.createSpan("ecl-f-eyebrow-d") : null;
  // Which top region this folder gets (same family: title, meta line, hairline; different art). Any type missing its data falls back to the plain top.
  // A reading queue and a work folder keep their own first block (Read next, the week calendar) and a course collection has a moon per course below.
  const c0 = T === "course" && X && !X.container ? X.courses[0] : null;
  const topKind = !X ? "plain" : T === "journal" ? "journal" : T === "projects" ? "none" : T === "queue" || T === "work" ? "none"
    : T === "course" ? (X.container ? "none" : c0 && c0.term && c0.term.start ? "course" : "plain") : "plain";
  const heatOf = (ms) => { const days = (Date.now() - ms) / 864e5; return days <= 7 ? 1 : days <= 21 ? 0.75 : days <= 45 ? 0.5 : days <= 100 ? 0.25 : 0.1; };
  const south = plugin.settings.latitude != null ? plugin.settings.latitude < 0 : guessSouth();
  // ---- work: where the roster stands now (shared by the lede, the rail and the Jobs rows) ----
  const wkHM = (e) => `${clock24(e.start)} - ${clock24(e.end)}`;
  const wkDur = (e) => (e.end > e.start ? e.end : e.end + 1440) - e.start;
  const wkAt = (e) => dayDate(e.date).getTime() + e.start * 6e4;
  const wkShort = (iso) => dayDate(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
  const wkMonday = (off) => { const n = plugin.nowDate(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7) + 7 * off); };
  const wkMins = (off) => { const a = isoDay(wkMonday(off)), b = isoDay(wkMonday(off + 1)); return X.shifts.filter((e) => e.date >= a && e.date < b).reduce((s, e) => s + wkDur(e), 0); };
  const wkStatus = () => {
    const ts = plugin.nowDate().getTime(), all = X.shifts;
    const cur = all.find((e) => wkAt(e) <= ts && ts < wkAt(e) + wkDur(e) * 6e4) || null;
    const ahead = all.filter((e) => wkAt(e) > ts), past = all.filter((e) => wkAt(e) + wkDur(e) * 6e4 <= ts);
    return { ts, cur, next: ahead[0] || null, then: ahead[1] || null, last: past[past.length - 1] || null };
  };
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
  const pl = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  // Unread items now (a note marked read on this page counts as read straight away).
  const unreadItems = () => (T === "queue" && X ? X.items.filter((i) => !i.read && !st.marked.has(i.path)) : []);
  // The lede only says what the stat row cannot: which thing is next due (the row has the countdown). No fact, no lede.
  const nextWords = () => (gold ? `Next due: ${clip(gold.title, 56)}.` : "");
  // ---- Edu (a course collection): what the header, the term band and the next-fortnight row share ----
  const plus = (iso, n) => { const x = dayDate(iso); x.setDate(x.getDate() + n); return isoDay(x); };
  const dShort = (iso) => dayDate(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" }).replace("Sept", "Sep");
  const eduAgo = (iso) => { const n = dayDiff(today, iso); return n <= 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`; };
  const eduAbbr = (c) => (c.code ? c.code.replace(/^[A-Za-z]+/, "") || c.code : c.name);
  const courseEnd = (c) => (c.term ? c.term.end : c.endInf) || null;
  const isGold = (x) => !!gold && !!x.dueIso && gold.path === x.path && gold.dueIso === x.dueIso;
  // "16 days left", "Finished 17 days ago", "Dates not set": where a course stands, in a few words.
  const courseState = (c) => {
    const t = c.term;
    if (t) return t.done ? `Finished ${eduAgo(t.end)}` : t.start > today ? `Starts in ${pl(dayDiff(t.start, today), "day")}` : t.left === 0 ? "Last day" : `${pl(t.left, "day")} left`;
    return c.endInf ? `${c.over ? "Ended" : "Ends"} ~${dShort(c.endInf)}` : "Dates not set";
  };
  const eduFacts = () => {
    const cs = X.courses, live = cs.filter((c) => !c.over), end14 = plus(today, 14), due = [];
    for (const c of cs) for (const a of c.assess) if (a.dueIso && a.dueIso >= today && a.dueIso <= end14) due.push({ c, a });
    due.sort((p, q) => (p.a.dueIso < q.a.dueIso ? -1 : p.a.dueIso > q.a.dueIso ? 1 : 0) || (p.a.name < q.a.name ? -1 : 1));
    const canvas = cs.filter((c) => c.canvas && c.canvas >= today).sort((p, q) => (p.canvas < q.canvas ? -1 : 1));
    const ends = cs.map(courseEnd).filter(Boolean).sort();
    return { cs, live, end14, due, canvas, lastEnd: ends[ends.length - 1] || null, courseNotes: cs.reduce((s, c) => s + c.nNotes, 0) };
  };
  const NUMW = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  const fillHead = () => {
    if (!on("summary")) return;
    ledeEl.empty(); statsEl.empty();
    const stat = (v, l, cls) => { const s = statsEl.createDiv("ecl-f-stat" + (cls ? " " + cls : "")); s.createSpan({ cls: "ecl-f-stat-v", text: String(v) }); s.createEl("small", { cls: "ecl-caps", text: l }); return s; };
    const goldStat = () => { if (gold) stat(dueIn(gold.dueIso, today), "next due", "is-gold"); };
    let lede = "";
    if (isEdu) {
      const f = eduFacts(), nC = f.cs.length;
      // Every course has an "Assignment 1": name the course and the day.
      const nextWords = () => { const h = gold && f.due.find((x) => x.a.path === gold.path && x.a.dueIso === gold.dueIso); return h ? `Next due: ${clip(h.a.name, 40)} (${eduAbbr(h.c)}), ${wkShort(h.a.dueIso)}.` : gold ? `Next due: ${clip(gold.title, 56)}.` : ""; };
      const canv = f.canvas.map((c, i) => `${eduAbbr(c)} ${i ? "" : "stays open in Canvas "}until ${wkShort(c.canvas)}`);
      if (!nC) lede = "No courses yet.";
      else if (!f.live.length) {
        lede = `${f.lastEnd ? `The term ended ${eduAgo(f.lastEnd)}.` : "The term has ended."} ${NUMW[nC] || nC} ${nC === 1 ? "course" : "courses"}, ${f.courseNotes} course notes. ${f.due.length ? `${f.due.length} due in the next two weeks. ${nextWords()}` : "Nothing is due."}`.trim();
        if (canv.length) lede += ` ${canv.join(", ")}.`;
      } else {
        const nEnd = f.live.filter((c) => { const e = courseEnd(c); return e && e >= today && e <= f.end14; }).length;
        lede = `${f.live.length} ${f.live.length === 1 ? "course" : "courses"} this term${nEnd ? `, ${nEnd} finishing in the next two weeks` : ""}.${gold ? " " + nextWords() : ""}`;
      }
      stat(nC, nC === 1 ? "course" : "courses");
      const ps = f.live.filter((c) => c.term).map((c) => c.term.p);
      if (nC && !f.live.length) stat("Done", "term");
      else if (ps.length) stat(Math.round((ps.reduce((a, b) => a + b, 0) / ps.length) * 100) + "%", "of term elapsed");
      stat(f.due.length, "due in 14 days"); stat(f.courseNotes, "course notes");
    } else if (T === "course" && X) {
      const cs = X.courses, tm = cs.find((c) => c.term && !c.term.done && c.term.week) || cs.find((c) => c.term);
      const nA = cs.reduce((a, c) => a + c.assess.length, 0), nW = cs.reduce((a, c) => a + c.weeks.length, 0);
      lede = nextWords();
      if (c0 && c0.term) lede = [c0.code, weekOf(c0.term).replace(/^./, (m) => m.toUpperCase())].filter(Boolean).join(". ") + "." + (lede ? " " + lede : "");
      if (X.container) stat(cs.length, "courses");
      if (tm) stat(tm.term.week ? `${tm.term.week}/${tm.term.weeks}` : "-", "term week");
      stat(nA, nA === 1 ? "assessment" : "assessments"); stat(nW, nW === 1 ? "week note" : "week notes"); goldStat();
    } else if (T === "queue" && X) {
      const un = unreadItems(), oldest = un.slice().sort((a, b) => a.saved - b.saved)[0];
      if (!un.length && !X.approx) lede = `All ${X.total} read. Nothing waiting.`;
      stat(X.approx ? un.length + "+" : un.length, "unread"); stat(X.total, "saved");
      if (oldest) stat(agoLong(oldest.saved).replace(" ago", ""), "oldest waiting");
    } else if (T === "projects" && X) {
      // The stats are the lanes below, in the same order and with the same counts.
      const L = X.lanes;
      lede = nextWords();
      stat(L.active.length, "active");
      for (const [k, w] of [["parked", "parked"], ["abandoned", "abandoned"], ["unknown", "unknown"]]) if (L[k].length) stat(L[k].length, w);
      goldStat();
    } else if (T === "work" && X) {
      const w = wkStatus();
      if (w.cur) lede = `On shift until ${clock24(w.cur.end)}, ${w.cur.label}.`;
      else if (w.next) lede = `Next shift: ${wkShort(w.next.date)}, ${wkHM(w.next)}, ${w.next.label}.`;
      else if (X.shifts.length) lede = "No upcoming shift on the roster.";
      // No stat row: the next shift is already the lede, the rail and the calendar; the counts sit on their own sections (Jobs, the week's hours).
    } else if (T === "journal" && X) {
      const mk = today.slice(0, 7), thisMonth = new Set(X.entries.filter((e) => e.day && e.month === mk).map((e) => e.iso)).size, last = X.entries[0];
      const ne = X.entries.length, dd = last && last.iso ? dayDiff(today, last.iso) : -1, agoD = dd === 0 ? "today" : dd === 1 ? "yesterday" : dd + " days ago";
      const wk0 = isoDay(new Date(plugin.nowDate().getFullYear(), plugin.nowDate().getMonth(), plugin.nowDate().getDate() - ((plugin.nowDate().getDay() + 6) % 7))), thisWeek = new Set(X.entries.filter((e) => e.day && e.iso >= wk0 && e.iso <= today).map((e) => e.iso)).size;
      if (!last) lede = "Nothing here yet.";
      else lede = `${thisWeek ? pl(thisWeek, "note") + " this week" : "Nothing written this week yet"}. ${last.iso ? "The last entry is " + fmtDay(last.iso, { day: "numeric", month: "short" }) : "The latest is " + last.title}.`;
      stat(X.approx ? ne + "+" : ne, ne === 1 && !X.approx ? "entry" : "entries"); stat(thisMonth, "days this month");
      if (last) stat(dd >= 0 ? agoD : last.title, "latest");
      stat(moonPhase(moonAge(plugin.nowDate())).lit + "%", "moon tonight");
    } else {
      if (gold) lede = `${nOver ? `${nOver} overdue. ` : ""}${nextWords()}`;
      else if (!d.count && !d.subs.length) lede = "Nothing here yet.";
      if (plugin.settings.showTasks && d.tasks.length) stat(d.tasks.length, d.tasks.length === 1 ? "open task" : "open tasks");
      if (gold) stat(dueIn(gold.dueIso, today), "next due", "is-gold");
      else if (nOver) stat(nOver, "overdue");
    }
    ledeEl.setText(lede);
    ledeEl.toggleClass("is-empty", !lede);
    // The eyebrow already says how many notes there are, so on a phone the "notes" stat goes (a plain folder keeps it: it has few stats).
    // A plain folder says its counts and when it was last touched in its own top, so the row keeps only the tasks.
    if (topKind === "plain") { /* counts and latest live in the plain top */ }
    else if (T !== "queue" && T !== "journal" && T !== "work" && !isEdu) stat(d.count, d.count === 1 ? "note" : "notes", "is-dup");
    if (d.note) {
      const lk = statsEl.createEl("a", { cls: "ecl-f-notelink", text: "Open folder note" });
      lk.onclick = () => view.openNote(d.note.path);
    }
  };
  if (on("summary")) {
    ledeEl = ht.createEl("p", { cls: "ecl-f-lede" });
    topEl = col.createDiv("ecl-f-top is-" + topKind);
    statsEl = col.createDiv("ecl-f-stats");
    detectEl = col.createDiv("ecl-f-detect");
  }
  // "Detected as ... - change": the type is a guess; choosing one writes `ecliptic: <type>` into the folder note, and only then.
  let detectOpen = false, askCreate = "";
  const commitType = async (fnote, type) => {
    try { await plugin.app.fileManager.processFrontMatter(fnote, (fm) => { if (type === "auto") delete fm.ecliptic; else fm.ecliptic = type; }); } catch (e) { new obsidian.Notice("Could not save the folder type"); return; }
    plugin.pendingType = plugin.pendingType || new Map();
    if (type !== "auto") { plugin.pendingType.set(d.tpath, type); window.setTimeout(() => plugin.pendingType.delete(d.tpath), 4000); }
    view.renderSection();
  };
  const chooseType = async (type) => {
    const folder = plugin.app.vault.getAbstractFileByPath(d.tpath), fnote = folder && plugin.folderNote(folder);
    if (!folder) return;
    if (fnote) { await commitType(fnote, type); return; }
    askCreate = type; fillDetect();
  };
  // "Detected as X - change" sits in the header meta line (R2.8, F1 polish 6); choosing a type or the create prompt open on their own line below.
  const fillDetect = () => {
    if (!detectEl) return;
    detectEl.empty();
    detectIn && detectIn.empty();
    const link = (label, fn, cls, into) => { const a = (into || detectEl).createEl("a", { cls: "ecl-f-dlink" + (cls ? " " + cls : ""), text: label }); a.onclick = fn; return a; };
    if (!askCreate && !detectOpen && detectIn) {
      detectIn.createSpan({ text: `  ·  ${d.auto ? "Detected as" : "Set as"} ${T === "course" && X && X.container ? "course collection" : FT_LABEL[T]}  -  ` });
      link("change", () => { detectOpen = true; fillDetect(); }, "ecl-f-dchange", detectIn);
      return;
    }
    if (askCreate) {
      const fname = d.tpath.split("/").pop();
      detectEl.createSpan({ text: `Create ${fname}/${fname}.md to remember this? ` });
      link("Create", async () => {
        const type = askCreate; askCreate = "";
        try { const f = await plugin.app.vault.create(`${d.tpath}/${fname}.md`, type === "auto" ? "" : `---\necliptic: ${type}\n---\n`); view.renderSection(); plugin.pendingType = plugin.pendingType || new Map(); if (f && type !== "auto") { plugin.pendingType.set(d.tpath, type); window.setTimeout(() => plugin.pendingType.delete(d.tpath), 4000); } } catch (e) { new obsidian.Notice("Could not create the folder note"); fillDetect(); }
      });
      detectEl.createSpan({ cls: "ecl-f-dsep", text: " · " });
      link("Cancel", () => { askCreate = ""; detectOpen = false; fillDetect(); });
      return;
    }
    if (!detectOpen) {
      detectEl.createSpan({ text: `${d.auto ? "Detected as" : "Set as"} ${T === "course" && X && X.container ? "course collection" : FT_LABEL[T]}  -  ` });
      link("change", () => { detectOpen = true; fillDetect(); }, "ecl-f-dchange");
      return;
    }
    detectEl.createSpan({ text: "Show as  " });
    FT_TYPES.forEach((t, i) => { if (i) detectEl.createSpan({ cls: "ecl-f-dsep", text: " · " }); link(t, () => chooseType(t), t === T ? "is-on" : ""); });
    if (!d.auto) { detectEl.createSpan({ cls: "ecl-f-dsep", text: " · " }); link("auto", () => chooseType("auto")); }
  };
  fillDetect();
  fillHead();

  const body = col.createDiv("ecl-f-body");
  const section = (parent, label, note, cls) => {
    const sec = parent.createEl("section", { cls: "ecl-t-sec ecl-f-sec" + (cls ? " " + cls : "") });
    const h = sec.createDiv({ cls: "ecl-caps ecl-t-lbl", text: label });
    if (note) h.createEl("em", { text: note });
    return sec;
  };

  // ---- blocks ------------------------------------------------------------
  const dueRow = (parent, t) => {
    const el = parent.createDiv({ cls: "ecl-f-dr" + (t === gold ? " is-gold" : "") + (t.overdue ? " is-late" : "") });
    el.createEl("i");
    el.createSpan({ cls: "ecl-f-what", text: t.title });
    el.createEl("small", { text: t.dueIso ? dueWords(t.dueIso, today) : "" });
    el.onclick = () => view.openNote(t.path);
    return el;
  };
  const weekBlock = (parent) => {
    const busy = d.week.some((w) => w.due.length) || nOver; // daily notes add a dot, but alone do not bring the strip
    if (!busy) return;
    const sec = section(parent, "Next 7 days", null, "ecl-f-weeksec");
    const strip = sec.createDiv("ecl-f-week");
    d.week.forEach((w, i) => {
      const c = strip.createEl("a", { cls: "ecl-f-day" + (i === 0 ? " is-now" : "") + (w.due.length ? " is-due" : "") + (gold && gold.dueIso === w.iso ? " is-gold" : "") });
      c.createEl("small", { text: w.dow });
      c.createEl("b", { text: String(w.day) });
      const tag = i === 0 && nOver ? `${nOver} late` : w.due.length ? w.due[0].title + (w.due.length > 1 ? ` +${w.due.length - 1}` : "") : "";
      c.createSpan({ cls: "ecl-f-day-t", text: tag || " " });
      if (w.daily) c.createEl("i", { cls: "ecl-f-day-note" });
      c.title = w.due.map((t) => t.title).join("\n");
      const go = w.due[0] ? w.due[0].path : i === 0 && nOver ? d.tasks[0].path : w.daily;
      if (go) c.onclick = () => view.openNote(go); else c.addClass("is-idle");
    });
    // Under about 430 px the strip becomes the next three things due this week.
    const three = sec.createDiv("ecl-f-week3");
    const soon = d.week.flatMap((w) => w.due).slice(0, 3);
    if (!soon.length) three.createDiv({ cls: "ecl-f-quiet", text: nOver ? `${nOver} overdue, nothing else this week` : "Nothing due this week" });
    for (const t of soon) dueRow(three, t);
  };
  // Compact rows, one per folder: a small body (lit = term progress, else share of notes touched this month), name, status, next due.
  const rowsBlock = (parent, list, label) => {
    if (!list.length) return;
    // What the lit part of each small body means, said in words (a term's progress, else the share of notes edited this month).
    const note = list.some((s) => s.term) ? "lit = term elapsed, else notes edited this month" : "lit = share of notes edited this month; bare ring = none";
    const sec = section(parent, label, label === "Also here" ? "folders that are not courses  ·  " + note : note, "ecl-f-ledsec");
    const rows = sec.createDiv("ecl-f-plist");
    const SHOW = 12;
    const add = (s) => {
      const r = rows.createEl("a", { cls: "ecl-f-prow" + (s.term && s.term.done ? " is-done" : "") });
      bodyCv(r, tiny() ? 34 : 40, tiny() ? 12 : 14, { seed: s.seed, frac: s.term ? s.term.p : s.share, dark: s.dark && !s.term });
      const nm = r.createDiv("ecl-f-pn");
      nm.createSpan({ cls: "ecl-f-lname", text: s.name });
      // "12 notes · edited 3 days ago", then "latest Alpha 3" as its own line, cut as a whole with an ellipsis (a phrase never wraps mid-way).
      if (!s.term && s.count) {
        const sub = nm.createDiv("ecl-f-psub");
        sub.createSpan({ cls: "ecl-f-ps", text: `${pl(s.count, "note")}${s.latest ? ` · ${!s.dark && s.share < 0.02 ? "quiet, " : ""}edited ${s.latest.when}` : ""}` });
        if (s.latest) { const lt = sub.createSpan({ cls: "ecl-f-pl", text: `latest ${s.latest.title}` }); lt.title = s.latest.title; }
      } else nm.createEl("small", { cls: "ecl-f-lstat", text: s.term ? s.term.words : "empty" });
      const nx = r.createDiv({ cls: "ecl-f-px" + (s.next && s.next === gold ? " is-gold" : "") + (!s.next && s.overdue ? " is-late" : "") });
      nx.setText(s.next ? dueWords(s.next.dueIso, today) : s.overdue ? `${s.overdue} overdue` : "");
      r.onclick = () => view.openLanding(s.path);
    };
    list.slice(0, SHOW).forEach(add);
    if (list.length > SHOW) {
      const more = sec.createEl("a", { cls: "ecl-f-all", text: `Show ${list.length - SHOW} more folders` });
      more.onclick = () => { more.remove(); list.slice(SHOW).forEach(add); startBodies(); };
    }
  };
  const ledgerBlock = (parent) => rowsBlock(parent, d.subs, "Folders");
  const dueBlock = (parent) => {
    if (!plugin.settings.showTasks || !d.tasks.length) return;
    const sec = section(parent, "Due soon", `${d.tasks.length} open`, "ecl-f-duesec");
    const rows = sec.createDiv("ecl-f-rows");
    const shown = d.tasks.slice(0, Math.max(5, nOver));
    shown.forEach((t) => dueRow(rows, t));
    if (d.tasks.length > shown.length) {
      const more = sec.createEl("a", { cls: "ecl-f-all", text: `Show ${d.tasks.length - shown.length} more tasks` });
      more.onclick = () => { more.remove(); d.tasks.slice(shown.length).forEach((t) => dueRow(rows, t)); };
    }
  };
  const showAll = (parent) => {
    const all = parent.createEl("a", { cls: "ecl-f-all", text: `Show all ${d.notes.length} notes` });
    all.onclick = () => { st.list = true; list(); scroller().scrollTop = 0; };
  };
  // A note row: title, its subfolder, the date; with `prev` a line of the note's own text under the title.
  const noteRow = (rows, n, prev) => {
    const el = rows.createDiv("ecl-f-nr" + (prev ? " has-prev" : ""));
    const mid = prev ? el.createDiv("ecl-f-nr-m") : el;
    const t = mid.createDiv("ecl-f-nr-t");
    t.createSpan({ cls: "ecl-f-what", text: n.title });
    if (n.sub) t.createEl("small", { cls: "ecl-f-in", text: n.sub });
    if (prev) lazyLine(mid.createDiv("ecl-f-nr-x"), { path: n.path, title: n.title });
    el.createEl("small", { text: n.when });
    el.onclick = () => view.openNote(n.path);
  };
  // The folder's own notes (not the ones inside its subfolders), compact, when it has subfolders too.
  const looseBlock = (parent) => {
    if (!d.subs.length) return;
    const own = d.notes.filter((n) => !n.sub);
    if (!own.length) return;
    const sec = section(parent, "Notes in this folder", String(own.length), "ecl-f-recsec");
    const rows = sec.createDiv("ecl-f-rows");
    own.slice(0, 5).forEach((n) => noteRow(rows, n, false));
    if (own.length > 5) {
      const more = sec.createEl("a", { cls: "ecl-f-all", text: `Show ${own.length - 5} more notes` });
      more.onclick = () => { more.remove(); own.slice(5).forEach((n) => noteRow(rows, n, false)); };
    }
  };
  const recentBlock = (parent) => {
    if (!d.notes.length) return;
    const withLoose = on("loose") && d.subs.length > 0 && d.notes.some((n) => !n.sub);
    const pool = withLoose ? d.notes.filter((n) => n.sub) : d.notes;
    // The loose notes already have their own block: Recent then lists what changed inside the subfolders.
    const seen = withLoose ? Math.min(5, d.notes.length - pool.length) : 0;
    if (!pool.length) { if (d.notes.length > seen) showAll(parent); return; }
    const sec = section(parent, "Recent", null, "ecl-f-recsec");
    const rows = sec.createDiv("ecl-f-rows");
    // A folder with no subfolders is only notes: show a line of each, so the page has body.
    const prev = !d.subs.length;
    const shown = pool.slice(0, 5);
    shown.forEach((n) => noteRow(rows, n, prev));
    if (d.notes.length > seen + shown.length) showAll(sec);
  };
  const scheduleBlock = (parent) => {
    if (!d.schedule || !d.schedule.length) return;
    const sec = section(parent, "Schedule", `${d.schedule.length} coming up`, "ecl-f-duesec");
    const rows = sec.createDiv("ecl-f-rows");
    const SHOW = 5, add = (e) => {
      const el = rows.createDiv("ecl-f-dr is-sched");
      el.createSpan({ cls: "ecl-f-what", text: [e.label, e.start != null ? clock24(e.start) + "-" + clock24(e.end) : ""].filter(Boolean).join(" ") });
      el.createEl("small", { text: e.when });
      el.onclick = () => view.openNote(e.path);
    };
    d.schedule.slice(0, SHOW).forEach(add);
    if (d.schedule.length > SHOW) {
      const more = sec.createEl("a", { cls: "ecl-f-all", text: `Show ${d.schedule.length - SHOW} more` });
      more.onclick = () => { more.remove(); d.schedule.slice(SHOW).forEach(add); };
    }
  };
  const BUILD = { week: weekBlock, schedule: scheduleBlock, subfolders: ledgerBlock, loose: looseBlock, due: dueBlock, recent: recentBlock };
  const quiet = (parent, text) => parent.createDiv({ cls: "ecl-f-quiet", text });
  const keepScroll = (fn) => { const t = scrollEl.scrollTop; fn(); scrollEl.scrollTop = t; };
  // A line of a note, written in when it is read (the frontmatter summary when there is one).
  const lazyLine = (el, p) => { if (p.summary) { el.setText(p.summary); return; } plugin.previewOf(p.notePath || p.path, p.title || p.name).then((t) => { if (el.isConnected) el.setText(t || ""); }); };
  const openThing = (p) => (p.isFolder ? view.openLanding(p.path) : view.openNote(p.path));

  // ---- course: one column per course (container), or the three sections across (a single course) ----
  // `edu`: a column on the Edu page. A finished course leads with its week notes and revision (the way back into the material), then the assessments as history.
  const courseSections = (parent, c, edu) => {
    const aSec = () => {
      const a = section(parent, "Assessments", null, "ecl-f-csec");
      if (!c.assess.length) quiet(a, "No assessments filed yet");
      c.assess.slice(0, 5).forEach((x) => {
        const r = a.createDiv("ecl-f-crow" + (isGold(x) ? " is-gold" : ""));
        r.createSpan({ cls: "ecl-f-what", text: x.name });
        const when = x.dueIso ? (edu && c.over ? dShort(x.dueIso) : dueLine(x.dueIso, today, false)) : x.fromTable ? "" : "edited " + agoLong(x.mtime);
        r.createEl("small", { text: [x.folder ? pl(x.count, "note") : "", x.weight != null ? x.weight + "%" : "", when].filter(Boolean).join(" · ") || "no date yet" });
        r.onclick = () => (x.folder ? view.openLanding(x.path) : view.openNote(x.path));
      });
      if (c.assess.length > 5) a.createDiv({ cls: "ecl-f-cnote", text: `${c.assess.length - 5} more` });
    };
    if (!(edu && c.over)) aSec();
    const w = section(parent, "Week notes", null, "ecl-f-csec");
    if (!c.weeks.length) quiet(w, "No week notes yet");
    else {
      const r = w.createDiv("ecl-f-crow");
      r.createSpan({ cls: "ecl-f-what", text: c.weeks[0].title });
      r.createEl("small", { text: "edited " + agoLong(c.weeks[0].mtime) });
      r.onclick = () => view.openNote(c.weeks[0].path);
      // The latest week is shown; the rest are one tap away (the weeks folder when they live in one).
      // One mention of the count: a link to all of them when they live in one folder, else plain words.
      const wn = w.createDiv({ cls: "ecl-f-cnote" });
      if (c.weeks.length > 1 && c.weeksPath) wn.createEl("a", { cls: "ecl-f-cnote-all", text: `All ${c.weeks.length} week notes` }).onclick = () => view.openLanding(c.weeksPath);
      else wn.setText(c.weeks.length > 1 ? `Latest of ${c.weeks.length} week notes` : "1 week note");
    }
    const v = section(parent, "Revise", null, "ecl-f-csec");
    if (!c.revise.length) quiet(v, "Nothing to revise yet");
    c.revise.slice(0, 4).forEach((x) => {
      const r = v.createDiv("ecl-f-crow");
      r.createSpan({ cls: "ecl-f-what", text: x.title });
      r.createEl("small", { text: "edited " + agoLong(x.mtime) });
      r.onclick = () => view.openNote(x.path);
    });
    if (edu && c.over) aSec();
    // Recent notes: the way into the notes themselves (those already listed above are left out).
    const shown = new Set([...c.revise.slice(0, 4).map((x) => x.path), ...c.weeks.slice(0, 1).map((x) => x.path), ...c.assess.filter((x) => !x.folder).map((x) => x.path)]);
    const rec = c.recent.filter((x) => !shown.has(x.path)).slice(0, 5);
    if (rec.length) {
      const n = section(parent, "Recent notes", null, "ecl-f-csec");
      rec.forEach((x) => {
        const r = n.createDiv("ecl-f-crow");
        r.createSpan({ cls: "ecl-f-what", text: x.title });
        r.createEl("small", { text: (x.sub ? x.sub + " · " : "") + agoLong(x.mtime) });
        r.onclick = () => view.openNote(x.path);
      });
    }
    if (edu) parent.createEl("a", { cls: "ecl-f-all ecl-f-call", text: `All ${c.nNotes} notes in ${c.code || c.name}` }).onclick = () => view.openLanding(c.path);
  };
  // ---- Edu: the term band (one shared date axis, a lane per course) ----
  let onEduSize = null; // set by the band: places its labels again when the plot's width changes
  const BAND_LANES = 4;
  const termBand = (parent) => {
    const dn = (iso) => dayDiff(iso, "1970-01-01");
    const cands = X.courses.filter((c) => c.term || c.endInf || c.canvas >= today || c.assess.some((a) => a.dueIso));
    const lanes = cands.slice().sort((a, b) => (a.over ? 1 : 0) - (b.over ? 1 : 0)).slice(0, BAND_LANES);
    if (!lanes.length) return null;
    const marks = (c) => {
      const m = c.assess.filter((a) => a.dueIso).map((a) => ({ iso: a.dueIso, name: a.name, w: a.weight, a }));
      if (c.canvas && c.canvas >= today) m.push({ iso: c.canvas, name: "Canvas closes", canvas: true });
      return m;
    };
    const pts = [];
    for (const c of lanes) { if (c.term) pts.push(dn(c.term.start), dn(c.term.end)); else if (c.endInf) pts.push(dn(c.endInf)); for (const m of marks(c)) pts.push(dn(m.iso)); }
    let lo = Math.min(...pts), hi = Math.max(...pts);
    const tn = dn(today);
    if (tn >= lo - 30 && tn <= hi + 30) { lo = Math.min(lo, tn); hi = Math.max(hi, tn); }
    const sp = Math.max(hi - lo, 14);
    lo -= Math.round(sp * 0.02) + 1; hi += Math.round(sp * 0.03) + 2;
    const pc = (n) => ((n - lo) / (hi - lo)) * 100, inR = (n) => n >= lo && n <= hi;

    const band = parent.createDiv("ecl-f-eb");
    const ov = band.createDiv("ecl-f-eb-ov");
    const axis = band.createDiv("ecl-f-eb-row ecl-f-eb-axis");
    axis.createDiv("ecl-f-eb-lab");
    const axPlot = axis.createDiv("ecl-f-eb-plot");
    // Months on the axis row, with a faint line down through the lanes.
    const f0 = new Date(1970, 0, 1 + lo);
    let mY = f0.getFullYear(), mM = f0.getMonth();
    const monthN = (y, m) => dn(isoDay(new Date(y, m, 1)));
    if (monthN(mY, mM) < lo) mM++;
    const addMonth = (n, txt, edge) => { axPlot.createSpan({ cls: "ecl-caps ecl-f-eb-mo" + (edge ? " is-edge" : ""), text: txt }).style.left = pc(n) + "%"; if (!edge) ov.createDiv("ecl-f-eb-mline").style.left = pc(n) + "%"; };
    if (pc(monthN(mY, mM)) > 14) addMonth(lo, fmtDay(new Date(mY, mM - 1, 1), { month: "short" }), true);
    for (; monthN(mY, mM) <= hi; mM++) addMonth(monthN(mY, mM), fmtDay(new Date(mY, mM, 1), { month: "short" }));
    let todayLab = null;
    if (inR(tn)) {
      ov.createDiv("ecl-f-eb-today").style.left = pc(tn) + "%";
      todayLab = axPlot.createSpan({ cls: "ecl-caps ecl-f-eb-tl", text: "Today  ·  " + dShort(today) });
      todayLab.style.left = pc(tn) + "%";
    }
    const refs = [];
    for (const c of lanes) {
      const row = band.createDiv("ecl-f-eb-row ecl-f-eb-lane");
      const lab = row.createDiv("ecl-f-eb-lab");
      lab.onclick = () => view.openLanding(c.path);
      if (c.code) lab.createDiv({ cls: "ecl-caps ecl-f-ccode", text: c.code });
      lab.createEl("h3", { cls: "ecl-f-cname ecl-f-eb-name", text: c.name }).title = c.name;
      lab.createDiv({ cls: "ecl-f-cmeta", text: courseState(c) });
      lab.createDiv({ cls: "ecl-f-cmeta ecl-f-eb-sub", text: [pl(c.nNotes, "note"), c.weeks.length ? pl(c.weeks.length, "week note") : ""].filter(Boolean).join(", ") });
      const plot = row.createDiv("ecl-f-eb-plot");
      const at = (cls, n, w) => { const e = plot.createDiv(cls); e.style.left = pc(n) + "%"; if (w != null) e.style.width = w + "%"; return e; };
      const t = c.term, ms = marks(c);
      if (t) {
        const s = dn(t.start), e = dn(t.end), p = Math.min(Math.max(tn, s), e);
        at("ecl-f-eb-ln", s, pc(e) - pc(s));
        if (p > s) at("ecl-f-eb-ln is-lit", s, pc(p) - pc(s));
        for (let i = 0; i < t.weeks; i++) { const x = s + i * 7; if (x <= e) at("ecl-f-eb-tick" + (c.weeks.some((w) => w.n === i + 1) ? " is-lit" : ""), x); }
        at("ecl-f-eb-end", e);
      } else if (c.endInf) {
        const e = dn(c.endInf);
        at("ecl-f-eb-dash is-inf", lo, pc(e) - pc(lo)); at("ecl-f-eb-end", e);
      }
      const cv = ms.find((m) => m.canvas);
      if (cv) { const from = courseEnd(c) ? dn(courseEnd(c)) : Math.max(lo, ...ms.filter((m) => !m.canvas).map((m) => dn(m.iso))); at("ecl-f-eb-dash", from, pc(dn(cv.iso)) - pc(from)); }
      // Same-day items share one marker and one label.
      const byDay = new Map();
      for (const m of ms) { const g = byDay.get(m.iso) || { iso: m.iso, n: dn(m.iso), parts: [], today: m.iso === today }; g.parts.push(m); byDay.set(m.iso, g); }
      const groups = [...byDay.values()].sort((a, b) => a.n - b.n);
      for (const g of groups) {
        const real = g.parts.find((m) => !m.canvas);
        const mk = at(real ? "ecl-f-eb-dia" + (g.parts.some((m) => m.a && isGold(m.a)) ? " is-gold" : "") : "ecl-f-eb-ring", g.n);
        mk.title = g.parts.map((m) => m.name).join(" + ") + "  ·  " + dShort(g.iso);
        if (real && real.a) mk.onclick = () => (real.a.folder ? view.openLanding(real.a.path) : view.openNote(real.a.path));
      }
      if (!groups.length) plot.createDiv({ cls: "ecl-f-eb-none", text: "No assessment has a date yet" });
      if (c.endInf && !t) groups.push({ iso: c.endInf, n: dn(c.endInf), parts: [], inf: true });
      groups.sort((a, b) => a.n - b.n);
      refs.push({ c, plot, groups, labs: plot.createDiv("ecl-f-eb-labs") });
    }
    if (cands.length > BAND_LANES || X.courses.length > lanes.length) band.createDiv({ cls: "ecl-f-eb-more", text: `${X.courses.length - lanes.length} more ${X.courses.length - lanes.length === 1 ? "course" : "courses"} below` });

    // Labels: placed in pixels on the measured plot, so they can be tested against each other.
    let lastW = 0;
    const placeAll = () => {
      const W = axPlot.clientWidth;
      if (!W || W === lastW) return;
      lastW = W;
      const tx = inR(tn) ? (pc(tn) / 100) * W : null;
      if (todayLab) { todayLab.removeClass("is-flip"); todayLab.style.transform = ""; const w = todayLab.offsetWidth; todayLab.toggleClass("is-flip", tx + w + 6 > W); }
      for (const L of refs) {
        L.labs.empty();
        const placed = { up: [], dn: [] };
        let pref = "up";
        for (const g of L.groups) {
          const x = (pc(g.n) / 100) * W;
          const names = g.parts.map((m) => m.name).join(" + "), ws = g.parts.filter((m) => m.w != null).map((m) => m.w + "%").join(" · "), date = dShort(g.iso);
          const build = (full) => {
            const el = L.labs.createDiv("ecl-f-eb-l");
            if (g.inf) { el.createSpan({ text: `ends ~${date} (inferred)` }); return el; }
            if (full) el.createDiv({ cls: "ecl-f-eb-l1", text: clip(names, 54) }).title = names;
            const l2 = el.createDiv("ecl-f-eb-l2");
            if (ws) l2.createEl("b", { text: ws });
            l2.appendText((ws ? " " : "") + date);
            return el;
          };
          let ok = false;
          for (const full of g.inf ? [true] : [true, false]) {
            if (ok) break;
            const el = build(full), w = el.offsetWidth;
            for (const side of [pref, pref === "up" ? "dn" : "up"]) {
              for (const flip of [false, true]) {
                const l = flip ? x - w + 3 : x - 3, r = l + w;
                if (ok || l < 0 || r > W) continue;
                if (placed[side].some((q) => l < q[1] + 10 && r > q[0] - 10)) continue;
                if (tx != null && !g.today && l < tx + 6 && r > tx - 6) continue;
                el.addClass("is-" + side); el.toggleClass("is-flip", flip); el.style.left = l + "px";
                placed[side].push([l, r]); pref = side === "up" ? "dn" : "up"; ok = true;
              }
            }
            if (!ok) el.remove();
          }
        }
      }
    };
    onEduSize = placeAll;
    placeAll();
    return band;
  };
  // ---- Edu: what is due in the next 14 days, across every course ----
  const nextFortnight = (parent) => {
    const f = eduFacts();
    // Nothing due (a term that is over): the lede and the stats already say so, so the heading and its "Nothing due." line are dropped and only the Admin line stays, which brings the course columns up (R2.8, F1 polish 5).
    if (!f.due.length && !f.canvas.length) return;
    const sec = f.due.length ? section(parent, "Next 14 days", null, "ecl-f-nf") : parent.createDiv("ecl-f-nf is-bare");
    if (f.due.length) {
      const row = sec.createDiv("ecl-f-nf-row");
      f.due.forEach(({ c, a }, i) => {
        const it = row.createDiv("ecl-f-nf-i" + (i === 0 ? " is-gold" : ""));
        it.createDiv({ cls: "ecl-caps ecl-f-nf-d", text: wkShort(a.dueIso) });
        it.createDiv({ cls: "ecl-f-nf-t", text: a.name });
        it.createEl("small", { text: [eduAbbr(c), a.weight != null ? a.weight + "%" : ""].filter(Boolean).join(" · ") });
        it.onclick = () => (a.folder ? view.openLanding(a.path) : view.openNote(a.path));
      });
    }
    if (f.canvas.length) {
      const ad = sec.createDiv("ecl-f-nf-admin");
      ad.createSpan({ cls: "ecl-caps ecl-f-nf-ak", text: "Admin" });
      f.canvas.forEach((c) => { const a = ad.createEl("a", { cls: "ecl-f-nf-al", text: `${eduAbbr(c)} closes in Canvas ${wkShort(c.canvas)}` }); a.onclick = () => view.openLanding(c.path); });
    }
  };
  const courseView = (parent) => {
    if (X.container) {
      // Phone: the courses stack, so a compact row at the top jumps to each (hidden on wider pages, where they sit side by side).
      // Each row: code and name, and the course's next due item (the one thing that tells the rows apart at a glance).
      const jump = parent.createDiv("ecl-f-jump"), cols = [];
      jump.createDiv({ cls: "ecl-caps ecl-t-lbl ecl-f-jump-hd", text: `${pl(X.courses.length, "course")}, below` });
      if (!X.courses.length) quiet(parent, "No courses here yet.");
      // The term band and its key (not on a phone, where the jump rows above stand in), then the next fortnight.
      if (X.courses.length) {
        if (!tiny() && termBand(parent)) {
          const ck = parent.createDiv("ecl-f-key ecl-f-bkey");
          ck.createEl("i", { cls: "ecl-f-kd" }); ck.appendText("assessment");
          ck.createEl("i", { cls: "ecl-f-kr" }); ck.appendText("Canvas closes");
          ck.createEl("i", { cls: "ecl-f-kt is-lit" }); ck.appendText("week with a note");
          ck.createEl("i", { cls: "ecl-f-kt" }); ck.appendText("week without");
          ck.createSpan({ cls: "ecl-f-key-x", text: "line lit up to today" });
        }
        nextFortnight(parent);
      }
      const grid = parent.createDiv("ecl-f-cols");
      for (const c of X.courses) {
        const colEl = grid.createDiv("ecl-f-course");
        cols.push(colEl);
        const j = jump.createEl("a", { cls: "ecl-f-jump-i" });
        const jm = j.createDiv("ecl-f-jump-m"), jt = jm.createDiv("ecl-f-jump-t");
        if (c.code) jt.createSpan({ cls: "ecl-caps ecl-f-jump-c", text: c.code });
        jt.createSpan({ cls: "ecl-f-jump-n", text: c.name });
        const nd = c.assess.find((x) => x.dueIso);
        jm.createEl("small", { cls: "ecl-f-jump-d" + (nd && nd.overdue ? " is-late" : nd && gold && gold.path === nd.path && gold.dueIso === nd.dueIso ? " is-gold" : ""), text: nd ? `${nd.name}  ·  ${nd.dueIso < today && !nd.overdue ? "was " + dShort(nd.dueIso) : dueLine(nd.dueIso, today, nd.overdue)}` : "Nothing dated" });
        j.onclick = () => colEl.scrollIntoView({ block: "start", behavior: "smooth" });
        // The column head: code, name, then a hairline for the term (a lit dot where today falls), its start on the left and where it stands on the right.
        const top = colEl.createDiv("ecl-f-etop");
        top.onclick = () => view.openLanding(c.path);
        if (c.code) top.createDiv({ cls: "ecl-caps ecl-f-ccode", text: c.code });
        top.createEl("h3", { cls: "ecl-f-cname", text: c.name }).title = c.name;
        const hl = top.createDiv("ecl-f-eline");
        if (c.term) {
          hl.createEl("i", { cls: "ecl-f-eline-lit" }).style.width = Math.round(c.term.p * 100) + "%";
          hl.createEl("b", { cls: "ecl-f-eline-dot" }).style.left = Math.round(c.term.p * 100) + "%";
        }
        const lt = top.createDiv("ecl-f-eline-t");
        lt.createSpan({ text: c.term ? dShort(c.term.start) : "" });
        lt.createSpan({ text: courseState(c) });
        courseSections(colEl, c, true);
      }
    } else courseSections(parent.createDiv("ecl-f-cols is-leaf"), X.courses[0]);
    if (X.also.length) rowsBlock(parent, X.also, "Also here");
  };

  // ---- reading queue ----
  const markRead = async (p) => {
    st.marked.add(p.path);
    keepScroll(summary);
    const f = plugin.app.vault.getAbstractFileByPath(p.path);
    try { await plugin.app.fileManager.processFrontMatter(f, (fm) => { if (p.hasRead) fm.read = true; if (p.hasStatus || !p.hasRead) fm.status = "read"; }); }
    catch (e) { st.marked.delete(p.path); keepScroll(summary); new obsidian.Notice("Could not mark it read"); }
  };
  const queueView = (parent) => {
    // Read next comes first; on a phone the category grid follows it (the side list is hidden there).
    const un = unreadItems(), grid = parent.createDiv("ecl-f-qgrid"), left = grid.createDiv("ecl-f-qleft"), right = grid.createDiv("ecl-f-qright"), strip = parent.createDiv("ecl-f-catgrid");
    const rn = section(left, "Read next");
    const picks = un.slice().sort((a, b) => a.saved - b.saved).slice(0, 3);
    if (!picks.length) quiet(rn, "Everything here is read.");
    picks.forEach((p, i) => {
      const el = rn.createDiv("ecl-f-pick" + (i === 0 ? " is-first" : ""));
      el.createEl("a", { cls: "ecl-f-ptitle", text: p.title }).onclick = () => view.openNote(p.path);
      lazyLine(el.createDiv("ecl-f-psum"), p);
      el.createDiv({ cls: "ecl-f-pmeta", text: `Saved ${agoLong(p.saved)} · ${p.cat}` });
      el.createEl("a", { cls: "ecl-f-mark", text: "Mark read" }).onclick = (e) => { e.stopPropagation(); markRead(p); };
    });
    const cats = X.cats.map((c) => ({ ...c, un: c.items.filter((i) => !i.read && !st.marked.has(i.path)) })).sort((a, b) => b.un.length - a.un.length || a.name.localeCompare(b.name));
    if (!cats.some((c) => c.name === st.sel)) st.sel = (cats.find((c) => c.un.length) || cats[0] || { name: "" }).name;
    // Phone: the categories as a two-column grid at the top (name, unread count, one dot per post) in place of the side list;
    // tapping one opens its unread list below. No selected look: the list's own heading names the category.
    const dotsOf = (parentEl, c) => {
      const dots = parentEl.createDiv("ecl-f-dots");
      const ord = c.items.slice().sort((a, b) => a.saved - b.saved), cap = parentEl.hasClass("ecl-f-catcell") ? 14 : 48;
      ord.slice(0, cap).forEach((i) => dots.createEl("i", i.read || st.marked.has(i.path) ? { cls: "is-lit" } : {}));
      if (ord.length > cap) dots.createSpan({ text: `+${ord.length - cap}` });
    };
    if (cats.length) strip.createDiv({ cls: "ecl-caps ecl-t-lbl ecl-f-cathd", text: "The queue" });
    for (const c of cats) {
      const a = strip.createEl("a", { cls: "ecl-f-catcell" });
      const hd = a.createDiv("ecl-f-catcell-h");
      hd.createSpan({ cls: "ecl-f-lname", text: c.name });
      hd.createEl("b", { text: `${c.un.length} unread` });
      dotsOf(a, c);
      a.onclick = () => { st.sel = c.name; st.all = false; keepScroll(summary); const l = body.querySelector(".ecl-f-qlist"); if (l) l.scrollIntoView({ block: "start", behavior: "smooth" }); };
    }
    if (cats.length) {
      const k0 = strip.createDiv("ecl-f-key ecl-f-catkey");
      k0.createSpan({ text: "One dot per saved post:" });
      k0.createEl("i", { cls: "is-lit" }); k0.createSpan({ text: "read" });
      k0.createEl("i"); k0.createSpan({ text: "unread, oldest first" });
    }
    const qs = section(right, "The queue", pl(cats.length, "category").replace("categorys", "categories"));
    for (const c of cats) {
      const r = qs.createDiv("ecl-f-cat" + (c.name === st.sel ? " is-on" : ""));
      bodyCv(r, tiny() ? 40 : 44, tiny() ? 13 : 15, { seed: hashOf(c.name), frac: c.items.length ? 1 - c.un.length / c.items.length : 1, sats: c.un.length });
      const tx = r.createDiv("ecl-f-cat-t");
      tx.createSpan({ cls: "ecl-f-lname", text: c.name });
      tx.createEl("small", { text: `${c.un.length} unread` });
      dotsOf(tx, c);
      const tot = r.createDiv("ecl-f-cat-n");
      tot.createSpan({ text: String(c.items.length) });
      tot.createEl("small", { cls: "ecl-caps", text: "saved" });
      r.onclick = () => { st.sel = c.name; st.all = false; keepScroll(summary); };
    }
    // A key for the dots: filled = read, open = still unread (oldest first).
    const key = qs.createDiv("ecl-f-key");
    key.createEl("i", { cls: "is-lit" }); key.createSpan({ text: "read" });
    key.createEl("i"); key.createSpan({ text: "unread, oldest first" });
    key.createSpan({ cls: "ecl-f-key-x", text: "  ·  lit part of a body = share read" });
    const sel = cats.find((c) => c.name === st.sel);
    if (sel && sel.un.length) {
      const ls = section(parent, sel.name, `${sel.un.length} unread`, "ecl-f-qlist");
      const rows = ls.createDiv("ecl-f-rows"), shown = st.all ? sel.un : sel.un.slice(0, 6);
      for (const p of shown.slice().sort((a, b) => a.saved - b.saved)) {
        const el = rows.createDiv("ecl-f-it");
        const m = el.createDiv("ecl-f-it-m");
        m.createSpan({ cls: "ecl-f-what", text: p.title });
        lazyLine(m.createEl("small", { cls: "ecl-f-it-x" }), p);
        el.createEl("small", { cls: "ecl-f-it-d", text: agoLong(p.saved) });
        el.onclick = () => view.openNote(p.path);
      }
      if (sel.un.length > 6) { const t = ls.createEl("a", { cls: "ecl-f-all", text: st.all ? "Show fewer" : `Show all ${sel.un.length}` }); t.onclick = () => { st.all = !st.all; keepScroll(summary); }; }
    }
  };

  // ---- projects in lanes ----
  const projectView = (parent) => {
    // The key first: brightness is how recently the project was touched, in steps so the rows differ at a glance.
    const L = X.lanes, anyKnown = Object.values(L).some((l, i) => l.length && l !== L.unknown);
    parent.createDiv({ cls: "ecl-f-key ecl-f-bkey", text: "Lit part = how recently edited, thin after three months  ·  dashed rim = abandoned" + (L.unknown.length && anyKnown ? "  ·  unknown = no status line in the note" : "") });
    // Nothing has a status yet: say how it is read, in one line (the notes still list below, under Unknown).
    if (!anyKnown && L.unknown.length) {
      const t = parent.createDiv("ecl-f-teach");
      t.createSpan({ text: "A project's lane is read from a " });
      t.createEl("code", { text: "status:" });
      t.createSpan({ text: " line at the top of its note: active, parked, abandoned or done." });
    }
    const grid = parent.createDiv("ecl-f-lanes");
    const heat = heatOf;
    const add = (rows, p, k) => {
      const r = rows.createDiv("ecl-f-pj");
      bodyCv(r, tiny() ? 34 : 36, tiny() ? 11 : 12, { seed: hashOf(p.path), frac: heat(p.mtime), dark: k === "abandoned" });
      const tx = r.createDiv("ecl-f-pj-t");
      tx.createSpan({ cls: "ecl-f-lname", text: p.name });
      const meta = tx.createEl("small", { cls: "ecl-f-lstat", text: (k === "abandoned" ? "abandoned · " : "") + "edited " + agoLong(p.mtime) });
      if (p.dueIso) meta.createSpan({ cls: p.overdue ? "is-late" : gold && gold.path === p.path && gold.dueIso === p.dueIso ? "is-gold" : "", text: ` · ${dueLine(p.dueIso, today, p.overdue)}` });
      const px = tx.createDiv("ecl-f-pj-x");
      lazyLine(px, p);
      r.onclick = () => openThing(p);
    };
    // Active always shows; a lane with nothing in it stays out of the way, so the columns match the stats above.
    const shown = [["active", "Active"], ["parked", "Parked"], ["abandoned", "Abandoned"], ["unknown", "Unknown"]].filter(([k]) => k === "active" || L[k].length);
    grid.style.setProperty("--ecl-lanes", String(shown.length));
    for (const [k, label] of shown) {
      const ps = X.lanes[k], lane = grid.createDiv("ecl-f-lane");
      const hd = lane.createDiv({ cls: "ecl-caps ecl-t-lbl ecl-f-lanehd", text: label });
      hd.createEl("em", { text: String(ps.length) });
      if (!ps.length) quiet(lane, "None");
      const rows = lane.createDiv("ecl-f-lrows");
      // Six fit without a "show all" (it would hide a single row); the link only appears when something is left out.
      const CAP = 6;
      ps.slice(0, CAP).forEach((p) => add(rows, p, k));
      // "show all" belongs to its lane: it sits in the lane's heading, not under the rows where it reads as part of the next lane.
      if (ps.length > CAP) { const more = hd.createEl("a", { cls: "ecl-f-lanemore", text: `show all ${ps.length}` }); more.onclick = () => { more.remove(); ps.slice(CAP).forEach((p) => add(rows, p, k)); startBodies(); }; }
    }
    const done = X.lanes.done;
    if (done.length) {
      const t = parent.createEl("a", { cls: "ecl-f-all ecl-f-done", text: `${st.done ? "Hide done" : "Done"} - ${done.length}` });
      t.onclick = () => { st.done = !st.done; keepScroll(summary); };
      if (st.done) { const rows = parent.createDiv("ecl-f-lrows ecl-f-donerows"); done.forEach((p) => add(rows, p, "done")); }
    }
    if (tiny()) { const k = parent.querySelector(":scope > .ecl-f-bkey"); if (k) parent.appendChild(k); }
  };

  // ---- journal: the last two weeks, then the newest months ----
  const journalView = (parent) => {
    // (The week as seven moons is the top of the page; the months follow.)
    for (const m of X.months.slice(0, 3)) {
      const [y, mo] = m.key.split("-").map(Number), dim = new Date(y, mo, 0).getDate(), days = new Set(m.list.filter((e) => e.day).map((e) => e.iso)).size;
      const sec = parent.createEl("section", { cls: "ecl-t-sec ecl-f-sec ecl-f-month" });
      const hd = sec.createDiv("ecl-f-mhead");
      bodyCv(hd, tiny() ? 36 : 40, tiny() ? 12 : 14, { seed: hashOf(m.key), frac: days / dim });
      const tx = hd.createDiv("ecl-f-mhead-t");
      tx.createEl("h3", { cls: "ecl-f-cname", text: fmtDay(new Date(y, mo - 1, 1), { month: "long", year: "numeric" }) });
      tx.createEl("small", { text: `${days} of ${dim} days` });
      const rows = sec.createDiv("ecl-f-rows");
      const addRow = (e) => {
        const r = rows.createDiv("ecl-f-jr");
        r.createSpan({ cls: "ecl-f-jr-d", text: e.iso ? fmtDay(e.iso, { weekday: "short", day: "numeric" }) : e.title });
        const x = r.createSpan({ cls: "ecl-f-jr-x" });
        // The date is already in the left column: lead with what was written.
        const lead = (t) => (t || "").replace(/^\s*(?:(?:daily\s+)?(?:notes?|journal|log|entry)(?:\s+for)?\s+)?\d{4}-(?:\d{2}-\d{2}|W\d{2}|\d{2})\s*[.:,\-–—]*\s*/i, "").trim();
        plugin.journalLine(e.path).then((t) => { if (!x.isConnected) return; const v = lead(t); x.setText(v || "Empty note"); x.toggleClass("is-empty", !v); });
        r.onclick = () => view.openNote(e.path);
      };
      m.list.slice(0, 8).forEach(addRow);
      if (m.list.length > 8) { const more = sec.createEl("a", { cls: "ecl-f-all", text: `Show ${m.list.length - 8} more entries` }); more.onclick = () => { more.remove(); m.list.slice(8).forEach(addRow); }; }
    }
  };
  // ---- work: the week of shifts (about two thirds), a rail beside it, then Jobs, Applications and Recent ----
  let onWorkSize = null; // set by the work view: refits the hour rows to the pane's width
  const workView = (parent) => {
    const row = parent.createDiv("ecl-f-wkrow"), left = row.createDiv("ecl-f-wkleft"), rail = row.createDiv("ecl-f-wkrail");
    const hasShifts = X.shifts.length > 0;
    const hrsTxt = (m) => { const h = Math.round(m / 6) / 10; return (h % 1 ? h.toFixed(1) : String(h)) + " h"; };
    const dayWord = (iso) => { const n = dayDiff(iso, isoDay(plugin.nowDate())); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : wkShort(iso); };
    const weekWord = (o) => (o === 0 ? "This week" : o === 1 ? "Next week" : o === -1 ? "Last week" : o > 0 ? `In ${o} weeks` : `${-o} weeks ago`);
    st.weekOff = st.weekOff || 0;
    let calEl = null, hpx = 0, repaintHours = () => {}, paintCal = () => {}, calEmpty = false;
    // -- the calendar (the shared grid) --
    if (hasShifts) {
      calEl = left.createDiv("ecl-f-wkcal");
      const tones = new Map();
      const wkHpx = () => clamp(Math.round((calEl.clientWidth || 800) / 60), 22, 38);
      paintCal = () => {
        const off = st.weekOff, n = plugin.nowDate();
        const wk = weekModel(plugin, X.shifts, [], wkMonday(off), n, false);
        const go = (o) => { st.weekOff = o; paintCal(); repaintHours(); };
        hpx = wkHpx();
        const g = makeWeekGrid(view, calEl, wk, { nowMins: n.getHours() * 60 + n.getMinutes(), daily: false, weekLabel: weekWord(off), none: "Nothing rostered this week", tones,
          nav: { prev: () => go(st.weekOff - 1), next: () => go(st.weekOff + 1), now: () => go(0), current: off === 0 } });
        g.paint(hpx);
        calEmpty = g.empty;
        // Side by side, the grid takes the rail's height when the rail is the taller one (hour rows up to 38 px).
        const gap = rail.offsetHeight - left.offsetHeight;
        if (gap > 8 && rail.offsetTop === left.offsetTop) g.paint(clamp(hpx + Math.floor(gap / g.hrs), hpx, 38));
      };
      paintCal();
      onWorkSize = () => { if (calEl.isConnected && wkHpx() !== hpx) paintCal(); };
    } else {
      const em = left.createDiv("ecl-f-wkempty");
      em.createDiv({ cls: "ecl-caps ecl-t-lbl", text: "Shifts" });
      em.createEl("p", { cls: "ecl-f-wkem-h", text: "No shifts found in this folder yet." });
      em.createEl("p", { text: "A roster is read from the notes in this folder. A dated bullet is a shift when it has a time range:" });
      em.createEl("code", { text: "- Tuesday 17 November: 10:00-15:00" });
      em.createEl("p", { text: "Give the year once, in a line such as \"Week of 16 November 2026\". A task works too:" });
      em.createEl("code", { text: "- [ ] 10:00 - 15:00 Shop floor 📅 2026-11-17" });
    }
    // -- the rail: the next shift, the week's hours, the kit --
    if (hasShifts) {
      const nsec = section(rail, "Next shift", null, "ecl-f-wkcard"), nbody = nsec.createDiv("ecl-f-wknext");
      const fillNext = () => {
        nbody.empty();
        const w = wkStatus();
        const line = (e) => `${dayWord(e.date)}, ${wkHM(e)} · ${e.label}`;
        if (w.cur) {
          nbody.createDiv({ cls: "ecl-f-wkbig", text: `Now, until ${clock24(w.cur.end)}` });
          nbody.createDiv({ cls: "ecl-f-wkline", text: `${w.cur.label} · started ${clock24(w.cur.start)}` });
          if (w.next) nbody.createDiv({ cls: "ecl-f-wkthen", text: "Then " + line(w.next) });
        } else if (w.next) {
          const mins = Math.max(1, Math.round((wkAt(w.next) - w.ts) / 6e4)), d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
          const big = mins >= 2880 ? `${d} d ${h} h` : mins >= 60 ? `${Math.floor(mins / 60)} h ${m} min` : `${m} min`;
          nbody.createDiv({ cls: "ecl-f-wkbig", text: big });
          nbody.createDiv({ cls: "ecl-f-wkline", text: line(w.next) });
          if (w.then) nbody.createDiv({ cls: "ecl-f-wkthen", text: "Then " + line(w.then) });
        } else {
          nbody.createDiv({ cls: "ecl-f-wkline", text: "No upcoming shift." + (w.last ? ` Last: ${wkShort(w.last.date)}, ${wkHM(w.last)} · ${w.last.label}` : "") });
        }
      };
      fillNext();
      // The countdown follows the clock (a debug date holds it still); the timer ends itself once the rail is gone.
      view.workTimer = window.setInterval(() => { if (!nbody.isConnected) { window.clearInterval(view.workTimer); view.workTimer = null; return; } if (!plugin.debugDate) fillNext(); }, 30000);

      const hsec = section(rail, "Hours rostered", null, "ecl-f-wkcard"), hbody = hsec.createDiv("ecl-f-wkhours");
      repaintHours = () => {
        hbody.empty();
        const off = st.weekOff, cur = wkMins(off);
        const big = hbody.createDiv({ cls: "ecl-f-wkbig", text: cur ? hrsTxt(cur) : "0 h" });
        big.createEl("small", { cls: "ecl-caps", text: weekWord(off).toLowerCase() });
        let offs = [off - 3, off - 2, off - 1, off, off + 1];
        while (offs.length > 2 && offs[0] !== off && !wkMins(offs[0])) offs.shift();
        const mx = Math.max(1, ...offs.map(wkMins));
        for (const o of offs) {
          const mm = wkMins(o), r = hbody.createDiv({ cls: "ecl-f-wkh" + (o === off ? " is-on" : "") });
          r.createSpan({ cls: "ecl-f-wkh-l", text: fmtDay(wkMonday(o), { day: "numeric", month: "short" }) });
          const bar = r.createSpan("ecl-f-wkh-b"); bar.createEl("i").style.width = Math.round((mm / mx) * 100) + "%";
          r.createSpan({ cls: "ecl-f-wkh-v", text: mm ? hrsTxt(mm) : "-" });
          if (o !== off) r.onclick = () => { st.weekOff = o; paintCal(); repaintHours(); };
        }
      };
      repaintHours();
    }
    const ksec = section(rail, "Kit", X.kit.length ? String(X.kit.length) : null, "ecl-f-wkcard");
    if (X.kit.length) for (const k of X.kit.slice(0, 5)) {
      const el = ksec.createDiv("ecl-f-dr");
      el.createEl("i");
      el.createSpan({ cls: "ecl-f-what", text: k.title });
      el.createEl("small", { text: k.when });
      el.onclick = () => view.openNote(k.path);
    } else quiet(ksec, "Notes in a Kit folder (CV, cover letters) are listed here.");

    // -- below: Jobs, Applications, Recent --
    const below = parent.createDiv("ecl-f-wkbelow");
    const jsec = section(below, "Jobs", X.jobs.length ? String(X.jobs.length) : null, "ecl-f-wkjobs");
    if (!X.hasWork) quiet(jsec, `No Work folder yet. A note per job in ${d.tpath} / Work lists here with its next shift.`);
    else if (!X.jobs.length) quiet(jsec, "The Work folder has no notes yet. A note per job lists here with its next shift.");
    else {
      const rows = jsec.createDiv("ecl-f-rows");
      for (const j of X.jobs) {
        const el = rows.createDiv("ecl-f-nr has-prev"), mid = el.createDiv("ecl-f-nr-m");
        mid.createDiv("ecl-f-nr-t").createSpan({ cls: "ecl-f-what", text: j.name });
        lazyLine(mid.createDiv("ecl-f-nr-x"), { path: j.path, title: j.name });
        el.createEl("small", { cls: "ecl-f-wkj-s" + (j.next ? " is-next" : ""), text: j.next ? `Next ${wkShort(j.next.date)}, ${wkHM(j.next)}` : j.last ? `Last ${wkShort(j.last.date)}` : "No roster noted" });
        el.onclick = () => view.openNote(j.path);
      }
    }
    if (hasShifts) paintCal(); // the rail is built now: the grid can take its height
    // An empty week leaves the rail much taller than the calendar: Jobs moves up under the calendar instead of leaving a hole.
    if (hasShifts && calEmpty && X.jobs.length && rail.offsetTop === left.offsetTop && rail.offsetHeight - left.offsetHeight > 120) { jsec.addClass("is-under"); left.appendChild(jsec); }
    const asec = section(below, "Applications", X.apps.length ? String(X.apps.length) : null, "ecl-f-wkapps");
    if (X.apps.length) {
      const rows = asec.createDiv("ecl-f-rows");
      for (const a of X.apps.slice(0, 6)) noteRow(rows, { title: a.title, path: a.path, when: a.when }, false);
    } else {
      quiet(asec, "No applications yet. Nothing to follow up.");
      asec.createDiv({ cls: "ecl-f-wkhint", text: `Put one note per application in ${X.appsPath} to start the list.` });
    }
    if (d.notes.length) {
      const rsec = section(below, "Recent", null, "ecl-f-recsec");
      const rows = rsec.createDiv("ecl-f-rows");
      d.notes.slice(0, 6).forEach((n) => noteRow(rows, n, false));
    }
  };
  const VIEWS = { course: courseView, queue: queueView, projects: projectView, journal: journalView, work: workView };

  // ---- the top: one region per type, the same family (hairline, serif, small caps) with its own art ----
  // Journal: the week as seven phase moons. Course: its moon and the term line with the assessments on it. Project: a body per project,
  // lit by recency, with its status. Plain: when things were touched over the last month. Missing data falls back to the plain top.
  const journalTop = () => {
    const now = plugin.nowDate(), todayIso = isoDay(now), mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const byIso = new Map(X.entries.filter((e) => e.iso).map((e) => [e.iso, e]));
    // The daily folder itself, or a folder inside it (Daily/2026): the create/open action shows there too, unless the nested folder is another year (R2.8, F1 polish 4).
    const dailyRoot = (plugin.daily.folder || "").replace(/^\/+|\/+$/g, "");
    const dailyHere = !!dailyRoot && (dailyRoot === d.tpath || dailyRoot.startsWith(d.tpath + "/") || (d.tpath.startsWith(dailyRoot + "/") && d.tpath.slice(dailyRoot.length + 1).split("/").every((s) => !/^\d{4}$/.test(s) || s === String(now.getFullYear()))));
    const S = tiny() ? 40 : host.hasClass("is-narrow") ? 58 : 76, row = topEl.createDiv("ecl-f-jm-row");
    for (let i = 0; i < 7; i++) {
      const dt = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i), iso = isoDay(dt), e = byIso.get(iso);
      // The phase is the sky that day (noon, local); the dot under it is only "a note exists". The two never mix.
      const age = moonAge(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12)), fr = (1 - Math.cos((age / SYNODIC) * TAU)) / 2, waxing = age < SYNODIC / 2, ph = moonPhase(age);
      const make = iso === todayIso && !e && dailyHere;
      const c = row.createEl("a", { cls: "ecl-f-jm" + (iso === todayIso ? " is-now" : "") + (iso > todayIso ? " is-future" : "") + (e ? " has" : "") + (e || make ? "" : " is-idle") });
      c.createEl("small", { cls: "ecl-caps", text: fmtDay(dt, { weekday: "short" }) });
      bodyCv(c, S, Math.round(S * 0.42), { seed: 5 + i * 3, frac: fr, flip: waxing !== south });
      c.createEl("b", { text: String(dt.getDate()) });
      c.createEl("i");
      c.title = `${ph.name}, ${ph.lit}% lit${e ? " · note written" : make ? " · create today's note" : ""}`;
      if (e) c.onclick = () => view.openNote(e.path);
      else if (make) c.onclick = async () => { const nf = await plugin.createDaily(); if (nf) view.openNote(nf.path); };
    }
    const foot = topEl.createDiv("ecl-f-jm-foot"), key = foot.createDiv("ecl-f-key");
    key.createSpan({ text: "Moon = the sky that day" });
    key.createEl("i", { cls: "is-lit" }); key.createSpan({ text: "a note exists" });
    key.createEl("i"); key.createSpan({ text: "no note" });
    const acts = foot.createDiv("ecl-f-topacts"), te = byIso.get(todayIso);
    if (te) acts.createEl("a", { cls: "ecl-f-dlink", text: "Open today's note" }).onclick = () => view.openNote(te.path);
    else if (dailyHere) acts.createEl("a", { cls: "ecl-f-dlink", text: "Create today's note" }).onclick = async () => { const nf = await plugin.createDaily(); if (nf) view.openNote(nf.path); };
  };
  const courseTop = () => {
    const c = c0, t = c.term, s0 = dayDate(t.start).getTime();
    const items = c.assess.filter((a) => a.dueIso).sort((a, b) => (a.dueIso < b.dueIso ? -1 : a.dueIso > b.dueIso ? 1 : 0)).slice(0, 8);
    // An assessment due after the term's end stretches the axis (the term line stops at its end, a dashed run carries on) instead of piling onto the last tick.
    const lastIso = items.reduce((m, a) => (a.dueIso > m ? a.dueIso : m), t.end), late = lastIso > t.end;
    const span = Math.max(864e5, dayDate(lastIso).getTime() - s0), termFrac = (dayDate(t.end).getTime() - s0) / span;
    const pos = (iso) => clamp((dayDate(iso).getTime() - s0) / span, 0, 1);
    const wrap = topEl.createDiv("ecl-f-ct"), S = tiny() ? 72 : 112;
    bodyCv(wrap.createDiv("ecl-f-ct-moon"), S, Math.round(S * 0.36), { seed: c.seed, frac: c.frac, dark: c.dark, tick: { n: c.weeks.length, total: t.weeks } });
    const plot = wrap.createDiv("ecl-f-tl").createDiv("ecl-f-tl-plot");
    const tline = plot.createDiv("ecl-f-tl-line");
    tline.style.right = (100 - termFrac * 100) + "%";
    tline.createEl("i").style.width = Math.round(t.p * 100) + "%";
    if (late) { const ex = plot.createDiv("ecl-f-tl-line is-after"); ex.style.left = termFrac * 100 + "%"; }
    for (let i = 0; i <= t.weeks; i++) plot.createEl("i", { cls: "ecl-f-tl-tick" }).style.left = (i / t.weeks) * termFrac * 100 + "%";
    items.forEach((a, i) => {
      const x = pos(a.dueIso) * 100, isGold = !!gold && gold.path === a.path && gold.dueIso === a.dueIso;
      plot.createEl("i", { cls: "ecl-f-tl-d" + (isGold ? " is-gold" : "") }).style.left = x + "%";
      // The label hangs off its own stem: text sits 8 px clear of it (on the stem's left when the marker is in the right third), so a weight like "30%" never touches the line.
      const l = plot.createDiv({ cls: `ecl-f-tl-l ${i % 2 ? "is-dn" : "is-up"} ${x > 62 ? "is-r" : ""} lv${i % 4 < 2 ? 0 : 1}${isGold ? " is-gold" : ""}` });
      l.style.left = x + "%";
      l.createSpan({ cls: "ecl-f-tl-n", text: a.name }).title = a.name;
      l.createEl("small", { text: [fmtDay(a.dueIso, { day: "numeric", month: "short" }), a.weight != null ? a.weight + "%" : ""].filter(Boolean).join(" · ") });
      l.onclick = () => (a.folder ? view.openLanding(a.path) : view.openNote(a.path));
    });
    if (today >= t.start && today <= t.end) plot.createEl("i", { cls: "ecl-f-tl-now" }).style.left = pos(today) * 100 + "%";
    const ends = plot.createDiv("ecl-f-tl-ends");
    // The term-end caption is centred on its tick (about 120 px wide) and the right-hand date is about 40 px: when they would touch, the caption takes the right-hand place.
    const closeEnd = late && (1 - termFrac) * (plot.clientWidth || 700) < 170;
    ends.createSpan({ cls: "ecl-caps", text: fmtDay(t.start, { day: "numeric", month: "short" }) });
    if (!items.length) ends.createSpan({ cls: "ecl-f-tl-none", text: "No assessment has a date yet" });
    if (late) {
      // The term's own end is marked on the line; the right-hand date is where the last assessment falls.
      const te = ends.createSpan({ cls: "ecl-caps ecl-f-tl-te", text: "Term ends " + fmtDay(t.end, { day: "numeric", month: "short" }) });
      te.style.left = termFrac * 100 + "%";
      plot.createEl("i", { cls: "ecl-f-tl-tick is-end" }).style.left = termFrac * 100 + "%";
      // Close to the right edge the term-end caption takes the right-hand place (the late assessment's own label carries its date).
      if (closeEnd) te.addClass("is-close");
    }
    if (!late || !closeEnd) ends.createSpan({ cls: "ecl-caps", text: fmtDay(late ? lastIso : t.end, { day: "numeric", month: "short" }) });
    topEl.createDiv({ cls: "ecl-f-key ecl-f-bkey", text: "Lit part = share of the term gone  ·  ticks = weeks, bright once a week note exists  ·  diamond = an assessment" + (items.some((a) => a.weight != null) ? ", with its weight" : "") });
  };
  const plainTop = () => {
    const DAY = 864e5, now = Date.now(), cnt = new Array(30).fill(0);
    for (const n of d.notes) { const k = Math.floor((now - n.mtime) / DAY); if (k >= 0 && k < 30) cnt[29 - k]++; }
    const month = cnt.reduce((a, b) => a + b, 0), mx = Math.max(1, ...cnt), row = topEl.createDiv("ecl-f-plt");
    const tx = row.createDiv("ecl-f-plt-t");
    tx.createDiv({ cls: "ecl-caps ecl-f-plt-c", text: [pl(d.count, "note"), d.subs.length ? pl(d.subs.length, "folder") : ""].filter(Boolean).join("  ·  ") });
    if (d.notes[0]) {
      const lt = tx.createDiv("ecl-f-plt-l");
      lt.createSpan({ cls: "ecl-caps ecl-f-plt-k", text: "Last touched" });
      lt.createEl("a", { cls: "ecl-f-plt-a", text: clip(d.notes[0].title, 60) }).onclick = () => view.openNote(d.notes[0].path);
      lt.createEl("small", { text: d.notes[0].when });
    }
    const sp = row.createDiv("ecl-f-plt-s");
    const bars = sp.createDiv("ecl-f-plt-b");
    cnt.forEach((n) => { const b = bars.createEl("i", n ? {} : { cls: "is-0" }); b.style.height = (n ? 5 + Math.round((n / mx) * 19) : 2) + "px"; });
    const cap = sp.createDiv("ecl-f-plt-cap");
    cap.createSpan({ text: "30 days ago" });
    cap.createSpan({ cls: "ecl-f-plt-n", text: month ? `${month} of ${d.notes.length} ${d.notes.length === 1 ? "note" : "notes"} edited` : "nothing edited this month" });
    cap.createSpan({ text: "today" });
  };
  const fillTop = () => {
    if (!topEl) return;
    topEl.empty();
    if (topKind === "none" || (!d.notes.length && !d.subs.length)) { topEl.addClass("is-off"); return; }
    topEl.removeClass("is-off");
    if (topKind === "journal") journalTop(); else if (topKind === "course") courseTop(); else plainTop();
  };

  const summary = () => {
    body.empty();
    if (view.listIO) { view.listIO.disconnect(); view.listIO = null; }
    body.removeClass("is-list");
    bodies.length = 0;
    fillHead();
    fillTop();
    if (!d.notes.length && !d.subs.length) { body.createDiv({ cls: "ecl-empty ecl-f-empty", text: "No notes yet" }); return; }
    if (VIEWS[T] && X) { VIEWS[T](body); showAll(body); startBodies(); return; }
    const order = d.blocks.filter((b) => BUILD[b]);
    for (let i = 0; i < order.length; i++) {
      const b = order[i], nx = order[i + 1];
      // Due soon and Recent next to each other share a row (stacked when narrow).
      if ((b === "due" && nx === "recent") || (b === "recent" && nx === "due")) {
        const pair = body.createDiv("ecl-f-pair");
        BUILD[b](pair); BUILD[nx](pair); i++;
        if (!pair.childElementCount) pair.remove();
        else if (pair.childElementCount === 1) pair.addClass("is-single");
        continue;
      }
      BUILD[b](body);
    }
    if (!order.includes("recent") && d.notes.length > 5) showAll(body);
    startBodies();
  };

  // ---- the list (Show all) --------------------------------------------
  const list = () => {
    body.empty();
    body.addClass("is-list");
    if (view.listIO) { view.listIO.disconnect(); view.listIO = null; }
    const bar = body.createDiv("ecl-f-tabbar");
    const tabs = bar.createDiv("ecl-f-tabs");
    const close = bar.createEl("a", { cls: "ecl-caps ecl-f-close" });
    close.createSpan({ cls: "ecl-back-mark", text: "‹" });
    close.appendText("Summary");
    close.onclick = () => { st.list = false; st.tab = ""; summary(); scroller().scrollTop = 0; };
    const listEl = body.createDiv("ecl-f-list");
    const counts = new Map();
    for (const n of d.notes) if (n.subPath) counts.set(n.subPath, (counts.get(n.subPath) || 0) + 1);
    const tabDefs = [{ key: "", label: "All", count: d.notes.length }, ...d.subs.filter((s) => counts.get(s.path)).map((s) => ({ key: s.path, label: s.name, count: counts.get(s.path) }))];
    if (!tabDefs.some((t) => t.key === st.tab)) st.tab = "";
    const fill = () => {
      listEl.empty();
      if (view.listIO) { view.listIO.disconnect(); view.listIO = null; }
      const rows = st.tab ? d.notes.filter((n) => n.subPath === st.tab) : d.notes;
      let at = 0;
      const batch = () => {
        const part = rows.slice(at, at + 40);
        at += part.length;
        for (const n of part) {
          const el = listEl.createDiv("ecl-f-ir");
          const main = el.createDiv("ecl-f-ir-main");
          main.createSpan({ cls: "ecl-f-ir-t", text: n.title });
          const pv = main.createSpan({ cls: "ecl-f-ir-x", text: " " });
          plugin.previewOf(n.path, n.title).then((t) => { pv.setText(t || " "); pv.toggleClass("is-empty", !t); });
          el.createEl("small", { cls: "ecl-f-in", text: st.tab ? "" : n.sub || "" });
          el.createEl("small", { cls: "ecl-f-ir-d", text: n.when });
          el.onclick = () => view.openNote(n.path);
        }
        if (at >= rows.length && view.listIO) { view.listIO.disconnect(); view.listIO = null; sentinel.remove(); }
      };
      const sentinel = createDiv("ecl-f-sentinel");
      batch();
      if (at < rows.length) {
        listEl.after(sentinel);
        view.listIO = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) batch(); }, { root: scroller(), rootMargin: "400px" });
        view.listIO.observe(sentinel);
      }
    };
    for (const t of tabDefs) {
      const b = tabs.createEl("a", { cls: "ecl-caps ecl-f-tab" + (t.key === st.tab ? " is-on" : "") });
      b.appendText(t.label);
      b.createSpan({ cls: "ecl-f-tab-n", text: String(t.count) });
      b.onclick = () => {
        st.tab = t.key;
        tabs.querySelectorAll(".ecl-f-tab").forEach((e) => e.removeClass("is-on"));
        b.addClass("is-on");
        body.querySelectorAll(".ecl-f-sentinel").forEach((e) => e.remove());
        fill();
      };
    }
    fill();
    const onTab = tabs.querySelector(".is-on");
    if (onTab && onTab.offsetLeft > tabs.clientWidth - 40) tabs.scrollLeft = onTab.offsetLeft - 20;
  };
  // Escape closes the list before it leaves the page.
  host._closeList = () => { if (!st.list) return false; st.list = false; st.tab = ""; summary(); return true; };
  if (st.list && d.notes.length > 5) { fillTop(); startBodies(); list(); } else summary();
  if (prevTop) scrollEl.scrollTop = prevTop;

  // ---- the object beside the title, and a quiet sky -------------------
  const MS = 84, MR = 28;
  drawFolderObject(mini, { S: MS, R: MR, seed: d.seed, ink, ground, accent: pal.accent, world });
  host._moonCanvas = mini; host._marks = marksEl;
  const sctx = sky.getContext("2d");
  let lastKey = "";
  const layout = () => {
    const W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return;
    sizeCls(W);
    if (tiny() !== builtTiny) { builtTiny = tiny(); if (!st.list) keepScroll(summary); }
    if (onWorkSize && !st.list) onWorkSize();
    if (onEduSize && !st.list) onEduSize();
    // Read by the page flight, in the pane's own pixels; ox/oy are the scale origin inside the small canvas.
    const r = mini.getBoundingClientRect(), b = host.getBoundingClientRect();
    host._moon = { cx: r.left - b.left + MS / 2, cy: r.top - b.top + MS / 2, R: MR, s: [-1, 0], K: -1, frac: 1, W: b.width, H: b.height, ox: MS / 2, oy: MS / 2 };
    const key = W + "x" + H;
    if (key === lastKey) return;
    lastKey = key;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    sky.width = Math.round(W * dpr); sky.height = Math.round(H * dpr);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, W, H);
    // A few stars in the margins, none under the words.
    const cr = col.getBoundingClientRect(), l = cr.left - b.left, rgt = cr.right - b.left;
    const rs = todayRng(d.seed + 17), n = Math.round((W * H) / 2600);
    for (let i = 0; i < n; i++) {
      const px = rs() * W, py = rs() * H, rad = 0.3 + Math.pow(rs(), 5) * 1.1, a = 0.08 + Math.pow(rs(), 2.2) * 0.5, keep = rs();
      const q = smooth(-10, 80, Math.max(l - px, px - rgt));
      if (keep > q) continue;
      sctx.fillStyle = `rgba(${pal.ink},${(a * q).toFixed(3)})`; sctx.beginPath(); sctx.arc(px, py, rad, 0, TAU); sctx.fill();
    }
  };
  layout();
  if (typeof ResizeObserver !== "undefined") {
    let t = 0;
    view.todayRO = new ResizeObserver(() => { window.clearTimeout(t); t = window.setTimeout(layout, 60); });
    view.todayRO.observe(host);
  }
}

// ---- Today (Phase): today's moon is the page ----------------------------
// The real moon at today's phase, stippled, fills the pane. Everything is
// written on its night side; the terminator is the one strong line and
// sunrise / now / sunset sit on it. Waning phases mirror the layout. When
// there is no night side to write on (gibbous and full) the text moves
// beside the moon; on a phone the moon turns so its lit limb is on top and
// the terminator is the horizon.
const todayRng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// o: W, H, cx, cy, R, s (unit vector toward the sun), frac (lit fraction 0 to 1), ink [r,g,b], stars, seed.
function drawPhaseMoon(ctx, o) { for (const _ of phaseMoonGen(ctx, o)); }
function* phaseMoonGen(ctx, o) {
  const K = 1 - 2 * o.frac, s = o.s, n = [-s[1], s[0]], R = o.R, R2 = R * R, ink = o.ink, cx = o.cx, cy = o.cy;
  const col = (a) => `rgba(${ink[0]},${ink[1]},${ink[2]},${a.toFixed(3)})`;
  ctx.clearRect(0, 0, o.W, o.H);
  // Near full, the whole disc is one evenly lit stipple: no terminator, no ring, only a thin sliver of night.
  // Near new, the night side shows a little more earthshine so the disc and its limb stay readable.
  const ev = smooth(0.62, 0.94, o.frac), rs = todayRng(o.starSeed || 11), soft = o.soft || 0, newish = 1 + 0.8 * (1 - smooth(0, 0.2, o.frac));
  // Where the text sits (o.quiet: x0, y0, x1, y1, feather) the dots thin out and dim, so the words stay the loudest thing on the page.
  const qz = o.quiet, qf = qz ? (x, y) => 1 - 0.8 * (1 - smooth(0, qz.f, Math.hypot(Math.max(qz.x0 - x, 0, x - qz.x1), Math.max(qz.y0 - y, 0, y - qz.y1)))) : () => 1;
  // (ON4 T2: a ground-coloured blurred rectangle used to be laid under the words here. The pane is already an opaque ground, so it hid nothing;
  // its soft edge only left 8-bit rounding steps, a lighter card with faint streaks. The ground is now left alone.)
  // Stars: none inside the text column, a thin trickle across its feather, the full field beyond.
  const sq = (x, y) => (qz ? smooth(0.22, 1, qf(x, y)) : 1);
  // Night-side dots fade toward the text along the disc, not along the column's straight edge: the column's near edge is bent into an arc
  // concentric with the disc (blended in over the middle of the disc so there is no seam), and the fade is a little longer.
  const side = qz && (qz.x0 + qz.x1) / 2 < cx ? -1 : 1;
  const sqN = qz && !o.soft ? (x, y) => {
    if (x > qz.x0 && x < qz.x1 && y > qz.y0 && y < qz.y1) return 0; // never a dot under the words
    const dx = x - cx, dy = y - cy, w = smooth(-0.35 * R, 0.6 * R, dx * side), xe = x + w * side * (Math.hypot(dx, dy) - Math.abs(dx));
    return smooth(0.22, 1, 1 - 0.8 * (1 - smooth(0, qz.f * 1.6, Math.hypot(Math.max(qz.x0 - xe, 0, xe - qz.x1), Math.max(qz.y0 - y, 0, y - qz.y1)))));
  } : sq;
  for (let i = 0; i < o.stars; i++) {
    if ((i & 127) === 127) yield;
    const px = rs() * o.W, py = rs() * o.H, rad = 0.3 + Math.pow(rs(), 5) * 1.1, a = 0.1 + Math.pow(rs(), 2.2) * 0.55, q = sq(px, py), keep = rs();
    if ((px - cx) * (px - cx) + (py - cy) * (py - cy) < R2 || keep > q) continue;
    ctx.fillStyle = col(a * (0.4 + 0.6 * q)); ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill();
  }
  // The dot field: dense and bright on the lit side, a very faint earthshine on the night side.
  const l = Math.max(0, cx - R), r = Math.min(o.W, cx + R), t = Math.max(0, cy - R), b = Math.min(o.H, cy + R), w = r - l, h = b - t;
  const rnd = todayRng(o.seed || 3), N = Math.round(w * h * 0.75);
  for (let i = 0; i < N; i++) {
    if ((i & 4095) === 4095) yield;
    const x = l + rnd() * w, y = t + rnd() * h, dx = x - cx, dy = y - cy, r2 = (dx * dx + dy * dy) / R2;
    if (r2 >= 1) continue;
    const u = (dx * s[0] + dy * s[1]) / R, wv = (dx * n[0] + dy * n[1]) / R, tx = Math.sqrt(Math.max(0, 1 - wv * wv)), tu = K * tx;
    let a, rr;
    const q = qf(x, y);
    if (u > tu) {
      let depth = Math.min(1, (u - tu) / (tx * (1 - K) + 1e-6));
      depth = depth * (1 - ev) + (0.62 + 0.3 * Math.sqrt(Math.max(0, 1 - r2))) * ev;
      if (soft) {
        // The phone: a long, wide lit field. Sparse at the terminator, fullest mid-way, thinning again to the limb, and slightly mottled so it reads as a surface.
        // ON7 Y1: the lit cap is shaded like a sphere (Lambert: brightest where the surface faces the sun, falling away to the terminator), so the cap has depth and curve
        // and 40% and 69% read as different shapes; the dark side stays a sparse, faint earthshine.
        const zz = Math.sqrt(Math.max(0, 1 - r2)), lam = Math.max(0, Math.sqrt(Math.max(0, 1 - K * K)) * u - K * zz), lp = Math.pow(lam, 0.55);
        const mott = 0.84 + 0.16 * Math.sin(dx / R * 7 + 1.3 * Math.sin(dy / R * 5)) * Math.sin(dy / R * 6 + 0.9 * Math.sin(dx / R * 4));
        if (rnd() > (0.035 + 0.24 * lp) * mott * sq(x, y)) continue;
        a = (0.3 + 0.62 * lp) * (0.5 + 0.5 * q); rr = 0.5 + 0.4 * rnd() + 0.22 * lp;
      } else {
        // Brightest at the terminator and the limb; the middle of the lit field is quiet so the moon reads as a moon, not a wall of noise.
        // The far limb (where the lit field is deepest) is eased a little so it never out-shouts the heading.
        const edge = Math.max(1 - smooth(0, 0.2, depth), 0.7 * smooth(0.84, 1, Math.sqrt(r2))), sup = (1 - edge) * (1 - 0.6 * ev), lim = smooth(0.8, 1, Math.sqrt(r2)) * (1 - ev);
        if (rnd() > (0.08 + 0.12 * Math.pow(depth, 0.7)) * (1 - 0.62 * sup) * (1 - 0.3 * lim) * q) continue;
        a = (0.35 + 0.6 * depth) * (1 - 0.5 * sup) * (1 - 0.32 * lim) * (0.45 + 0.55 * q); rr = 0.55 + 0.45 * rnd() + 0.2 * depth * (1 - 0.4 * sup) * (1 - 0.3 * lim);
      }
    } else {
      // Earthshine is strongest beside the terminator and eases off with depth into the night, so it fades along the disc's own curve; the limb keeps its faint ring.
      const depthN = (tu - u) / (tx + tu + 1e-6), fade = 1 - 0.75 * smooth(0.06, 0.75, depthN) * (1 - smooth(0.86, 1, Math.sqrt(r2))), qn = sqN(x, y) * (soft ? 1 : fade);
      if (rnd() > (soft ? 0.026 : 0.03) * newish * (1 + 1.3 * smooth(0.88, 1, Math.sqrt(r2))) * qn) continue; /* ON2 P1: phone night side much sparser and dimmer (ON4 R2: a little less sparse again, so the unlit disc reads as part of the moon) */ // (ON2 P5: the night side and the lit field give no dots right under the words)
      a = (soft ? 0.65 : 1) * (0.14 + 0.16 * rnd() + 0.08 * (newish - 1)) * (0.5 + 0.5 * qn); rr = 0.45 + 0.4 * rnd();
    }
    ctx.fillStyle = col(a); ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
  }
  // A faint limb so the night side reads as a dark disc, then the terminator.
  const seg = function* (pt, t0, t1, step, alpha, lw) {
    ctx.lineWidth = lw; ctx.lineCap = "round";
    let prev = pt(t0), c = 0;
    for (let k = t0 + step; k <= t1 + 1e-9; k += step) {
      if (++c % 200 === 0) { yield; ctx.lineWidth = lw; ctx.lineCap = "round"; }
      const q = pt(k), a = alpha(k);
      if (a > 0.01 && prev.x > -20 && prev.x < o.W + 20 && prev.y > -20 && prev.y < o.H + 20) {
        ctx.strokeStyle = col(a); ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      prev = q;
    }
  };
  const edge = soft ? Math.max(1 - ev, 0.6) : 1 - ev; // the phone keeps a faint limb and terminator even at full, so the disc reads as a shape (ON2 P1)
  if (edge > 0.01) {
    const lf = o.limbFade, lfk = (y) => (lf ? 1 - smooth(lf[0], lf[1], y) : 1);
    const hidden = (x, y) => (o.gaps && o.gaps.some((q) => Math.hypot(Math.max(q.x0 - x, 0, x - q.x1), Math.max(q.top - y, 0, y - q.bot)) < 12) ? 0 : 1); // ON7 Z1: the rim is never drawn within 12px of a label
    yield* seg((k) => ({ x: cx + R * Math.cos(k), y: cy + R * Math.sin(k) }), 0, TAU, 0.004, (k) => (soft ? 3.6 : 1) * (0.1 + 0.07 * (newish - 1)) * edge * lfk(cy + R * Math.sin(k)) * sq(cx + R * Math.cos(k), cy + R * Math.sin(k)) * hidden(cx + R * Math.cos(k), cy + R * Math.sin(k)), 0.8); // the night limb fades out under the text, so no hairline cuts the column
    yield* seg((k) => { const uu = K * Math.cos(k), ww = Math.sin(k); return { x: cx + R * (uu * s[0] + ww * n[0]), y: cy + R * (uu * s[1] + ww * n[1]) }; },
      -Math.PI / 2, Math.PI / 2, 0.004, (k) => (soft ? 0.85 : 0.7) * edge * (0.35 + 0.65 * Math.cos(k)), 1.15);
  }
}

function renderToday(view, host, d, sliced) {
  if (host.clientWidth >= WIDE_MIN) { host.removeClass("is-wide"); return renderTodayWide(view, host, d, sliced); }
  host.removeClass("is-wide");
  if (view.todayTimer) { window.clearInterval(view.todayTimer); view.todayTimer = null; }
  const plugin = view.plugin, pal = plugin.palette(), world = WORLDS.find((x) => x.id === plugin.settings.world) || WORLDS[0];
  if (view.todayRO) { view.todayRO.disconnect(); view.todayRO = null; }
  if (view.artJob) { view.artJob.cancel(); view.artJob = null; }
  host.empty();
  host.removeClass("is-home", "is-compact", "is-mirror", "is-beside", "is-phone", "is-folder", "is-narrow", "is-tiny");
  host._closeList = null;
  if (view.listIO) { view.listIO.disconnect(); view.listIO = null; }
  host.addClass("is-today");
  host.style.setProperty("--ecl-warn", world.warn);
  const ink = pal.ink.split(",").map(Number);
  const canvas = host.createEl("canvas", { cls: "ecl-t-moon" });
  const marksEl = host.createDiv("ecl-t-marks");
  const col = host.createDiv("ecl-t-col");

  // ---- text, all from the vault -------------------------------------
  const back = col.createEl("a", { cls: "ecl-caps ecl-back ecl-t-back" });
  back.createSpan({ cls: "ecl-back-mark", text: "‹" });
  back.appendText("Ecliptic");
  back.onclick = () => view.up();
  col.createDiv({ cls: "ecl-caps ecl-t-date", text: d.dateLong });
  col.createEl("h1", { cls: "ecl-t-title", text: d.weekday });
  const placeEl = col.createDiv({ cls: "ecl-t-place" });
  placeEl.createSpan({ text: [d.place, `${d.phase.toLowerCase()}, ${d.lit}% lit`].filter(Boolean).join("  ·  ") });
  // No location yet, so no sunrise or sunset: one quiet line says where to get them (AA9).
  if (!d.sun) setPlaceLink(placeEl, plugin);
  const sunlist = col.createDiv("ecl-t-sunlist");

  const head = (parent, label, note) => {
    const sec = parent.createEl("section", { cls: "ecl-t-sec" });
    const h = sec.createDiv({ cls: "ecl-caps ecl-t-lbl", text: label });
    if (note) h.createEl("em", { text: note });
    return sec;
  };
  const nsec = head(col, "Today's note");
  if (d.note) {
    if (d.note.excerpt) nsec.createEl("p", { cls: "ecl-t-note", text: d.note.excerpt });
    const lk = nsec.createEl("a", { cls: "ecl-t-link", text: "Open " + d.note.name });
    lk.onclick = () => view.openNote(d.note.path);
  } else {
    nsec.createEl("p", { cls: "ecl-t-note is-faint", text: "No note for today yet." });
    const lk = nsec.createEl("a", { cls: "ecl-t-link", text: "Create today's note" });
    lk.onclick = async () => { const nf = await plugin.createDaily(); view.openNote(nf.path); };
  }

  // Rostered shifts and other timed entries: a short schedule, not tasks.
  if (d.schedule && d.schedule.length) {
    const ssec = head(col, "Schedule", "");
    const srows = ssec.createDiv("ecl-t-rows");
    for (const e of d.schedule.slice(0, 4)) {
      const el = srows.createDiv("ecl-t-task is-sched");
      el.createSpan({ cls: "ecl-t-what", text: [e.label, e.start != null ? clock24(e.start) + "-" + clock24(e.end) : ""].filter(Boolean).join(" ") });
      el.createEl("small", { text: e.when });
      el.onclick = () => view.openNote(e.path);
    }
  }

  if (d.time) makeTimeSection(view, col, d.time, isoDay(d.now));

  if (plugin.settings.showTasks) {
    const tsec = head(col, "Tasks", d.openTotal ? `${d.openTotal} open` : "") /* the done count lives on the "N done" line below, so each number is said once */;
    const rows = tsec.createDiv("ecl-t-rows");
    const row = (t) => {
      const el = rows.createDiv({ cls: "ecl-t-task" + (t.overdue ? " is-overdue" : "") + (t.done ? " is-done" : "") });
      el.createEl("i");
      el.createSpan({ cls: "ecl-t-what", text: t.title });
      const meta = [t.due, t.folder, t.overdue ? "overdue" : ""].filter(Boolean).join(" · ");
      if (meta) el.createEl("small", { text: meta });
      el.onclick = () => view.openNote(t.path);
    };
    // Overdue first, then the next few by due date; the rest sit behind one quiet "+ N more" line.
    const ordered = [...d.open.filter((t) => t.overdue), ...d.open.filter((t) => !t.overdue)];
    // A narrow pane shows four, so Recent starts higher up and its first rows clear the scroll fade.
    const narrow = (host.clientWidth || (view.contentEl && view.contentEl.clientWidth) || 1000) < 560;
    const shown = ordered.slice(0, Math.max(narrow ? 4 : 6, d.open.filter((t) => t.overdue).length));
    for (const t of shown) row(t);
    if (ordered.length > shown.length) {
      const rest = ordered.slice(shown.length);
      const more = rows.createDiv({ cls: "ecl-t-task is-more" });
      more.createSpan({ cls: "ecl-t-what", text: `Show ${rest.length} more tasks` });
      more.onclick = () => {
        const at = more.nextSibling;
        more.remove();
        for (const t of rest) { row(t); if (at) rows.insertBefore(rows.lastChild, at); }
        if (view.todayRO) view.todayRO.takeRecords();
      };
    }
    // The list can be shorter than the vault's open tasks: say so rather than imply it is everything.
    if (d.openTotal > d.open.length) rows.createDiv({ cls: "ecl-t-task is-fold is-cap" }).createSpan({ cls: "ecl-t-what", text: `+${d.openTotal - d.open.length} more in your notes` });
    // Finished tasks fold into one faint line (click to show them).
    if (d.done.length) {
      const fold = rows.createDiv({ cls: "ecl-t-task is-done is-fold" });
      fold.createSpan({ cls: "ecl-t-what", text: `${d.done.length} done` });
      fold.onclick = () => {
        const at = fold.nextSibling;
        fold.remove();
        for (const t of d.done) { row(t); if (at) rows.insertBefore(rows.lastChild, at); }
      };
    }
    if (!d.openTotal && !d.open.length && !d.done.length) rows.createDiv({ cls: "ecl-empty", text: "No open tasks" });
  }

  // An empty vault has nothing to list: no Recent section at all, so the page has one clear action (Create today's note).
  const rsec = d.recent.length ? head(col, "Recent") : null;
  const rlist = rsec ? rsec.createDiv("ecl-t-rows") : document.createElement("div");
  for (const r of d.recent) {
    const el = rlist.createDiv("ecl-t-recent");
    el.createSpan({ cls: "ecl-t-what", text: r.title });
    el.createEl("small", { text: [r.folder, r.when].filter(Boolean).join(" · ") });
    el.onclick = () => view.openNote(r.path);
  }

  // ---- the marks: sunrise / now / sunset (sun times only with a location) ----
  const marks = [];
  if (d.sun && d.sun.exact) marks.push({ name: "Sunrise", mins: d.sun.rise, kind: "sun" });
  marks.push({ name: "Now", mins: d.nowMins, kind: "now" });
  if (d.sun && d.sun.exact) marks.push({ name: "Sunset", mins: d.sun.set, kind: "sun" });
  for (const m of marks) {
    m.time = fmtClock(m.mins);
    m.el = marksEl.createDiv({ cls: "ecl-t-mark is-" + m.kind });
    m.el.createEl("i");
    const lab = m.el.createDiv("ecl-t-mark-lab");
    lab.createDiv({ cls: "ecl-caps", text: m.name });
    lab.createDiv({ cls: "ecl-t-mark-time", text: m.time });
    m.li = sunlist.createDiv({ cls: "ecl-t-sunitem is-" + m.kind });
    m.li.createSpan({ cls: "ecl-caps", text: m.name });
    m.li.createSpan({ cls: "ecl-t-mark-time", text: m.time });
  }

  // ---- layout and the moon -------------------------------------------
  const ctx = canvas.getContext("2d");
  let lastKey = "";
  const layout = (slice) => {
    if (!canvas.isConnected) { if (view.todayRO) { view.todayRO.disconnect(); view.todayRO = null; } return; }
    const W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return;
    const key = W + "x" + H;
    if (key === lastKey) return;
    lastKey = key;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const K = 1 - 2 * d.frac, phone = W < 560, beside = !phone && K <= -0.8, mirror = !phone && !beside && !d.litLeft;
    host.toggleClass("is-phone", phone); host.toggleClass("is-beside", beside); host.toggleClass("is-mirror", mirror);
    let gaps = null, g; // the moon: cx, cy, R, s
    const place = (el, x, y) => { el.style.left = x + "px"; el.style.top = y + "px"; };

    if (phone) {
      // Lit limb on top; the terminator is the horizon and the marks hang down off it.
      // Gibbous and full shrink the disc until the whole full moon fits the pane.
      // Crescents: pull the crest of the limb down into view (a few px under the top edge) so the lit strip reads as a round body, not a flat band.
      // The sky runs under the status bar (the page host starts at the very top of the screen), and the disc is sized so its whole lit limb is on screen:
      // the crest sits just below the top and the terminator (yH) follows from the disc size, so the phase reads as a shape (ON2 P1).
      // ON7 Y1: the whole rim sits inside the pane with air above it (clear of the status bar) and a margin each side, so the disc reads as a body, not a dome cut off by the edges.
      const st = parseFloat(getComputedStyle(document.body).getPropertyValue("--safe-area-inset-top")) || 0, m = Math.max(34, st + 14);
      const R = W * (K >= 0 ? 0.4 : 0.4 + 0.12 * K), yH = m + (1 - K) * R, cy = yH + K * R, cx = W / 2;
      const tyAt = (x) => cy - K * R * Math.sqrt(Math.max(0, 1 - ((x - cx) / R) ** 2));
      g = { cx, cy, R, s: [0, -1] };
      let bottom = 0;
      const base = Math.min(W / 2 - 24, R * 0.9); // the marks stay on the terminator, which is only 2R wide when the disc is small
      // ON7 Z1: every label (name and time) keeps at least LIMB_GAP from the disc's rim and TERM_GAP from the terminator, at every phase.
      // Each label hangs off its own stem, to the right of it by default, and takes the nearest spot that clears the rim, the terminator, the pane edges,
      // the other labels and the other stems: first by turning to the other side of its stem, then by hanging higher or lower. The two sun labels share one
      // baseline where they can, so SUNRISE and SUNSET read as a pair; Now sits on its own tier. Where the marks cannot all be placed along the whole terminator
      // (the disc is small at gibbous phases) they are drawn a little closer together until they can. As a last resort the rim is left undrawn behind a label.
      const LIMB_GAP = 14, TERM_GAP = 6, lh = 32; // (14 so the text itself, which overhangs its line box by a pixel or so, is never nearer than 12)
      const nowM = marks.find((q) => q.kind === "now"), sunM = marks.filter((q) => q.kind !== "now");
      const lwOf = new Map(marks.map((q) => [q, q.el.querySelector(".ecl-t-mark-lab").offsetWidth || 66]));
      const termPts = []; for (let i = 0; i <= 120; i++) { const k = -Math.PI / 2 + (i / 120) * Math.PI; termPts.push([cx + R * Math.sin(k), cy - K * R * Math.cos(k)]); }
      const boxOf = (p, flip, off) => { const x0 = flip ? p.x - 7 - p.lw : p.x + 7; return { x0, x1: x0 + p.lw, top: p.y + off - 10, bot: p.y + off - 10 + lh }; };
      // AA5: the sun labels hang outward by default (sunrise to the left of its stem, sunset to the right) and turn inward only where the rim, the terminator or another stem leaves no room, so the same phase reads the same way day to day.
      const sides = (q) => (q.name === "Sunrise" ? [true, false] : [false, true]);
      const solve = (half, cap, loose) => {
        const xOf = (q) => cx - half + (q.mins / 1440) * 2 * half;
        const pos = new Map(marks.map((q) => [q, { m: q, x: xOf(q), y: tyAt(xOf(q)), lw: lwOf.get(q) }]));
        const nowP = nowM && pos.get(nowM), boxes = [], stems = [];
        const valid = (p, flip, off) => {
          if (off < 12 || off > cap) return false; // (a stem longer than cap reads as a leader line to nowhere: squeeze the marks together first)
          const b = boxOf(p, flip, off);
          if (b.x0 < 8 || b.x1 > W - 8) return false;
          const near = (x, y) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.top - y, 0, y - b.bot));
          const far = Math.max(...[[b.x0, b.top], [b.x1, b.top], [b.x0, b.bot], [b.x1, b.bot]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
          if (!(far <= R - LIMB_GAP || near(cx, cy) >= R + LIMB_GAP)) return false; // wholly inside the rim with room to spare, or wholly outside it
          for (const [x, y] of termPts) if (near(x, y) < TERM_GAP) return false;
          for (const o of boxes) if (b.x0 < o.x1 + 6 && o.x0 < b.x1 + 6 && b.top < o.bot + 12 && o.top < b.bot + 12) return false; // labels keep 12px apart
          // another mark's stem never runs through a label; Now's stem is not placed yet while the sun labels are, so it is taken as running to the bottom
          const all = nowP && p !== nowP && !stems.some((s) => s.p === nowP) ? stems.concat({ p: nowP, y0: nowP.y, y1: 1e9 }) : stems;
          for (const s of all) if (s.p !== p && s.p.x > b.x0 - 4 && s.p.x < b.x1 + 4 && s.y1 > b.top && s.y0 < b.bot) return false;
          return true;
        };
        const put = (r) => { boxes.push(boxOf(r.p, r.flip, r.off)); stems.push({ p: r.p, y0: r.p.y, y1: r.p.y + r.off - 10 }); return r; };
        // the nearest valid spot to the wanted offset: same side of the stem first, then the other, widening up and down
        const find = (p, want) => {
          for (let d = 0; d <= 200; d += 2) for (const o of d ? [want + d, want - d] : [want]) for (const fl of sides(p.m)) if (valid(p, fl, o)) return { p, flip: fl, off: o };
          return loose ? { p, flip: false, off: Math.max(12, want) } : null;
        };
        // where the terminator drops away under a label (the horns of a crescent, the bow of a gibbous disc) the label hangs below the lowest point of the curve under its width
        const underOf = (p) => { let low = p.y; for (let k = 0; k <= 8; k++) low = Math.max(low, tyAt(p.x + 7 + (p.lw * k) / 8)); return low - p.y; };
        const res = [];
        if (sunM.length) {
          const wantT = Math.max(...sunM.map((q) => { const p = pos.get(q), u = underOf(p); return p.y + 12 + (u > 0 ? u + 6 : 0); }));
          const tryTier = (T) => {
            const n0 = boxes.length, s0 = stems.length, rs = [];
            for (const q of sunM) {
              const p = pos.get(q), fl = sides(q).find((f) => valid(p, f, T - p.y));
              if (fl === undefined) { boxes.length = n0; stems.length = s0; return null; }
              rs.push(put({ p, flip: fl, off: T - p.y }));
            }
            return rs;
          };
          let shared = null;
          for (let d = 0; d <= 200 && !shared; d += 2) for (const T of d ? [wantT + d, wantT - d] : [wantT]) { shared = tryTier(T); if (shared) break; }
          if (shared) res.push(...shared);
          else for (const q of sunM) { const p = pos.get(q), r = find(p, wantT - p.y); if (!r) return null; res.push(put(r)); }
        }
        if (nowP) { const u = underOf(nowP), r = find(nowP, 44 + (u > 0 ? u + 6 : 0)); if (!r) return null; res.push(put(r)); }
        return res;
      };
      let placed = null;
      for (const cap of [72, 1e9]) { for (const f of [1, 0.93, 0.86, 0.79, 0.72, 0.65, 0.58]) { placed = solve(base * f, cap, false); if (placed) break; } if (placed) break; }
      if (!placed) placed = solve(base, 1e9, true);
      for (const r of placed) {
        const m = r.p.m;
        place(m.el, r.p.x, r.p.y); m.el.style.setProperty("--stem", r.off + "px");
        m.el.classList.add("is-hang"); m.el.classList.toggle("is-flip", r.flip);
        bottom = Math.max(bottom, r.p.y + r.off + 32);
      }
      gaps = placed.map((r) => boxOf(r.p, r.flip, r.off));
      const top = marks.length ? bottom + 2 : yH + 12;
      col.addClass("is-stack"); col.removeClass("is-side", "is-flush"); col.style.removeProperty("left"); col.style.removeProperty("width"); col.style.top = top + "px";
    } else if (beside) {
      const Wt = Math.max(300, Math.min(430, W * 0.42)), avail = W - 80 - Wt, R = Math.min(0.46 * H, avail * 0.46);
      g = { cx: W - 40 - avail / 2 + avail * 0.04, cy: H / 2, R, s: d.litLeft ? [-1, 0] : [1, 0] };
      col.removeClass("is-stack"); col.addClass("is-side", "is-flush"); col.style.removeProperty("left"); col.style.removeProperty("top"); col.style.width = Wt + "px";
      for (const m of marks) m.el.classList.remove("is-hang");
    } else {
      const Wc = Math.max(300, Math.min(430, W * 0.48)), GAP = K < 0 ? 104 : 80, cy = H / 2; // gibbous: the terminator bows toward the column, so the marks get a wider gap
      const colLeft = W - 40 - Wc;
      const cxOf = (R) => { const wmax = Math.min(1, (H / 2 - 24) / R), qEnds = Math.sqrt(1 - wmax * wmax); return colLeft - GAP + K * R * (K > 0 ? qEnds : 1); };
      // The lit limb is a true arc or it is off the pane, never a short arc that meets the pane edge at a corner (ON4 T1):
      // where the limb would cut the edge within the pane's height, the disc is made a little smaller until it sits whole inside the edge.
      let R = Math.min(0.77 * H, 0.66 * W);
      const cutsEdge = (r) => { const c0 = cxOf(r); return c0 - r < 10 && (c0 >= r || Math.sqrt(r * r - c0 * c0) < H / 2 + 8); };
      for (let r = R; r > 0.5 * R; r -= 3) { if (!cutsEdge(r)) { R = r; break; } }
      const cx = cxOf(R);
      const tx = (y) => cx - K * R * Math.sqrt(Math.max(0, 1 - ((y - cy) / R) ** 2));
      const X = (x) => (mirror ? W - x : x);
      g = { cx: X(cx), cy, R, s: mirror ? [1, 0] : [-1, 0] };
      // The column sits centred in the night side (the strip between the terminator marks and the pane edge) instead of hugging the moon:
      // it is as wide as its content (at most 560, at most the strip), so an empty page no longer leaves a wide dead gutter on its right (ON3 B4).
      const spanR = W - 40, spanL = Math.min(Math.max(colLeft - 30, tx(cy) + 70), spanR - 240);
      col.removeClass("is-stack", "is-flush"); col.addClass("is-side", "is-measure"); col.style.removeProperty("left"); col.style.removeProperty("width"); col.style.removeProperty("top");
      const natural = col.offsetWidth; col.removeClass("is-measure");
      const bw = Math.round(Math.max(240, Math.min(natural, 560, spanR - spanL)));
      const leftU = Math.round((spanL + spanR) / 2 - bw / 2);
      Object.assign(col.style, { left: (mirror ? W - leftU - bw : leftU) + "px", width: bw + "px" });
      // Evenly by time of day down the edge, pushed apart so labels never touch.
      // Sorted by time of day, so labels never swap over; 60px apart so Now never sits on Sunset.
      const y0 = 64, y1 = H - 64, ord = marks.slice().sort((a, b) => a.mins - b.mins), ys = ord.map((m) => y0 + (m.mins / 1440) * (y1 - y0));
      for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < 60) ys[i] = ys[i - 1] + 60;
      const over = ys.length ? ys[ys.length - 1] - (H - 40) : 0;
      if (over > 0) for (let i = 0; i < ys.length; i++) ys[i] -= over;
      ord.forEach((m, i) => { m.el.classList.remove("is-hang"); place(m.el, X(tx(ys[i])), ys[i]); });
    }
    sunlist.toggleClass("is-on", beside);
    marksEl.toggleClass("is-off", beside);
    // Fit the column to the pane: a tighter rhythm first, then fewer Recent rows; the scroll fade is the fallback.
    {
      const rr = Array.from(rlist.querySelectorAll(".ecl-t-recent"));
      col.removeClass("is-tight"); rr.forEach((e) => e.classList.remove("ecl-off"));
      const over = () => col.scrollHeight > col.clientHeight + 1;
      if (over()) col.addClass("is-tight");
      let shown = rr.length;
      // On the phone the column scrolls (with room at the end), so no Recent rows are dropped.
      while (!phone && over() && shown > 2) rr[--shown].classList.add("ecl-off");
    }
    const quiet = { x0: col.offsetLeft, y0: col.offsetTop, x1: col.offsetLeft + col.offsetWidth, y1: col.offsetTop + col.offsetHeight, f: phone ? 70 : 90 };
    if (phone) { quiet.x0 = 0; quiet.x1 = W; quiet.y1 = H; }
    // Phone: the disc's outline fades out before the text column so it never runs through the lists.
    const limbFade = phone ? [col.offsetTop - 30, col.offsetTop + 30] : null;
    const gen = phaseMoonGen(ctx, { W, H, cx: g.cx, cy: g.cy, R: g.R, s: g.s, frac: d.frac, ink, stars: Math.round(W * H / 2400), starSeed: 11, seed: 3, soft: phone ? 1 : 0, quiet, limbFade, gaps });
    if (view.artJob) { view.artJob.cancel(); view.artJob = null; }
    if (slice === true) view.artJob = sliceRun(gen, () => { view.artJob = null; });
    else for (const _ of gen);
    host._moon ={ cx: g.cx, cy: g.cy, R: g.R, s: g.s, K, frac: d.frac, W, H }; // read by the page flight
    host._moonCanvas = canvas; host._marks = marksEl;
  };
  layout(!!sliced);
  if (typeof ResizeObserver !== "undefined") {
    let t = 0;
    view.todayRO = new ResizeObserver(() => { window.clearTimeout(t); t = window.setTimeout(() => layout(false), 60); });
    view.todayRO.observe(host);
  }
}

// ---- Today, wide: the whole moon, the day's lists, and the week under them ------------------------
// A pane at least WIDE_MIN wide gets this page (option B of the second overnight round); narrower panes and the phone keep renderToday's layouts.
// The moon sits whole at one side with sunrise / now / sunset on its terminator; the day's note, tasks and recent notes are written on its night side;
// under them is the week: seven day columns, an hour axis fitted to that week's timed entries, shift blocks, a now-line, due items in an all-day strip.
const WIDE_MIN = 900, WIDE_MAX = 1800; // the hero and the week share one centred column, at most WIDE_MAX wide
const SHIFT_TONES = ["236, 228, 214", "128, 140, 152", "190, 160, 112", "146, 170, 150", "170, 140, 160"]; // comma form, so rgba(var(--tone), a) is valid
// ---- "Before it's due": free hours before each deadline (timeData), shared by the wide and the narrow Today ----------
// One row per deadline: when it is due, what it is, the free hours before it against the hours it needs, a pip per free hour grouped by day
// (lit = yours for this, hatched = an earlier deadline takes it, outline = spare, dashed = missing) and one line on why. Dated tasks with no effort fold into one line.
function makeTimeSection(view, parent, t, todayIso) {
  if (!t) return null;
  const plugin = view.plugin, empty = !t.rows.length && !t.plain.length;
  if (empty && t.hintOff) return null;
  const sec = parent.createEl("section", { cls: "ecl-t-sec ecl-ti" });
  const h = sec.createDiv({ cls: "ecl-caps ecl-t-lbl", text: "Before it's due" });
  h.createEl("em", { text: "next 14 days" });
  // A click target that the keyboard can reach too: a tab stop, a role, and Enter or Space.
  const act = (el, fn, role, label) => {
    el.tabIndex = 0; el.setAttr("role", role); if (label) el.setAttr("aria-label", label);
    el.addEventListener("click", fn);
    el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); fn(ev); } });
  };
  if (empty) {
    // Nothing to show yet: one quiet line with an example, dismissible (remembered).
    const e = sec.createDiv("ecl-ti-empty"), p = e.createSpan();
    p.appendText("Nothing due in the next 14 days. Add "); p.createEl("code", { text: "effort: 10h" });
    p.appendText(" to a course assessment, or a due date to a task, and the free hours before it show here.");
    const x = e.createEl("button", { cls: "ecl-ti-x", text: "×", attr: { type: "button", "aria-label": "Dismiss this hint" } });
    x.onclick = () => { plugin.settings.timeHintDismissed = true; plugin.save(); (parent.hasClass("ecl-t-time") ? parent : sec).remove(); };
    return sec;
  }
  const key = h.createDiv("ecl-ti-key");
  for (const [cls, txt] of [["is-lit", "free hour you need"], ["is-sp", "spare"], ["is-rs", "taken by an earlier deadline"]]) { const k = key.createSpan(); k.createEl("i", { cls: "ecl-ti-p " + cls }); k.appendText(txt); }
  const hrs = (n) => (Math.round(n * 10) / 10) + " h";
  const at = (m) => { const h12 = Math.floor(m / 60) % 12 || 12, mm = m % 60; return `${h12}${mm ? ":" + pad2(mm) : ""} ${m % 1440 >= 720 ? "pm" : "am"}`; };
  const dayName = (iso) => (dayDiff(iso, todayIso) === 0 ? "Today" : fmtDay(iso, { weekday: "long" }));
  const dayLong = (iso) => `${fmtDay(iso, { weekday: "short" })} ${fmtDay(iso, { day: "numeric" })} ${fmtDay(iso, { month: "short" })}`;
  const grpName = (iso) => (dayDiff(iso, todayIso) >= 7 ? fmtDay(iso, { weekday: "short", day: "numeric" }) : fmtDay(iso, { weekday: "short" }));
  const list = sec.createDiv("ecl-ti-rows");
  const addRow = (into, r) => {
    const known = r.need != null, short = known && r.short > 0, blind = !known && !t.hasBusy;
    const el = into.createDiv({ cls: "ecl-ti-row" + (short ? " is-short" : "") });
    const when = el.createDiv("ecl-ti-when");
    const dl = when.createDiv({ cls: "ecl-caps ecl-ti-day", text: dayLong(r.iso) });
    if (r.dueMin != null) dl.createSpan({ cls: "ecl-ti-at", text: at(r.dueMin) });
    const main = el.createDiv("ecl-ti-main");
    main.createDiv({ cls: "ecl-ti-title", text: r.title });
    const sub = r.kind === "assess" ? [r.code || r.course, r.weight != null ? `${r.weight}% of the unit` : ""] : ["Task"];
    main.createDiv({ cls: "ecl-caps ecl-ti-sub", text: sub.filter(Boolean).join(" · ") });
    const st = main.createDiv("ecl-ti-stat");
    // One meaning of "free" everywhere: hours left after the earlier deadlines take theirs (Home says the same). The raw unbooked total goes in the reason line.
    if (blind) st.createSpan({ cls: "ecl-caps ecl-ti-src", text: "Effort not set" });
    else { st.createSpan({ cls: "ecl-ti-free", text: hrs(r.avail) }); st.createSpan({ cls: "ecl-caps", text: "free" }); }
    if (known) {
      st.createSpan({ cls: "ecl-ti-need", text: `needs ${r.src === "est" ? "~" : ""}${hrs(r.need)}` });
      st.createSpan({ cls: "ecl-caps ecl-ti-src", text: r.src === "est" ? "estimated" : "effort set" });
    }
    if (r.pips) {
      const pips = el.createDiv("ecl-ti-pips");
      for (const p of r.pips) {
        const g = pips.createDiv("ecl-ti-grp"), pr = g.createDiv("ecl-ti-pr");
        for (const [k, n] of [["rs", p.rs], ["lit", p.lit], ["sp", p.sp]]) for (let i = 0; i < n; i++) pr.createEl("i", { cls: "ecl-ti-p is-" + k });
        g.createDiv({ cls: "ecl-caps ecl-ti-dl", text: grpName(p.iso) });
      }
      if (r.shortPips) {
        const g = pips.createDiv("ecl-ti-grp is-short"), pr = g.createDiv("ecl-ti-pr");
        for (let i = 0; i < r.shortPips; i++) pr.createEl("i", { cls: "ecl-ti-p is-short" });
        g.createDiv({ cls: "ecl-caps ecl-ti-dl", text: "Short" });
      }
    }
    // The reason, one line: what is missing and what costs it, or how much is spare; the unbooked total only when earlier deadlines took part of it.
    const note = r.claimed > 0 && r.avail !== r.free && !blind ? ` ${hrs(r.free)} unbooked, ${hrs(r.claimed)} go to earlier deadlines.` : "";
    let why = "";
    if (short) {
      why = `Short by ${hrs(r.short)}.`;
      if (r.cause) why += ` ${dayName(r.cause.iso)}'s ${r.cause.kind} costs ${hrs(r.cause.cost)}; without it you'd have ${hrs(r.cause.without)}.`;
      why += note;
    } else if (known) why = `${hrs(r.spare)} spare.` + note;
    if (known && r.src === "est" && r.weight != null) why += ` About ${hrs(r.need)} is a guess from the ${r.weight}% weight (${t.rate} h a point).`;
    if (!known && r.kind !== "task") why = "Add effort: 10h to the note to check it fits." + note;
    if (why) el.createDiv({ cls: "ecl-ti-why", text: why.trim() });
    const label = `${r.title}, due ${dayLong(r.iso)}${r.dueMin != null ? " " + at(r.dueMin) : ""}. ${blind ? "Effort not set." : `${hrs(r.avail)} free${r.claimed > 0 ? `, after ${hrs(r.claimed)} for earlier deadlines` : ""}.`}${known ? ` Needs ${hrs(r.need)}${short ? `, short by ${hrs(r.short)}` : ""}.` : ""}`;
    act(el, () => view.openNote(r.path, r.line), "link", label);
  };
  // The first eight sit in the list; the rest wait behind "+N more", which opens them in place.
  const SHOW = 8;
  t.rows.slice(0, SHOW).forEach((r) => addRow(list, r));
  if (t.rows.length > SHOW) {
    const rest = list.createDiv("ecl-ti-rest");
    t.rows.slice(SHOW).forEach((r) => addRow(rest, r));
    const n = t.rows.length - SHOW, more = list.createDiv({ cls: "ecl-caps ecl-ti-more", text: `${n} more deadlines` });
    more.setAttr("aria-expanded", "false");
    act(more, () => { const on = !rest.hasClass("is-open"); rest.toggleClass("is-open", on); more.toggleClass("is-open", on); more.setAttr("aria-expanded", String(on)); more.firstChild.textContent = on ? "Fewer deadlines" : `${n} more deadlines`; }, "button");
  }
  if (t.plain.length) {
    const fold = list.createDiv({ cls: "ecl-ti-plain" });
    const head = fold.createDiv({ cls: "ecl-caps ecl-ti-plainhead", text: `${t.plain.length} ${t.plain.length === 1 ? "task" : "tasks"} with dates` });
    head.setAttr("aria-expanded", "false");
    const body = fold.createDiv("ecl-ti-plainbody");
    for (const p of t.plain) {
      const row = body.createDiv("ecl-ti-prow");
      row.createSpan({ cls: "ecl-ti-ptitle", text: p.title });
      row.createSpan({ cls: "ecl-caps ecl-ti-pdate", text: dayLong(p.iso) });
      if (t.hasBusy) row.createSpan({ cls: "ecl-ti-pfree", text: `${hrs(p.avail)} free until then` });
      act(row, () => view.openNote(p.path, p.line), "link");
    }
    act(head, () => { const on = !fold.hasClass("is-open"); fold.toggleClass("is-open", on); head.setAttr("aria-expanded", String(on)); }, "button");
  }
  // What "free" was counted from, so a number is never a mystery (and how to change it).
  const b = t.basis, cnt = (c, one, many) => `${c} ${c === 1 ? one : many}`;
  if (b) {
    const bits = [`counted hours ${clock24(t.from)}-${clock24(t.to)}`];
    if (t.cap) bits.push(`up to ${t.cap} h a day`);
    bits.push(b.shifts + b.classes ? [b.shifts ? cnt(b.shifts, "shift", "shifts") : "", b.classes ? cnt(b.classes, "class", "classes") : ""].filter(Boolean).join(", ") : "no shifts or classes found");
    if (b.unknown) bits.push(cnt(b.unknown, "deadline", "deadlines") + " with hours unknown");
    const bl = sec.createDiv({ cls: "ecl-caps ecl-ti-basis", text: "Based on " + bits.join(" · ") + " · " });
    const a = bl.createEl("a", { text: "Settings" });
    act(a, () => { try { plugin.app.setting.open(); plugin.app.setting.openTabById(plugin.manifest.id); } catch (e) { new obsidian.Notice("Open Settings, then Ecliptic"); } }, "link");
  }
  return sec;
}
// ---- The week: its model and its grid, shared by Today and the work folder page -----------------
// weekModel: the Monday-to-Sunday week starting at `monday`: its days, the timed entries (shifts) falling in it, what falls due,
// the next shift after `now` (across all of `sched`, not only this week) and the minutes rostered. `daily` marks days with a daily note.
function weekModel(plugin, sched, open, monday, now, daily) {
  const todayIso = isoDay(now), nowMin = now.getHours() * 60 + now.getMinutes();
  const days = [...Array(7)].map((_, i) => { const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i), iso = isoDay(dt); return { iso, dn: dt.getDate(), dow: fmtDay(dt, { weekday: "short" }), diff: dayDiff(iso, todayIso), note: daily ? !!plugin.dailyFile(dt) : false }; });
  const events = sched.filter((e) => e.start != null && e.end != null && e.date >= days[0].iso && e.date <= days[6].iso)
    .map((e) => ({ date: e.date, start: e.start, end: e.end, label: e.label, path: e.path }));
  const next = sched.find((e) => e.start != null && (e.date > todayIso || (e.date === todayIso && e.start > nowMin)));
  const due = open.filter((t) => t.due && t.due >= days[0].iso && t.due <= days[6].iso).slice(0, 40).map((t) => ({ date: t.due, title: t.title, path: t.path, overdue: !!t.overdue }));
  return { days, events, due, next: next ? { date: next.date, start: next.start } : null,
    minutes: events.reduce((s, e) => s + ((e.end > e.start ? e.end : e.end + 1440) - e.start), 0) };
}

// makeWeekGrid: seven day columns, an hour axis fitted to the week's timed entries, shift blocks, a now-line, due items in an all-day strip.
// o: nowMins; daily (daily-note dots and key, a day links to its note); weekLabel ("This week"); none (the empty line); tones (a label -> tone Map kept between weeks);
// nav { prev, next, now, current } (arrows beside the title). Returns { hrs, paint(hpx) }; paint returns { nowLine, hpx, h0 }, or null when the week is empty.
function makeWeekGrid(view, weekEl, wk, o) {
  const plugin = view.plugin, toneOf = o.tones || new Map();
  for (const e of wk.events) if (!toneOf.has(e.label)) toneOf.set(e.label, SHIFT_TONES[toneOf.size % SHIFT_TONES.length]);
  const hm = (m) => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
  const nextDay = (iso) => isoDay(new Date(dayDate(iso).getTime() + 864e5));
  // Timed entries as day segments (an overnight one carries on into the next day), then split into side-by-side lanes where they overlap.
  const segs = [];
  for (const e of wk.events) {
    if (e.end > e.start) segs.push({ e, date: e.date, s: e.start, f: e.end });
    else { segs.push({ e, date: e.date, s: e.start, f: 1440 }); if (e.end > 0) segs.push({ e, date: nextDay(e.date), s: 0, f: e.end, cont: true }); }
  }
  for (const day of wk.days) {
    const list = segs.filter((q) => q.date === day.iso).sort((a, b) => a.s - b.s || b.f - a.f), ends = [];
    for (const q of list) { let l = ends.findIndex((x) => x <= q.s); if (l < 0) { l = ends.length; ends.push(0); } ends[l] = q.f; q.lane = l; }
    for (const q of list) q.lanes = ends.length;
  }
  const inWeek = segs.filter((q) => wk.days.some((x) => x.iso === q.date));
  let h0 = 8, h1 = 22;
  if (inWeek.length) {
    h0 = Math.max(0, Math.floor(Math.min(...inWeek.map((q) => q.s)) / 60) - 1);
    h1 = Math.min(24, Math.ceil(Math.max(...inWeek.map((q) => q.f)) / 60) + 1);
    while (h1 - h0 < 6) { if (h0 > 0) h0--; if (h1 - h0 < 6 && h1 < 24) h1++; }
  }
  const shiftCount = wk.events.length, hours = Math.round(wk.minutes / 6) / 10;
  const dayLabel = (a, b) => `${fmtDay(a, { day: "numeric" })} - ${fmtDay(b, { day: "numeric", month: "short" })}`.toUpperCase();
  const paint = (hpx) => {
    weekEl.empty();
    const top = weekEl.createDiv("ecl-w-top");
    const title = top.createDiv({ cls: "ecl-caps ecl-w-title" });
    if (o.nav) {
      const nv = title.createSpan("ecl-w-nav");
      nv.createEl("a", { text: "‹", attr: { title: "Previous week", "aria-label": "Previous week" } }).onclick = o.nav.prev;
      nv.createEl("a", { text: "›", attr: { title: "Next week", "aria-label": "Next week" } }).onclick = o.nav.next;
    }
    title.appendText(`${o.weekLabel || "This week"} · ${dayLabel(wk.days[0].iso, wk.days[6].iso)}`);
    if (shiftCount) title.createSpan({ cls: "ecl-w-gold", text: ` · ${shiftCount} ${shiftCount === 1 ? "shift" : "shifts"}${hours ? " · " + (hours % 1 ? hours : Math.round(hours)) + " h" : ""}` });
    if (o.nav && !o.nav.current) title.createEl("a", { cls: "ecl-w-back", text: "This week" }).onclick = o.nav.now;
    const leg = top.createDiv({ cls: "ecl-caps ecl-w-legend" });
    if (o.daily) leg.createSpan({ cls: "ecl-w-key is-note", text: "Daily note" });
    if (wk.due.length) leg.createSpan({ cls: "ecl-w-key is-due", text: "Due" });
    for (const label of new Set(wk.events.map((e) => e.label))) { const k = leg.createSpan({ cls: "ecl-w-key is-tone", text: label }); k.style.setProperty("--tone", toneOf.get(label)); }
    if (wk.next && wk.events.some((e) => e.date === wk.next.date && e.start === wk.next.start)) leg.createSpan({ cls: "ecl-w-key is-next", text: "Next shift" });
    const tbl = weekEl.createDiv("ecl-w");
    tbl.createDiv("ecl-w-gut");
    for (const day of wk.days) {
      const h = tbl.createDiv({ cls: "ecl-w-hd" + (day.diff < 0 ? " is-past" : day.diff === 0 ? " is-today" : "") });
      h.createDiv({ cls: "ecl-caps", text: day.dow });
      const r = h.createDiv("ecl-w-hr");
      r.createSpan({ cls: "ecl-w-dn", text: String(day.dn) });
      if (o.daily) {
        r.createSpan({ cls: "ecl-w-nd" + (day.note ? " is-on" : ""), attr: { title: day.note ? "Daily note" : "No daily note" } });
        if (day.note) { h.addClass("is-link"); h.onclick = () => { const f = plugin.dailyFile(dayDate(day.iso)); if (f) view.openNote(f.path); }; }
      }
    }
    if (wk.due.length) {
      const ad = tbl.createDiv("ecl-w-allday");
      ad.createDiv("ecl-w-gut");
      for (const day of wk.days) {
        const c = ad.createDiv({ cls: "ecl-w-adc" + (day.diff < 0 ? " is-past" : "") });
        for (const t of wk.due.filter((x) => x.date === day.iso)) {
          const it = c.createDiv({ cls: "ecl-w-due" + (t.overdue ? " is-overdue" : ""), text: t.title, attr: { title: t.title } });
          it.onclick = () => view.openNote(t.path);
        }
      }
    }
    if (!inWeek.length) {
      const body = tbl.createDiv("ecl-w-empty");
      body.createDiv("ecl-w-gut");
      for (const day of wk.days) body.createDiv({ cls: "ecl-w-col" + (day.diff < 0 ? " is-past" : day.diff === 0 ? " is-today" : "") });
      body.createDiv({ cls: "ecl-w-none", text: o.none || "Nothing scheduled this week" });
      return null;
    }
    const gut = tbl.createDiv("ecl-w-gut"), Hpx = (h1 - h0) * hpx;
    gut.style.height = Hpx + "px";
    for (let i = 0; i <= h1 - h0; i++) { const s = gut.createSpan({ text: pad2(h0 + i) }); s.style.top = i * hpx + "px"; }
    let nowLine = null;
    for (const day of wk.days) {
      const c = tbl.createDiv({ cls: "ecl-w-col" + (day.diff < 0 ? " is-past" : day.diff === 0 ? " is-today" : "") });
      c.style.height = Hpx + "px";
      for (let i = 0; i <= h1 - h0; i++) c.createDiv("ecl-w-hl").style.top = i * hpx + "px";
      for (const q of inWeek.filter((x) => x.date === day.iso)) {
        const y = ((q.s / 60) - h0) * hpx, h = Math.max(((q.f - q.s) / 60) * hpx - 2, 14), e = q.e;
        const ev = c.createDiv({ cls: "ecl-w-ev" + (day.diff < 0 || (day.diff === 0 && q.f <= o.nowMins) ? " is-past" : "") + (wk.next && wk.next.date === e.date && wk.next.start === e.start && !q.cont ? " is-next" : "") + (day.diff === 0 && !q.cont ? " is-today" : "") });
        const lw = 100 / q.lanes;
        Object.assign(ev.style, { top: y + "px", height: h + "px", left: `calc(${q.lane * lw}% + 3px)`, width: `calc(${lw}% - 6px)` });
        ev.style.setProperty("--tone", toneOf.get(e.label));
        ev.createEl("b", { text: e.label });
        const mins = (e.end > e.start ? e.end : e.end + 1440) - e.start;
        if (h >= 34) ev.createEl("i", { text: `${hm(e.start)} - ${hm(e.end)}` });
        // The length goes on its own line: after the times it was the part that clipped when a column is narrow.
        if (h >= 70) ev.createEl("i", { cls: "ecl-w-dur", text: (mins % 60 ? (mins / 60).toFixed(1) : mins / 60) + " h" });
        ev.title = `${e.label}  ${hm(e.start)} - ${hm(e.end)}`;
        ev.onclick = () => view.openNote(e.path);
      }
      if (day.diff === 0) {
        const y = ((o.nowMins / 60) - h0) * hpx;
        if (y >= 0 && y <= Hpx) { nowLine = c.createDiv("ecl-w-now"); nowLine.style.top = y + "px"; }
      }
    }
    return { nowLine, hpx, h0 };
  };
  return { hrs: Math.max(1, h1 - h0), empty: !inWeek.length, paint };
}

function renderTodayWide(view, host, d, sliced) {
  const plugin = view.plugin, pal = plugin.palette(), world = WORLDS.find((x) => x.id === plugin.settings.world) || WORLDS[0];
  if (view.todayRO) { view.todayRO.disconnect(); view.todayRO = null; }
  if (view.todayTimer) { window.clearInterval(view.todayTimer); view.todayTimer = null; }
  if (view.artJob) { view.artJob.cancel(); view.artJob = null; }
  host.empty();
  host.removeClass("is-home", "is-compact", "is-mirror", "is-beside", "is-phone", "is-folder", "is-narrow", "is-tiny");
  host._closeList = null;
  if (view.listIO) { view.listIO.disconnect(); view.listIO = null; }
  host.addClass("is-today", "is-wide");
  host.scrollTop = 0;
  host.style.setProperty("--ecl-warn", world.warn);
  const ink = pal.ink.split(",").map(Number);
  const page = host.createDiv("ecl-t-page");
  const hero = page.createDiv("ecl-t-hero");
  const canvas = hero.createEl("canvas", { cls: "ecl-t-moon" });
  const marksEl = hero.createDiv("ecl-t-marks");
  const col = hero.createDiv("ecl-t-col ecl-t-wcol");
  const weekEl = page.createDiv("ecl-t-week");

  // ---- the day's text -------------------------------------------------------
  const back = col.createEl("a", { cls: "ecl-caps ecl-back ecl-t-back" });
  back.createSpan({ cls: "ecl-back-mark", text: "‹" });
  back.appendText("Ecliptic");
  back.onclick = () => view.up();
  col.createDiv({ cls: "ecl-caps ecl-t-date", text: d.dateLong });
  col.createEl("h1", { cls: "ecl-t-title", text: d.weekday });
  const placeEl = col.createDiv({ cls: "ecl-t-place" });
  placeEl.createSpan({ text: [d.place, `${d.phase.toLowerCase()}, ${d.lit}% lit`].filter(Boolean).join("  ·  ") });
  if (!d.sun) setPlaceLink(placeEl, plugin);
  if (d.shiftLine) placeEl.createDiv({ cls: "ecl-t-setplace ecl-t-shiftline", text: d.shiftLine });
  const sunlist = col.createDiv("ecl-t-sunlist");
  const grid = col.createDiv("ecl-t-grid");
  const head = (parent, label, note, cls) => {
    const sec = parent.createEl("section", { cls: "ecl-t-sec " + (cls || "") });
    const h = sec.createDiv({ cls: "ecl-caps ecl-t-lbl", text: label });
    if (note) h.createEl("em", { text: note });
    return sec;
  };
  const nsec = head(grid, "Today's note", "", "is-note");
  if (d.note) {
    if (d.note.excerpt) nsec.createEl("p", { cls: "ecl-t-note", text: d.note.excerpt });
    const lk = nsec.createEl("a", { cls: "ecl-t-link", text: "Open " + d.note.name });
    lk.onclick = () => view.openNote(d.note.path);
  } else {
    nsec.createEl("p", { cls: "ecl-t-note is-faint", text: "No note for today yet." });
    const lk = nsec.createEl("a", { cls: "ecl-t-link", text: "Create today's note" });
    lk.onclick = async () => { const nf = await plugin.createDaily(); view.openNote(nf.path); };
  }
  if (plugin.settings.showTasks) {
    const tsec = head(grid, "Tasks", d.openTotal ? `${d.openTotal} open` : "", "is-tasks");
    const rows = tsec.createDiv("ecl-t-rows");
    const row = (t) => {
      const el = rows.createDiv({ cls: "ecl-t-task" + (t.overdue ? " is-overdue" : "") + (t.done ? " is-done" : "") });
      const box = el.createEl("i", { attr: { role: "checkbox", "aria-label": "Mark done", "aria-checked": String(!!t.done), tabindex: "0" } });
      if (!t.done && t.line != null) {
        const tick = async (ev) => {
          ev.stopPropagation(); ev.preventDefault();
          if (el.hasClass("is-done")) return;
          el.addClass("is-done"); box.setAttr("aria-checked", "true");
          const ok = await plugin.tickTask(t.path, t.line, t.title);
          if (ok === "open") { el.removeClass("is-done"); box.setAttr("aria-checked", "false"); new obsidian.Notice("This task repeats. Tick it in the note, where the Tasks plugin can add the next one."); view.openNote(t.path, t.line); }
          else if (!ok) { el.removeClass("is-done"); box.setAttr("aria-checked", "false"); new obsidian.Notice("That task has moved in its note. Open the note to tick it."); }
        };
        box.addEventListener("click", tick);
        box.addEventListener("keydown", (ev) => { if (ev.key === " " || ev.key === "Enter") tick(ev); });
      }
      el.createSpan({ cls: "ecl-t-what", text: t.title });
      const meta = [t.due, t.folder, t.overdue ? "overdue" : ""].filter(Boolean).join(" · ");
      if (meta) el.createEl("small", { text: meta });
      el.onclick = () => view.openNote(t.path);
    };
    // Overdue first, then the next few by due date; the rest sit behind one quiet "Show N more" line.
    const ordered = [...d.open.filter((t) => t.overdue), ...d.open.filter((t) => !t.overdue)];
    const shown = ordered.slice(0, Math.max(6, d.open.filter((t) => t.overdue).length));
    for (const t of shown) row(t);
    if (ordered.length > shown.length) {
      const rest = ordered.slice(shown.length);
      const more = rows.createDiv({ cls: "ecl-t-task is-more" });
      more.createSpan({ cls: "ecl-t-what", text: `Show ${rest.length} more tasks` });
      more.onclick = () => {
        const at = more.nextSibling;
        more.remove();
        for (const t of rest) { row(t); if (at) rows.insertBefore(rows.lastChild, at); }
        layout(false, true);
      };
    }
    // The list can be shorter than the vault's open tasks: say so rather than imply it is everything.
    if (d.openTotal > d.open.length) rows.createDiv({ cls: "ecl-t-task is-fold is-cap" }).createSpan({ cls: "ecl-t-what", text: `+${d.openTotal - d.open.length} more in your notes` });
    if (d.done.length) {
      const fold = rows.createDiv({ cls: "ecl-t-task is-done is-fold" });
      fold.createSpan({ cls: "ecl-t-what", text: `${d.done.length} done` });
      fold.onclick = () => {
        const at = fold.nextSibling;
        fold.remove();
        for (const t of d.done) { row(t); if (at) rows.insertBefore(rows.lastChild, at); }
        layout(false, true);
      };
    }
    if (!d.openTotal && !d.open.length && !d.done.length) rows.createDiv({ cls: "ecl-empty", text: "No open tasks" });
  }
  if (d.recent.length) {
    const rsec = head(grid, "Recent", "", "is-recent");
    const rlist = rsec.createDiv("ecl-t-rows");
    for (const r of d.recent) {
      const el = rlist.createDiv("ecl-t-recent");
      el.createSpan({ cls: "ecl-t-what", text: r.title });
      el.createEl("small", { text: [r.folder, r.when].filter(Boolean).join(" · ") });
      el.onclick = () => view.openNote(r.path);
    }
  }

  // ---- the marks on the terminator (sun times only with a place) ---------------
  const marks = [];
  if (d.sun && d.sun.exact) marks.push({ name: "Sunrise", mins: d.sun.rise, kind: "sun" });
  marks.push({ name: "Now", mins: d.nowMins, kind: "now" });
  if (d.sun && d.sun.exact) marks.push({ name: "Sunset", mins: d.sun.set, kind: "sun" });
  for (const m of marks) {
    m.time = fmtClock(m.mins);
    m.el = marksEl.createDiv({ cls: "ecl-t-mark is-" + m.kind });
    m.el.createEl("i");
    const lab = m.el.createDiv("ecl-t-mark-lab");
    lab.createDiv({ cls: "ecl-caps", text: m.name });
    lab.createDiv({ cls: "ecl-t-mark-time", text: m.time });
    m.li = sunlist.createDiv({ cls: "ecl-t-sunitem is-" + m.kind });
    m.li.createSpan({ cls: "ecl-caps", text: m.name });
    m.li.createSpan({ cls: "ecl-t-mark-time", text: m.time });
  }

  // ---- the week (the shared grid, makeWeekGrid) -----------------------------
  const wkGrid = makeWeekGrid(view, weekEl, d.week, { nowMins: d.nowMins, daily: true }), paintWeek = wkGrid.paint;
  // ---- before it's due (below the week, in the same column) -------------------
  const timeEl = d.time ? page.createDiv("ecl-t-time") : null;
  if (timeEl && !makeTimeSection(view, timeEl, d.time, isoDay(d.now))) { timeEl.remove(); }

  // ---- layout: the hero (moon, marks, text), then the week ----------------------
  const ctx = canvas.getContext("2d");
  let lastKey = "", wkInfo = null;
  const layout = (slice, force) => {
    if (!canvas.isConnected) { if (view.todayRO) { view.todayRO.disconnect(); view.todayRO = null; } if (view.todayTimer) { window.clearInterval(view.todayTimer); view.todayTimer = null; } return; }
    const W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return;
    if (W < WIDE_MIN) { renderToday(view, host, d, false); return; } // the pane was narrowed: the other layouts take over
    const K = 1 - 2 * d.frac, beside = K <= -0.8, mirror = !beside && !d.litLeft;
    host.toggleClass("is-mirror", mirror); host.toggleClass("is-beside", beside); host.toggleClass("is-phone", false);
    // The column: the hero's moon and text and the week all live in CW pixels, centred in the pane (ox is the gap on each side).
    const CW = Math.min(W, WIDE_MAX), ox = Math.round((W - CW) / 2);
    const X = (x) => ox + (mirror ? CW - x : x);
    const pad = Math.round(clamp(CW * 0.035, 40, 72)), Hh0 = Math.round(clamp(H * 0.54, 380, 640));
    const geo = (Hh) => {
      const R = Math.round(Math.min((Hh - 72) / 2, CW * 0.17)), cx = pad + R, termMax = beside ? cx + R : cx - K * R;
      const L = Math.round(termMax + (beside ? 0 : 112) + 44), colW = Math.max(320, Math.min(CW - pad - L, CW >= 1500 ? 1500 : 1180));
      return { R, cx, L, colW };
    };
    let Hh = Hh0, g = geo(Hh);
    const setCol = () => {
      col.toggleClass("is-two", g.colW < 700);
      const left = ox + (mirror ? Math.max(pad, CW - g.L - g.colW) : g.L);
      Object.assign(col.style, { left: left + "px", width: g.colW + "px" });
    };
    sunlist.toggleClass("is-on", beside); marksEl.toggleClass("is-off", beside);
    for (let pass = 0; pass < 2; pass++) {
      setCol();
      const need = col.offsetHeight + 30 + 36;
      if (need <= Hh) break;
      Hh = need; g = geo(Hh);
    }
    hero.style.height = Hh + "px";
    const cy = Math.round(Hh / 2), { R, cx } = g;
    const tx = (y) => cx - K * R * Math.sqrt(Math.max(0, 1 - ((y - cy) / R) ** 2));
    if (!beside) {
      const y0 = cy - R * 0.74, y1 = cy + R * 0.74, ord = marks.slice().sort((a, b) => a.mins - b.mins), ys = ord.map((m) => y0 + (m.mins / 1440) * (y1 - y0));
      for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < 58) ys[i] = ys[i - 1] + 58;
      const over = ys.length ? ys[ys.length - 1] - (cy + R * 0.9) : 0;
      if (over > 0) for (let i = 0; i < ys.length; i++) ys[i] -= over;
      ord.forEach((m, i) => { m.el.classList.remove("is-hang"); m.el.style.left = X(tx(ys[i])) + "px"; m.el.style.top = ys[i] + "px"; });
    }
    // the moon: drawn again only when its size or place changed
    const key = [W, Hh, R, Math.round(cx), mirror, d.frac].join("|");
    if (key !== lastKey || force === "moon") {
      lastKey = key;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const quiet = { x0: col.offsetLeft - 8, y0: col.offsetTop - 4, x1: col.offsetLeft + col.offsetWidth, y1: col.offsetTop + col.offsetHeight, f: 90 };
      const gen = phaseMoonGen(ctx, { W, H: Hh, cx: X(cx), cy, R, s: mirror ? [1, 0] : [-1, 0], frac: d.frac, ink, stars: Math.round(W * Hh / 2400), starSeed: 11, seed: 3, soft: 0, quiet, limbFade: null, gaps: null });
      if (view.artJob) { view.artJob.cancel(); view.artJob = null; }
      if (slice === true) view.artJob = sliceRun(gen, () => { view.artJob = null; });
      else for (const _ of gen);
    }
    host._moon = { cx: X(cx), cy, R, s: mirror ? [1, 0] : [-1, 0], K, frac: d.frac, W, H: Hh };
    host._moonCanvas = canvas; host._marks = marksEl;
    // The week is aligned to the hero's column and gets the room left under the hero: an hour row is 14 to 44 px tall,
    // so the hero and the week fit the pane's height down to about 760 px; below that the page scrolls.
    host.toggleClass("is-big", CW >= 1500);
    weekEl.style.setProperty("--ecl-wpad", pad + "px");
    weekEl.style.maxWidth = CW + "px";
    if (timeEl) { timeEl.style.setProperty("--ecl-wpad", pad + "px"); timeEl.style.maxWidth = CW + "px"; }
    const hrs = wkGrid.hrs, HMIN = 14;
    wkInfo = paintWeek(HMIN);
    if (wkInfo) {
      const fixed = weekEl.offsetHeight - hrs * HMIN + (parseFloat(getComputedStyle(page).paddingBottom) || 0);
      const hpx = clamp(Math.floor((H - Hh - fixed) / hrs), HMIN, 44);
      if (hpx !== HMIN) wkInfo = paintWeek(hpx);
    }
  };
  layout(!!sliced);
  if (typeof ResizeObserver !== "undefined") {
    let t = 0;
    view.todayRO = new ResizeObserver(() => { window.clearTimeout(t); t = window.setTimeout(() => layout(false), 60); });
    view.todayRO.observe(host);
  }
  // The now-line follows the clock while the page is open.
  view.todayTimer = window.setInterval(() => {
    if (!canvas.isConnected) { window.clearInterval(view.todayTimer); view.todayTimer = null; return; }
    if (view.plugin.debugDate || !wkInfo || !wkInfo.nowLine) return;
    const n = new Date(), y = ((n.getHours() * 60 + n.getMinutes()) / 60 - wkInfo.h0) * wkInfo.hpx;
    if (y >= 0) wkInfo.nowLine.style.top = y + "px";
  }, 60000);
}

const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));

class EclipticView extends obsidian.ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.section = null; this.moves = 0; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() {
    if (this.section === HOME) return "Ecliptic: Today";
    return this.section ? `Ecliptic: ${this.plugin.plain(this.section.split("/").pop())}` : "Ecliptic";
  }
  getIcon() { return "orbit"; }
  // The tab title follows the page. (Obsidian's window title only follows on a real tab switch: the call that forced it is undocumented, so it is not used.)
  retitle() {
    // With a page open the orbit behind it is out of the Tab order; coming back, focus returns to the moon the page came from.
    if (this.orbitEl) this.orbitEl.inert = !!this.section;
    if (!this.section && this.lastFolder !== undefined) { const f = this.lastFolder; this.lastFolder = undefined; this.focusMoon(f); }
    this.leaf.updateHeader && this.leaf.updateHeader();
  }
  getState() { return { section: this.section }; }

  async setState(state, result) {
    if (state && state.section && state.section !== this.section) await this.openLanding(state.section, null, true);
    if (state && !state.section && this.section) this.closeLanding(true);
    return super.setState(state, result);
  }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("ecl-view");
    this.orbitEl = this.contentEl.createDiv("ecl-orbit");
    this.landingEl = this.contentEl.createDiv("ecl-landing");
    this.dotEl = this.contentEl.createEl("canvas", { cls: "ecl-dot is-gone" });
    this.scene =new EclipticScene(this.orbitEl, {
      world: this.plugin.settings.world,
      onOpenSection: (s, at) => this.openLanding(s.folder, at),
      onOpenNote: (path) => this.openNote(path),
      onOpenToday: (t, at) => this.openLanding(HOME, at),
      onWorld: (w) => this.plugin.setWorld(w.id, true),
      onOpenHome: (at) => this.openLanding(HOME, at && { x: at.x, y: at.y, planet: true, r: this.scene ? this.scene.planetR() * 0.5 : 12 }),
      onNewFolder: () => this.plugin.newFolder(),
      onMore: () => this.plugin.openSettings(),
      worlds: this.plugin.worldList(),
      sky: this.plugin.weatherSpec(),
    });
    this.contentEl.tabIndex = -1;
    // Keyboard: every page element that takes a click (divs, anchors with no href) becomes a link you can Tab to and press Enter or Space on.
    // The pages are built in many places, so one observer finds them as they appear.
    this.kbObs = new MutationObserver(() => {
      if (this.kbQueued) return;
      this.kbQueued = true;
      requestAnimationFrame(() => { this.kbQueued = false; makeKeyable(this.landingEl); });
    });
    this.kbObs.observe(this.landingEl, { childList: true, subtree: true });
    this.registerDomEvent(this.landingEl, "keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const t = e.target;
      if (!t || !t.dataset || !t.dataset.eclKey || e.defaultPrevented) return;
      e.preventDefault(); t.click();
    });
    this.setLightNote(this.plugin.lightNoteWanted());
    this.setThemePrompt(this.plugin.themePromptWanted());
    // Escape goes back one level, only while this view has focus.
    this.registerDomEvent(this.contentEl, "keydown", (e) => {
      if (e.key !== "Escape" || !this.section) return;
      e.preventDefault(); e.stopPropagation();
      if (this.landingEl._closeList && this.landingEl._closeList()) return;
      this.up();
    });
    this.refresh();
  }

  // Light mode: one quiet line at the foot of the pane, with a small dismiss that is remembered in the plugin's data.
  setLightNote(on) {
    if (this.lightNoteEl) { this.lightNoteEl.remove(); this.lightNoteEl = null; }
    if (this.scene) this.scene.footNote = !!on || !!this.themePromptEl; // the first-run block keeps clear of the line
    if (!on) { this.syncFootNote(); return; }
    const n = this.lightNoteEl = this.contentEl.createDiv("ecl-lightnote");
    n.createSpan({ cls: "ecl-lightnote-text", text: "Ecliptic is dark only. To match it, set Settings → Appearance → Base color scheme to dark." });
    const x = n.createEl("button", { cls: "ecl-lightnote-x", text: "×", attr: { "aria-label": "Dismiss" } });
    x.addEventListener("click", () => { this.plugin.settings.lightNoteDismissed = true; this.plugin.save(); this.plugin.checkMode(); });
    this.syncFootNote();
  }

  // A page (Today, a folder) reserves a strip for the light-mode line or the theme question (styles.css), so neither sits over content.
  syncFootNote() { this.contentEl.toggleClass("has-footnote", !!(this.lightNoteEl || this.themePromptEl)); }

  // The first-open question, in the same quiet strip as the light-mode line: serif italic, two plain text buttons.
  setThemePrompt(on) {
    if (this.themePromptEl) { this.themePromptEl.remove(); this.themePromptEl = null; }
    if (this.scene) this.scene.footNote = !!on || this.plugin.lightNoteWanted();
    this.contentEl.toggleClass("has-themeprompt", !!on);
    if (!on) { this.syncFootNote(); return; }
    const n = this.themePromptEl = this.contentEl.createDiv("ecl-lightnote ecl-themeprompt");
    n.setAttr("role", "group"); n.setAttr("aria-label", "Theme the whole app");
    n.createSpan({ cls: "ecl-lightnote-text", text: "Theme the whole app to match?" });
    const ask = (label, yes) => n.createEl("button", { cls: "ecl-themeprompt-btn", text: label }).addEventListener("click", () => this.plugin.answerTheme(yes));
    ask("Yes", true); ask("Not now", false);
    this.syncFootNote();
  }

  refresh() {
    if (!this.scene) return;
    this.scene.setWorlds(this.plugin.worldList());
    this.scene.setAmbient(this.plugin.ambient());
    this.scene.setSections(this.plugin.collect());
    this.scene.moreN = this.plugin.hiddenFolders || 0;
    this.scene.setToday(this.plugin.today());
    Promise.all([this.plugin.taskBelt(), this.plugin.timeData().catch(() => null)]).then(([t, time]) => {
      if (!this.scene) return;
      this.plugin.applyLive(this.scene.sections, t, time);
      this.scene.dialShown = -9;
      this.scene.setTasks(t);
    });
    // The dial's card leads with each section's one-line summary, read from
    // its overview note.
    const secs = this.scene.sections;
    Promise.all(secs.map((s) => this.plugin.summaryOf(this.plugin.overview(s.folder)).catch(() => ""))).then((sums) => {
      if (!this.scene || this.scene.sections !== secs) return;
      secs.forEach((s, i) => (s.summary = sums[i]));
      this.scene.dialShown = -9; // -9 = redraw (-1 is the Today card, so an empty vault never redrew it)
      if (this.scene.reduced) this.scene.draw();
    });
    if (this.section && !this.contentEl.hasClass("is-swapping")) this.renderSection();
  }

  async renderSection(sliced) {
    const isToday = this.section === HOME;
    const data = isToday ? await this.plugin.todayData() : await this.plugin.landing(this.section);
    if (!data || !this.section) return;
    if (isToday) renderToday(this, this.landingEl, data, sliced); else renderFolder(this, this.landingEl, data, sliced);
  }

  // ---- page flights -----------------------------------------------------
  // Home to a page, and back, as one choreography on a single rAF clock:
  // the scene dims and draws back, the clicked moon brightens and folds to a
  // dot, the dot flies an eased arc with a short trail to the heading, lands
  // with a pulse, and a signal line runs out under the title while the page
  // rises in, part by part. Today's stipple dots stream into the moon and its
  // terminator is drawn. Backwards it is taken apart in reverse.

  // Where a page's heading sits, in the pane's own pixels: the dot lands at
  // the start of the line under it.
  headTarget() {
    const base = this.contentEl.getBoundingClientRect();
    const h = this.landingEl.querySelector(".ecl-t-title, .ecl-f-title, .ecl-title");
    if (!h) return { x: base.width * 0.12, y: base.height * 0.3, w: 220 };
    const r = h.getBoundingClientRect(), lift = parseFloat(h.dataset.lift || "0"); // a hidden heading sits lower
    return { x: Math.max(12, r.left - base.left), y: r.bottom - base.top + 8 - lift, w: Math.min(r.width || 200, 360) };
  }

  // The parts of a page in the order they appear: heading, then its meta, then the sections.
  pageParts(host, sink) {
    const q = (s) => Array.from(host.querySelectorAll(s)), seen = new Set(), out = [];
    const add = (els, lift) => els.forEach((e) => { if (e && !seen.has(e)) { seen.add(e); out.push({ el: e, lift }); } });
    if (host.hasClass("is-today")) {
      add(q(".ecl-t-title"), 8);
      add(q(".ecl-t-back, .ecl-t-date, .ecl-t-place, .ecl-t-sunlist"), 8);
      add(q(".ecl-t-sec"), 12);
      if (sink) add([host._moonCanvas, host._marks], 0);
    } else if (host.hasClass("is-folder")) {
      add(q(".ecl-f-title"), 8);
      add(q(".ecl-f-crumb, .ecl-f-eyebrow, .ecl-f-lede, .ecl-f-stats"), 8);
      add(q(".ecl-f-body > *"), 12);
      if (sink) add([host._moonCanvas, host._marks], 0);
    } else {
      add(q(".ecl-title"), 8);
      add(q(".ecl-top, .ecl-hero-text > *"), 8);
      add(q(".ecl-col"), 12);
      if (sink) add(q(".ecl-art"), 0);
    }
    return out;
  }
  hideParts(parts) {
    for (const p of parts) {
      p.el.style.transition = "none"; p.el.style.opacity = "0";
      if (p.lift) { p.el.style.transform = `translateY(${p.lift}px)`; p.el.dataset.lift = String(p.lift); }
    }
  }
  // Rising and fading in, about 50 ms apart.
  revealParts(parts) {
    const EO = "cubic-bezier(.2,.75,.25,1)";
    parts.forEach((p, i) => {
      const d = Math.min(i * 50, 500);
      p.el.style.transition = `opacity 520ms ${EO} ${d}ms, transform 640ms ${EO} ${d}ms`;
      p.el.style.opacity = ""; p.el.style.transform = ""; delete p.el.dataset.lift;
    });
    window.setTimeout(() => parts.forEach((p) => { p.el.style.transition = ""; }), 1400);
  }
  // Sinking out, last part first.
  sinkParts(parts) {
    parts.slice().reverse().forEach((p, i) => {
      const d = Math.min(i * 26, 200);
      p.el.style.transition = `opacity 240ms cubic-bezier(.4,0,1,1) ${d}ms, transform 300ms cubic-bezier(.4,0,1,1) ${d}ms`;
      p.el.style.opacity = "0";
      if (p.lift) p.el.style.transform = `translateY(${-Math.min(p.lift, 8)}px)`;
    });
  }

  // o.moon() gives the clicked moon (or the click point) in scene pixels, read every frame,
  // so a moving moon is followed; o.done runs at the end.
  pageFlight(back, o) {
    cancelAnimationFrame(this.dotRaf);
    if (this.flightClean) this.flightClean();
    const view = this, scene = this.scene, el = this.contentEl, orb = this.orbitEl, host = this.landingEl;
    const cv = this.dotEl, g = cv.getContext("2d"), W = el.clientWidth, H = el.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    cv.removeClass("is-gone");
    const acc = getComputedStyle(el).getPropertyValue("--ecl-accent").trim() || "232,190,110";
    const MS = back ? 1100 : 1400;
    const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
    const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const out3 = (t) => 1 - Math.pow(1 - t, 3);
    // Opening, the animation starts at once and the page is built meanwhile: the page-bound parts
    // (heading target, parts, Today's dots) are picked up by bind() on the first frame after o.ready().
    let mo = null, mc = null, marks = null, parts = [], dots = null, bound = false, held = 0;
    let head = { x: W * 0.12, y: H * 0.3, w: 220 }, reread = back, revealed = false, sunk = false, paused = false, t0 = null, frozen = null, S = back ? 0.9 : 1;
    const bind = () => {
      bound = true;
      mo = host.hasClass("is-today") || host.hasClass("is-folder") ? host._moon : null; mc = host._moonCanvas; marks = host._marks;
      parts = this.pageParts(host, back);
      if (!back) { this.hideParts(parts); if (mo && mc) { mc.style.opacity = "0"; marks.style.opacity = "0"; } }
      head = this.headTarget(); reread = back;
      // Today: the stipple dots that stream into the moon (lit side only).
      if (mo && !back) {
        const rnd = todayRng(7), n = [-mo.s[1], mo.s[0]];
        dots = [];
        for (let tries = 0; dots.length < 260 && tries < 4000; tries++) {
          const a = rnd() * TAU, rr = Math.sqrt(rnd()) * mo.R, dx = Math.cos(a) * rr, dy = Math.sin(a) * rr;
          const uu = (dx * mo.s[0] + dy * mo.s[1]) / mo.R, wv = (dx * n[0] + dy * n[1]) / mo.R, tx = Math.sqrt(Math.max(0, 1 - wv * wv));
          const x = mo.cx + dx, y = mo.cy + dy;
          if (uu <= mo.K * tx || x < 0 || y < 0 || x > W || y > H) continue;
          dots.push({ x, y, d: rnd(), r: 0.7 + rnd() * 0.9, a: 0.5 + 0.45 * rnd() });
        }
      }
    };
    if (back || !o.ready) bind();
    const cx0 = W / 2, cy0 = H / 2, idx = o.moon().i;
    const moonNow = () => { const m = o.moon(); return { x: cx0 + (m.x - cx0) * S, y: cy0 + (m.y - cy0) * S, r: m.r * S }; };
    const clean = () => {
      orb.style.opacity = ""; orb.style.transform = "";
      if (mc) { mc.style.opacity = ""; mc.style.transform = ""; }
      if (marks) marks.style.opacity = "";
      scene.fx = null;
    };
    this.flightClean = clean;
    const frame = () => {
      const now = performance.now();
      if (t0 === null) { t0 = now; if (back) this.sinkParts(parts); }
      if (!bound && ((o.ready && o.ready()) || now - t0 > 3000)) bind();
      // The clock waits (at 20 %) if the page is not built yet; the scene has already moved by then.
      if (!bound && now - t0 - held > 0.2 * MS) held = now - t0 - 0.2 * MS;
      const u = clamp((now - t0 - held) / MS, 0, 1);
      if (bound && !reread && u > 0.35) { head = this.headTarget(); reread = true; }
      // ---- the scene and the page around the dot ----
      let fold, bright;
      if (!back) {
        S = 1 - 0.1 * out3(seg(u, 0, 0.7));
        orb.style.opacity = ((1 - 0.74 * out3(seg(u, 0, 0.24))) * (1 - seg(u, 0.5, 0.86))).toFixed(3);
        fold = inOut(seg(u, 0.1, 0.3));
        bright = out3(seg(u, 0, 0.2)) * (1 - seg(u, 0.26, 0.4));
        if (!revealed && u >= 0.62) { revealed = true; el.addClass("is-landing"); this.revealParts(parts); }
        if (!paused && u >= 0.88) { paused = true; scene.paused = true; }
      } else {
        const rise = out3(seg(u, 0.3, 0.9));
        S = 0.9 + 0.1 * rise;
        orb.style.opacity = rise.toFixed(3);
        fold = 1 - out3(seg(u, 0.66, 0.95));
        bright = Math.sin(Math.PI * seg(u, 0.64, 0.98));
        if (!sunk && u >= 0.5) { sunk = true; el.removeClass("is-landing"); }
      }
      orb.style.transform = `scale(${S.toFixed(4)})`;
      scene.fx = idx >= 0 ? { i: idx, k: 1 - fold } : null;
      // ---- the dot: arc, trail, pulse ----
      if (!back && !frozen && u >= 0.26) frozen = moonNow();
      const m = moonNow();
      // On the black hole and Betelgeuse the folder itself (its star or cloud) is what flies, and it lands where the page's object is.
      const carry = !!(bound && mo && idx >= 0 && host.hasClass("is-folder") && objectKind(scene.world) !== "moon");
      const tgt = carry ? { x: mo.cx, y: mo.cy } : { x: head.x, y: head.y };
      const a = back ? tgt : frozen || m, b = back ? m : tgt;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const side = (a.x + b.x) / 2 < W / 2 ? 1 : -1;
      const qx = (a.x + b.x) / 2 + (dy / len) * len * 0.22 * side, qy = (a.y + b.y) / 2 - (dx / len) * len * 0.22 * side;
      const at = (p) => ({ x: (1 - p) * (1 - p) * a.x + 2 * (1 - p) * p * qx + p * p * b.x, y: (1 - p) * (1 - p) * a.y + 2 * (1 - p) * p * qy + p * p * b.y });
      const f = back ? inOut(seg(u, 0.2, 0.66)) : inOut(seg(u, 0.26, 0.68));
      const d = at(f);
      const dotA = back ? seg(u, 0.1, 0.2) * fold : fold * (1 - seg(u, 0.86, 0.96));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.lineCap = "round";
      // The moon being picked up (or put down): glow and a ring that closes on the dot.
      const mp = back ? b : a;
      if (bright > 0.01) {
        const gr = m.r * 3.4 + 10, gl = g.createRadialGradient(mp.x, mp.y, 0, mp.x, mp.y, gr);
        gl.addColorStop(0, `rgba(${acc},${0.6 * bright})`); gl.addColorStop(1, `rgba(${acc},0)`);
        g.fillStyle = gl; g.fillRect(mp.x - gr, mp.y - gr, gr * 2, gr * 2);
      }
      if (fold < 0.995) {
        g.strokeStyle = `rgba(${acc},${0.5 * clamp(bright * 1.2 + fold, 0, 1) * (1 - fold)})`; g.lineWidth = 1;
        g.beginPath(); g.arc(mp.x, mp.y, Math.max(1, 2.6 + (m.r + 3 - 2.6) * (1 - fold)), 0, TAU); g.stroke();
      }
      // The trail: only the last part of the path, tapering to nothing, shortening as the dot arrives.
      const tail = Math.max(0, f - 0.2 * (1 - (back ? seg(u, 0.6, 0.68) : seg(u, 0.66, 0.76))));
      if (f > 0.01 && f - tail > 0.004 && dotA > 0.01) {
        const N = 22;
        let prev = at(tail);
        for (let j = 1; j <= N; j++) {
          const q = at(tail + ((f - tail) * j) / N), k = j / N;
          g.strokeStyle = `rgba(${acc},${0.16 * Math.pow(k, 1.3) * dotA})`; g.lineWidth = 2 + 7 * k;
          g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(q.x, q.y); g.stroke();
          g.strokeStyle = `rgba(${acc},${0.75 * Math.pow(k, 1.4) * dotA})`; g.lineWidth = 0.5 + 2.6 * k;
          g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(q.x, q.y); g.stroke();
          prev = q;
        }
      }
      // The landing pulse at the heading (the same collapse, run backwards, when leaving).
      const land = back ? 1 - seg(u, 0, 0.2) : seg(u, 0.66, 0.84), pulse = back ? Math.sin(Math.PI * seg(u, 0, 0.2)) : Math.sin(Math.PI * seg(u, 0.66, 0.78));
      if (back ? u < 0.2 : land > 0 && land < 1) {
        const rr = back ? 6 + 38 * land : 4 + 46 * out3(land);
        g.strokeStyle = `rgba(${acc},${back ? 0.5 * pulse : 0.65 * Math.pow(1 - land, 1.2)})`; g.lineWidth = 1.2;
        g.beginPath(); g.arc(head.x, head.y, rr, 0, TAU); g.stroke();
      }
      if (pulse > 0.01) {
        const gl = g.createRadialGradient(head.x, head.y, 0, head.x, head.y, 36);
        gl.addColorStop(0, `rgba(${acc},${0.5 * pulse})`); gl.addColorStop(1, `rgba(${acc},0)`);
        g.fillStyle = gl; g.fillRect(head.x - 36, head.y - 36, 72, 72);
      }
      // The signal line under the heading.
      const lp = back ? 1 - inOut(seg(u, 0, 0.22)) : out3(seg(u, 0.72, 0.92));
      if (lp > 0.001) {
        g.strokeStyle = `rgba(${acc},${0.6 * Math.min(1, lp * 3)})`; g.lineWidth = 1;
        g.beginPath(); g.moveTo(head.x, head.y); g.lineTo(head.x + head.w * lp, head.y); g.stroke();
      }
      // Today: dots stream out of the landing point into the moon, and the terminator is drawn.
      if (dots) {
        const fade = 1 - seg(u, 0.88, 1);
        for (const p of carry ? [] : dots) {
          const l = clamp((u - 0.66 - p.d * 0.14) / 0.2, 0, 1);
          if (l <= 0) continue;
          const e = out3(l), e0 = out3(Math.max(0, l - 0.06));
          const x = head.x + (p.x - head.x) * e, y = head.y + (p.y - head.y) * e;
          g.fillStyle = `rgba(${acc},${p.a * Math.min(1, l * 3) * fade})`;
          g.beginPath(); g.arc(x, y, p.r, 0, TAU); g.fill();
          if (l < 0.85) {
            g.strokeStyle = `rgba(${acc},${0.28 * p.a * fade})`; g.lineWidth = p.r * 0.8;
            g.beginPath(); g.moveTo(head.x + (p.x - head.x) * e0, head.y + (p.y - head.y) * e0); g.lineTo(x, y); g.stroke();
          }
        }
        const edge = 1 - smoothstep((mo.frac - 0.62) / 0.32), tp = out3(seg(u, 0.74, 0.96));
        if (edge > 0.05 && tp > 0.005) {
          const n = [-mo.s[1], mo.s[0]];
          let prev = null;
          for (let k = -Math.PI / 2; k <= -Math.PI / 2 + Math.PI * tp + 1e-9; k += 0.03) {
            const uu = mo.K * Math.cos(k), ww = Math.sin(k), pt = { x: mo.cx + mo.R * (uu * mo.s[0] + ww * n[0]), y: mo.cy + mo.R * (uu * mo.s[1] + ww * n[1]) };
            if (prev) { g.strokeStyle = `rgba(${acc},${0.7 * edge * (0.35 + 0.65 * Math.cos(k))})`; g.lineWidth = 1.15; g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(pt.x, pt.y); g.stroke(); }
            prev = pt;
          }
        }
        // The real moon, then the marks, take over.
        const e = out3(seg(u, 0.84, 1));
        mc.style.opacity = e.toFixed(3); mc.style.transform = `scale(${(0.94 + 0.06 * e).toFixed(4)})`; mc.style.transformOrigin = `${mo.ox != null ? mo.ox : mo.cx}px ${mo.oy != null ? mo.oy : mo.cy}px`;
        marks.style.opacity = seg(u, 0.9, 1).toFixed(3);
      }
      // The carried object: the seeded star or cloud sprite, its lit dot at the core, growing from the home size to the page's as it flies.
      if (carry && dotA > 0.01) {
        const base = scene.moonR(scene.sections[idx]), ph = mo.H || H, sx = Math.max(ph * 0.12, 60);
        const sp = scene.sprite(base, sx - mo.cx, sx - mo.cy, scene.colours().ink, scene.bgP || "10,10,12", scene.objSeed(idx, 0));
        const e = back ? 1 - f : f, rr = m.r + (base * 2.2 - m.r) * e, sz = (rr / base) * sp.S;
        const al = dotA * (back ? 1 : 1 - seg(u, 0.78, 0.94));
        const gl = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, 12);
        gl.addColorStop(0, `rgba(255,250,235,${0.7 * al})`); gl.addColorStop(1, `rgba(${acc},0)`);
        g.save(); g.globalAlpha = al;
        g.drawImage(sp.c, d.x - sz / 2, d.y - sz / 2, sz, sz);
        g.restore();
        g.fillStyle = gl; g.fillRect(d.x - 12, d.y - 12, 24, 24);
        g.fillStyle = `rgba(255,250,235,${al})`; g.beginPath(); g.arc(d.x, d.y, 2.2, 0, TAU); g.fill();
      }
      // The dot itself.
      if (dotA > 0.01 && !carry) {
        const sw = 1 + 0.45 * Math.sin(Math.PI * (back ? seg(u, 0.62, 0.72) : seg(u, 0.66, 0.8)));
        const gl = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, 18);
        gl.addColorStop(0, `rgba(${acc},${0.6 * dotA})`); gl.addColorStop(1, `rgba(${acc},0)`);
        g.fillStyle = gl; g.fillRect(d.x - 18, d.y - 18, 36, 36);
        g.fillStyle = `rgba(255,250,235,${dotA})`;
        g.beginPath(); g.arc(d.x, d.y, 2.6 * sw + (fold < 1 && fold > 0 ? (m.r * 0.5 * (1 - fold)) : 0), 0, TAU); g.fill();
      }
      if (u < 1) this.dotRaf = requestAnimationFrame(frame);
      else { cv.addClass("is-gone"); clean(); this.flightClean = null; if (o.done) o.done(); }
    };
    this.dotRaf = requestAnimationFrame(frame);
  }

  // A moon's place and size on the home scene, read live.
  moonAt(folder) {
    const s = this.scene;
    return () => {
      const i = folder === HOME ? s.sections.length : s.sections.findIndex((x) => x.folder === folder);
      if (i < 0) return { x: s.w / 2, y: s.h / 2, r: 8, i: -1 };
      const p = s.dotPos(i);
      // On the phone's dial the moons are small and the chosen one wears a ring of 9 px.
      return { x: p.x, y: p.y, r: s.dialMode ? 6 : folder === HOME ? 9 : s.moonR(s.sections[i]) + 2, i };
    };
  }

  // Open a page: from home a moon folds to a dot and flies to the heading.
  // From one page to another, cross-fade instead.
  async openLanding(folder, at, instant) {
    const el = this.contentEl, scene = this.scene;
    const moved = ++this.moves;
    const dot = !instant && !scene.reduced && !this.section && scene.k === 1 && !scene.flight;
    if (dot) {
      this.section = folder;
      el.removeClass("is-swapping");
      el.addClass("is-dot");
      el.removeClass("is-instant");
      const live = this.moonAt(folder);
      // From the planet the dot starts at the click, not at a moon.
      const origin = at && at.planet ? () => ({ x: at.x, y: at.y, r: at.r || 12, i: -1 }) : live;
      // The flight starts on the click's own frame; the page is built after its first frame,
      // with the heavy stipple drawn in slices, and the flight picks it up when it is there.
      let built = false;
      this.pageFlight(false, { moon: origin, ready: () => built || moved !== this.moves, done: () => el.removeClass("is-dot") });
      requestAnimationFrame(() => window.setTimeout(async () => {
        try { if (moved === this.moves) await this.renderSection(true); } finally { built = true; }
      }, 0));
      this.app.workspace.requestSaveLayout();
      this.retitle();
      this.contentEl.focus({ preventScroll: true });
      return;
    }
    if (this.section && this.section !== folder && !instant) {
      el.addClass("is-swapping");
      await sleep(200);
      if (moved !== this.moves) return;
      this.section = folder;
      await this.renderSection();
      this.landingEl.scrollTop = 0;
      el.removeClass("is-swapping");
    } else {
      this.section = folder;
      await this.renderSection();
      if (moved !== this.moves) return;
      el.toggleClass("is-instant", !!instant);
      const fade = scene.reduced && !instant; // reduced motion: a short cross-fade, no camera
      if (instant) { scene.focus = at || { x: scene.w / 2, y: scene.h / 2 }; scene.k = K_FLY; scene.flight = null; }
      else if (fade) scene.focus = null;
      else scene.flyTo(at || scene.project(0, 0, 0), K_FLY, 0.95);
      el.addClass("is-landing");
      window.setTimeout(() => { if (this.section && moved === this.moves) scene.paused = true; }, instant ? 0 : fade ? 250 : 1000);
    }
    this.app.workspace.requestSaveLayout();
    this.retitle();
    this.contentEl.focus({ preventScroll: true });
  }

  // And back out again.
  closeLanding(instant) {
    if (!this.section) return;
    const el = this.contentEl, scene = this.scene;
    const folder = this.section;
    this.section = null;
    this.lastFolder = this.contentEl.contains(document.activeElement) ? folder : undefined; // only a keyboard user gets focus handed back
    this.folderState = null;
    const moved = ++this.moves;
    if (!instant && !scene.reduced && scene.k === 1) {
      // The page sinks, the dot flies back to its moon, the scene comes forward and the moon opens out.
      el.removeClass("is-instant"); el.removeClass("is-swapping");
      if (scene.dialMode) scene.liftCard(0); // the phone's card was carried up on the way in
      el.addClass("is-dot");
      scene.paused = false; scene.start();
      this.pageFlight(true, { moon: this.moonAt(folder), done: () => el.removeClass("is-dot") });
      window.setTimeout(() => { if (!this.section && moved === this.moves) this.landingEl.empty(); }, 1300);
      this.app.workspace.requestSaveLayout();
      this.retitle();
      return;
    }
    el.toggleClass("is-instant", !!instant);
    el.removeClass("is-swapping");
    if (instant) { scene.k = 1; scene.focus = null; scene.flight = null; scene.paused = false; scene.start(); }
    else if (scene.reduced) { if (scene.dialMode) scene.liftCard(0); scene.k = 1; scene.focus = null; scene.flight = null; scene.paused = false; scene.start(); }
    else scene.flyTo(null, 1, 0.85);
    el.removeClass("is-landing");
    window.setTimeout(() => { if (!this.section && moved === this.moves) this.landingEl.empty(); }, 900);
    this.app.workspace.requestSaveLayout();
    this.retitle();
  }

  // Put keyboard focus back on the moon button of the page that just closed (Today when it was the Today page).
  focusMoon(folder) {
    const s = this.scene;
    if (!s || s.dialMode) return;
    const i = folder === HOME ? s.sections.length : s.sections.findIndex((x) => x.folder === folder);
    const at = i < 0 ? -1 : s.today ? (i === s.sections.length ? 0 : i + 1) : i;
    const b = at >= 0 && s.kbEl.children[at];
    if (b) window.setTimeout(() => { try { if (!this.section) b.focus({ preventScroll: true }); } catch (e) { /* gone */ } }, 0);
  }

  // Back one level: a nested page goes to its parent, a section to Ecliptic.
  up() {
    const parent = this.plugin.parentOf(this.section);
    if (parent) this.openLanding(parent);
    else this.closeLanding();
  }

  // Leave gently: fade this view, then open the note in the same tab so
  // Back returns here, and let the note fade in.
  openNote(path, line) {
    this.contentEl.addClass("is-leaving");
    window.setTimeout(async () => {
      const file = this.app.vault.getAbstractFileByPath(path) || this.app.metadataCache.getFirstLinkpathDest(path, "");
      if (file) await this.leaf.openFile(file, line != null ? { eState: { line } } : undefined); else await this.app.workspace.openLinkText(path, "", false);
      if (this.contentEl) this.contentEl.removeClass("is-leaving");
    }, 180);
  }

  async onClose() {
    if (this.kbObs) { this.kbObs.disconnect(); this.kbObs = null; }
    if (this.todayRO) { this.todayRO.disconnect(); this.todayRO = null; }
    if (this.todayTimer) { window.clearInterval(this.todayTimer); this.todayTimer = null; }
    cancelAnimationFrame(this.dotRaf);
    if (this.scene) this.scene.destroy();
    this.scene = null;
  }
}

// ---- Dates, moon and sun ----------------------------------------------
// Days are local "YYYY-MM-DD" strings; dayDate builds a local Date from one.
const pad2 = (n) => String(n).padStart(2, "0");
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dayDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((dayDate(a) - dayDate(b)) / 864e5);
// A task line with `code spans` blanked, so an example written in code is never read as a date or estimate.
const noCode = (raw) => String(raw).replace(/`[^`]*`/g, " ");
// A task line as plain words: no checkbox, dates, markdown marks, links or tags.
function taskTitle(raw) {
  return String(raw)
    .replace(/^\s*[-*+]\s+\[.\]\s*/, "")
    .replace(/⏱\s*\d+(?:[.,]\d+)?\s*(?:h|hr|hrs|hours?|m|min|mins|minutes?)?(?![\p{L}\p{N}])/giu, "") // an effort estimate ("⏱ 2h") is not part of the title
    .replace(/(`[^`]*`)|\[\s*(?:due|effort)\s*::[^\]]*\]|\(\s*(?:due|effort)\s*::[^)]*\)/giu, (m, code) => code || "") // Dataview inline fields: [due:: 2026-11-20], (effort:: 2h); left alone inside `code`
    .replace(/[📅⏳🛫✅➕🔁⏫🔼🔽]\s*(\d{4}-\d{2}-\d{2})?/gu, "")
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/~~([^~]*)~~/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_]([^*_\s][^*_]*?)[*_](?=[^\w*]|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/==([^=]*)==/g, "$1")
    .replace(/\s*[—–→-]+\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
// The due day on a task line: "📅 2026-11-20", or a Dataview field "[due:: 2026-11-20]" / "(due:: 2026-11-20 17:00)". null when there is none.
// (Named taskDue, not dueIn: dueIn(iso, today) is the folder pages' "in 2 days" helper.)
function taskDue(raw) {
  const s = noCode(raw), m = s.match(/📅\s*(\d{4}-\d{2}-\d{2})/u) || s.match(/\[\s*due\s*::\s*(\d{4}-\d{2}-\d{2})(?:[T ][\d:]+)?\s*\]/i) || s.match(/\(\s*due\s*::\s*(\d{4}-\d{2}-\d{2})(?:[T ][\d:]+)?\s*\)/i);
  // A typo like 2026-02-30 or 0000-00-00 would roll over into a believable overdue date; treat it as undated instead.
  return m && isoDay(dayDate(m[1])) === m[1] ? m[1] : null;
}
// An open box whose text starts struck through (~~like this~~) is finished or dropped, not open.
function isStruck(raw) { return /^\s*[-*+]\s+\[ \]\s*~~/.test(String(raw)); }
// Schedule entries are checkbox lines that say when something happens, not what to do: "08:30 - 16:30 Work shift 📅 2026-10-26".
// They are never tasks (never open, never overdue). A line is one when it starts with a time range, starts with "shift" / "work shift",
// says "shift" next to a time range, or sits in a roster note (see isRosterNote) and carries a time range or a shift-like word.
const TIME_RANGE = /(\d{1,2}):(\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}):(\d{2})/i;
const TIME_RANGE_START = /^\s*(\d{1,2}):(\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}):(\d{2})\b/i;
function isRosterNote(file, fm) {
  if (/roster|\brota\b|shifts?\b/i.test(file.basename)) return true;
  const t = fm && fm.type != null ? String(fm.type).toLowerCase() : "";
  return /^(roster|rota|shifts?|shift-roster)$/.test(t) || (fm && fm.roster === true);
}
// null when the line is an ordinary task; otherwise { date, start, end, label } (date and times may be null).
function scheduleOf(raw, roster, fileBase) {
  const body = String(raw).replace(/^\s*[-*+]\s+\[.\]\s*/, "").replace(/^~~\s*/, "");
  const tr = body.match(TIME_RANGE);
  const shiftWord = /\bshift\b/i.test(body);
  const yes = TIME_RANGE_START.test(body) || /^(?:(?:work|my)\s+)?shift\b/i.test(body) || (shiftWord && !!tr)
    || (roster && (!!tr || /\b(shift|rostered|training|leave|day off|on[- ]call)\b/i.test(body)));
  if (!yes) return null;
  const dm = String(raw).match(/[📅⏳🛫]\s*(\d{4}-\d{2}-\d{2})/u) || String(raw).match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const date = dm ? dm[1] : /^\d{4}-\d{2}-\d{2}$/.test(fileBase) ? fileBase : null;
  const start = tr ? +tr[1] * 60 + +tr[2] : null, end = tr ? +tr[3] * 60 + +tr[4] : null;
  let label = taskTitle("- [ ] " + body.replace(TIME_RANGE, "")).replace(/\s*\b\d{4}-\d{2}-\d{2}\b/g, "").replace(/^[\s,:;-]+|[\s,:;-]+$/g, "").trim();
  const m = label.match(/^(.*?)\s*\bshift\b$/i);
  if (m) label = m[1].trim() || "Shift";
  return { date, start, end, label: label || "Shift" };
}
// Plain dated bullets in a work or roster note: "- Tuesday 17 November: 10:00–15:00", "- 2026-11-17 10:00-15:00 Costco", "- Tue 17 Nov 10:00 to 15:00".
// The year comes from the bullet, else the nearest line above that names one ("Week of 16 November 2026"), else fallbackYear.
// A bullet with only a weekday ("- Tue: 10:00-15:00") counts when a "Week of <date>" line sits above it. Checkbox lines are left to scheduleOf.
const WEEKDAYS3 = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_IN_TEXT = /(\d{4})-(\d{2})-(\d{2})|\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s+(20\d{2}))?|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(20\d{2}))?/i;
function plainShifts(text, fileBase, fallbackYear) {
  const out = [], lines = String(text).split(/\r?\n/);
  let ctxYear = null, weekStart = null;
  const dayOfMatch = (m, yr) => {
    if (m[1]) return `${m[1]}-${m[2]}-${m[3]}`;
    const mo = MONTHS3.indexOf((m[5] || m[7]).slice(0, 3).toLowerCase()), d = +(m[4] || m[8]), y = +(m[6] || m[9] || yr);
    return mo < 0 ? null : `${y}-${pad2(mo + 1)}-${pad2(d)}`;
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], bullet = raw.match(/^\s*[-*+]\s+(?!\[.\])(.*)$/);
    if (!bullet) {
      const ym = raw.match(/\b(20\d{2})\b/);
      if (ym) ctxYear = +ym[1];
      const wk = raw.match(/\bweek\s+(?:of|starting|beginning|commencing)\b(.*)/i);
      if (wk) { const dm = wk[1].match(DAY_IN_TEXT); const iso = dm && dayOfMatch(dm, ctxYear || fallbackYear); if (iso) weekStart = iso; }
      continue;
    }
    const body = bullet[1], tr = body.match(TIME_RANGE);
    if (!tr) continue;
    const yr = ctxYear || fallbackYear, rest = body.replace(TIME_RANGE, " ");
    const dm = rest.match(DAY_IN_TEXT);
    let date = dm ? dayOfMatch(dm, yr) : null;
    if (!date && weekStart) {
      const wd = rest.match(/^\s*(?:\*\*)?(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i);
      if (wd) { const k = (WEEKDAYS3.indexOf(wd[1].toLowerCase()) + 6) % 7; date = isoDay(new Date(dayDate(weekStart).getTime() + k * 864e5)); }
    }
    if (!date) continue;
    const start = +tr[1] * 60 + +tr[2], end = +tr[3] * 60 + +tr[4];
    let label = rest.replace(DAY_IN_TEXT, " ").replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/ig, " ").replace(/[*_`]/g, "").replace(/[()]/g, " ").replace(/\s{2,}/g, " ").replace(/^[\s,:;–—-]+|[\s,:;–—-]+$/g, "").trim();
    if (/^(shift|work|work shift)$/i.test(label)) label = "";
    out.push({ date, start, end, label: label || String(fileBase).replace(/^\d+[\s._-]+/, "") || "Shift", line: i });
  }
  return out;
}
// The same shift found twice (a checkbox line and a bullet, or two notes) is one: keyed on its day and times.
function dedupeSched(list) {
  const seen = new Set(), out = [];
  for (const e of list) { const k = `${e.date}|${e.start}|${e.end}`; if (e.start != null && seen.has(k)) continue; seen.add(k); out.push(e); }
  return out;
}
// ---- Time you have: the model ------------------------------------------------------------------------------------
// For each deadline, the counted hours between now and the due moment, with shifts (and the travel buffer either side of them) and classes taken out,
// handed out earliest deadline first: a later deadline only sees what the earlier ones leave. Pure (no Obsidian calls), so model-check.mjs runs it as it is.
// time-model:begin
const CLASS_WORD = /\b(lectures?|class(?:es)?|tutorials?|labs?|seminars?|workshops?)\b/i; // a timed entry that says so is a class: no travel buffer
const EFFORT_UNIT = "h|hr|hrs|hours?|m|min|mins|minutes?";
// "26h", "1.5 hours", "90 min", 26 (hours): hours as a number, or null.
function parseEffort(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v > 0 && v <= 500 ? v : null;
  const m = String(v).trim().match(new RegExp("^~?\\s*(\\d+(?:[.,]\\d+)?)\\s*(" + EFFORT_UNIT + ")?\\b", "i"));
  if (!m) return null;
  let n = parseFloat(m[1].replace(",", "."));
  if (m[2] && /^m/i.test(m[2])) n /= 60;
  return n > 0 && n <= 500 ? Math.round(n * 100) / 100 : null;
}
// A task line's own estimate: "- [ ] Write the report ⏱ 2h". Hours, or null.
function effortIn(raw) {
  const s = noCode(raw), m = s.match(new RegExp("⏱\\s*(\\d+(?:[.,]\\d+)?\\s*(?:" + EFFORT_UNIT + ")?)", "iu"))
    || s.match(new RegExp("\\[\\s*effort\\s*::\\s*(\\d+(?:[.,]\\d+)?\\s*(?:" + EFFORT_UNIT + ")?)\\s*\\]", "i"))
    || s.match(new RegExp("\\(\\s*effort\\s*::\\s*(\\d+(?:[.,]\\d+)?\\s*(?:" + EFFORT_UNIT + ")?)\\s*\\)", "i")); // or a Dataview field: [effort:: 2h] / (effort:: 2h), brackets matching
  return m ? parseEffort(m[1]) : null;
}
// Hours needed for an assessment: set (an `effort` property), else estimated from its weight (rate hours a point; 0 turns estimates off), else unknown.
function timeNeed(effort, weight, rate) {
  if (effort != null) return { need: effort, src: "set" };
  if (weight != null && rate > 0) return { need: Math.round(weight * rate * 10) / 10, src: "est" };
  return { need: null, src: "unknown" };
}
const shiftIso = (iso, n) => { const d = dayDate(iso); return isoDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
// o: { now: Date, from, to (counted minutes of the day), buffer (minutes), sched: [{ date, start, end, label }], deadlines: [{ iso, dueMin (null = end of day), need (hours or null), src, ... }], horizon (days, default 70) }
// Returns { rows, hasBusy }: the deadlines due from now on, in order, each with free / claimed / avail / need / short / spare (hours), pips by day and the entry that costs most.
function timeModel(o) {
  const now = o.now, today = isoDay(now), nowMin = now.getHours() * 60 + now.getMinutes(), from = o.from, to = o.to, buf = o.buffer || 0;
  const byDate = new Map();
  for (const e of o.sched || []) {
    if (!e.date || e.start == null || e.end == null) continue;
    if (o.skip === e) continue; // the counterfactual run: the model again, minus this one entry
    const k = byDate.get(e.date) || []; k.push({ ...e, orig: e, kind: CLASS_WORD.test(e.label || "") ? "class" : "shift" }); byDate.set(e.date, k);
  }
  const busyOn = (iso) => {
    const out = [], pre = (e) => (e.kind === "shift" ? buf : 0);
    for (const e of byDate.get(iso) || []) out.push({ a: e.start - pre(e), b: (e.end > e.start ? e.end : 1440) + pre(e), e });
    for (const e of byDate.get(shiftIso(iso, -1)) || []) if (e.end <= e.start && e.end > 0) out.push({ a: 0, b: e.end + pre(e), e });
    return out;
  };
  const startOf = (iso) => (iso === today ? Math.max(from, nowMin) : from);
  const segsOn = (iso) => {
    let segs = startOf(iso) < to ? [[startOf(iso), to]] : [];
    for (const bz of busyOn(iso)) {
      const nx = [];
      for (const [a, b] of segs) {
        if (bz.b <= a || bz.a >= b) { nx.push([a, b]); continue; }
        if (bz.a > a) nx.push([a, bz.a]);
        if (bz.b < b) nx.push([bz.b, b]);
      }
      segs = nx;
    }
    return segs;
  };
  const items = (o.deadlines || []).map((d) => ({ ...d, dueAt: d.dueMin == null ? 1440 : d.dueMin }))
    .filter((d) => d.iso > today || (d.iso === today && (d.dueMin == null || d.dueMin > nowMin)))
    .sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : a.dueAt - b.dueAt));
  const last = items.length ? items[items.length - 1].iso : today, cap = shiftIso(today, o.horizon || 70);
  const pool = [];
  const dayCap = o.cap > 0 ? Math.round(o.cap * 60) : Infinity; // most minutes any one day gives, after shifts, classes and buffer are out
  for (let iso = today; iso <= last && iso <= cap; iso = shiftIso(iso, 1)) {
    let left = dayCap;
    for (const [a, b] of segsOn(iso)) { const len = Math.min(b - a, left); if (len <= 0) break; pool.push({ iso, a, b: a + len }); left -= len; }
  }
  const r1 = (m) => Math.round(m / 6) / 10; // minutes -> hours, one decimal
  let claimed = 0;
  const rows = items.map((d) => {
    const mine = [];
    for (const s of pool) { if (s.iso > d.iso) break; const b = s.iso === d.iso ? Math.min(s.b, d.dueAt) : s.b; if (b > s.a) mine.push({ iso: s.iso, a: s.a, b }); }
    const freeMin = mine.reduce((t, s) => t + (s.b - s.a), 0), avail = Math.max(0, freeMin - claimed);
    const needMin = d.need != null ? Math.round(d.need * 60) : null, takes = needMin != null ? Math.min(needMin, avail) : 0;
    const shortMin = needMin != null ? Math.max(0, needMin - avail) : 0, claimedBefore = claimed;
    claimed += takes;
    let pips = null;
    if (needMin != null) {
      const days = new Map(), cut1 = claimedBefore, cut2 = claimedBefore + takes;
      let off = 0;
      for (const s of mine) {
        const len = s.b - s.a, rec = days.get(s.iso) || { rs: 0, lit: 0, sp: 0 };
        const rs = clamp(cut1 - off, 0, len), lit = clamp(cut2 - off, 0, len) - rs;
        rec.rs += rs; rec.lit += lit; rec.sp += len - rs - lit; days.set(s.iso, rec); off += len;
      }
      pips = [...days].map(([iso, r]) => {
        const p = { iso }; let c0 = 0;
        for (const k of ["rs", "lit", "sp"]) { const c1 = c0 + r[k]; p[k] = Math.round(c1 / 60) - Math.round(c0 / 60); c0 = c1; }
        return p;
      }).filter((p) => p.rs + p.lit + p.sp > 0);
    }
    // What a short deadline blames: the timed entry (with its buffer) that takes the most counted time before it.
    let cause = null;
    if (shortMin > 0 && !o.skip) {
      const cost = new Map();
      for (let iso = today; iso <= d.iso; iso = shiftIso(iso, 1)) {
        const hi = iso === d.iso ? Math.min(to, d.dueAt) : to, lo = startOf(iso);
        for (const bz of busyOn(iso)) {
          const m = Math.max(0, Math.min(bz.b, hi) - Math.max(bz.a, lo));
          if (m > 0) { const key = bz.e.date + "|" + bz.e.start + "|" + bz.e.end; const c = cost.get(key) || { e: bz.e, m: 0 }; c.m += m; cost.set(key, c); }
        }
      }
      // Overlapping entries share their minutes, so the raw cost over-counts: the few biggest are run again without them and the one that gives back most is blamed.
      const idx = items.indexOf(d);
      let top = null;
      for (const c of [...cost.values()].sort((a, b) => b.m - a.m).slice(0, 4)) {
        const re = timeModel({ ...o, skip: c.e.orig }).rows[idx]; // same deadlines, same order: the same index
        const wMin = re ? re.availMin : avail;
        if (!top || wMin > top.w) top = { e: c.e, w: wMin };
      }
      if (top && top.w > avail) cause = { iso: top.e.date, kind: top.e.kind, start: top.e.start, end: top.e.end, cost: r1(top.w - avail), without: r1(top.w) };
    }
    return { ...d, free: r1(freeMin), claimed: r1(claimedBefore), avail: r1(avail), availMin: avail, need: d.need, short: r1(shortMin), spare: needMin != null ? r1(Math.max(0, avail - needMin)) : null,
      pips, shortPips: shortMin > 0 ? Math.max(1, Math.round(shortMin / 60)) : 0, cause };
  });
  const hasBusy = [...byDate.keys()].some((iso) => iso >= today && iso <= last);
  return { rows, hasBusy };
}
// time-model:end
const clock24 = (mins) => `${pad2(Math.floor(mins / 60) % 24)}:${pad2(mins % 60)}`;
const fmtDay = (d, opts) => (typeof d === "string" ? dayDate(d) : d).toLocaleDateString(undefined, opts);
const fmtClock = (mins) => {
  const d = new Date(2000, 0, 1, Math.floor(mins / 60) % 24, Math.round(mins % 60));
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

const SYNODIC = 29.530588853;
// Days since the last new moon (0 to 29.53), from a known new moon.
function moonAge(date) {
  const jd = date.getTime() / 864e5 + 2440587.5;
  const age = (jd - 2451550.1) % SYNODIC;
  return age < 0 ? age + SYNODIC : age;
}
function moonPhase(age) {
  const f = age / SYNODIC, lit = Math.round(((1 - Math.cos(f * TAU)) / 2) * 100);
  // Named by how much is lit, so each named phase spans about a day either side
  // (equal eighths called 32% lit a "first quarter").
  const waxing = f < 0.5;
  const name = lit <= 2 ? "New moon" : lit >= 98 ? "Full moon"
    : lit >= 40 && lit <= 60 ? (waxing ? "First quarter" : "Last quarter")
    : lit < 40 ? (waxing ? "Waxing crescent" : "Waning crescent")
    : (waxing ? "Waxing gibbous" : "Waning gibbous");
  return { name, lit };
}

// Minutes east of UTC for an IANA zone at a moment; the system zone when none is given or it is unknown.
function zoneOffset(tz, at) {
  const sys = -at.getTimezoneOffset();
  if (!tz) return sys;
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
      .formatToParts(at).map((x) => [x.type, x.value]));
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(at.getTime() / 60000) * 60000) / 60000);
  } catch (e) { return sys; }
}

// Sunrise and sunset in minutes on the place's own clock (the system zone if
// none is known), NOAA's approximate method. Without a location, or in polar
// day or night, a plain 06:30 / 18:30 stands in.
function sunWindow(lat, lon, date, tz) {
  const plain = { rise: 390, set: 1110, exact: false };
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return plain;
  const rad = Math.PI / 180, noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const n = Math.floor((noon - new Date(noon.getFullYear(), 0, 0)) / 864e5);
  const g = (2 * Math.PI / 365) * (n - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosH > 1 || cosH < -1) return plain;
  const ha = Math.acos(cosH) / rad, off = zoneOffset(tz, noon);
  const wrap = (v) => ((v % 1440) + 1440) % 1440;
  return { rise: wrap(720 - 4 * (lon + ha) - eqt + off), set: wrap(720 - 4 * (lon - ha) - eqt + off), exact: true };
}

// Time zones in the southern hemisphere, used only to flip the moon's lit side
// when no latitude is set.
const SOUTHERN_TZ = /^(Australia|Antarctica|Pacific\/(Auckland|Fiji|Tongatapu|Apia|Noumea|Tahiti)|Africa\/(Johannesburg|Maputo|Harare|Windhoek|Lusaka)|America\/(Sao_Paulo|Argentina|Santiago|Lima|Montevideo|Asuncion|La_Paz)|Indian\/(Reunion|Mauritius|Antananarivo))/;
function guessSouth() {
  try { return SOUTHERN_TZ.test(Intl.DateTimeFormat().resolvedOptions().timeZone || ""); } catch (e) { return false; }
}

// Keyboard access for elements that take a click but are not natively focusable: give them a tab stop and a role. Enter and Space are handled by the view.
const NATIVELY_FOCUSABLE = /^(BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/;
function makeKeyable(root) {
  if (!root) return;
  for (const n of root.querySelectorAll("*")) {
    if (n.dataset.eclKey || typeof n.onclick !== "function" || NATIVELY_FOCUSABLE.test(n.tagName) || (n.tagName === "A" && n.hasAttribute("href"))) continue;
    n.dataset.eclKey = "1";
    if (!n.hasAttribute("tabindex")) n.tabIndex = 0;
    if (!n.hasAttribute("role")) n.setAttribute("role", "link");
  }
}

// Small stable number from a string, for each page's art seed.
function hashOf(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return (h % 997) + 1; }

// ---- Settings ---------------------------------------------------------
const SKIP_BY_DEFAULT = /^(_.*|attachments?|assets?|templates?|images?|files?)$/i;
const defaults = () => ({
  world: "saturn",
  worlds: [], // ids in the rotation; empty means all of them
  tint: true,
  themeApp: false, // re-colour the whole of Obsidian after the world; off until the first-open prompt is answered
  themeAsked: false, // the first-open "Theme the whole app?" prompt has been answered
  immersive: false,
  openOnStart: false,
  folderShow: {},
  folderLabels: {},
  maxSections: 8,
  showTasks: true,
  timeOn: true, // the "Before it's due" section on Today and the fact line on Home
  timeFrom: "09:00", // the hours of the day that count as usable
  timeTo: "21:00",
  timeBuffer: 60, // minutes of travel either side of a shift
  timeCap: 6, // most hours one day can give to deadlines (0 = no cap)
  timeRate: 0.5, // hours of work per weight point, to estimate an assessment with no effort set (0 turns estimates off)
  debris: "some", // off | light | some | lots: rocks, dust and wakes round the home system
  motion: "lively", // calm | lively | brisk: how fast the folder moons turn
  dailyFolder: "",
  dailyFormat: "",
  lightNoteDismissed: false,
  timeHintDismissed: false, // the one-line "add effort: 10h" hint under Before it's due, once closed
  weather: false,
  latitude: null,
  longitude: null,
  timezone: "", // IANA zone of the looked-up place, for sunrise and sunset
  placeName: "",
  lastWeather: null,
  debugDate: "", // a date like 2026-11-18T12:00:00 to draw every page for, in place of today (used by the demo vault); blank is the real date
});

class EclipticPlugin extends obsidian.Plugin {
  async onload() {
    const saved = (await this.loadData()) || {};
    this.firstRun = !Object.keys(saved).length;
    // Only keys that still exist, with the right type; anything else from an older version is ignored.
    const def = defaults();
    this.settings = def;
    for (const k of Object.keys(def)) if (k in saved && typeof saved[k] === typeof def[k] && (def[k] === null || !Array.isArray(def[k]) === !Array.isArray(saved[k]))) this.settings[k] = saved[k];
    for (const k of ["latitude", "longitude"]) if (typeof saved[k] === "number") this.settings[k] = saved[k];
    if (saved.lastWeather && typeof saved.lastWeather === "object") this.settings.lastWeather = saved.lastWeather;
    // An install that saved settings before the prompt existed keeps what it had (the whole-app theme was on by default then) and is not asked.
    if (!this.firstRun && typeof saved.themeAsked !== "boolean") { if (typeof saved.themeApp !== "boolean") this.settings.themeApp = true; this.settings.themeAsked = true; }
    if (!WORLDS.some((w) => w.id === this.settings.world)) this.settings.world = "saturn";
    this.settings.worlds = Array.isArray(saved.worlds) ? saved.worlds.filter((id) => WORLDS.some((w) => w.id === id)) : [];
    this.settings.folderShow = Object.assign({}, saved.folderShow);
    this.settings.folderLabels = Object.assign({}, saved.folderLabels);
    this.daily = { folder: "", format: "YYYY-MM-DD", template: "" };
    this.taskDirty = new Set(); this.taskVer = 0; this.taskIdxVer = -1; this.taskIdx = new Map();
    // The Daily notes configuration loads now, not on the first refresh, so "Open today's note" right after enabling uses the real folder and format.
    await this.loadDaily();
    this.initTaskIndex();
    this.wx = null;
    const lw = this.settings.lastWeather;
    if (this.settings.weather && lw && Date.now() - lw.at < 6 * 36e5) this.wx = lw;
    this.debugDate = this.settings.debugDate || null;
    this.day = isoDay(new Date());

    this.registerView(VIEW_TYPE, (leaf) => new EclipticView(leaf, this));
    this.addRibbonIcon("orbit", "Open Ecliptic", () => this.activate());
    this.addCommand({ id: "open", name: "Open home", callback: () => this.activate() });
    this.addCommand({ id: "open-today-note", name: "Open today's note", callback: () => this.openTodayNote() });
    this.addSettingTab(new EclipticSettingTab(this.app, this));

    this.applyImmersive();
    this.tint();
    this.theme();
    this.registerEvent(this.app.workspace.on("css-change", () => { this.tint(); this.theme(); this.checkMode(); }));
    const corner = obsidian.debounce(() => this.placeCorner(), 160, true);
    for (const ev of ["active-leaf-change", "layout-change", "resize", "file-open"]) this.registerEvent(this.app.workspace.on(ev, corner));
    this.cornerSoon = corner;
    // The status bar drops its note stats whenever the pane in front is an Ecliptic view (whether or not the leaf has focus).
    const stats = () => {
      const on = this.app.workspace.getLeavesOfType(VIEW_TYPE).some((l) => l.containerEl.offsetParent && l.parent && l.parent.containerEl && l.parent.containerEl.hasClass("mod-active"));
      document.body.toggleClass("ecl-view-front", !!on);
    };
    for (const ev of ["active-leaf-change", "layout-change"]) this.registerEvent(this.app.workspace.on(ev, () => window.setTimeout(stats, 50)));
    this.app.workspace.onLayoutReady(stats);
    // Revealing a tab does not always fire a workspace event, so a 400 ms poll backs the events up - only while the window is shown and focused.
    let statsTimer = 0;
    const stopStats = () => { window.clearInterval(statsTimer); statsTimer = 0; };
    const startStats = () => { if (statsTimer || document.hidden || !document.hasFocus()) return; stats(); statsTimer = window.setInterval(stats, 400); };
    this.registerDomEvent(document, "visibilitychange", () => (document.hidden ? stopStats() : startStats()));
    this.registerDomEvent(window, "focus", startStats);
    this.registerDomEvent(window, "blur", stopStats);
    this.register(stopStats);
    startStats();
    this.register(() => document.body.removeClass("ecl-view-front"));

    // The clock: a new day refreshes the pages, and the sun moves on.
    this.registerInterval(window.setInterval(() => {
      if (isoDay(new Date()) !== this.day) { this.day = isoDay(new Date()); this.refreshAll(); }
      this.updateWeather();
    }, 60000));
    this.registerInterval(window.setInterval(() => this.fetchWeather(), 15 * 6e4));

    this.app.workspace.onLayoutReady(() => {
      // Vault events fire once per file while the vault loads, so listen only
      // after layout is ready, and batch the refresh.
      const again = obsidian.debounce(() => this.refreshAll(), 800, true);
      this.registerEvent(this.app.vault.on("create", again));
      this.registerEvent(this.app.vault.on("delete", again));
      this.registerEvent(this.app.vault.on("rename", again));
      this.registerEvent(this.app.vault.on("modify", again));
      this.registerEvent(this.app.metadataCache.on("resolved", again));
      this.fetchWeather();
      this.updateWeather(true);
      if (this.settings.openOnStart && !this.views().length) this.activate(true);
    });
  }

  onunload() {
    this.untint();
    this.untheme();
    document.body.removeClass("ecl-immersive");
  }

  async save() { await this.saveData(this.settings); }

  views() {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view).filter((v) => v instanceof EclipticView);
  }

  // Open (or reveal) the view. On startup it takes an empty tab if there is one.
  async activate(onStart) {
    const ws = this.app.workspace, existing = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (existing) { ws.revealLeaf(existing); return; }
    const leaf = (onStart && ws.getLeavesOfType("empty")[0]) || ws.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    ws.revealLeaf(leaf);
  }

  refreshAll() {
    this.loadDaily().then(() => { for (const v of this.views()) v.refresh(); });
  }

  // ---- worlds and tint -------------------------------------------------
  worldList() {
    const ids = this.settings.worlds, cur = this.settings.world;
    let list = ids.length ? WORLDS.filter((w) => ids.includes(w.id)) : WORLDS.slice();
    if (!list.length) list = WORLDS.slice();
    if (!list.some((w) => w.id === cur)) { const c = WORLDS.find((w) => w.id === cur); if (c) list = [c, ...list]; }
    return list;
  }

  // The scene changed world (a click on the date): remember it.
  async setWorld(id, sync) {
    this.settings.world = id;
    this.tint();
    // From the scene's own switch the chrome waits for the flare, then glides with the new world blooming.
    if (sync) this.theme(false, 1000, 460); else this.theme();
    await this.save();
  }

  // The settings page picked a world: move every open view there.
  async travel(id) {
    await this.setWorld(id);
    for (const v of this.views()) {
      if (!v.scene) continue;
      v.scene.setWorlds(this.worldList(), id);
      // A page that is open sits over a paused scene: repaint it in the new world.
      if (v.section) { v.scene.skyFade = 1; v.scene.fade = 1; v.scene.applyCss(); v.renderSection(); }
    }
  }

  palette() {
    const w = WORLDS.find((x) => x.id === this.settings.world) || WORLDS[0];
    return { ink: w.ink, accent: w.accent, accent2: w.accent2, tones: w.tones };
  }

  isDark() { return document.body.hasClass("theme-dark"); }

  // Tint: only the accent variables, from the world's signal colour, on body so
  // they beat the theme. It is what is left to do when the whole-app theme is
  // off, so it only runs in dark mode; light mode is left completely alone.
  tint() {
    this.untint();
    const w = WORLDS.find((x) => x.id === this.settings.world);
    if (!this.settings.tint || !w || !this.isDark()) return;
    const s = document.body.style;
    for (const v of ACCENT_VARS) s.setProperty(v, `rgb(${w.accent})`);
    for (const v of ACCENT_SOFT_VARS) s.setProperty(v, `rgba(${w.accent},0.22)`);
  }
  untint() {
    const s = document.body.style;
    for (const v of [...ACCENT_VARS, ...ACCENT_SOFT_VARS]) s.removeProperty(v);
  }
  // Theme the whole app, dark mode only: publish the world's four tokens
  // (ground, ink, signal, warning red) as --ecl-t-* on body; styles.css maps
  // them onto Obsidian's own variables under body.ecl-themed. In light mode
  // nothing is set and Obsidian is left completely alone.
  // The tokens glide from the old world's to the new one's over ~650 ms
  // (instantly with reduced motion), and the star layer is repainted as they go.
  theme(instant, ms, delay) {
    const b = document.body;
    const w = WORLDS.find((x) => x.id === this.settings.world);
    if (!this.settings.themeApp || !w || !this.isDark()) { this.untheme(); return; }
    const to = { ground: hexRgb(w.ground), ink: w.ink.split(",").map(Number), signal: hexRgb(w.signal), warn: hexRgb(w.warn) };
    const from = b.hasClass("ecl-themed") && this.themeNow ? this.themeNow : to;
    if (this.themeRaf) cancelAnimationFrame(this.themeRaf);
    this.themeRaf = 0;
    b.addClass("ecl-themed");
    this.ensureStars();
    const apply = (t) => {
      const cur = {};
      for (const k of Object.keys(to)) cur[k] = from[k].map((v, i) => v + (to[k][i] - v) * t);
      this.themeNow = cur;
      const rgb = (a) => `rgb(${a.map(Math.round).join(",")})`, set = (k, v) => b.style.setProperty("--ecl-t-" + k, v);
      set("ground", rgb(cur.ground)); set("ink", cur.ink.map(Math.round).join(",")); set("signal", rgb(cur.signal));
      set("signal-rgb", cur.signal.map(Math.round).join(",")); set("warn", rgb(cur.warn));
      this.drawStars();
    };
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (instant || from === to) { apply(1); if (this.cornerSoon) this.cornerSoon(); return; }
    // Reduced motion: a short cross-fade rather than a glide.
    const t0 = performance.now(), dur = reduced ? 200 : ms || 650, wait = reduced ? 0 : delay || 0;
    const step = (now) => {
      const t = clamp((now - t0 - wait) / dur, 0, 1), e = t * t * (3 - 2 * t);
      apply(e);
      this.themeRaf = t < 1 || now - t0 < wait ? requestAnimationFrame(step) : 0;
      if (t >= 1 && this.cornerSoon) this.cornerSoon();
    };
    this.themeRaf = requestAnimationFrame(step);
  }
  untheme() {
    const b = document.body;
    if (this.themeRaf) cancelAnimationFrame(this.themeRaf);
    this.themeRaf = 0;
    this.themeNow = null;
    b.removeClass("ecl-themed");
    for (const k of APP_TOKENS) b.style.removeProperty("--ecl-t-" + k);
    if (this.starEl) { this.starEl.remove(); this.starEl = null; }
    this.dropCorner();
    if (this.starResize) { window.removeEventListener("resize", this.starResize); this.starResize = null; }
  }
  // One fixed canvas behind the whole app: a quiet field of stars, repainted on resize and while the world's colours glide.
  ensureStars() {
    if (this.starEl && this.starEl.isConnected) return;
    const c = document.createElement("canvas");
    c.className = "ecl-stars";
    document.body.insertBefore(c, document.body.firstChild);
    this.starEl = c;
    this.starResize = () => this.drawStars();
    window.addEventListener("resize", this.starResize);
  }
  drawStars() {
    const c = this.starEl, cur = this.themeNow;
    if (!c || !cur) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    let s = 20261115;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const n = Math.min(900, Math.round((W * H) / 5200));
    const ink = cur.ink.map(Math.round), sig = cur.signal.map(Math.round);
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = rnd() * H, m = rnd(), warm = rnd() < 0.08;
      const r = 0.35 + m * m * 0.9, a = 0.12 + m * m * 0.5, col = warm ? sig : ink;
      g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
  }
  // A faint, distant world in the free margin beside an ordinary note, so a plain note still sits in the sky.
  // Cheap (one small canvas, drawn when the size or world changes) and only where it clears the text column.
  dropCorner() { if (this.cornerEl) { this.cornerEl.remove(); this.cornerEl = null; } this.cornerKey = ""; }
  placeCorner() {
    if (!this.themeNow || !this.starEl) { this.dropCorner(); return; }
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (!view || !view.leaf.getRoot || view.leaf.getRoot() !== this.app.workspace.rootSplit) { if (this.cornerEl) this.cornerEl.classList.remove("is-on"); return; }
    // Reading mode keeps a hidden .cm-content (zero-size) first in the DOM, so pick the column the current mode actually shows.
    const pane = view.contentEl.getBoundingClientRect(), preview = view.getMode && view.getMode() === "preview";
    const txt = view.contentEl.querySelector(preview ? ".markdown-preview-sizer" : ".cm-content"), tr = txt && txt.getBoundingClientRect();
    if (!tr || !tr.width) { if (this.cornerEl) this.cornerEl.classList.remove("is-on"); return; }
    const free = pane.right - tr.right - 20, size = Math.round(Math.min(free - 20, 230));
    if (size < 150 || pane.height < 360) { if (this.cornerEl) this.cornerEl.classList.remove("is-on"); return; }
    if (!this.cornerEl) {
      this.cornerEl = document.createElement("canvas");
      this.cornerEl.className = "ecl-corner";
      document.body.appendChild(this.cornerEl);
    }
    const c = this.cornerEl, w = WORLDS.find((x) => x.id === this.settings.world) || WORLDS[0], pal = this.palette();
    c.classList.add("is-on");
    c.style.left = Math.round(pane.right - size - 10) + "px";
    c.style.top = Math.round(pane.bottom - size - 8) + "px";
    const key = size + "|" + w.id + "|" + Math.round(window.devicePixelRatio * 10);
    if (key === this.cornerKey) return;
    this.cornerKey = key;
    drawWorldArt(c, { w: size, h: size, ink: pal.ink, accent: pal.accent, tone: pal.tones[3 % pal.tones.length], surface: w.surface, moons: [], seed: 7 });
  }
  // Obsidian in light mode: the plugin leaves its chrome alone and says so with one quiet line inside its pane (dismissible, remembered).
  // The one-time toast it used to show is gone, so the explanation is not given twice (ON4 R4).
  // First open: ask once whether to theme the whole app. Quiet line in the pane, no modal; the answer is remembered and Settings can change it.
  themePromptWanted() { return !this.settings.themeAsked; }
  async answerTheme(yes) {
    this.settings.themeApp = !!yes; this.settings.themeAsked = true;
    this.theme(); this.checkMode();
    this.views().forEach((v) => v.setThemePrompt(false));
    await this.save();
  }
  lightNoteWanted() { return !this.isDark() && !!this.settings.themeApp && !this.settings.lightNoteDismissed; }
  checkMode() {
    const on = this.lightNoteWanted();
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((l) => l.view && l.view.setLightNote && l.view.setLightNote(on));
  }
  // Settings, on the Ecliptic tab (where the folder list is).
  openSettings() { try { this.app.setting.open(); this.app.setting.openTabById(this.manifest.id); } catch (e) { new obsidian.Notice("Open Settings, then Ecliptic"); } }
  // First run, "New folder": make a folder through the vault API and put a first note in it, because a folder only becomes a moon once it holds a note.
  async newFolder() {
    const v = this.app.vault;
    let name = "New folder", n = 1;
    while (v.getAbstractFileByPath(name)) name = `New folder ${++n}`;
    try {
      await v.createFolder(name);
      await v.create(`${name}/Untitled.md`, "");
      new obsidian.Notice(`Made "${name}" with a first note in it. Rename it in the file explorer.`);
    } catch (e) { new obsidian.Notice("Could not make a folder in this vault."); }
  }
  applyImmersive() { document.body.toggleClass("ecl-immersive", !!this.settings.immersive); }

  // ---- weather ---------------------------------------------------------
  sun() { return sunWindow(this.settings.latitude, this.settings.longitude, this.nowDate(), this.settings.timezone); }

  // Weather is a night overlay on Earth only: clouds, rain, snow, fog or a storm.
  weatherSpec() {
    const wx = this.settings.weather ? this.wx : null, spec = skySpec(wx);
    spec.label = wx ? `${WEATHER[spec.kind].name} ${Math.round(wx.temp)}°` : "";
    return spec;
  }
  updateWeather(force) {
    const spec = this.weatherSpec(), key = `${spec.kind}|${spec.label}`;
    if (key === this.skyKey && !force) return;
    this.skyKey = key;
    for (const v of this.views()) v.scene && v.scene.setSky(spec);
  }
  async setWeather(on) {
    this.settings.weather = on;
    await this.save();
    if (on && !this.wx) await this.fetchWeather();
    this.updateWeather(true);
  }

  /* Opt-in. Open-Meteo needs no account or key; the only thing sent is the
     latitude and longitude set in the settings. A failed fetch keeps the
     last reading. */
  async fetchWeather() {
    const { weather, latitude, longitude } = this.settings;
    if (!weather || latitude == null || longitude == null) return;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      "&current=weather_code,cloud_cover,is_day,wind_speed_10m,temperature_2m&timezone=auto";
    try {
      const res = await obsidian.requestUrl({ url, throw: false });
      const cur = res.status === 200 && res.json && res.json.current;
      if (!cur) return;
      this.wx = { at: Date.now(), code: cur.weather_code, kind: weatherKind(cur.weather_code), cloud: cur.cloud_cover,
        wind: cur.wind_speed_10m, temp: cur.temperature_2m };
      this.settings.lastWeather = this.wx;
      await this.save();
      this.updateWeather();
    } catch (e) { /* offline: keep the last sky */ }
  }

  // User-initiated only: turn a place name into coordinates (2 decimals).
  async lookupPlace(name) {
    const url = "https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(name.split(",")[0].trim()); // a filled-in "City, Region, Country" searches by its city part
    const res = await obsidian.requestUrl({ url, throw: false });
    const hit = res.status === 200 && res.json && res.json.results && res.json.results[0];
    if (!hit) return null;
    return { lat: Math.round(hit.latitude * 100) / 100, lon: Math.round(hit.longitude * 100) / 100,
      name: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", "), tz: hit.timezone || "" };
  }

  // ---- vault: folders and notes -----------------------------------------
  plain(name) { return name.replace(/^\d+\s+/, ""); }
  todayLong() { return fmtDay(this.nowDate(), { weekday: "long", day: "numeric", month: "long" }); }

  notesIn(folder) {
    const out = [];
    obsidian.Vault.recurseChildren(folder, (f) => { if (f instanceof obsidian.TFile && f.extension === "md") out.push(f); });
    return out;
  }
  // A note's display title: an index.md shows as its folder's name.
  noteTitle(f) { return f.basename.toLowerCase() === "index" && f.parent && !f.parent.isRoot() ? this.plain(f.parent.name) : f.basename; }
  noteRef(f) { return { title: this.noteTitle(f), path: f.path, mtime: f.stat.mtime }; }
  newest(files, n) { return files.slice().sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, n); }
  // The folder note: Folder/Folder.md or Folder/index.md.
  folderNote(folder) {
    return folder.children.find((c) => c instanceof obsidian.TFile && c.extension === "md" && [folder.name.toLowerCase(), "index"].includes(c.basename.toLowerCase())) || null;
  }

  subfolders(folder) {
    return folder.children.filter((c) => c instanceof obsidian.TFolder && !c.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  // Top-level folders become the dots.
  candidates() {
    const out = [];
    for (const c of this.app.vault.getRoot().children) {
      if (!(c instanceof obsidian.TFolder) || c.name.startsWith(".") || c.path === this.app.vault.configDir) continue;
      const notes = this.notesIn(c);
      if (notes.length) out.push({ folder: c, notes });
    }
    return out;
  }
  isShown(name) {
    const set = this.settings.folderShow[name];
    return set != null ? !!set : !SKIP_BY_DEFAULT.test(name);
  }
  collect() {
    const shown = this.candidates().filter((c) => this.isShown(c.folder.name));
    shown.sort((a, b) => Math.max(...b.notes.map((f) => f.stat.mtime)) - Math.max(...a.notes.map((f) => f.stat.mtime)));
    const picked = shown.slice(0, Math.max(1, this.settings.maxSections | 0));
    this.hiddenFolders = shown.length - picked.length;
    picked.sort((a, b) => a.folder.name.localeCompare(b.folder.name, undefined, { numeric: true }));
    const t0 = this.nowDate().setHours(0, 0, 0, 0);
    return picked.map(({ folder, notes: all }) => {
      // The folder's own landing note is linked on its page, not counted (the page and the Home card agree on the number).
      const fnote = this.folderNote(folder), rest = all.filter((f) => f !== fnote), notes = rest.length ? rest : all;
      const subs = this.subfolders(folder).map((s) => s.name);
      const last = Math.max(0, ...notes.map((f) => f.stat.mtime)), todayN = notes.filter((f) => f.stat.mtime >= t0).length;
      return {
        folder: folder.path,
        label: this.settings.folderLabels[folder.name] || this.plain(folder.name),
        count: notes.length,
        // The live line under the moon on Home (applyLive may replace it with an overdue / due / shift line once the task index is read).
        live: todayN ? `${todayN} edited today` : last ? `edited ${agoLong(last)}` : "",
        recent: this.newest(notes, 3).map((f) => this.noteRef(f)),
        wide: this.newest(notes, 7).map((f) => this.noteRef(f)), // the phone card lists as many as fit
        subs: subs.slice(0, 4),
        meta: `${notes.length} ${notes.length === 1 ? "note" : "notes"}`,
      };
    });
  }

  // The most useful live fact for each folder moon, one short line: overdue count, else the next due task, else the next shift
  // (work folders), else what was edited today, else when it was last edited (that last pair comes from collect()).
  applyLive(sections, belt, time) {
    if (!belt) return;
    const nowD = this.nowDate(), today = isoDay(nowD), nowMin = nowD.getHours() * 60 + nowD.getMinutes();
    // Time line: the deadline with the least slack (hours free after earlier deadlines, minus hours needed), among those with a known need.
    const hrs = (n) => String(Math.round(n * 10) / 10);
    const tight = (pre) => {
      let best = null;
      for (const r of (time && time.rows) || []) {
        if (r.need == null || !r.path || !r.path.startsWith(pre)) continue;
        if (!best || r.avail - r.need < best.avail - best.need) best = r;
      }
      return best;
    };
    const when = (iso) => { const n = dayDiff(iso, today); return n <= 0 ? "today" : n === 1 ? "tomorrow" : n < 7 ? fmtDay(iso, { weekday: "short" }) : fmtDay(iso, { day: "numeric", month: "short" }); };
    const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
    for (const s of sections) {
      const pre = s.folder + "/", mine = (p) => p.startsWith(pre);
      const open = (belt.open || []).filter((t) => mine(t.path));
      const od = open.filter((t) => t.overdue).length;
      s.liveKind = "";
      if (od) { s.live = `${od} overdue`; s.liveKind = "overdue"; continue; }
      const tl = tight(pre);
      if (tl) { s.live = tl.short > 0 ? `${clip(tl.title, 18)}: ${tl.src === "est" ? "~" : ""}${hrs(tl.short)} h short` : `${clip(tl.title, 18)}: ${hrs(tl.avail)} h free`; continue; }
      let nx = null;
      for (const t of open) if (t.due && t.due >= today && (!nx || t.due < nx.due)) nx = t;
      if (nx) { s.live = `${clip(nx.title, 20)} · ${when(nx.due)}`; continue; }
      // The next entry that has not ended yet; a class or lecture goes by its own label, only a shift is called "Shift".
      const sh = (belt.schedule || []).find((e) => mine(e.path) && e.date && !(e.date === today && e.end != null && e.start != null && e.end > e.start && e.end <= nowMin));
      if (sh) s.live = `${CLASS_WORD.test(sh.label || "") ? clip(sh.label, 18) : "Shift"} ${when(sh.date)}${sh.start != null ? " " + clock24(sh.start) : ""}`;
    }
  }

  parentOf(section) {
    if (!section || section === HOME) return null;
    const f = this.app.vault.getAbstractFileByPath(section);
    const p = f && f.parent;
    return p && !p.isRoot() ? p.path : null;
  }

  // A folder's own overview: a note named like the folder, else Overview, Index or README.
  overview(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!f || !f.children) return null;
    const want = [f.name, "Overview", "Index", "README"].map((n) => n.toLowerCase());
    for (const w of want) {
      const hit = f.children.find((c) => c instanceof obsidian.TFile && c.extension === "md" && c.basename.toLowerCase() === w);
      if (hit) return hit;
    }
    return null;
  }
  // The first line of prose in a note, without markdown dressing.
  async firstLines(file, n, max) {
    if (!file) return [];
    let text = await this.app.vault.cachedRead(file);
    text = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    const lines = [];
    for (const raw of text.split(/\r?\n/)) {
      const t = raw.replace(/^\s*(#+\s*|[-*+]\s+(\[.\]\s*)?|>\s*)/, "").replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2")
        .replace(/[*_`]/g, "").trim();
      if (!t || /^---+$/.test(t)) continue;
      lines.push(t.length > max ? t.slice(0, max - 1) + "…" : t);
      if (lines.length >= n) break;
    }
    return lines;
  }
  async summaryOf(file) { return (await this.firstLines(file, 1, 120))[0] || ""; }

  ago(ms) {
    const days = Math.floor((Date.now() - ms) / 864e5);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return days + " days ago";
    return fmtDay(new Date(ms), { day: "numeric", month: "short" });
  }

  // ---- daily notes -------------------------------------------------------
  // Blank settings follow the vault's own Daily notes configuration.
  async loadDaily() {
    const cfg = { folder: "", format: "YYYY-MM-DD", template: "" };
    try {
      const path = obsidian.normalizePath(`${this.app.vault.configDir}/daily-notes.json`);
      if (await this.app.vault.adapter.exists(path)) {
        const j = JSON.parse(await this.app.vault.adapter.read(path));
        if (j.folder) cfg.folder = j.folder;
        if (j.format) cfg.format = j.format;
        if (j.template) cfg.template = j.template;
      }
    } catch (e) { /* no daily notes configuration: use the defaults */ }
    if (this.settings.dailyFolder) cfg.folder = this.settings.dailyFolder;
    if (this.settings.dailyFormat) cfg.format = this.settings.dailyFormat;
    this.daily = cfg;
  }
  dailyName(date) { return obsidian.moment(date).format(this.daily.format); }
  dailyPath(date) {
    const dir = this.daily.folder.replace(/^\/+|\/+$/g, "");
    return obsidian.normalizePath((dir ? dir + "/" : "") + this.dailyName(date) + ".md");
  }
  // Exactly the configured folder and format, nothing else: a note with the same name somewhere else (an archive) is not today's note.
  dailyFile(date) {
    const f = this.app.vault.getAbstractFileByPath(this.dailyPath(date));
    return f instanceof obsidian.TFile ? f : null;
  }
  async ensureFolder(path) {
    const parts = path.split("/").slice(0, -1);
    let cur = "";
    for (const p of parts) {
      cur = cur ? cur + "/" + p : p;
      if (!this.app.vault.getAbstractFileByPath(cur)) await this.app.vault.createFolder(cur);
    }
  }
  async createDaily() {
    const date = new Date(), path = this.dailyPath(date);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof obsidian.TFile) return existing;
    let body = "";
    if (this.daily.template) {
      const tf = this.app.metadataCache.getFirstLinkpathDest(this.daily.template, "");
      if (tf) body = (await this.app.vault.cachedRead(tf)).replace(/{{\s*(date|time|title)\s*(?::([^}]+?))?\s*}}/gi, (all, kind, fmt) => {
        const k = kind.toLowerCase(), m = obsidian.moment(date);
        if (k === "title") return this.dailyName(date).split("/").pop();
        return m.format(fmt || (k === "time" ? "HH:mm" : "YYYY-MM-DD"));
      });
    }
    await this.ensureFolder(path);
    const file = await this.app.vault.create(path, body);
    this.refreshAll();
    return file;
  }
  async openTodayNote() {
    await this.loadDaily(); // the Daily notes settings may have changed since the last refresh
    const file = this.dailyFile(new Date()) || (await this.createDaily());
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  // ---- tasks ---------------------------------------------------------------
  // ---- tasks ---------------------------------------------------------------
  // A task index over the whole vault: per note with checkboxes, its open tasks, finished count and schedule entries.
  // A note is re-read only when its mtime or size changed or a vault / metadata event marked it dirty; everything else comes from memory.
  taskNoteFiles() {
    return this.app.vault.getMarkdownFiles().filter((f) => !/(^|\/)(\d+[\s._-]+)?templates?(\/|$)/i.test(f.path));
  }
  // A note that can hold a roster as plain bullets: a roster note, one with `type: job | work | roster`, or one in a Work / Roster / Jobs folder.
  isWorkNote(f) {
    const fm = this.fmOf(f), t = fm && fm.type != null ? String(fm.type).toLowerCase() : "";
    if (isRosterNote(f, fm) || /^(job|work|roster|rota|shifts?)$/.test(t)) return true;
    return /(^|\/)(\d+[\s._-]+)?(work|roster|rota|shifts?|jobs?)\//i.test(f.path);
  }
  async parseTasks(f, items, work) {
    const text = await this.app.vault.cachedRead(f), lines = text.split(/\r?\n/), roster = isRosterNote(f, this.fmOf(f));
    const e = { mtime: f.stat.mtime, size: f.stat.size, open: [], done: 0, doneItems: [], sched: [] };
    if (work) {
      const fmDate = this.fmOf(f).date, fy = new Date(f.stat.mtime).getFullYear(), ym = fmDate != null && String(fmDate).match(/\b(20\d{2})\b/);
      for (const sc of plainShifts(text, f.basename, ym ? +ym[1] : fy)) e.sched.push(sc);
    }
    for (const it of items || []) {
      if (it.task === undefined) continue;
      const line = it.position.start.line, raw = lines[line] || "";
      if (it.task === " ") {
        if (isStruck(raw)) continue;
        const sc = scheduleOf(raw, roster, f.basename);
        if (sc) { e.sched.push({ ...sc, line }); continue; }
        const title = taskTitle(raw);
        if (!title) continue;
        e.open.push({ title, line, due: taskDue(raw), effort: effortIn(raw) });
      } else {
        if (scheduleOf(raw, roster, f.basename)) continue;
        e.done++;
        const title = taskTitle(raw);
        if (title) e.doneItems.push({ title });
      }
    }
    e.sched = dedupeSched(e.sched);
    return e;
  }
  // Called from onload: after layout is ready (vault events fire once per file while the vault loads), watch for changes.
  // A changed note is re-read on the next ask; "resolved" re-checks every note (cheap: no reads for unchanged ones).
  initTaskIndex() {
    this.app.workspace.onLayoutReady(() => {
      const touch = (f) => { if (f && f.path) this.taskDirty.add(f.path); this.taskVer++; };
      for (const ev of ["create", "modify", "delete"]) this.registerEvent(this.app.vault.on(ev, touch));
      this.registerEvent(this.app.vault.on("rename", (f, old) => { this.taskDirty.add(old); touch(f); }));
      this.registerEvent(this.app.metadataCache.on("changed", touch));
      this.registerEvent(this.app.metadataCache.on("resolved", () => { this.taskVer++; }));
      if (this.settings.showTasks) this.taskBelt();
    });
  }
  async buildTaskIndex() {
    const idx = this.taskIdx, cache = this.app.metadataCache, dirty = new Set(this.taskDirty);
    this.taskDirty.clear();
    const files = this.taskNoteFiles(), live = new Set();
    let n = 0;
    for (const f of files) {
      live.add(f.path);
      const items = (cache.getFileCache(f) || {}).listItems;
      const hasTask = !!items && items.some((it) => it.task !== undefined), work = this.isWorkNote(f);
      if (!hasTask && !work) { idx.delete(f.path); continue; }
      const e = idx.get(f.path);
      if (e && e.mtime === f.stat.mtime && e.size === f.stat.size && !dirty.has(f.path)) continue;
      try { idx.set(f.path, await this.parseTasks(f, items, work)); } catch (err) { idx.delete(f.path); }
      if (++n % 50 === 0) await new Promise((r) => window.setTimeout(r, 0));
    }
    for (const k of [...idx.keys()]) if (!live.has(k)) idx.delete(k);
  }
  async ensureTaskIndex() {
    this.taskIdx = this.taskIdx || new Map();
    while (this.taskIdxVer !== this.taskVer) {
      if (this.taskIdxP) { await this.taskIdxP.catch(() => {}); continue; }
      const ver = this.taskVer;
      this.taskIdxP = this.buildTaskIndex().finally(() => { this.taskIdxP = null; });
      await this.taskIdxP;
      this.taskIdxVer = ver;
    }
  }
  // Every open task, schedule entries and finished-lately items, derived from the index and cached by (index version, day).
  // `all` is for the time model: "Show open tasks" only hides the task list, the roster and classes still count as busy time.
  taskBelt(all) {
    if (!this.settings.showTasks && !all) return Promise.resolve({ done: 0, open: [], doneItems: [], schedule: [], openTotal: 0, overdueTotal: 0 });
    // The scan's "today" is part of the cache key: overdue flags and the finished-lately window go stale at midnight.
    const day = isoDay(this.nowDate());
    if (!this.tasksP || this.tasksDay !== day || this.tasksVer !== this.taskVer) {
      this.tasksDay = day; this.tasksVer = this.taskVer;
      this.tasksP = this.scanTasks(day).catch(() => ({ done: 0, open: [], doneItems: [], schedule: [], openTotal: 0, overdueTotal: 0 }));
    }
    return this.tasksP;
  }
  async scanTasks(today) {
    await this.ensureTaskIndex();
    const open = [], schedule = [], recentMs = Date.now() - 2 * 864e5, fresh = [], allSched = [], memo = new Map();
    let done = 0, ended = 0;
    for (const [path, e] of this.taskIdx) {
      done += e.done;
      // Tasks in a course whose term is over are not overdue and not open: they are history (counted in `ended`).
      const gone = e.open.length ? await this.endedCourseOf(path, today, memo) : null;
      for (const t of e.open) {
        if (gone) { ended++; continue; }
        open.push({ title: t.title, path, line: t.line, due: t.due, effort: t.effort == null ? null : t.effort, soon: !!t.due && dayDiff(t.due, today) <= 2, overdue: !!t.due && t.due < today, mtime: e.mtime });
      }
      for (const sc of e.sched) if (sc.date) { allSched.push({ ...sc, path }); if (sc.date >= today) schedule.push({ ...sc, path }); }
      if (e.done && e.mtime >= recentMs) fresh.push([path, e]);
    }
    // Tasks finished lately (in notes touched in the last two days), for the Today page.
    const doneItems = [];
    fresh.sort((a, b) => b[1].mtime - a[1].mtime);
    for (const [path, e] of fresh.slice(0, 6)) for (const it of e.doneItems) doneItems.push({ title: it.title, path, done: true, mtime: e.mtime });
    open.sort((a, b) => (b.soon - a.soon) || (a.due && b.due ? (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) : a.due ? -1 : b.due ? 1 : 0) || b.mtime - a.mtime);
    const byTime = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.start || 0) - (b.start || 0));
    schedule.sort(byTime); allSched.sort(byTime);
    return { done, open, doneItems, schedule: dedupeSched(schedule), allSchedule: dedupeSched(allSched), openTotal: open.length, overdueTotal: open.filter((t) => t.overdue).length, endedTotal: ended };
  }
  // The course folder that holds this note when its term is over, else null: { path, end (ISO day), inferred }.
  // The term comes from its Runs line; with none, the end is inferred (see inferTermEnd). `memo` caches folder answers for one scan.
  async endedCourseOf(path, today, memo) {
    memo = memo || new Map();
    const parts = path.split("/");
    for (let i = parts.length - 1; i >= 1; i--) {
      const fp = parts.slice(0, i).join("/");
      if (!memo.has(fp)) {
        const fo = this.app.vault.getAbstractFileByPath(fp);
        let res = null;
        if (fo && fo.children && this.isCourseFolder(fo)) {
          const own = this.folderNote(fo) || fo.children.find((c) => c instanceof obsidian.TFile && c.extension === "md" && /overview$/i.test(c.basename)) || null;
          const term = await this.termOf(fo, own, today);
          if (term) res = { path: fp, course: true, ended: term.done, inferred: false, end: term.done ? isoDay(new Date(dayDate(today).getTime() + term.left * 864e5)) : null };
          else { const end = this.inferTermEnd(fo); res = { path: fp, course: true, ended: !!end && end < today, inferred: true, end }; }
        }
        memo.set(fp, res);
      }
      const r = memo.get(fp);
      if (r && r.course) return r.ended ? r : null; // the nearest course folder decides
    }
    return null;
  }
  // A course with no Runs line: its term is taken to end at the latest of its last assessment due date and the end of its latest week note
  // (a W<n> or Week <n> note's `date`, else its edit time, plus the rest of that week). null when the notes give no sign.
  inferTermEnd(folder) {
    let end = null;
    const bump = (iso) => { if (iso && (!end || iso > end)) end = iso; };
    for (const x of this.sample(folder, 8, 5000)) {
      bump(this.dueOf(x.fm));
      if (/^(?:week|w)\s*\d+\b/i.test(x.f.basename)) {
        const dv = x.fm.date != null ? String(x.fm.date).match(/\d{4}-\d{2}-\d{2}/) : null;
        bump(dv ? dv[0] : isoDay(new Date(x.f.stat.mtime + 6 * 864e5)));
      }
    }
    return end;
  }

  ambient() {
    const s = this.settings;
    return { debris: { off: 0, light: 0.5, some: 1, lots: 1.8 }[s.debris] ?? 1, speed: { calm: 1, lively: 2.6, brisk: 4.5 }[s.motion] ?? 2.6 };
  }

  // The moment the pages are drawn for. `plugin.debugDate = "2026-11-23"` (from the console) fakes the day, for checking other moon phases.
  nowDate() {
    if (this.debugDate) { const d = new Date(this.debugDate); if (!isNaN(d)) return d; }
    return new Date();
  }

  // Everything the Today page shows, from the real vault: the moon at today's phase,
  // sun times (only with a location), today's note, tasks and recent notes.
  async todayData() {
    const now = this.nowDate(), f = this.dailyFile(now), s = this.settings;
    const age = moonAge(now), ph = moonPhase(age), frac = (1 - Math.cos((age / SYNODIC) * TAU)) / 2, waxing = age < SYNODIC / 2;
    const south = s.latitude != null ? s.latitude < 0 : guessSouth();
    const located = s.latitude != null && s.longitude != null;
    const sun = located ? sunWindow(s.latitude, s.longitude, now, s.timezone) : null;
    const belt = s.showTasks ? await this.taskBelt() : { open: [], doneItems: [] };
    const folderOf = (p) => { const i = p.lastIndexOf("/"); return i > 0 ? this.plain(p.slice(0, i).split("/").pop()) : ""; };
    const open = (belt.open || []).slice().sort((a, b) => (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0)).slice(0, 200)
      .map((t) => ({ title: t.title, path: t.path, line: t.line, overdue: !!t.overdue, done: false, folder: folderOf(t.path), dueIso: t.due || "", due: t.due ? dueDay(t.due, isoDay(now)) : "" }));
    // The week (Monday to Sunday) for the calendar under the moon: its days, the timed entries (shifts), and what falls due.
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)), todayIso = isoDay(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const week = weekModel(this, belt.allSchedule || [], belt.open || [], mon, now, true), wnext = week.next;
    // One quiet line for the hero: today's shift if there is one, else the next known shift.
    const hmm = (m) => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
    const todays = (belt.allSchedule || []).filter((e) => e.date === todayIso && e.start != null && e.end != null).sort((a, b) => a.start - b.start);
    const tShift = todays.find((e) => (e.end > e.start ? e.end : 1440) > nowMin) || todays[todays.length - 1];
    const shiftLine = tShift ? `${tShift.label} ${hmm(tShift.start)} - ${hmm(tShift.end)}`
      : wnext ? `Next shift ${fmtDay(wnext.date, { weekday: "short" })} ${fmtDay(wnext.date, { day: "numeric", month: "short" })}, ${hmm(wnext.start)}` : "";
    const schedule = (belt.schedule || []).slice(0, 8).map((e) => ({ date: e.date, when: this.shiftWhen(e, isoDay(now)), label: e.label, path: e.path, start: e.start, end: e.end }));
    const doneT = (belt.doneItems || []).slice(0, 12).map((t) => ({ title: t.title, path: t.path, overdue: false, done: true, folder: folderOf(t.path), due: "" }));
    let excerpt = "";
    if (f) {
      let text = (await this.app.vault.cachedRead(f)).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
      const parts = [];
      for (const raw of text.split(/\r?\n/)) {
        const t = raw.trim();
        if (!t || /^#+\s/.test(t) || /^[-*+]\s+\[.\]/.test(t) || /^---+$/.test(t)) continue;
        parts.push(t.replace(/^[-*+>]\s+/, "").replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2").replace(/[*_`]/g, ""));
        if (parts.join(" ").length > 240) break;
      }
      excerpt = parts.join(" ");
      if (excerpt.length > 280) excerpt = excerpt.slice(0, 279).replace(/\s+\S*$/, "") + "…";
    }
    const recent = this.newest(this.app.vault.getMarkdownFiles(), 5).map((x) => ({ title: this.noteTitle(x), path: x.path, folder: folderOf(x.path), when: this.agoShort(x.stat.mtime) }));
    const time = await this.timeData().catch(() => null);
    return {
      time,
      now, weekday: fmtDay(now, { weekday: "long" }), dateLong: fmtDay(now, { day: "numeric", month: "long", year: "numeric" }),
      place: located ? s.placeName || "" : "", phase: ph.name, lit: ph.lit, frac, waxing, south, litLeft: waxing === south,
      sun, nowMins: now.getHours() * 60 + now.getMinutes(),
      note: f ? { path: f.path, name: f.basename, excerpt } : null,
      open, openTotal: belt.openTotal || 0, overdueTotal: belt.overdueTotal || 0, done: doneT, schedule, recent, week, shiftLine,
    };
  }

  // "Time you have": every deadline in the next 14 days (assessments, and tasks with an effort or a date) against the counted hours left before it.
  // null when the setting is off. The deadlines are gathered once per (index version, day); the model runs on each call (the settings and the clock feed it).
  // Returns { rows (assessments and tasks with an effort, at most 8), plain (dated tasks with no effort), hasBusy, window }.
  async timeData() {
    const s = this.settings;
    if (!s.timeOn) return null;
    const now = this.nowDate(), today = isoDay(now), WINDOW = 14, last = shiftIso(today, WINDOW);
    const belt = await this.taskBelt(true);
    const key = this.taskVer + "|" + today + "|" + (s.showTasks ? 1 : 0);
    if (!this.timeGather || this.timeGather.key !== key) {
      const list = [];
      try {
        for (const cf of this.findCourses(this.app.vault.getRoot(), 5, 40)) {
          const c = await this.courseData(cf, today);
          if (c.over) continue;
          for (const a of c.assess) {
            if (!a.dueIso || a.dueIso < today || a.dueIso > last || a.closed) continue;
            list.push({ kind: "assess", iso: a.dueIso, dueMin: a.dueMin == null ? null : a.dueMin, effort: a.effort == null ? null : a.effort, weight: a.weight, title: a.name, code: c.code, course: c.name, path: a.path });
          }
        }
      } catch (err) { /* a course that cannot be read is left out */ }
      this.timeGather = { key, list };
    }
    const hm = (v, dflt) => { const m = String(v == null ? "" : v).trim().match(/^(\d{1,2}):(\d{2})$/); return m && +m[1] < 25 && +m[2] < 60 ? Math.min(1440, +m[1] * 60 + +m[2]) : dflt; };
    let from = hm(s.timeFrom, 540), to = hm(s.timeTo, 1260);
    if (to <= from) { from = 540; to = 1260; }
    const rate = typeof s.timeRate === "number" ? s.timeRate : 0.5;
    const cap = typeof s.timeCap === "number" && s.timeCap > 0 ? Math.min(24, s.timeCap) : 0;
    const deadlines = [];
    for (const g of this.timeGather.list) deadlines.push({ ...g, ...timeNeed(g.effort, g.weight, rate) });
    for (const t of s.showTasks ? belt.open || [] : []) { // tasks are deadlines only while the task list is shown; the schedule below always counts
      if (!t.due || t.due < today || t.due > last) continue;
      deadlines.push({ kind: "task", iso: t.due, dueMin: null, title: t.title, path: t.path, line: t.line, ...(t.effort != null ? timeNeed(t.effort, null, 0) : { need: null, src: "unknown" }) });
    }
    const { rows, hasBusy } = timeModel({ now, from, to, buffer: Math.max(0, +s.timeBuffer || 0), cap, sched: belt.allSchedule || [], deadlines, horizon: WINDOW + 2 });
    const main = rows.filter((r) => r.kind === "assess" || r.need != null);
    // What the numbers were counted from, for the footnote: entries in the window, split the way the model splits them.
    const basis = { shifts: 0, classes: 0, unknown: main.filter((r) => r.need == null).length };
    for (const e of belt.allSchedule || []) if (e.date >= today && e.date <= last && e.start != null && e.end != null) { if (CLASS_WORD.test(e.label || "")) basis.classes++; else basis.shifts++; }
    // All the deadlines come back (Home picks its tightest from the whole list); the page shows the first eight and folds the rest behind "+N more".
    return { rows: main, plain: rows.filter((r) => r.kind === "task" && r.need == null), hasBusy, from, to, rate, cap, basis, hintOff: !!s.timeHintDismissed };
  }

  // "Today", "Tomorrow" or "Thu 19 Nov" for a schedule entry's day.
  shiftWhen(e, today) {
    const n = e.date ? dayDiff(e.date, today) : null;
    if (n === 0) return "Today";
    if (n === 1) return "Tomorrow";
    return e.date ? fmtDay(e.date, { weekday: "short", day: "numeric", month: "short" }) : "";
  }

  agoShort(ms) {
    const min = Math.floor((Date.now() - ms) / 6e4);
    if (min < 2) return "just now";
    if (min < 60) return min + " min ago";
    if (min < 1440) return Math.floor(min / 60) + " h ago";
    return this.ago(ms).toLowerCase();
  }

  // ---- the moon and the pages --------------------------------------------
  today() {
    const now = this.nowDate(), f = this.dailyFile(now), lat = this.settings.latitude;
    return {
      short: fmtDay(now, { day: "numeric", month: "short" }),
      long: fmtDay(now, { weekday: "long", day: "numeric", month: "long" }),
      path: f ? f.path : null,
      age: moonAge(this.nowDate()),
      south: lat != null ? lat < 0 : guessSouth(),
      recent: this.newest(this.app.vault.getMarkdownFiles(), 3).map((x) => this.noteRef(x)),
      wide: this.newest(this.app.vault.getMarkdownFiles(), 7).map((x) => this.noteRef(x)),
      meta: f ? "Today's note" : "No note yet",
    };
  }

  // ---- folder types ---------------------------------------------------
  // What a folder is for, from the metadata cache only (no file reads): course, queue, projects, journal or plain.
  // Order: the folder note's `ecliptic:` choice, a container of courses, journal, queue, course, projects, plain.
  // A folder name only lowers a threshold; it never decides alone.
  fmOf(f) {
    const fm = (this.app.metadataCache.getFileCache(f) || {}).frontmatter, o = {};
    if (fm) for (const k of Object.keys(fm)) o[k.toLowerCase()] = fm[k];
    return o;
  }
  // Notes under a folder as { f, fm }: its own files first, then subfolders, depth 4, at most cap.
  sample(folder, depth = 4, cap = 200) {
    const out = [];
    const walk = (fo, dp) => {
      for (const c of fo.children) if (c instanceof obsidian.TFile && c.extension === "md" && out.length < cap) out.push({ f: c, fm: this.fmOf(c) });
      if (dp >= depth) return;
      for (const c of fo.children) if (c instanceof obsidian.TFolder && !c.name.startsWith(".") && out.length < cap) walk(c, dp + 1);
    };
    walk(folder, 1);
    out.cut = out.length >= cap; // true when the cap stopped the walk: the list may be a part of the folder
    return out;
  }
  // The direct children of a folder as projects: loose notes, and subfolders (their folder note, or first note, carries the status).
  projectKids(folder, noIndex) {
    const own = this.folderNote(folder), out = [];
    for (const c of folder.children) {
      if (c instanceof obsidian.TFile && c.extension === "md" && c !== own && !(noIndex && INDEX_NOTE.test(c.basename))) out.push({ f: c, fm: this.fmOf(c), path: c.path, name: c.basename, mtime: c.stat.mtime, isFolder: false });
      else if (c instanceof obsidian.TFolder && !c.name.startsWith(".")) {
        const all = this.notesIn(c), fn = this.folderNote(c) || all[0];
        if (!fn) continue;
        out.push({ f: fn, fm: this.fmOf(fn), path: c.path, name: this.plain(c.name), mtime: Math.max(...all.map((x) => x.stat.mtime)), isFolder: true });
      }
    }
    return out;
  }
  classify(folder, leafOnly) {
    const pend = this.pendingType && this.pendingType.get(folder.path);
    if (pend) return { type: pend, auto: false };
    const fn = this.folderNote(folder), nfm = fn ? this.fmOf(fn) : {};
    let ov = nfm.ecliptic;
    if (ov === false) ov = "hidden";
    if (typeof ov === "string") {
      ov = ov.trim().toLowerCase();
      if (ov === "false" || ov === "hidden") return { type: "plain", auto: false, hidden: true };
      if (FT_TYPES.includes(ov)) return { type: ov, auto: false };
    }
    const name = folder.name.toLowerCase().replace(/^[\dz]+[\s._-]*/, "");
    // A container of courses: two or more courses anywhere below (Edu / Current / each course folder), else the older direct-subfolder rule.
    if (!leafOnly) {
      const found = this.findCourses(folder);
      if (found.length >= 2) return { type: "course", auto: true, container: found };
      const subs = this.subfolders(folder);
      if (subs.length >= 2 && subs.length <= 30) {
        // Assignment and week folders inside a course are sections of it, not courses.
        const cs = subs.filter((s) => { const sn = stripCode(s.name).toLowerCase(); return !COURSE_SUB.test(sn) && !ASSESS_SUB.test(sn) && this.classify(s, true).type === "course"; });
        if (cs.length >= 2) return { type: "course", auto: true, container: cs };
      }
    }
    const notes = this.sample(folder), n = notes.length;
    const st = (x) => String(x.fm.status == null ? "" : x.fm.status).trim().toLowerCase().replace(/[\s_]+/g, "-");
    // work: a Career / Work / Jobs folder with something in it, or job and roster notes (shifts, jobs, kit and applications live here)
    if ((n > 0 && WORK_NAME.test(stripNum(folder.name))) || notes.filter((x) => WORK_TYPES.has(String(x.fm.type == null ? "" : x.fm.type).toLowerCase())).length >= 2) return { type: "work", auto: true };
    // journal
    const dated = notes.filter((x) => DATED_NAME.test(x.f.basename)).length, dd = (this.daily.folder || "").replace(/^\/+|\/+$/g, "");
    if ((dd && folder.path === dd) || (n >= 5 && dated / n >= 0.6) || (/^(journal|daily|diary)/.test(name) && dated >= 3)) return { type: "journal", auto: true };
    // queue
    const isRead = (x) => READ_DONE.has(st(x)) || x.fm.read === true, isOpen = (x) => READ_OPEN.has(st(x)) || x.fm.read === false;
    const rv = notes.filter((x) => isRead(x) || isOpen(x) || x.fm.shelf != null).length;
    const srcd = notes.filter((x) => x.fm.source != null || x.fm.url != null || x.fm.author != null).length;
    if ((n >= 5 && rv / n >= 0.6 && notes.some(isOpen)) || notes.filter((x) => /clipping/i.test(String(x.fm.category))).length >= 3 || (/^(inbox|clippings?|reading|read-later|read-later)$/.test(name.replace(/\s+/g, "-")) && n >= 3 && srcd >= 3)) return { type: "queue", auto: true };
    // course
    const typ = (x) => String(x.fm.type == null ? "" : x.fm.type).toLowerCase();
    const strong = notes.filter((x) => /^(lecture|assignment|exam|reading)s?$/.test(typ(x)) || x.fm.course != null).length;
    const secSubs = this.subfolders(folder).filter((s) => COURSE_SUB.test(stripCode(s.name).toLowerCase())).length;
    const weekNotes = notes.filter((x) => /^(?:week|w)\s*\d+\b/i.test(x.f.basename)).length; // only W<n> and Week <n> are weeks (not Module 1, Lecture 2)
    if (strong >= 2 || secSubs >= 2 || weekNotes >= 3 || (COURSE_CODE.test(folder.name) && strong + secSubs + weekNotes > 0)) return { type: "course", auto: true };
    // projects
    const kids = this.projectKids(folder), lanes = new Set(), withLane = kids.filter((k) => { const l = laneOf(k.fm.status); if (l) lanes.add(l); return !!l; });
    if ((withLane.length >= 3 && lanes.size >= 2) || kids.filter((k) => String(k.fm.type == null ? "" : k.fm.type).toLowerCase() === "project").length >= 3 || (/^projects?$/.test(name) && kids.length >= 3)) return { type: "projects", auto: true };
    return { type: "plain", auto: true };
  }
  // A folder that is one course: named with a course code and holding something, or an Overview note with `type: course`, or an Overview note beside a weeks folder.
  isCourseFolder(f) {
    if (f.name.startsWith(".") || SKIP_BY_DEFAULT.test(f.name.replace(/^\d+\s+/, ""))) return false;
    const notes = f.children.filter((c) => c instanceof obsidian.TFile && c.extension === "md");
    const ov = notes.find((n) => /overview$/i.test(n.basename)) || this.folderNote(f);
    const ovType = ov ? String(this.fmOf(ov).type == null ? "" : this.fmOf(ov).type).toLowerCase() : "";
    if (ovType === "course") return true;
    const subs = this.subfolders(f), weeksDir = subs.some((s) => WEEKS_SUB.test(stripCode(s.name).toLowerCase()) && /^(weeks?|lectures?|tutorials?)\b/i.test(stripCode(s.name)));
    if (ov && weeksDir) return true;
    return COURSE_CODE.test(f.name) && (notes.length > 0 || subs.length > 0) && (!!ov || weeksDir || subs.some((s) => ASSESS_SUB.test(stripCode(s.name).toLowerCase())) || notes.length >= 2);
  }
  // Courses at any depth below a folder (not the folder itself, and not inside a course): at most cap, down to depth levels.
  findCourses(root, depth = 5, cap = 40) {
    const out = [];
    const walk = (fo, dp) => {
      for (const c of this.subfolders(fo)) {
        if (out.length >= cap) return;
        if (this.isCourseFolder(c)) out.push(c);
        else if (dp < depth) walk(c, dp + 1);
      }
    };
    walk(root, 1);
    return out;
  }
  // Share of notes touched in the last 30 days (0..1), and whether anything was touched in the last 120.
  recency(files) {
    const now = Date.now();
    if (!files.length) return { share: 0, dark: true };
    const share = files.filter((f) => now - f.stat.mtime < 30 * 864e5).length / files.length;
    return { share, dark: !files.some((f) => now - f.stat.mtime < 120 * 864e5) };
  }
  dueOf(fm) {
    const v = fm.due != null ? fm.due : fm["due-date"] != null ? fm["due-date"] : fm.duedate;
    const m = v != null && String(v).match(/\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : null;
  }

  // A course: its term, assessments (subfolders and loose assignment notes), week notes, and what to revise.
  // Also its structure for the folder page: the overview note, the week list in order, the current week.
  async courseData(folder, today) {
    const subs = this.subfolders(folder);
    const own = this.folderNote(folder) || folder.children.find((c) => c instanceof obsidian.TFile && c.extension === "md" && /overview$/i.test(c.basename)) || null;
    const term = await this.termOf(folder, own, today);
    const codeM = folder.name.match(COURSE_CODE), code = codeM ? codeM[0].trim() : "";
    const name = code ? folder.name.slice(codeM[0].length).replace(/^[\s._-]+/, "") || folder.name : this.plain(folder.name);
    const strip = stripCode;
    const all = this.sample(folder, 8, 5000).filter((x) => x.f !== own);
    const asg = new Map(), weeks = [], revise = [], loose = [];
    for (const x of all) {
      const rel = x.f.path.slice(folder.path.length + 1).split("/"), top = rel.length > 1 ? rel[0] : "", topN = strip(top).toLowerCase();
      const typ = String(x.fm.type == null ? "" : x.fm.type).toLowerCase(), due = this.dueOf(x.fm);
      if (top && ASSESS_SUB.test(topN)) {
        const g = asg.get(top) || { name: strip(top).replace(/^[\s._-]+/, ""), path: folder.path + "/" + top, count: 0, mtime: 0, dueIso: null, pastIso: null, states: [], files: [], folder: true };
        g.count++; g.mtime = Math.max(g.mtime, x.f.stat.mtime);
        if (due) {
          if (due >= today) { if (!g.dueIso || due < g.dueIso) g.dueIso = due; }
          else if (!g.pastIso || due > g.pastIso) g.pastIso = due;
        }
        const gs = String(x.fm.status == null ? "" : x.fm.status).trim().toLowerCase().replace(/[\s_]+/g, "-");
        if (gs) g.states.push(gs);
        if (g.files.length < 6) g.files.push(x.f);
        asg.set(top, g);
      } else if (!top && /^(assignment|exam|quiz|assessment)s?$/.test(typ)) loose.push({ name: x.f.basename, path: x.f.path, count: 1, mtime: x.f.stat.mtime, dueIso: due || null, pastIso: null, states: [String(x.fm.status == null ? "" : x.fm.status).trim().toLowerCase().replace(/[\s_]+/g, "-")].filter(Boolean), files: [x.f], folder: false });
      else if (REVISE_NAME.test(x.f.basename) || String(x.fm.status || "").toLowerCase() === "raw") revise.push({ title: x.f.basename, path: x.f.path, mtime: x.f.stat.mtime });
      else if (/^(?:week|w)\s*\d+\b/i.test(x.f.basename)) {
        const wm = x.f.basename.match(/^(?:week|w)\s*(\d+)/i);
        weeks.push({ n: wm ? +wm[1] : null, title: x.f.basename, path: x.f.path, mtime: x.f.stat.mtime, top: rel.length > 1 ? rel.slice(0, -1).join("/") : "" });
      }
    }
    // A past date is kept: the assessment stays dated, and is overdue unless it is marked done or the course has finished.
    // With no date in any property, a "Due Sun 1 Nov 2026" line in the assessment's notes will do.
    const assess = [...asg.values(), ...loose];
    // With no Runs line the term end is inferred from the notes (labelled as inferred on the page); a course is over once that day has passed.
    const endInf = term ? null : this.inferTermEnd(folder), over = term ? term.done : !!endInf && endInf < today;
    let canvas = null; // the day this course closes in Canvas, when a note says so
    for (const a of assess) {
      if (!a.dueIso && !a.pastIso) {
        for (const f of a.files) { const td = textDue(await this.app.vault.cachedRead(f), today); if (td) { if (td >= today) a.dueIso = td; else a.pastIso = td; break; } }
      }
      if (!a.dueIso && a.pastIso) a.dueIso = a.pastIso;
      const closed = a.states.length > 0 && a.states.every((st) => DONE_STATE.test(st));
      a.overdue = !!a.dueIso && a.dueIso < today && !closed && !over;
      if (!canvas) for (const f of a.files) { const cc = canvasClose(await this.app.vault.cachedRead(f), today); if (cc) { canvas = cc; break; } }
      // Its weight in the course, from a `weight` property or a "Weight: 30%" line; null when none says.
      a.weight = null;
      for (const f of a.files) {
        const wfm = this.fmOf(f), wp = wfm.weight != null ? wfm.weight : wfm.worth, wm = wp != null && String(wp).match(/\d{1,3}(?:\.\d+)?/);
        const wt = wm ? wm[0] : ((await this.app.vault.cachedRead(f)).match(/\bweight(?:ing)?\b[^\n%]{0,24}?(\d{1,3}(?:\.\d+)?)\s*%/i) || [])[1];
        if (wt != null && +wt > 0 && +wt <= 100) { a.weight = +wt; break; }
      }
      // Hours needed (an `effort` property) and the time of day it is due (a time in the `due` value), from the first note that says.
      a.effort = null; a.dueMin = null; a.closed = closed;
      for (const f of a.files) {
        const efm = this.fmOf(f), ev = parseEffort(efm.effort);
        if (a.effort == null && ev != null) a.effort = ev;
        const dv = efm.due != null ? efm.due : efm["due-date"] != null ? efm["due-date"] : efm.duedate;
        if (a.dueMin == null && dv != null && this.dueOf(efm) === a.dueIso) a.dueMin = clockIn(String(dv).replace(/\d{4}-\d{2}-\d{2}/, ""));
      }
      delete a.pastIso; delete a.states; delete a.files;
    }
    // The overview's assessments table adds what the folders lack (a test with no folder, weights); a row already listed (same date, or same name and number) only fills in its gaps.
    if (own) {
      const yr = term ? +term.end.slice(0, 4) : +today.slice(0, 4);
      const nk = (s) => { const k = String(s).match(/^(\D*?)\s*(\d+)/); return k ? k[1].trim().toLowerCase() + "#" + k[2] : null; };
      const ovText = await this.app.vault.cachedRead(own), tbl = parseAssessTable(ovText, yr);
      // The exam block only counts when nothing listed already says exam (a table row or a folder).
      const rowsAll = tbl.concat(tbl.length || assess.some((a) => /\bexam\b/i.test(a.name)) ? [] : parseExamBlock(ovText, yr));
      for (const row of rowsAll) {
        const rk = row.key && row.key[0] + "#" + row.key[1];
        const hit = assess.find((a) => (row.dueIso && a.dueIso === row.dueIso) || (rk && nk(a.name) === rk) || a.name.toLowerCase() === row.name.toLowerCase());
        if (hit) { if (hit.weight == null) hit.weight = row.weight; if (!hit.dueIso && row.dueIso) hit.dueIso = row.dueIso; if (hit.dueMin == null && row.dueIso === hit.dueIso) hit.dueMin = row.dueMin; }
        else assess.push({ name: row.name, path: own.path, count: 1, mtime: own.stat.mtime, dueIso: row.dueIso, weight: row.weight, dueMin: row.dueMin, effort: null, closed: false, folder: false, overdue: false, fromTable: true });
      }
    }
    const rank = (a) => (!a.dueIso ? 2 : a.dueIso >= today ? 0 : 1);
    assess.sort((a, b) => (rank(a) - rank(b)) || (rank(a) === 0 ? (a.dueIso < b.dueIso ? -1 : a.dueIso > b.dueIso ? 1 : 0) : rank(a) === 1 ? (a.dueIso < b.dueIso ? 1 : a.dueIso > b.dueIso ? -1 : 0) : 0) || b.mtime - a.mtime);
    // Weeks in order; the current one is the term's week when it is running, else the latest numbered (or last edited) note.
    const weeksList = weeks.slice().sort((a, b) => (a.n == null) - (b.n == null) || (a.n || 0) - (b.n || 0) || (a.title < b.title ? -1 : 1));
    const numbered = weeksList.filter((w) => w.n != null);
    let curNote = null;
    if (term && !term.done && term.week > 0) curNote = numbered.filter((w) => w.n <= term.week).pop() || numbered[0] || null;
    if (!curNote) curNote = numbered.length ? numbered[numbered.length - 1] : weeks.slice().sort((a, b) => b.mtime - a.mtime)[0] || null;
    const weeksSorted = curNote ? [curNote, ...weeksList.filter((w) => w !== curNote)] : weeksList;
    revise.sort((a, b) => a.mtime - b.mtime);
    const files = all.map((x) => x.f), rc = this.recency(files);
    const recent = all.slice().sort((a, b) => b.f.stat.mtime - a.f.stat.mtime).slice(0, 12).map((x) => { const rel = x.f.path.slice(folder.path.length + 1).split("/"); return { title: this.noteTitle(x.f), path: x.f.path, mtime: x.f.stat.mtime, sub: rel.length > 1 ? strip(rel[0]).replace(/^[\s._-]+/, "") : "" }; });
    // Where the week notes live, when they all sit in one folder inside the course.
    const wdirs = new Set(weeks.map((x) => x.path.slice(0, x.path.lastIndexOf("/")))), weeksPath = wdirs.size === 1 && [...wdirs][0] !== folder.path ? [...wdirs][0] : "";
    if (!canvas && own) canvas = canvasClose(await this.app.vault.cachedRead(own), today);
    const ft = this.settings.showTasks ? await this.folderTasks(this.notesIn(folder)) : [];
    return { path: folder.path, name, code, term, endInf, over, canvas, nNotes: all.length + (own ? 1 : 0), assess, open: ft.length, overdue: ft.filter((t) => t.overdue).length, weeks: weeksSorted, weeksList, curWeek: curNote ? curNote.n : null, curWeekNote: curNote ? { n: curNote.n, title: curNote.title, path: curNote.path } : null,
      overview: own ? own.path : "", weeksPath, revise, recent,
      last: files.length ? Math.max(...files.map((f) => f.stat.mtime)) : 0,
      frac: term ? term.p : rc.share, dark: !term && rc.dark, seed: hashOf(folder.path) };
  }

  // A reading queue: every note with its category (subfolder, or `category`), read state and saved date.
  queueData(folder) {
    const own = this.folderNote(folder), items = [], sampled = this.sample(folder, 8, 5000);
    for (const x of sampled) {
      if (x.f === own) continue;
      const rel = x.f.path.slice(folder.path.length + 1).split("/");
      let cat = rel.length > 1 ? this.plain(rel[0]) : "";
      if (!cat && x.fm.category != null) cat = String([].concat(x.fm.category)[0] || "").replace(/\[\[|\]\]/g, "").trim();
      const s = String(x.fm.status == null ? "" : x.fm.status).trim().toLowerCase().replace(/[\s_]+/g, "-");
      const read = READ_DONE.has(s) || x.fm.read === true;
      const dv = x.fm.saved || x.fm.created || x.fm.date || x.fm.added, t = dv ? Date.parse(String(dv)) : NaN;
      items.push({ title: this.noteTitle(x.f), path: x.f.path, cat: cat || "Loose notes", read, saved: isNaN(t) ? x.f.stat.ctime : t,
        summary: String(x.fm.summary || x.fm.description || "").trim(), hasStatus: x.fm.status != null, hasRead: typeof x.fm.read === "boolean" });
    }
    const cats = new Map();
    for (const it of items) { const c = cats.get(it.cat) || { name: it.cat, items: [] }; c.items.push(it); cats.set(it.cat, c); }
    // Exact total from the file list (no reads); unread is a lower bound when the metadata sample stopped short of it.
    const total = Math.max(items.length, this.notesIn(folder).filter((f) => f !== own).length);
    return { kind: "queue", items, cats: [...cats.values()], total, approx: sampled.cut && items.length < total };
  }

  // Projects in lanes (active, parked, abandoned, done), from `status`; a missing status is active.
  projectData(folder, today) {
    const lanes = { active: [], parked: [], abandoned: [], done: [], unknown: [] };
    for (const k of this.projectKids(folder, true)) {
      const known = !!laneOf(k.fm.status), lane = laneOf(k.fm.status) || "unknown", due = this.dueOf(k.fm), live = lane === "active" || lane === "unknown";
      const sum = String(k.fm.summary || k.fm.description || "").trim();
      lanes[lane].push({ name: k.name, path: k.path, isFolder: k.isFolder, notePath: k.f.path, summary: sum, mtime: k.mtime, dueIso: due && (due >= today || live) ? due : null, overdue: !!due && due < today && live, lane, known });
    }
    for (const l of Object.values(lanes)) l.sort((a, b) => b.mtime - a.mtime);
    return { kind: "projects", lanes };
  }

  // A journal: notes named YYYY-MM-DD (day), YYYY-Www (week) or YYYY-MM (month), grouped by month, newest first.
  journalData(folder) {
    const days = [], months = new Map();
    const isoWeekMonth = (y, w) => { const j4 = new Date(y, 0, 4), mon = new Date(j4.getTime() + ((w - 1) * 7 - ((j4.getDay() + 6) % 7)) * 864e5); return `${mon.getFullYear()}-${pad2(mon.getMonth() + 1)}`; };
    const sampled = this.sample(folder, 8, 5000);
    for (const x of sampled) {
      const b = x.f.basename;
      let m;
      if ((m = b.match(/^(\d{4})-(\d{2})-(\d{2})$/))) { days.push({ iso: b, path: x.f.path, title: b, month: `${m[1]}-${m[2]}`, day: true }); }
      else if ((m = b.match(/^(\d{4})-W(\d{2})$/i))) days.push({ iso: "", path: x.f.path, title: b, month: isoWeekMonth(+m[1], +m[2]), day: false });
      else if ((m = b.match(/^(\d{4})-(\d{2})$/))) days.push({ iso: "", path: x.f.path, title: b, month: b, day: false });
    }
    days.sort((a, b) => (a.iso || a.title) < (b.iso || b.title) ? 1 : -1);
    for (const e of days) { const g = months.get(e.month) || []; g.push(e); months.set(e.month, g); }
    return { kind: "journal", approx: sampled.cut, entries: days, months: [...months.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([key, list]) => ({ key, list })) };
  }

  // Page data: HOME is the Today page, anything else a folder page (renderFolder).
  async landing(section) {
    // "Up to the parent" from a folder shown in place of its parent asks for the parent as itself, once (until another page opens).
    if (this.noUnwrap && this.noUnwrap !== section) this.noUnwrap = "";
    if (section === HOME) return this.todayPage();
    const folder = this.app.vault.getAbstractFileByPath(section);
    if (!folder || !folder.children) return null;
    const label = (f) => (f.parent && f.parent.isRoot() && this.settings.folderLabels[f.name]) || this.plain(f.name);
    // One visible subfolder and no notes of its own: show what is inside it, titled and trailed as that folder.
    const own0 = this.folderNote(folder), subs0 = this.subfolders(folder);
    if (this.noUnwrap !== section && subs0.length === 1 && !folder.children.some((c) => c instanceof obsidian.TFile && c.extension === "md" && c !== own0)) {
      const inner = await this.landing(subs0[0].path);
      if (inner) {
        const crumbs = [{ label: "Ecliptic", path: null }];
        const chain = [];
        for (let p = folder.parent; p && !p.isRoot(); p = p.parent) chain.unshift(p);
        for (const p of chain) crumbs.push({ label: label(p), path: p.path });
        // trail: the opened folder, then each only-child folder down to the one whose contents are shown.
        const trail = [{ label: label(folder), path: folder.path }, ...(inner.trail || [{ label: inner.title, path: inner.tpath }])];
        for (const t of trail.slice(0, -1)) crumbs.push({ label: t.label, path: t.path, noUnwrap: true });
        return { ...inner, path: section, title: trail[trail.length - 1].label, crumbs, seed: hashOf(section), trail, via: trail[trail.length - 2].label, viaPath: trail[trail.length - 2].path };
      }
    }
    const cls = this.classify(folder), ftype = cls.type;
    // The folder note: Folder/Folder.md or Folder/index.md. It is linked, not listed.
    const fnote = this.folderNote(folder);
    const all = this.notesIn(folder), notes = all.filter((f) => f !== fnote);
    const today = isoDay(this.nowDate());
    // Queues and journals are not task lists.
    const tasks = this.settings.showTasks && ftype !== "queue" && ftype !== "journal" ? await this.folderTasks(all) : [];
    const subs = [];
    for (const s of this.subfolders(folder)) {
      const sn = this.notesIn(s), own = this.folderNote(s), list = sn.filter((f) => f !== own), pre = s.path + "/";
      const mine = tasks.filter((t) => t.path.startsWith(pre)), next = mine.find((t) => t.dueIso && !t.overdue) || null;
      const latest = this.newest(list, 1)[0], rc = this.recency(list);
      subs.push({ name: this.plain(s.name), path: s.path, count: list.length, seed: hashOf(s.path),
        open: mine.length, overdue: mine.filter((t) => t.overdue).length, next, share: rc.share, dark: rc.dark,
        latest: latest ? { title: this.noteTitle(latest), when: this.whenShort(latest.stat.mtime) } : null,
        term: await this.termOf(s, own, today) });
    }
    // The type's own data, and the nearest real deadline (a dated task, or a `due` property on a course or project).
    let x = null, nextDue = tasks.find((t) => t.dueIso && !t.overdue) || null;
    const near = (c) => { if (c && c.dueIso && c.dueIso >= today && (!nextDue || c.dueIso < nextDue.dueIso)) nextDue = c; };
    if (ftype === "course") {
      const list = cls.container || [folder], courses = [];
      for (const cf of list) courses.push(await this.courseData(cf, today));
      const also = cls.container ? subs.filter((s) => !cls.container.some((c) => c.path === s.path || c.path.startsWith(s.path + "/"))) : [];
      x = { kind: "course", container: !!cls.container, courses, also };
      for (const c of courses) for (const a of c.assess) near(a.dueIso ? { title: a.name, path: a.path, dueIso: a.dueIso } : null);
    } else if (ftype === "queue") x = this.queueData(folder);
    else if (ftype === "projects") {
      x = this.projectData(folder, today);
      for (const p of [...x.lanes.active, ...x.lanes.unknown]) near(p.dueIso ? { title: p.name, path: p.path, dueIso: p.dueIso } : null);
    } else if (ftype === "journal") x = this.journalData(folder);
    else if (ftype === "work") x = await this.workData(folder, today);
    if (ftype === "queue" || ftype === "journal") nextDue = null;
    const crumbs = [{ label: "Ecliptic", path: null }];
    const chain = [];
    for (let p = folder.parent; p && !p.isRoot(); p = p.parent) chain.unshift(p);
    for (const p of chain) crumbs.push({ label: label(p), path: p.path });
    const subOf = (f) => {
      const rest = f.path.slice(section.length + 1).split("/");
      return rest.length > 1 ? { sub: this.plain(rest[0]), subPath: section + "/" + rest[0] } : { sub: "", subPath: "" };
    };
    const sorted = notes.slice().sort((x, y) => y.stat.mtime - x.stat.mtime);
    // The next seven days: tasks due on each, and whether a daily note exists for it.
    const week = [];
    for (let i = 0; i < 7; i++) {
      const dt = this.nowDate(); dt.setDate(dt.getDate() + i);
      const iso = isoDay(dt), due = tasks.filter((t) => t.dueIso === iso), df = this.app.vault.getAbstractFileByPath(this.dailyPath(dt));
      week.push({ iso, dow: fmtDay(dt, { weekday: "short" }), day: dt.getDate(), due, daily: df instanceof obsidian.TFile ? df.path : null });
    }
    const schedule = this.settings.showTasks && ftype !== "queue" && ftype !== "journal" ? this.scheduleIn(all) : [];
    const fm = fnote ? (this.app.metadataCache.getFileCache(fnote) || {}).frontmatter || {} : {};
    let blocks = fm["ecliptic-blocks"];
    if (typeof blocks === "string") blocks = blocks.split(/[,\s]+/);
    blocks = Array.isArray(blocks) ? blocks.map((b) => String(b).trim().toLowerCase()).filter((b) => FOLDER_BLOCKS.includes(b)) : null;
    return {
      kind: "folder", path: section, title: label(folder), crumbs, subs, today, week,
      ftype, auto: cls.auto !== false, x, nextDue, tpath: folder.path, via: "", trail: null,
      blocks: blocks && blocks.length ? blocks : schedule.length ? ["summary", "schedule", "subfolders", "loose", "recent"] : ["summary", "subfolders", "loose", "recent"],
      schedule,
      count: notes.length,
      edited: all.length ? this.whenShort(Math.max(...all.map((f) => f.stat.mtime))) : "",
      note: fnote ? { path: fnote.path } : null,
      tasks,
      notes: sorted.map((f) => ({ title: this.noteTitle(f), path: f.path, when: this.whenShort(f.stat.mtime), mtime: f.stat.mtime, ...subOf(f) })),
      seed: hashOf(section),
    };
  }

  // A folder's term, from a "Runs: Mon 10 Aug → Fri 30 Oct 2026" line (or `runs:` property) in its
  // folder note or an overview note at its top. null when there is none.
  async termOf(folder, own, today) {
    const files = folder.children.filter((c) => c instanceof obsidian.TFile && c.extension === "md");
    files.sort((a, b) => (b === own) - (a === own) || /overview/i.test(b.basename) - /overview/i.test(a.basename));
    for (const f of files.slice(0, 4)) {
      const fm = (this.app.metadataCache.getFileCache(f) || {}).frontmatter || {};
      let line = fm.runs ? String(fm.runs) : null;
      if (!line) { const m = (await this.app.vault.cachedRead(f)).match(/^[^\n]{0,8}Runs:?\**:?\s*([^\n]+)/im); line = m && m[1]; }
      const t = line && parseRuns(line, today);
      if (t) return t;
    }
    return null;
  }

  // "12 min ago", "3 h ago", "yesterday", "4 days ago", then the date.
  whenShort(ms) {
    const min = Math.floor((Date.now() - ms) / 6e4);
    if (min < 2) return "just now";
    if (min < 60) return min + " min ago";
    if (min < 1440) return Math.floor(min / 60) + " h ago";
    const days = Math.floor(min / 1440);
    if (days === 1) return "yesterday";
    if (days < 7) return days + " days ago";
    return fmtDay(new Date(ms), { day: "numeric", month: "short" });
  }

  // The opening prose of a note (no headings, tasks or rules), up to about max characters.
  async excerptOf(file, max) {
    const text = (await this.app.vault.cachedRead(file)).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    const parts = [];
    for (const raw of text.split(/\r?\n/)) {
      const t = raw.trim();
      if (!t) { if (parts.length) break; continue; }
      if (/^#+\s/.test(t) || /^[-*+]\s+\[.\]/.test(t) || /^---+$/.test(t) || /^```/.test(t)) { if (parts.length) break; continue; }
      parts.push(t.replace(/^[-*+>]\s+/, "").replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2").replace(/[*_`]/g, ""));
      if (parts.join(" ").length > max) break;
    }
    let out = parts.join(" ");
    if (out.length > max + 40) out = out.slice(0, max).replace(/\s+\S*$/, "") + "…";
    return out;
  }

  // The first line of a note that is not its own title, for the list view. Cached by path and mtime.
  async previewOf(path, title) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!f || !f.stat) return "";
    this.previews = this.previews || new Map();
    const hit = this.previews.get(path);
    if (hit && hit.m === f.stat.mtime) return hit.t;
    const want = (title || "").trim().toLowerCase();
    const lines = await this.firstLines(f, 3, 140);
    const t = lines.find((l) => l.trim().toLowerCase() !== want) || "";
    this.previews.set(path, { m: f.stat.mtime, t });
    return t;
  }

  // What a journal row says: the first prose of the entry (headings, rules and empty template sections are skipped), else its first task or bullet, else nothing.
  async journalLine(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!f || !f.stat) return "";
    this.jlines = this.jlines || new Map();
    const hit = this.jlines.get(path);
    if (hit && hit.m === f.stat.mtime) return hit.t;
    let t = await this.excerptOf(f, 110);
    if (!t) {
      const text = (await this.app.vault.cachedRead(f)).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
      for (const raw of text.split(/\r?\n/)) {
        const m = raw.match(/^\s*[-*+]\s+(?:\[.\]\s*)?(.+)$/);
        if (m && m[1].replace(/[*_`#]/g, "").trim()) { t = m[1].replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2").replace(/[*_`]/g, "").trim().slice(0, 110); break; }
      }
    }
    this.jlines.set(path, { m: f.stat.mtime, t });
    return t;
  }

  // Open tasks in these notes (all of them, from the task index): overdue first, then by due date, then the newest notes.
  async folderTasks(files) {
    await this.ensureTaskIndex();
    const today = isoDay(this.nowDate()), out = [];
    for (const f of files) {
      const e = this.taskIdx.get(f.path);
      if (!e) continue;
      for (const t of e.open) out.push({ title: t.title, path: f.path, line: t.line, dueIso: t.due, due: t.due ? dueDay(t.due, today) : "", overdue: !!t.due && t.due < today, mtime: e.mtime });
    }
    out.sort((a, b) => (b.overdue - a.overdue) || (a.dueIso && b.dueIso ? (a.dueIso < b.dueIso ? -1 : a.dueIso > b.dueIso ? 1 : 0) : a.dueIso ? -1 : b.dueIso ? 1 : 0) || b.mtime - a.mtime);
    return out;
  }
  // Tick an open task off in its note: the box at that line becomes [x] with a done date. Nothing is written unless the line still is that task.
  // A repeating task (Tasks plugin "🔁 every ...") must also create its next occurrence, which only the Tasks plugin knows how to do.
  // With Tasks enabled its own toggle does the work and its answer is written back; without it a repeating task is not ticked here (returns "open").
  tasksApi() {
    try {
      const pl = this.app.plugins;
      // plugins.plugins only holds plugins that are loaded, so a disabled Tasks plugin has no entry.
      const api = pl && pl.plugins && pl.plugins["obsidian-tasks-plugin"] && pl.plugins["obsidian-tasks-plugin"].apiV1;
      return api && typeof api.executeToggleTaskDoneCommand === "function" ? api : null;
    } catch (e) { return null; }
  }
  // Returns true (ticked), false (the line moved or changed) or "open" (a repeating task and no Tasks plugin: open the note instead).
  async tickTask(path, line, title) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof obsidian.TFile)) return false;
    let ok = false;
    await this.app.vault.process(f, (txt) => {
      const lines = txt.split("\n"), cr = (lines[line] || "").endsWith("\r") ? "\r" : "", raw = (lines[line] || "").replace(/\r$/, "");
      if (!/^\s*[-*+]\s+\[ \]/.test(raw) || taskTitle(raw) !== title) return txt;
      if (/🔁/u.test(raw)) {
        const api = this.tasksApi();
        if (!api) { ok = "open"; return txt; }
        let out;
        try { out = api.executeToggleTaskDoneCommand(raw, path); } catch (e) { console.warn("Ecliptic: the Tasks plugin could not toggle the task", e); }
        if (typeof out !== "string" || !out.trim() || out === raw) return txt;
        lines[line] = out.split(/\r?\n/).join(cr + "\n") + cr; // the new occurrence and the done line, in the note's own line endings
        ok = true;
        return lines.join("\n");
      }
      lines[line] = raw.replace("[ ]", "[x]") + (raw.includes("✅") ? "" : " ✅ " + isoDay(new Date())) + cr;
      ok = true;
      return lines.join("\n");
    });
    return ok;
  }
  // Schedule entries (shifts, timed items) from these notes, today onwards.
  scheduleIn(files) {
    const today = isoDay(this.nowDate()), out = [];
    for (const f of files) {
      const e = this.taskIdx && this.taskIdx.get(f.path);
      if (e) for (const sc of e.sched) if (sc.date && sc.date >= today) out.push({ ...sc, path: f.path, when: this.shiftWhen(sc, today) });
    }
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.start || 0) - (b.start || 0)));
    return dedupeSched(out);
  }

  // A work folder's data: every shift found in its notes (the shift parser's entries, so dated bullets and checkbox lines both count),
  // one job per note in its Work / Jobs folder (or in the folder itself when it is that folder), the Kit notes and the Applications notes.
  async workData(folder, today) {
    if (this.settings.showTasks) await this.ensureTaskIndex();
    const subs = this.subfolders(folder), find = (re) => subs.find((s) => re.test(stripNum(s.name))) || null;
    const asRef = (f) => ({ title: this.noteTitle(f), path: f.path, mtime: f.stat.mtime, when: fmtDay(new Date(f.stat.mtime), { day: "numeric", month: "short" }) });
    const direct = (fo) => { const own = this.folderNote(fo); return fo.children.filter((c) => c instanceof obsidian.TFile && c.extension === "md" && c !== own); };
    const workDir = find(/^(work|jobs?|employment|roster|rota)$/) || (/^(work|jobs?)$/.test(stripNum(folder.name)) ? folder : null);
    const kitDir = find(/^(application )?kit$/), appDir = find(/^applications?$/);
    const sched = [];
    if (this.settings.showTasks && this.taskIdx) for (const f of this.notesIn(folder)) {
      const e = this.taskIdx.get(f.path);
      if (e) for (const sc of e.sched) if (sc.date && sc.start != null && sc.end != null) sched.push({ date: sc.date, start: sc.start, end: sc.end, label: sc.label, path: f.path });
    }
    const shifts = dedupeSched(sched.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start - b.start)));
    const nowMin = this.nowDate().getHours() * 60 + this.nowDate().getMinutes();
    // A shift belongs to a job when it sits in the job's note, carries the job's name as its label, or comes from a roster note that
    // names exactly one job (or that the job note links to). A roster that names no job stays unattributed.
    const jobFiles = workDir ? direct(workDir) : [], jobNames = jobFiles.map((f) => this.noteTitle(f));
    const byPath = new Map(), has = (txt, name) => new RegExp("(^|[^\\p{L}\\p{N}])" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^\\p{L}\\p{N}]|$)", "iu").test(txt);
    const jobTxt = new Map();
    for (const f of jobFiles) { try { jobTxt.set(f.path, await this.app.vault.cachedRead(f)); } catch (e) { jobTxt.set(f.path, ""); } }
    for (const p of new Set(shifts.map((s) => s.path))) {
      if (jobFiles.some((f) => f.path === p)) continue;
      const src = this.app.vault.getAbstractFileByPath(p);
      if (!(src instanceof obsidian.TFile)) continue;
      let txt = ""; try { txt = await this.app.vault.cachedRead(src); } catch (e) { continue; }
      const named = jobFiles.filter((f, i) => has(txt, jobNames[i]) || has(jobTxt.get(f.path) || "", src.basename));
      if (named.length === 1) byPath.set(p, named[0].path);
    }
    const jobs = jobFiles.map((f) => {
      const name = this.noteTitle(f), lname = name.toLowerCase();
      const own = (s) => s.path === f.path || String(s.label).toLowerCase() === lname || (byPath.get(s.path) === f.path && !jobNames.some((n) => n.toLowerCase() === String(s.label).toLowerCase() && n.toLowerCase() !== lname));
      const mine = shifts.filter(own);
      const next = mine.find((s) => s.date > today || (s.date === today && s.end > nowMin)) || null;
      const last = mine.filter((s) => s !== next && (s.date < today || (s.date === today && s.end <= nowMin))).pop() || null;
      return { name, path: f.path, mtime: f.stat.mtime, next, last, count: mine.length };
    }).sort((a, b) => (a.next ? 0 : 1) - (b.next ? 0 : 1) || (a.next && b.next ? (a.next.date < b.next.date ? -1 : 1) : b.mtime - a.mtime));
    // Kit: the notes of a Kit folder, else the application kit note itself.
    let kit = [];
    if (kitDir) kit = this.notesIn(kitDir).map(asRef).sort((a, b) => b.mtime - a.mtime);
    else kit = direct(folder).filter((f) => /(^|\s)kit$/i.test(f.basename)).map(asRef);
    const apps = appDir ? this.notesIn(appDir).map(asRef).sort((a, b) => b.mtime - a.mtime) : [];
    return { kind: "work", shifts, jobs, kit, kitIsDir: !!kitDir, apps, hasWork: !!workDir, hasApps: !!appDir,
      jobsPath: workDir ? workDir.path : "", appsPath: appDir ? appDir.path : folder.path + "/Applications" };
  }

  async todayPage() {
    const now = this.nowDate(), f = this.dailyFile(now), ph = moonPhase(moonAge(now)), world = WORLDS.find((w) => w.id === this.settings.world) || WORLDS[0];
    const located = this.settings.latitude != null && this.settings.longitude != null, sun = this.sun();
    const stats = [["Moon", ph.name], ["Lit", ph.lit + "%"]];
    if (located && sun.exact) stats.push(["Sunrise", fmtClock(sun.rise)], ["Sunset", fmtClock(sun.set)]);
    const noteRows = [];
    if (f) {
      for (const line of await this.firstLines(f, 4, 90)) noteRows.push({ when: "", title: line, path: f.path });
      noteRows.push({ when: "", title: "Open today's note", path: f.path });
    } else {
      noteRows.push({ when: "", title: "Create today's note", run: async () => { const nf = await this.createDaily(); const v = this.views()[0]; if (v) v.openNote(nf.path); } });
    }
    const columns = [{ eyebrow: "Today's note", rows: noteRows }];
    if (this.settings.showTasks) {
      const tasks = (await this.taskBelt()).open.slice(0, 8);
      columns.push({ eyebrow: "Open tasks", empty: "Nothing open", rows: tasks.map((t) => ({ when: t.due ? fmtDay(t.due, { day: "numeric", month: "short" }) : "", title: t.title, path: t.path, soon: t.soon })) });
    }
    const recent = this.newest(this.app.vault.getMarkdownFiles(), 8);
    columns.push({ eyebrow: "Recently edited", empty: "Nothing here yet", rows: recent.map((x) => ({ when: this.ago(x.stat.mtime), title: this.noteTitle(x), path: x.path })) });
    return {
      eyebrow: fmtDay(now, { day: "numeric", month: "long", year: "numeric" }),
      backLabel: "Ecliptic",
      title: fmtDay(now, { weekday: "long" }),
      summary: located && this.settings.placeName ? this.settings.placeName : "",
      stats, columns,
      moons: recent.slice(0, 5).map((x) => ({ name: this.noteTitle(x), path: x.path })),
      seed: hashOf(isoDay(now)), surface: world.surface,
    };
  }
}

// ---- Settings tab -------------------------------------------------------
class EclipticSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  display() {
    const { containerEl: el } = this, p = this.plugin, s = p.settings;
    el.empty();
    el.addClass("ecl-settings");
    const head = (t) => new obsidian.Setting(el).setName(t).setHeading();
    const apply = async (refresh) => { await p.save(); if (refresh) p.refreshAll(); };

    head("Appearance");
    new obsidian.Setting(el).setName("World").setDesc("The planet at the centre. Click the date at the bottom of the Ecliptic view to travel to the next one.")
      .addDropdown((d) => {
        for (const w of WORLDS) d.addOption(w.id, w.name);
        d.setValue(s.world).onChange((v) => p.travel(v));
      })
      .addButton((b) => b.setButtonText("Open Ecliptic").onClick(() => p.activate()));
    // The rotation row and its grid share one card, so the grid does not float between cards.
    const card = el.createDiv({ cls: "ecl-set-card" });
    new obsidian.Setting(card).setName("Worlds in rotation").setDesc("The date click goes through the ticked worlds. At least one stays ticked.");
    const grid = card.createDiv({ cls: "ecl-set-worlds", attr: { role: "group", "aria-label": "Worlds in rotation" } });
    const cells = [];
    const inRot = (id) => !s.worlds.length || s.worlds.includes(id);
    const paintWorlds = () => cells.forEach(([w, b]) => { const on = inRot(w.id); b.toggleClass("is-on", on); b.setAttr("aria-checked", String(on)); });
    for (const w of WORLDS) {
      const b = grid.createEl("button", { cls: "ecl-set-world", attr: { type: "button", role: "checkbox" } });
      const g = b.createSpan({ cls: "ecl-set-glyph is-" + w.id });
      g.style.setProperty("--g", `rgb(${w.accent})`);
      b.createSpan({ cls: "ecl-set-wname", text: w.name });
      obsidian.setIcon(b.createSpan({ cls: "ecl-set-check" }), "check");
      b.addEventListener("click", async () => {
        const set = new Set(s.worlds.length ? s.worlds : WORLDS.map((x) => x.id));
        set.has(w.id) ? set.delete(w.id) : set.add(w.id);
        if (!set.size) set.add(w.id);
        s.worlds = set.size === WORLDS.length ? [] : WORLDS.map((x) => x.id).filter((id) => set.has(id));
        paintWorlds();
        await apply(true);
      });
      cells.push([w, b]);
    }
    paintWorlds();
    // Tint accents only matters while the whole-app theme is off, so it reads inactive (disabled, dimmed, with a note) while that is on.
    let tintRow = null, tintToggle = null;
    const paintTint = () => {
      const off = s.themeApp;
      tintRow.setDesc(off
        ? "Off while 'Theme the whole app' is on, which already colours accents."
        : "Colour only links, checkboxes and other accents after the current world, and leave the rest of your theme alone. Dark mode only.");
      tintRow.setDisabled(off);
      tintRow.settingEl.toggleClass("ecl-set-inactive", off);
      tintToggle.setValue(off ? false : s.tint); // reads OFF (not checked-and-dimmed) while the whole-app theme covers it; the saved choice returns when that is switched off
      tintToggle.setDisabled(off);
      const box = tintToggle.toggleEl.querySelector("input"); if (box) box.disabled = off;
    };
    new obsidian.Setting(el).setName("Theme the whole app").setDesc("Colour Obsidian's sidebars, tabs, editor and dialogs after the current world. Works in dark mode; in light mode Obsidian is left alone.")
      .addToggle((t) => t.setValue(s.themeApp).onChange(async (v) => { s.themeApp = v; s.themeAsked = true; p.views().forEach((x) => x.setThemePrompt(false)); paintTint(); p.theme(); await apply(); }));
    tintRow = new obsidian.Setting(el).setName("Tint accents")
      .addToggle((t) => { tintToggle = t; t.setValue(s.tint).onChange(async (v) => { s.tint = v; p.tint(); p.theme(); await apply(); }); });
    paintTint();
    new obsidian.Setting(el).setName("Immersive").setDesc("Hide the sidebars, ribbon and status bar to give the view the whole window.")
      .addToggle((t) => t.setValue(s.immersive).onChange(async (v) => { s.immersive = v; p.applyImmersive(); await apply(); }));
    new obsidian.Setting(el).setName("Open on startup").setDesc("Open Ecliptic when Obsidian starts, in an empty tab if there is one.")
      .addToggle((t) => t.setValue(s.openOnStart).onChange(async (v) => { s.openOnStart = v; await apply(); }));

    head("Home folders");
    const maxRow = new obsidian.Setting(el).setName("Maximum folder moons").setDesc("Top-level folders Home shows as moons (3 to 12). When there are more, the most recently edited stay.");
    maxRow.addSlider((sl) => sl.setLimits(3, 12, 1).setValue(s.maxSections).setDynamicTooltip().onChange(async (v) => { s.maxSections = v; await apply(true); }));
    const cands = p.candidates().map((c) => c.folder.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!cands.length) new obsidian.Setting(el).setName("No folders with notes yet");
    // One group: the intro, the column heads and every folder row sit in a single bordered block, rows compact and aligned. (ON2 A2)
    let group = el;
    if (cands.length) {
      group = el.createDiv({ cls: "ecl-set-folders" });
      new obsidian.Setting(group).setName("Folders").setDesc("Type a label to rename a moon; blank uses the folder name. The switch shows or hides it on Home.");
      const colhead = group.createDiv({ cls: "ecl-set-colhead" });
      colhead.createSpan({ text: "Moon label" });
      colhead.createSpan({ text: "Show" });
    }
    for (const name of cands) {
      const row = new obsidian.Setting(group).setName(name);
      row.settingEl.addClass("ecl-set-folder");
      row.addText((t) => {
        t.setPlaceholder(p.plain(name)).setValue(s.folderLabels[name] || "").onChange(async (v) => {
          v.trim() ? (s.folderLabels[name] = v.trim()) : delete s.folderLabels[name];
          await apply(true);
        });
        t.inputEl.setAttr("aria-label", `Moon label for ${name}`);
      });
      row.addToggle((t) => {
        t.setValue(p.isShown(name)).onChange(async (v) => { s.folderShow[name] = v; await apply(true); });
        t.toggleEl.setAttr("aria-label", `Show ${name} on Home`);
      });
    }

    head("Today");
    new obsidian.Setting(el).setName("Daily note folder").setDesc("Blank follows your Daily notes settings.")
      .addText((t) => t.setPlaceholder(p.daily.folder || "(vault root)").setValue(s.dailyFolder).onChange(async (v) => { s.dailyFolder = v.trim(); await apply(true); }));
    new obsidian.Setting(el).setName("Filename date format").setDesc("How the date reads in a daily note's file name, like YYYY-MM-DD. Blank follows Daily notes.")
      .addText((t) => t.setPlaceholder(p.daily.format).setValue(s.dailyFormat).onChange(async (v) => { s.dailyFormat = v.trim(); await apply(true); }));
    new obsidian.Setting(el).setName("Show open tasks").setDesc("Open tasks appear on the Today page and as rocks in the asteroid belt.")
      .addToggle((t) => t.setValue(s.showTasks).onChange(async (v) => { s.showTasks = v; await apply(true); }));
    new obsidian.Setting(el).setName("Time you have").setDesc("Today lists each deadline in the next two weeks with the free hours before it, and Home names the tightest one under its moon.")
      .addToggle((t) => t.setValue(s.timeOn).onChange(async (v) => { s.timeOn = v; await apply(true); }));
    const hhmm = (v) => { const m = String(v).trim().match(/^(\d{1,2}):(\d{2})$/); return !!m && +m[1] < 25 && +m[2] < 60; };
    new obsidian.Setting(el).setName("Counted hours start").setDesc("The part of each day that counts as free time, as 24-hour HH:MM. Shifts and classes are taken out of it.")
      .addText((t) => t.setPlaceholder("09:00").setValue(s.timeFrom).onChange(async (v) => { if (!hhmm(v)) return; s.timeFrom = v.trim(); await apply(true); }));
    new obsidian.Setting(el).setName("Counted hours end").setDesc("Must be later than the start, or the defaults (09:00 to 21:00) are used.")
      .addText((t) => t.setPlaceholder("21:00").setValue(s.timeTo).onChange(async (v) => { if (!hhmm(v)) return; s.timeTo = v.trim(); await apply(true); }));
    new obsidian.Setting(el).setName("Travel buffer around shifts").setDesc("Minutes taken off before and after each shift. Classes get none.")
      .addSlider((sl) => sl.setLimits(0, 120, 15).setValue(s.timeBuffer).setDynamicTooltip().onChange(async (v) => { s.timeBuffer = v; await apply(true); }));
    new obsidian.Setting(el).setName("Most hours you'd work in a day").setDesc("Each day gives at most this many free hours to deadlines, even if more are open. 0 means no limit.")
      .addSlider((sl) => sl.setLimits(0, 12, 1).setValue(s.timeCap).setDynamicTooltip().onChange(async (v) => { s.timeCap = v; await apply(true); }));
    new obsidian.Setting(el).setName("Hours per weight point").setDesc("Guess for an assessment with no effort set: its weight times this. 0 turns the guess off.")
      .addSlider((sl) => sl.setLimits(0, 2, 0.1).setValue(s.timeRate).setDynamicTooltip().onChange(async (v) => { s.timeRate = Math.round(v * 10) / 10; await apply(true); }));

    head("Ambient");
    new obsidian.Setting(el).setName("Debris").setDesc("Rock and dust drifting round the planet on Home, and the faint wake behind moons.")
      .addDropdown((d) => d.addOptions({ off: "Off", light: "Light", some: "Some", lots: "Lots" }).setValue(s.debris).onChange(async (v) => { s.debris = v; await apply(true); }));
    new obsidian.Setting(el).setName("Moon speed").setDesc("How fast the moons turn. A moon holds still while you point at it. Reduced motion stops it all.")
      .addDropdown((d) => d.addOptions({ calm: "Calm", lively: "Lively", brisk: "Brisk" }).setValue(s.motion).onChange(async (v) => { s.motion = v; await apply(true); }));

    head("Place & sky");
    let latText, lonText, nameText;
    const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : Math.round(n * 100) / 100; };
    new obsidian.Setting(el).setName("Place").setDesc("Look up fills in the coordinates. Runs only when you press it.")
      .addText((t) => { nameText = t; t.setPlaceholder("e.g. Paris").setValue(s.placeName).onChange(async (v) => { s.placeName = v.trim(); await p.save(); }); })
      .addButton((b) => b.setButtonText("Look up").onClick(async () => {
        const q = (s.placeName || "").trim();
        if (!q) { new obsidian.Notice("Type a place name first."); return; }
        try {
          const hit = await p.lookupPlace(q);
          if (!hit) { new obsidian.Notice("No place found."); return; }
          s.latitude = hit.lat; s.longitude = hit.lon; s.placeName = hit.name; s.timezone = hit.tz;
          nameText.setValue(hit.name); latText.setValue(String(hit.lat)); lonText.setValue(String(hit.lon));
          await p.save(); p.fetchWeather(); p.updateWeather(true); p.refreshAll();
        } catch (e) { new obsidian.Notice("Could not reach the lookup service."); }
      }));
    new obsidian.Setting(el).setName("Latitude").setDesc("Degrees, south is negative.")
      .addText((t) => { latText = t; t.setPlaceholder("e.g. 48.86").setValue(s.latitude == null ? "" : String(s.latitude)).onChange(async (v) => { s.latitude = num(v); s.timezone = ""; await p.save(); p.updateWeather(true); }); });
    new obsidian.Setting(el).setName("Longitude").setDesc("Degrees, west is negative. Sets sunrise, sunset and the moon's lit side, even with weather off.")
      .addText((t) => { lonText = t; t.setPlaceholder("e.g. 2.35").setValue(s.longitude == null ? "" : String(s.longitude)).onChange(async (v) => { s.longitude = num(v); s.timezone = ""; await p.save(); p.updateWeather(true); }); });
    new obsidian.Setting(el).setName("Live weather").setDesc("Off by default. When on, your coordinates go to open-meteo.com every 15 minutes to shape the sky. Nothing else is sent.")
      .addToggle((t) => t.setValue(s.weather).onChange(async (v) => { s.weather = v; await p.setWeather(v); }));
  }
}

module.exports = EclipticPlugin;

