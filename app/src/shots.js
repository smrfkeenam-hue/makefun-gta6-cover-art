// Fixed scenes for screenshots. `?shot=cover` shows the cover alone,
// full frame, for the exported-cover screenshots; `?shot=editor` shows
// the editor with a photo loaded. The query also picks the scene:
//   layout, grade, size, title, subtitle, badge, stars, photos
// `photos` is a comma list of sample ids, dealt to the panels in order.
// window.__shotReady is set once the cover is painted with its fonts.

export async function runShot(shot, query, editor) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await editor.applyShotState(query);
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  window.__shotReady = true;
}
