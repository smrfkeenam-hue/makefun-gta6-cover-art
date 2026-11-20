// The cover engine: draws a whole GTA-style poster onto a canvas from the
// editor's state. One function, drawCover, does everything: panels with
// their photos and grades, the title block, the badge and heat meter, then
// grain and vignette. The editor calls it on every change (it is fast
// enough to run live), and export calls it once per size on an offscreen
// canvas at the full export resolution.
//
// state:
//   w, h          cover size in pixels
//   layoutId      key of LAYOUTS
//   gradeId       key of GRADES
//   title         main caption, drawn in Anton
//   subtitle      script line under it, drawn in Pacifico
//   badge         short text for the starburst badge ('' hides it)
//   stars         heat meter, 0..5 (0 hides it)
//   grain         film grain on/off
//   vignette      edge vignette on/off
//   frame         white gutters and border on/off
//   photos        array of loaded images (the library)
//   crops         per-panel {photo, zoom, dx, dy}; dx/dy in -1..1 pan the
//                 photo inside its panel, zoom scales it past cover-fit

import { layoutPanels, layoutTitle } from './layouts.js';
import { GRADES } from './grades.js';

/** Small deterministic PRNG, so the grain looks the same every render. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let noiseTile = null;
/** A 128x128 tile of monochrome noise, made once and reused as a pattern. */
function getNoiseTile() {
  if (noiseTile) return noiseTile;
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const ctx = tile.getContext('2d');
  const img = ctx.createImageData(128, 128);
  const rand = mulberry32(20261119);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = tile;
  return tile;
}

/**
 * Draws `img` to cover `rect`, then zooms and pans it: `zoom` scales past
 * cover-fit, `dx`/`dy` in -1..1 slide it inside the overflow. The grade's
 * canvas filter is applied to the photo pass only.
 */
function drawPhotoInto(ctx, img, rect, crop, filter) {
  const zoom = crop?.zoom ?? 1;
  const dx = crop?.dx ?? 0;
  const dy = crop?.dy ?? 0;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const ox = (rect.w - pw) / 2 + dx * Math.max(0, (pw - rect.w) / 2);
  const oy = (rect.h - ph) / 2 + dy * Math.max(0, (ph - rect.h) / 2);
  ctx.save();
  ctx.filter = filter;
  ctx.drawImage(img, rect.x + ox, rect.y + oy, pw, ph);
  ctx.restore();
}

