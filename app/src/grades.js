// Colour grades: a canvas filter for the photo pass, then one or two wash
// gradients laid over each panel. The filter does the heavy lifting
// (contrast, saturation, tone); the washes bend the shadows and highlights
// toward the grade's palette, which is what reads as a "Vice City grade"
// at a glance. Every grade also names the title gradient it pairs with,
// so the lettering and the photos feel like one poster.
//
// A wash is {from, to, alpha, blend}: a vertical gradient across the panel
// from the first colour to the second, painted at `alpha` with the canvas
// composite mode `blend`.

export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    swatch: ['#ff9a3d', '#e83e8c'],
    filter: 'contrast(1.08) saturate(1.35) brightness(1.02)',
    washes: [
      { from: 'rgba(255,150,60,0.30)', to: 'rgba(215,30,110,0.38)', blend: 'soft-light' },
      { from: 'rgba(255,120,40,0.10)', to: 'rgba(90,10,60,0.22)', blend: 'multiply' },
    ],
    titleFrom: '#ffe259',
    titleTo: '#ff2e88',
    band: '#1c0b26',
  },
  neon: {
    name: 'Neon Nights',
    swatch: ['#22e6d2', '#ff2e88'],
    filter: 'contrast(1.14) saturate(1.5) brightness(1.0)',
    washes: [
      { from: 'rgba(0,230,205,0.22)', to: 'rgba(255,35,150,0.34)', blend: 'overlay' },
      { from: 'rgba(10,10,40,0.12)', to: 'rgba(60,0,50,0.20)', blend: 'multiply' },
    ],
    titleFrom: '#7df9e8',
    titleTo: '#ff2e88',
    band: '#0d0a24',
  },
  gold: {
    name: 'Palm Gold',
    swatch: ['#ffd97a', '#b45a12'],
    filter: 'contrast(1.06) saturate(1.25) sepia(0.28) brightness(1.03)',
    washes: [
      { from: 'rgba(255,200,90,0.26)', to: 'rgba(140,60,0,0.28)', blend: 'soft-light' },
    ],
    titleFrom: '#fff3b0',
    titleTo: '#ff8c1a',
    band: '#241304',
  },
  noir: {
    name: 'Mono Noir',
    swatch: ['#e8e8e8', '#111111'],
    filter: 'grayscale(1) contrast(1.28) brightness(1.06)',
    washes: [
      { from: 'rgba(255,240,220,0.10)', to: 'rgba(15,15,25,0.22)', blend: 'overlay' },
    ],
    titleFrom: '#ffffff',
    titleTo: '#c9c9c9',
    band: '#101010',
  },
  haze: {
    name: 'Heat Haze',
    swatch: ['#ffd9b0', '#c98a6b'],
    filter: 'contrast(0.92) saturate(0.85) brightness(1.09)',
    washes: [
      { from: 'rgba(255,225,190,0.20)', to: 'rgba(200,140,110,0.16)', blend: 'soft-light' },
      { from: 'rgba(255,255,255,0.07)', to: 'rgba(255,255,255,0.02)', blend: 'source-over' },
    ],
    titleFrom: '#fff6e0',
    titleTo: '#ff9e64',
    band: '#2a1a12',
  },
  drive: {
    name: 'Ocean Drive',
    swatch: ['#2fb9c9', '#ff8c42'],
    filter: 'contrast(1.16) saturate(1.32) brightness(1.0)',
    washes: [
      { from: 'rgba(0,130,150,0.32)', to: 'rgba(255,140,40,0.24)', blend: 'soft-light' },
      { from: 'rgba(0,60,80,0.14)', to: 'rgba(120,40,0,0.14)', blend: 'multiply' },
    ],
    titleFrom: '#a5ecf5',
    titleTo: '#ff8c42',
    band: '#06222e',
  },
};

export const GRADE_ORDER = ['sunset', 'neon', 'gold', 'noir', 'haze', 'drive'];
