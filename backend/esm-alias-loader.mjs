import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = pathToFileURL(path.join(__dirname, 'dist/'));

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    const target = new URL(rel, distRoot);
    return { url: target.href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}