/** The empty-panel look: a dark gradient with a dashed frame and a label. */
function drawEmptyPanel(ctx, rect, label) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, '#2a2138');
  grad.addColorStop(1, '#171021');
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(2, rect.w * 0.006);
  ctx.setLineDash([rect.w * 0.03, rect.w * 0.02]);
  ctx.strokeRect(
    rect.x + rect.w * 0.06, rect.y + rect.h * 0.06,
    rect.w * 0.88, rect.h * 0.88,
  );
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `${Math.max(14, rect.h * 0.09)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

/** Lays a grade's wash gradients over a panel rect. */
function applyGradeWashes(ctx, rect, grade) {
  for (const wash of grade.washes) {
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grad.addColorStop(0, wash.from);
    grad.addColorStop(1, wash.to);
    ctx.save();
    ctx.globalCompositeOperation = wash.blend;
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}

/** Halftone dots across a rect: the print-poster texture behind titles. */
function drawHalftone(ctx, rect, color, alpha) {
  const step = Math.max(10, rect.h * 0.14);
  const r = step * 0.16;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let y = rect.y + step / 2; y < rect.y + rect.h; y += step) {
    for (let x = rect.x + step / 2; x < rect.x + rect.w; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Shrinks a font size until `text` fits `maxWidth`; returns the size. */
function fitFontSize(ctx, text, maxWidth, startSize, family, minSize = 12) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size = Math.max(minSize, size * 0.92);
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

/** Greedy word wrap at a fixed size; returns lines that fit maxWidth. */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth || !line) {
      line = trial;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A five-pointed star path centred at (cx, cy) with outer radius r. */
function starPath(ctx, cx, cy, r) {
  const inner = r * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** The heat meter: `count` filled gold stars out of five. */
function drawStars(ctx, cx, cy, size, count) {
  if (!count) return;
  const gap = size * 1.35;
  const total = gap * 4;
  for (let i = 0; i < 5; i++) {
    const x = cx - total / 2 + i * gap;
    starPath(ctx, x, cy, size / 2);
    if (i < count) {
      ctx.fillStyle = '#ffd21f';
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = Math.max(1.5, size * 0.08);
      ctx.stroke();
    }
  }
}

/** A tilted starburst badge with the badge text inside. */
function drawBadge(ctx, cx, cy, radius, text) {
  if (!text) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.22);
  ctx.beginPath();
  const points = 14;
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? radius : radius * 0.78;
    const a = (i * Math.PI) / points;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd21f';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = radius * 0.18;
  ctx.shadowOffsetY = radius * 0.08;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#1c0b26';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = fitFontSize(ctx, text.toUpperCase(), radius * 1.5, radius * 0.42, '"Bebas Neue", sans-serif');
  ctx.font = `${size}px "Bebas Neue", sans-serif`;
  ctx.fillText(text.toUpperCase(), 0, radius * 0.04);
  ctx.restore();
}

/**
 * Draws the title, subtitle and stars inside `rect`. The title gets the
 * grade's sunset gradient fill with a white keyline and a soft shadow;
 * the subtitle is Pacifico script. Returns nothing.
 */
function drawTitleText(ctx, rect, state, grade) {
  const title = state.title.trim().toUpperCase();
  const subtitle = state.subtitle.trim();
  const pad = rect.w * 0.04;
  const maxW = rect.w - pad * 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Title: one line when it fits, wrapped when the block is square.
  const oneLine = fitFontSize(ctx, title, maxW, rect.h * 0.52, 'Anton, "Arial Narrow", sans-serif');
  let lines = [title];
  let size = oneLine;
  if (rect.w / rect.h < 1.6 && title.includes(' ')) {
    // Square-ish block (the nine-panel centre): wrap at a bigger size.
    size = rect.h * 0.26;
    ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
    lines = wrapText(ctx, title, maxW);
    while (lines.length > 2 && size > 12) {
      size *= 0.9;
      ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
      lines = wrapText(ctx, title, maxW);
    }
  }
  const lineH = size * 1.04;
  const titleH = lineH * lines.length;
  const subSize = Math.min(rect.h * 0.2, size * 0.42);
  const starSize = state.stars ? Math.min(rect.h * 0.14, size * 0.24) : 0;
  const gap = size * 0.12;
  const blockH = titleH + (subtitle ? subSize + gap : 0) + (state.stars ? starSize + gap : 0);
  const top = rect.y + (rect.h - blockH) / 2;
  let y = top + size * 0.82;

  const grad = ctx.createLinearGradient(0, y - size, 0, y - size + titleH);
  grad.addColorStop(0, grade.titleFrom);
  grad.addColorStop(1, grade.titleTo);
  ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = size * 0.1;
  ctx.shadowOffsetY = size * 0.04;
  for (const line of lines) {
    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(line, rect.x + rect.w / 2, y);
    ctx.fillStyle = grad;
    ctx.fillText(line, rect.x + rect.w / 2, y);
    y += lineH;
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (subtitle) {
    // Baseline from the block top, not from the loop's y: the loop already
    // advanced past the last title line, so reusing y would push the
    // subtitle (and the stars) below the block.
    y = top + titleH + gap + subSize * 0.8;
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ffd7ec';
    ctx.shadowColor = 'rgba(255,46,136,0.8)';
    ctx.shadowBlur = subSize * 0.35;
    ctx.fillText(subtitle, rect.x + rect.w / 2, y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
  if (state.stars) {
    const starY = top + titleH + (subtitle ? subSize + gap : 0) + gap + starSize * 0.5;
    drawStars(ctx, rect.x + rect.w / 2, starY, starSize, state.stars);
  }
}

/** Draws the whole cover onto `canvas` from the editor state. */
export function drawCover(canvas, state) {
  const { w, h } = state;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  const grade = GRADES[state.gradeId] ?? GRADES.sunset;
  const panels = layoutPanels(state.layoutId, w, h);
  const title = layoutTitle(state.layoutId, w, h);
  const isTilted = state.layoutId === 'tilted';
  const isBleed = state.layoutId === 'fullbleed';

  // Backdrop: white when the frame is on (it shows through as gutters),
  // the grade's band colour otherwise. Tilted always gets the band colour.
  ctx.fillStyle = isTilted || !state.frame ? grade.band : '#f8f5f0';
  ctx.fillRect(0, 0, w, h);

  const gutter = state.frame && !isBleed && !isTilted ? Math.max(2, w * 0.004) : 0;
  panels.forEach((panel, i) => {
    const crop = state.crops[i] ?? { photo: i, zoom: 1, dx: 0, dy: 0 };
    const img = state.photos[crop.photo];
    const rect = {
      x: panel.x + gutter,
      y: panel.y + gutter,
      w: panel.w - gutter * 2,
      h: panel.h - gutter * 2,
    };
    ctx.save();
    if (panel.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((panel.rot * Math.PI) / 180);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
    }
    if (panel.frame === 'polaroid') {
      // White card with a deeper foot, like a printed snapshot.
      const pad = Math.max(8, w * 0.012);
      ctx.fillStyle = '#fdfcf8';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = w * 0.02;
      ctx.shadowOffsetY = h * 0.012;
      ctx.fillRect(rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 3.2);
      ctx.shadowColor = 'transparent';
      rect.h -= pad * 1.2;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (img) {
      drawPhotoInto(ctx, img, rect, crop, grade.filter);
      applyGradeWashes(ctx, rect, grade);
    } else {
      drawEmptyPanel(ctx, rect, 'ADD PHOTO');
    }
    ctx.restore();
    ctx.restore();
  });

  // Title block, by style.
  if (title.style === 'band' || title.style === 'block') {
    ctx.fillStyle = grade.band;
    ctx.fillRect(title.x, title.y, title.w, title.h);
    drawHalftone(ctx, title, '#ffffff', 0.07);
    if (title.style === 'band') {
      ctx.fillStyle = grade.titleTo;
      ctx.fillRect(title.x, title.y, title.w, Math.max(3, h * 0.004));
    }
    drawTitleText(ctx, title, state, grade);
  } else if (title.style === 'scrim') {
    const scrim = ctx.createLinearGradient(0, title.y - h * 0.12, 0, title.y + title.h);
    scrim.addColorStop(0, 'rgba(10,5,20,0)');
    scrim.addColorStop(1, 'rgba(10,5,20,0.78)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, title.y - h * 0.12, w, title.h + h * 0.12);
    drawTitleText(ctx, title, state, grade);
  } else {
    drawTitleText(ctx, title, state, grade);
  }

  // Badge, top-right, and grain + vignette over everything.
  if (state.badge.trim()) {
    const r = Math.min(w, h) * 0.062;
    drawBadge(ctx, w - r * 1.25, r * 1.3, r, state.badge);
  }
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(getNoiseTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (state.vignette) {
    const vig = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.36)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }
}
