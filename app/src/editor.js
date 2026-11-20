// The editor: state, history, photo library, panel interaction and export.
// main.js calls initEditor() once; shots.js drives it through
// applyShotState() for the fixed screenshot scenes.
//
// The library holds every photo the session knows: the six samples shipped
// under app/samples/ plus anything the user uploads. Panels reference the
// library by index, so undo snapshots stay small and uploads never break
// an older snapshot.

import { drawCover } from './cover.js';
import { LAYOUTS, LAYOUT_ORDER, layoutPanels } from './layouts.js';
import { GRADES, GRADE_ORDER } from './grades.js';

export const SAMPLES = [
  { id: 'woman', name: 'Boulevard', file: 'samples/woman.jpg' },
  { id: 'rooftop', name: 'Rooftop', file: 'samples/rooftop.jpg' },
  { id: 'neon', name: 'Neon Night', file: 'samples/neon.jpg' },
  { id: 'angler', name: 'Pier Day', file: 'samples/angler.jpg' },
  { id: 'boulevard', name: 'Palm Row', file: 'samples/boulevard.jpg' },
  { id: 'pier', name: 'Golden Pier', file: 'samples/pier.jpg' },
];

export const SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, label: 'Square 1:1' },
  { id: '1080x1350', w: 1080, h: 1350, label: 'Portrait 4:5' },
  { id: '1920x1080', w: 1920, h: 1080, label: 'Wide 16:9' },
  { id: '1080x1920', w: 1080, h: 1920, label: 'Story 9:16' },
];

const TITLES = ['Neon Shore', 'Sunset Heist', 'Vice Run', 'Palm Royale', 'Night Shift', 'Pier Pressure'];

