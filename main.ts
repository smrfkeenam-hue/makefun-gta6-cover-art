// Vice Press entry (Node 22, standard library only): hands the cover-maker
// app in. It copies this directory's app/ (the offline web app: the editor,
// its vendored fonts and sample photos) and screenshots/ (the cover and the
// editor, shot from the app itself) to /output, then writes
// /output/dossier.json with the kit's make.fun library — the summary the
// judge reads. Nothing is built or fetched: the app is plain static files.
//
// Try it locally first: `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repo = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name) {
  const from = join(repo, name);
  const to = join(out, name);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

mkdirSync(out, { recursive: true });

// Fail fast with a useful message when the app is missing its entry page,
// instead of handing in an empty app/ the gate would refuse.
if (!existsSync(join(repo, 'app', 'index.html'))) {
  throw new Error('app/index.html is missing: the app cannot be entered without it');
}
copyTree('app');
copyTree('screenshots');

// The scorer's own caps (reference/gate.json): text_max_bytes shapes the
// dossier's text; the rest refuse an entry the scorer would refuse — more
// than 4 screenshots or one over 256 KiB, app/ over 993 files or 48 MiB,
// or an app/ path over 1000 bytes.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`handed in app/ + screenshots/ to ${out} (dossier.json ${dossier.length} bytes)`);
