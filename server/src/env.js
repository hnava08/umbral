import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const path = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(path)) {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const split = trimmed.indexOf('=');
    if (split < 1) {
      continue;
    }
    const key = trimmed.slice(0, split).trim();
    if (process.env[key] === undefined) {
      process.env[key] = trimmed.slice(split + 1).trim();
    }
  }
}
