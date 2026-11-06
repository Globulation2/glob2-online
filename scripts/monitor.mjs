import { pathToFileURL } from 'node:url';

// GitHub runs the 5-minute ratings schedule only every few hours (gaps of 3.5–6.2 h seen), so allow 8 h.
export const MAX_FEED_AGE_MS = 8 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 1024 * 1024;

export function validateFreshness(feed, now = Date.now()) {
  if (feed?.schemaVersion !== 1 || feed.ratingPolicy !== 'openskill-plackett-luce-v1' ||
      feed.ladder !== 'ranked-1v1' || !Array.isArray(feed.entries) ||
      typeof feed.generatedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(feed.generatedAt)) {
    throw new Error('Ratings feed has an unsupported schema or timestamp');
  }
  const generated = Date.parse(feed.generatedAt);
  if (!Number.isFinite(generated) || new Date(generated).toISOString().slice(0, 19) !== feed.generatedAt.slice(0, 19)) {
    throw new Error('Ratings feed timestamp is invalid');
  }
  const age = now - generated;
  if (age < -60_000) throw new Error('Ratings feed timestamp is more than one minute in the future');
  if (age > MAX_FEED_AGE_MS) {
    throw new Error(`Ratings feed is stale (${Math.floor(age / 60_000)} minutes old; maximum ${MAX_FEED_AGE_MS / 60_000}). Inspect Publish player ratings runs.`);
  }
  return Math.max(0, age);
}

export function validateInstance(instance, origin) {
  if (instance?.origin !== origin || instance.realtimeUrl !== `${origin.replace(/^https:/, 'wss:')}/realtime` ||
      !Array.isArray(instance.supportedSimVersions) || !Array.isArray(instance.authProviders)) {
    throw new Error('App instance metadata does not advertise the expected app origin/realtime endpoint');
  }
}

export async function request(url, fetcher = fetch) {
  if (new URL(url).protocol !== 'https:') throw new Error('Monitoring requires HTTPS');
  const response = await fetcher(url, {
    redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'glob2-online-availability/1' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new Error('Response exceeds monitoring size limit');
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  return { response, body: Buffer.concat(chunks).toString('utf8') };
}

export async function monitor() {
  const website = 'https://glob2.online';
  const app = 'https://app.glob2.online';
  const checks = [
    ['Public website', async () => {
      const { response, body } = await request(`${website}/`);
      if (!body.includes('<h1') || !body.includes('Globulation') || !response.headers.get('content-security-policy')) {
        throw new Error('Expected static homepage or CSP is missing');
      }
    }],
    ['App instance', async () => {
      const { body } = await request(`${app}/api/v1/instance`);
      validateInstance(JSON.parse(body), app);
    }],
    ['Browser isolation', async () => {
      const { response } = await request(`${app}/play/`);
      if (response.headers.get('cross-origin-opener-policy') !== 'same-origin' ||
          response.headers.get('cross-origin-embedder-policy') !== 'require-corp') {
        throw new Error('Browser game isolation headers are missing');
      }
    }],
    ['Ratings freshness', async () => {
      const { body } = await request('https://storage.googleapis.com/glob2-website-public/rankings/v1.json');
      const age = validateFreshness(JSON.parse(body));
      console.log(`Ratings snapshot: ${Math.floor(age / 60_000)} minutes old`);
    }],
  ];
  const results = await Promise.allSettled(checks.map(async ([name, check]) => {
    await check();
    console.log(`PASS ${name}`);
  }));
  let failures = 0;
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      failures++;
      console.error(`FAIL ${checks[index][0]}: ${result.reason.message}`);
    }
  });
  if (failures) throw new Error(`${failures} availability check(s) failed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  monitor().catch(error => { console.error(error.message); process.exitCode = 1; });
}
