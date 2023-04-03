import fs from 'node:fs/promises';
import pkg from '../package.json' assert { type: 'json' };
import manifest from '../extension/manifest.json' assert { type: 'json' };

console.log('Copying source files to dist...');
await fs.cp('extension', 'dist', { recursive: true });

console.log('Updating version number in manifest.json...');
manifest.version = pkg.version;

if (process.argv.includes('--chromium')) {
  console.log('Updating manifest.json for Chromium compatibility...');
  manifest.manifest_version = 3;
  const swSource = manifest.background.scripts[0];
  manifest.background.service_worker = swSource;
  delete manifest.background.scripts;
  delete manifest.options_ui.chrome_style;
}

await fs.writeFile(
  'dist/manifest.json',
  JSON.stringify(manifest, null, 2),
  'utf-8'
);

console.log('Done!');
