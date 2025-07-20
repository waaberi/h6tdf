#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the available shadcn components from shadcn_comp_names.txt
const availableComponentsPath = path.resolve(__dirname, '../shadcn_comp_names.txt');
const availableComponents = fs.readFileSync(availableComponentsPath, 'utf8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0)
  .map(name => name.toLowerCase().replace(/\s+/g, '-'));

// Path to cache file
const cachePath = path.resolve(__dirname, '../src/cache/shadcn/cache.json');
// Components to fetch - use command-line args or default to all available components
const components = process.argv.slice(2).length > 0 ? process.argv.slice(2) : availableComponents;

let cache = {};
try {
  cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
} catch (err) {
  cache = {};
}

for (const comp of components) {
  const kebabCase = comp.toLowerCase().replace(/\s+/g, '-');
  
  // Check if component is available in shadcn_comp_names.txt
  if (!availableComponents.includes(kebabCase)) {
    console.warn(`⚠️ Component "${comp}" not found in shadcn_comp_names.txt`);
    continue;
  }

  if (cache[kebabCase]) {
    console.log(`${kebabCase} is already cached, skipping.`);
    continue;
  }

  console.log(`Adding Shadcn component: ${kebabCase}`);
  const result = spawnSync('pnpm', ['dlx', 'shadcn@latest', 'add', kebabCase], { stdio: 'inherit' });
  
  if (result.status !== 0) {
    console.error(`Failed to add component: ${kebabCase}`);
    continue;
  }
  
  cache[kebabCase] = true;
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  console.log(`✅ Successfully cached ${kebabCase}`);
}

export { availableComponents, cache };
