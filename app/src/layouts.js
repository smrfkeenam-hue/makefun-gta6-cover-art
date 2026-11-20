// Layouts for the cover: where each photo panel sits, as fractions of the
// cover's width and height, and where the title block goes. A layout is a
// function of the cover size, so the same layout works at every export size.
//
// Panel rects are {x, y, w, h} in 0..1 fractions; a panel may also carry a
// `rot` (degrees, for the tilted snapshot layout) and `frame: 'polaroid'`.
// The title block is {x, y, w, h} plus a `style`: 'band' paints a solid
// band with halftone dots, 'block' fills a grid cell, 'scrim' fades a
// gradient over the photo beneath, 'top' sits above the panels.

const G = 0.016; // white gutter between panels, as a fraction of width

function grid(cols, rows, top, bottom, skip) {
  const panels = [];
  const gw = G;
  const gh = G * 0.6;
  const cellW = (1 - gw * (cols - 1)) / cols;
  const cellH = (bottom - top - gh * (rows - 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (skip && skip(r, c)) continue;
      panels.push({
        x: c * (cellW + gw),
        y: top + r * (cellH + gh),
        w: cellW,
        h: cellH,
      });
    }
  }
  return panels;
}

export const LAYOUTS = {
  hero3: {
    name: 'Hero + Three',
    blurb: 'The classic poster: one big hero, three moments beside it.',
    panels: () => [
      { x: 0, y: 0, w: 0.63, h: 0.8 },
      { x: 0.646, y: 0, w: 0.354, h: 0.256 },
      { x: 0.646, y: 0.272, w: 0.354, h: 0.256 },
      { x: 0.646, y: 0.544, w: 0.354, h: 0.256 },
    ],
    title: { x: 0, y: 0.816, w: 1, h: 0.184, style: 'band' },
  },
  grid4: {
    name: 'Four Up',
    blurb: 'A clean two-by-two grid with the title underneath.',
    panels: () => grid(2, 2, 0, 0.8),
    title: { x: 0, y: 0.816, w: 1, h: 0.184, style: 'band' },
  },
  grid9: {
    name: 'Nine Panel',
    blurb: 'Eight photos around a title block in the middle.',
    panels: () => grid(3, 3, 0, 1, (r, c) => r === 1 && c === 1),
    title: { x: 0.339, y: 0.339, w: 0.322, h: 0.322, style: 'block' },
  },
  fullbleed: {
    name: 'Full Bleed',
    blurb: 'One photo edge to edge, title over a sunset scrim.',
    panels: () => [{ x: 0, y: 0, w: 1, h: 1 }],
    title: { x: 0.05, y: 0.74, w: 0.9, h: 0.22, style: 'scrim' },
  },
  tilted: {
    name: 'Tilted Snaps',
    blurb: 'Three snapshots tossed on the table, polaroid style.',
    panels: () => [
      { x: 0.06, y: 0.2, w: 0.4, h: 0.52, rot: -7, frame: 'polaroid' },
      { x: 0.52, y: 0.16, w: 0.42, h: 0.55, rot: 4, frame: 'polaroid' },
      { x: 0.3, y: 0.58, w: 0.4, h: 0.36, rot: -2, frame: 'polaroid' },
    ],
    title: { x: 0.05, y: 0.02, w: 0.9, h: 0.13, style: 'top' },
  },
  duo: {
    name: 'Split Duo',
    blurb: 'Two halves, one story, title across the foot.',
    panels: () => [
      { x: 0, y: 0, w: 0.492, h: 0.8 },
      { x: 0.508, y: 0, w: 0.492, h: 0.8 },
    ],
    title: { x: 0, y: 0.816, w: 1, h: 0.184, style: 'band' },
  },
  strip: {
    name: 'Film Strip',
    blurb: 'Three wide strips stacked like frames of a reel.',
    panels: () => [
      { x: 0, y: 0, w: 1, h: 0.256 },
      { x: 0, y: 0.272, w: 1, h: 0.256 },
      { x: 0, y: 0.544, w: 1, h: 0.256 },
    ],
    title: { x: 0, y: 0.816, w: 1, h: 0.184, style: 'band' },
  },
};

export const LAYOUT_ORDER = ['hero3', 'grid4', 'grid9', 'fullbleed', 'tilted', 'duo', 'strip'];

/** Panel rects in pixels for a layout at a cover size. */
export function layoutPanels(layoutId, w, h) {
  const layout = LAYOUTS[layoutId] ?? LAYOUTS.hero3;
  return layout.panels(w, h).map((p) => ({
    x: p.x * w,
    y: p.y * h,
    w: p.w * w,
    h: p.h * h,
    rot: p.rot ?? 0,
    frame: p.frame ?? null,
  }));
}

/** Title block in pixels for a layout at a cover size. */
export function layoutTitle(layoutId, w, h) {
  const layout = LAYOUTS[layoutId] ?? LAYOUTS.hero3;
  const t = layout.title;
  return { x: t.x * w, y: t.y * h, w: t.w * w, h: t.h * h, style: t.style };
}