function defaultState() {
  return {
    layoutId: 'hero3',
    gradeId: 'sunset',
    sizeId: '1080x1350',
    title: 'Neon Shore',
    subtitle: 'a vice city story',
    badge: 'EST. 2026',
    stars: 4,
    grain: true,
    vignette: true,
    frame: true,
    selected: 0,
    crops: [],
  };
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

export function initEditor() {
  const canvas = document.getElementById('cover');
  const outline = document.getElementById('panel-outline');
  const status = document.getElementById('status');
  const state = defaultState();
  const library = []; // {id, name, img}
  const past = []; // undo stack of snapshots
  const future = []; // redo stack
  let drag = null;

  const size = () => SIZES.find((s) => s.id === state.sizeId) ?? SIZES[1];
  const panelCount = () => layoutPanels(state.layoutId, 100, 100).length;

  function snapshot() {
    return JSON.stringify({
      layoutId: state.layoutId,
      gradeId: state.gradeId,
      sizeId: state.sizeId,
      title: state.title,
      subtitle: state.subtitle,
      badge: state.badge,
      stars: state.stars,
      grain: state.grain,
      vignette: state.vignette,
      frame: state.frame,
      selected: state.selected,
      crops: state.crops,
    });
  }

  function restore(json) {
    Object.assign(state, JSON.parse(json));
    syncControls();
    render();
  }

  function commit() {
    past.push(snapshot());
    if (past.length > 60) past.shift();
    future.length = 0;
    updateHistoryButtons();
  }

  function undo() {
    if (!past.length) return;
    future.push(snapshot());
    restore(past.pop());
    updateHistoryButtons();
  }

  function redo() {
    if (!future.length) return;
    past.push(snapshot());
    restore(future.pop());
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    document.getElementById('undo').disabled = past.length === 0;
    document.getElementById('redo').disabled = future.length === 0;
  }

  /** Grows the crops array to the layout's panel count, cycling photos. */
  function ensureCrops() {
    const n = panelCount();
    while (state.crops.length < n) {
      const i = state.crops.length;
      state.crops.push({ photo: i % Math.max(1, library.length), zoom: 1, dx: 0, dy: 0 });
    }
    state.crops.length = n;
    if (state.selected >= n) state.selected = 0;
  }

  function render() {
    ensureCrops();
    const s = size();
    drawCover(canvas, {
      w: s.w,
      h: s.h,
      layoutId: state.layoutId,
      gradeId: state.gradeId,
      title: state.title,
      subtitle: state.subtitle,
      badge: state.badge,
      stars: state.stars,
      grain: state.grain,
      vignette: state.vignette,
      frame: state.frame,
      photos: library.map((p) => p.img),
      crops: state.crops,
    });
    positionOutline();
  }

  /** Moves the selection outline over the selected panel, in page pixels. */
  function positionOutline() {
    const rect = canvas.getBoundingClientRect();
    const s = size();
    const panels = layoutPanels(state.layoutId, s.w, s.h);
    const p = panels[state.selected];
    if (!p || document.body.classList.contains('shot-cover')) {
      outline.style.display = 'none';
      return;
    }
    const stage = canvas.parentElement.getBoundingClientRect();
    outline.style.display = 'block';
    outline.style.left = `${rect.left - stage.left + (p.x / s.w) * rect.width}px`;
    outline.style.top = `${rect.top - stage.top + (p.y / s.h) * rect.height}px`;
    outline.style.width = `${(p.w / s.w) * rect.width}px`;
    outline.style.height = `${(p.h / s.h) * rect.height}px`;
  }

  function say(text) {
    status.textContent = text;
  }

  // ---- control builders -------------------------------------------------

  function buildLayoutPicker() {
    const box = document.getElementById('layouts');
    for (const id of LAYOUT_ORDER) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'layout-btn';
      b.dataset.layout = id;
      b.title = LAYOUTS[id].blurb;
      b.innerHTML = `<span class="mini mini-${id}"></span>${LAYOUTS[id].name}`;
      b.addEventListener('click', () => {
        if (state.layoutId === id) return;
        commit();
        state.layoutId = id;
        state.selected = 0;
        syncControls();
        render();
      });
      box.appendChild(b);
    }
  }

  function buildGradePicker() {
    const box = document.getElementById('grades');
    for (const id of GRADE_ORDER) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'grade-btn';
      b.dataset.grade = id;
      b.title = GRADES[id].name;
      b.innerHTML = `<span class="swatch" style="background:linear-gradient(135deg,${GRADES[id].swatch[0]},${GRADES[id].swatch[1]})"></span>${GRADES[id].name}`;
      b.addEventListener('click', () => {
        if (state.gradeId === id) return;
        commit();
        state.gradeId = id;
        syncControls();
        render();
      });
      box.appendChild(b);
    }
  }

  function buildSampleTray() {
    const box = document.getElementById('samples');
    for (const sample of SAMPLES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sample-btn';
      b.dataset.sample = sample.id;
      b.title = `Use ${sample.name} in the selected panel`;
      const img = document.createElement('img');
      img.src = sample.file;
      img.alt = sample.name;
      img.draggable = false;
      b.appendChild(img);
      b.appendChild(document.createTextNode(sample.name));
      b.addEventListener('click', () => {
        const idx = library.findIndex((p) => p.id === sample.id);
        if (idx === -1) return;
        commit();
        ensureCrops();
        state.crops[state.selected] = { photo: idx, zoom: 1, dx: 0, dy: 0 };
        state.selected = (state.selected + 1) % panelCount();
        syncControls();
        render();
      });
      box.appendChild(b);
    }
  }

  function buildSizePicker() {
    const box = document.getElementById('sizes');
    for (const s of SIZES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'size-btn';
      b.dataset.size = s.id;
      b.textContent = s.label;
      b.addEventListener('click', () => {
        if (state.sizeId === s.id) return;
        commit();
        state.sizeId = s.id;
        syncControls();
        render();
      });
      box.appendChild(b);
    }
  }

  function buildStarPicker() {
    const box = document.getElementById('stars');
    for (let n = 0; n <= 5; n++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'star-btn';
      b.dataset.stars = String(n);
      b.textContent = n === 0 ? 'No stars' : '★'.repeat(n);
      b.addEventListener('click', () => {
        if (state.stars === n) return;
        commit();
        state.stars = n;
        syncControls();
        render();
      });
      box.appendChild(b);
    }
  }

  /** Marks the active buttons and fills the inputs from the state. */
  function syncControls() {
    document.querySelectorAll('.layout-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.layout === state.layoutId);
    });
    document.querySelectorAll('.grade-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.grade === state.gradeId);
    });
    document.querySelectorAll('.size-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.size === state.sizeId);
    });
    document.querySelectorAll('.star-btn').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.stars) === state.stars);
    });
    document.getElementById('title').value = state.title;
    document.getElementById('subtitle').value = state.subtitle;
    document.getElementById('badge').value = state.badge;
    document.getElementById('grain').checked = state.grain;
    document.getElementById('vignette').checked = state.vignette;
    document.getElementById('frame').checked = state.frame;
    const crop = state.crops[state.selected];
    document.getElementById('zoom').value = String(Math.round((crop?.zoom ?? 1) * 100));
    document.getElementById('panel-label').textContent =
      `Panel ${state.selected + 1} of ${panelCount()} — drag the photo to move it, scroll to zoom`;
  }

  // ---- panel interaction ------------------------------------------------

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const s = size();
    return {
      x: ((event.clientX - rect.left) / rect.width) * s.w,
      y: ((event.clientY - rect.top) / rect.height) * s.h,
    };
  }

  function hitPanel(x, y) {
    const s = size();
    const panels = layoutPanels(state.layoutId, s.w, s.h);
    for (let i = panels.length - 1; i >= 0; i--) {
      const p = panels[i];
      if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return i;
    }
    return -1;
  }

  canvas.addEventListener('pointerdown', (event) => {
    const pt = canvasPoint(event);
    const hit = hitPanel(pt.x, pt.y);
    if (hit === -1) return;
    canvas.setPointerCapture(event.pointerId);
    if (state.selected !== hit) {
      state.selected = hit;
      syncControls();
      render();
    }
    const crop = state.crops[hit];
    drag = { x: pt.x, y: pt.y, crop: { ...crop }, moved: false };
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const pt = canvasPoint(event);
    const s = size();
    const panel = layoutPanels(state.layoutId, s.w, s.h)[state.selected];
    const crop = state.crops[state.selected];
    const img = library[crop.photo]?.img;
    if (!img || !panel) return;
    const base = Math.max(panel.w / img.naturalWidth, panel.h / img.naturalHeight);
    const pw = img.naturalWidth * base * crop.zoom;
    const ph = img.naturalHeight * base * crop.zoom;
    const dx = pt.x - drag.x;
    const dy = pt.y - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    crop.dx = Math.max(-1, Math.min(1, crop.dx + (2 * dx) / Math.max(1, pw - panel.w)));
    crop.dy = Math.max(-1, Math.min(1, crop.dy + (2 * dy) / Math.max(1, ph - panel.h)));
    drag.x = pt.x;
    drag.y = pt.y;
    render();
  });

  function endDrag() {
    if (!drag) return;
    if (drag.moved) {
      past.push(snapshot());
      future.length = 0;
      // The snapshot above holds the state after the drag; rewind one step
      // so undo returns to the pre-drag crop.
      const after = past.pop();
      const before = { ...JSON.parse(after) };
      before.crops = before.crops.map((c, i) => (i === state.selected ? drag.crop : c));
      past.push(JSON.stringify(before));
      future.length = 0;
    }
    drag = null;
    updateHistoryButtons();
    syncControls();
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    ensureCrops();
    const crop = state.crops[state.selected];
    crop.zoom = Math.max(1, Math.min(4, crop.zoom * Math.exp(-event.deltaY * 0.0012)));
    render();
    syncControls();
  }, { passive: false });

  // ---- export -----------------------------------------------------------

  function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
  }

  async function exportSize(sizeId) {
    const s = SIZES.find((x) => x.id === sizeId) ?? size();
    const off = document.createElement('canvas');
    drawCover(off, {
      w: s.w,
      h: s.h,
      layoutId: state.layoutId,
      gradeId: state.gradeId,
      title: state.title,
      subtitle: state.subtitle,
      badge: state.badge,
      stars: state.stars,
      grain: state.grain,
      vignette: state.vignette,
      frame: state.frame,
      photos: library.map((p) => p.img),
      crops: state.crops,
    });
    const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
    const name = `vice-press-${slug(state.title)}-${s.id}.png`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return name;
  }

  // ---- wiring -----------------------------------------------------------

  buildLayoutPicker();
  buildGradePicker();
  buildSampleTray();
  buildSizePicker();
  buildStarPicker();

  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('redo').addEventListener('click', redo);
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' ||
        (event.key.toLowerCase() === 'z' && event.shiftKey))) {
      event.preventDefault();
      redo();
    }
  });

  let titleTimer = null;
  for (const id of ['title', 'subtitle', 'badge']) {
    document.getElementById(id).addEventListener('input', (event) => {
      state[id] = event.target.value;
      render();
      clearTimeout(titleTimer);
      titleTimer = setTimeout(commit, 800);
    });
  }
  for (const id of ['grain', 'vignette', 'frame']) {
    document.getElementById(id).addEventListener('change', (event) => {
      commit();
      state[id] = event.target.checked;
      render();
    });
  }
  document.getElementById('zoom').addEventListener('input', (event) => {
    ensureCrops();
    state.crops[state.selected].zoom = Number(event.target.value) / 100;
    render();
  });
  document.getElementById('zoom').addEventListener('change', commit);

  document.getElementById('shuffle').addEventListener('click', () => {
    if (!library.length) return;
    commit();
    ensureCrops();
    const order = library.map((_, i) => i).sort(() => Math.random() - 0.5);
    state.crops.forEach((crop, i) => {
      crop.photo = order[i % order.length];
      crop.zoom = 1;
      crop.dx = 0;
      crop.dy = 0;
    });
    render();
    say('Photos shuffled across the panels.');
  });

  document.getElementById('surprise').addEventListener('click', () => {
    commit();
    state.layoutId = LAYOUT_ORDER[Math.floor(Math.random() * LAYOUT_ORDER.length)];
    state.gradeId = GRADE_ORDER[Math.floor(Math.random() * GRADE_ORDER.length)];
    state.title = TITLES[Math.floor(Math.random() * TITLES.length)];
    state.selected = 0;
    ensureCrops();
    render();
    syncControls();
    say(`Surprise: ${LAYOUTS[state.layoutId].name} in ${GRADES[state.gradeId].name}.`);
  });

  document.getElementById('upload').addEventListener('change', async (event) => {
    const files = [...event.target.files];
    if (!files.length) return;
    for (const file of files) {
      try {
        const img = await loadImage(URL.createObjectURL(file));
        library.push({ id: `up-${library.length}`, name: file.name, img });
      } catch {
        say(`Could not read ${file.name}.`);
      }
    }
    event.target.value = '';
    commit();
    ensureCrops();
    state.crops[state.selected] = {
      photo: library.length - 1, zoom: 1, dx: 0, dy: 0,
    };
    render();
    say(`${files.length} photo${files.length > 1 ? 's' : ''} added — click a thumbnail or panel to place them.`);
  });

  document.getElementById('export').addEventListener('click', async () => {
    say('Exporting…');
    const name = await exportSize(state.sizeId);
    say(`Saved ${name}`);
  });

  document.getElementById('export-all').addEventListener('click', async () => {
    say('Exporting all four sizes…');
    for (const s of SIZES) {
      await exportSize(s.id);
      await new Promise((r) => setTimeout(r, 350));
    }
    say('Saved all four sizes.');
  });

  window.addEventListener('resize', positionOutline);

  // ---- shots API --------------------------------------------------------

  /**
   * Applies a screenshot scene: loads the named samples, sets the layout,
   * grade, size and words, then renders. `params` comes from the URL query.
   * Returns a promise that resolves once the cover is painted.
   */
  async function applyShotState(params) {
    const photoIds = (params.get('photos') ?? 'woman,rooftop,neon,angler').split(',');
    const wanted = [];
    for (const id of photoIds) {
      const found = library.findIndex((p) => p.id === id.trim());
      if (found !== -1) wanted.push(found);
    }
    if (params.get('layout') && LAYOUTS[params.get('layout')]) state.layoutId = params.get('layout');
    if (params.get('grade') && GRADES[params.get('grade')]) state.gradeId = params.get('grade');
    if (params.get('size') && SIZES.some((s) => s.id === params.get('size'))) {
      state.sizeId = params.get('size');
    }
    if (params.get('title') !== null) state.title = params.get('title');
    if (params.get('subtitle') !== null) state.subtitle = params.get('subtitle');
    if (params.get('badge') !== null) state.badge = params.get('badge');
    if (params.get('stars') !== null) state.stars = Number(params.get('stars')) || 0;
    ensureCrops();
    state.crops.forEach((crop, i) => {
      crop.photo = wanted.length ? wanted[i % wanted.length] : 0;
      crop.zoom = 1;
      crop.dx = 0;
      crop.dy = 0;
    });
    state.selected = 0;
    syncControls();
    render();
    await document.fonts.ready;
    render();
  }

  /** Loads the samples, then paints the default cover. */
  async function start() {
    const loaded = await Promise.allSettled(
      SAMPLES.map(async (s) => ({ ...s, img: await loadImage(s.file) })),
    );
    for (const entry of loaded) {
      if (entry.status === 'fulfilled') library.push(entry.value);
    }
    ensureCrops();
    syncControls();
    render();
    await document.fonts.ready;
    render();
    updateHistoryButtons();
    return { state, library };
  }

  return { state, library, start, render, undo, redo, applyShotState, exportSize };
}
