// Background shimmer: a grid of dots at random brightness, masked by Perlin
// noise that slides sideways, so patches of the grid glint in and out.
(() => {
  const DOT = 4;          // dot diameter, CSS px
  const PITCH = 12;       // dot spacing, CSS px
  const CONTRAST = 2;     // > 0 favours dim dots, so the bright ones pop
  const NOISE_CELL = 40;  // size of a noise blob, CSS px
  const NOISE_RES = 4;    // noise is drawn at 1/4 resolution; it's smooth anyway
  const DRIFT = 40;       // mask drift, CSS px per second

  const canvas = document.getElementById("shimmer");
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Classic 2D Perlin noise, -1..1.
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = perm[i + 256] = Math.floor(Math.random() * 256);
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);
  function grad(hash, x, y) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  function perlin(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const A = perm[X] + Y, B = perm[X + 1] + Y;
    return lerp(v,
      lerp(u, grad(perm[A], x, y), grad(perm[B], x - 1, y)),
      lerp(u, grad(perm[A + 1], x, y - 1), grad(perm[B + 1], x - 1, y - 1)));
  }

  function drawDots(w, h, dpr) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const r = DOT / 2;
    for (let y = PITCH / 2; y < h + r; y += PITCH) {
      for (let x = PITCH / 2; x < w + r; x += PITCH) {
        ctx.fillStyle = `rgba(255,255,255,${Math.pow(Math.random(), 1 + CONTRAST / 5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  // A noise tile twice the viewport wide: the noise, then its mirror image,
  // so it repeats along x without a seam. Noise sits in the alpha channel.
  function noiseTile(w, h) {
    const nw = Math.ceil(w / NOISE_RES), nh = Math.ceil(h / NOISE_RES);
    const cell = NOISE_CELL / NOISE_RES;
    const tile = document.createElement("canvas");
    tile.width = nw * 2;
    tile.height = nh;
    const t = tile.getContext("2d");
    const img = t.createImageData(nw * 2, nh);
    const d = img.data;
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const n = (perlin(x / cell, y / cell) + 1) / 2;
        const a = Math.round(255 * Math.min(1, Math.max(0, (n - 0.35) / 0.4)));
        for (const px of [x, nw * 2 - 1 - x]) {
          const i = (y * nw * 2 + px) * 4;
          d[i] = d[i + 1] = d[i + 2] = 255;
          d[i + 3] = a;
        }
      }
    }
    t.putImageData(img, 0, 0);
    return tile.toDataURL();
  }

  let anim = null;
  function build() {
    const w = innerWidth, h = innerHeight;
    drawDots(w, h, Math.min(window.devicePixelRatio || 1, 2));

    const s = canvas.style;
    s.maskImage = s.webkitMaskImage = `url(${noiseTile(w, h)})`;
    s.maskSize = s.webkitMaskSize = `${w * 2}px ${h}px`;
    s.maskRepeat = s.webkitMaskRepeat = "repeat-x";
    s.maskPosition = s.webkitMaskPosition = "0 0";

    if (anim) anim.cancel();
    if (!reduceMotion && canvas.animate) {
      const to = `${-w * 2}px 0`;
      anim = canvas.animate(
        [{ maskPosition: "0 0", webkitMaskPosition: "0 0" },
         { maskPosition: to, webkitMaskPosition: to }],
        { duration: (w * 2 / DRIFT) * 1000, iterations: Infinity });
    }
  }

  // Mobile toolbars nudge the height while scrolling; only rebuild when the
  // width changes or the viewport outgrows what was drawn.
  let builtW = 0, builtH = 0, resizeTimer;
  function rebuild() {
    builtW = innerWidth;
    builtH = innerHeight;
    build();
  }
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (innerWidth !== builtW || innerHeight > builtH) rebuild();
    }, 150);
  });
  rebuild();
})();
