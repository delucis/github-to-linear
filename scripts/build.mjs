import fs from 'node:fs/promises';
import pkg from '../package.json' assert { type: 'json' };

console.log('Copying source files to dist...');
await fs.cp('extension', 'dist', { recursive: true });

console.log('Updating version number in manifest.json...');
let manifest = await fs.readFile('dist/manifest.json', 'utf-8');
manifest = manifest.replace(
  '"version": "0.0.0"',
  `"version": "${pkg.version}"`
);
await fs.writeFile('dist/manifest.json', manifest, 'utf-8');

console.log('Done!');
