// Entry point: starts the editor, then either hands over to a fixed
// screenshot scene (?shot=cover or ?shot=editor) or leaves the default
// cover on screen for the person using it.
import { initEditor } from './editor.js';
import { runShot } from './shots.js';

const editor = initEditor();
const query = new URLSearchParams(location.search);
const shot = query.get('shot');

await editor.start();
if (shot) {
  await runShot(shot, query, editor);
}
