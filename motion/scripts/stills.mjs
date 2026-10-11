// Rend des images clés : node scripts/stills.mjs 200 500 1000 …  (images de la composition OvalV3)
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { resolve } from 'node:path';
const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: process.env.COMP ?? 'OvalV4' });
for (const frame of frames) {
  await renderStill({ composition, serveUrl, frame, output: `out/stills/f${String(frame).padStart(4, '0')}.jpg`, imageFormat: 'jpeg', jpegQuality: 85 });
  console.log('✓ image', frame);
}
