import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/**
 * Build-time service worker generator (replaces a PWA plugin dependency).
 * After Vite writes the bundle, every output file (hashed JS/CSS, icons,
 * manifest, index.html) is listed in a precache manifest and a content hash
 * becomes the cache version, so each deploy installs a fresh cache.
 */
export default function offlineServiceWorker({ template = 'pwa/sw-template.js', exclude = [/\.map$/, /^sw\.js$/, /^robots\.txt$/] } = {}) {
  let config;
  return {
    name: 'fitbox-offline-service-worker',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir);
      const base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      const files = walk(outDir)
        .map((f) => path.relative(outDir, f).split(path.sep).join('/'))
        .filter((f) => !exclude.some((re) => re.test(f)))
        .sort();

      const hash = createHash('sha256');
      for (const f of files) {
        hash.update(f);
        hash.update(readFileSync(path.join(outDir, f)));
      }
      const version = hash.digest('hex').slice(0, 12);
      const urls = files.map((f) => `${base}${f}`);

      const source = readFileSync(path.resolve(config.root, template), 'utf8')
        .replace('__CACHE_VERSION__', version)
        .replace('__BASE__', base)
        .replace('__PRECACHE_MANIFEST__', JSON.stringify(urls, null, 2));
      writeFileSync(path.join(outDir, 'sw.js'), source);
      config.logger.info(`\n[offline] sw.js generated: ${urls.length} files precached (version ${version})`);
    },
  };
}
