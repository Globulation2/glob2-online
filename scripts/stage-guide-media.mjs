import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const bucket = 'glob2-website-public';
export const mediaOrigin = `https://storage.googleapis.com/${bucket}/guide-media/`;
export function validateManifest(manifest) {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) throw new Error('Invalid guide media manifest');
  const ids = new Set(), paths = new Set();
  for (const asset of manifest.assets) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(asset.id) || ids.has(asset.id)) throw new Error(`Invalid or duplicate media ID: ${asset.id}`);
    if (!/^\/guide-media\/[a-z0-9/-]+\.(webp|png|mp4)$/.test(asset.path) || asset.path.includes('..') || path.posix.normalize(asset.path) !== asset.path || paths.has(asset.path)) throw new Error(`Invalid or duplicate media path: ${asset.path}`);
    if (asset.url !== `https://storage.googleapis.com/${bucket}${asset.path}`) throw new Error(`Untrusted media URL: ${asset.id}`);
    if (!/^[a-f0-9]{64}$/.test(asset.sha256) || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0) throw new Error(`Invalid media digest/size: ${asset.id}`);
    if (![asset.width, asset.height].every(n => Number.isSafeInteger(n) && n > 0) || !asset.caption?.trim() || !asset.alt?.trim()) throw new Error(`Missing media dimensions or description: ${asset.id}`);
    if (!['image', 'video'].includes(asset.kind) || (asset.kind === 'video') !== asset.path.endsWith('.mp4')) throw new Error(`Invalid media kind: ${asset.id}`);
    ids.add(asset.id); paths.add(asset.path);
  }
  for (const asset of manifest.assets) if (asset.kind === 'video' && (!ids.has(asset.poster) || manifest.assets.find(a=>a.id === asset.poster).kind !== 'image')) throw new Error(`Missing video poster: ${asset.id}`);
  return manifest.assets;
}
export function verifyAsset(asset, bytes) {
  if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Guide media checksum mismatch: ${asset.id}`);
}
export async function stageMedia({ manifestPath = 'src/data/guide-media.json', output = 'dist', cache = 'artifacts/handbook/media-cache', fetcher = fetch } = {}) {
  const assets = validateManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
  await mkdir(cache, { recursive: true });
  for (const asset of assets) {
    const cached = path.join(cache, asset.sha256);
    let bytes;
    try { bytes = await readFile(cached); verifyAsset(asset, bytes); }
    catch {
      const response = await fetcher(asset.url, { redirect: 'error', signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Guide media unavailable: ${asset.id} (${response.status})`);
      const chunks = []; let size = 0;
      for await (const chunk of response.body) { size += chunk.length; if (size > asset.bytes) throw new Error(`Guide media exceeds expected size: ${asset.id}`); chunks.push(chunk); }
      bytes = Buffer.concat(chunks); verifyAsset(asset, bytes);
      await writeFile(cached + '.tmp', bytes); await rename(cached + '.tmp', cached);
    }
    const target = path.join(output, asset.path.slice(1));
    await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes);
  }
  console.log(`Staged ${assets.length} checked guide assets`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  stageMedia().catch(error => { console.error(error.message); process.exitCode = 1; });
}
