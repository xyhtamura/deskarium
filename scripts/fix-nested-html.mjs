/* Repoint PWA links in nested HTML entries.
   ---------------------------------------------------------------
   `base: './'` keeps the build portable — it runs from a server root,
   from /deskarium/dist/, or from GitHub Pages with nothing to change.
   Vite resolves the asset links per entry, so a page one folder deep
   correctly gets ../assets/. vite-plugin-pwa does not: it injects
   `./manifest.webmanifest` and `./registerSW.js` verbatim into every
   entry, and both files live at the dist root.

   On dist/rpi/index.html that is two 404s and no error anywhere. The
   manifest is what lets the panel be installed and found by app-id, and
   registerSW is what installs the service worker, so the page the Pi
   actually boots was the one page missing both.

   registerSW.js cannot simply be repointed: it calls
   `register('./sw.js', { scope: './' })`, and those resolve against the
   document rather than the script, so a page at /rpi/ would look for
   /rpi/sw.js and claim a scope that excludes the assets. Nested pages
   get an inline registration with the right depth instead.

   Run after `vite build`; wired into `npm run build`. */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let fixed = 0;

for (const file of await htmlFiles(DIST)) {
  const depth = relative(DIST, file).split(sep).length - 1;
  if (depth === 0) continue; // root pages are already correct

  const up = '../'.repeat(depth);
  const before = await readFile(file, 'utf8');

  const after = before
    .replace(/href="\.\/manifest\.webmanifest"/g, `href="${up}manifest.webmanifest"`)
    .replace(
      /<script id="vite-plugin-pwa:register-sw" src="\.\/registerSW\.js"><\/script>/g,
      `<script id="vite-plugin-pwa:register-sw">if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('${up}sw.js',{scope:'${up}'})})}</script>`,
    );

  if (after !== before) {
    await writeFile(file, after);
    console.log(`fix-nested-html: ${relative(DIST, file)} (depth ${depth})`);
    fixed++;
  }
}

console.log(fixed ? `fix-nested-html: ${fixed} file(s)` : 'fix-nested-html: nothing to do');
