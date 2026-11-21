/**
 * Dev tool: receive images rendered by the running app and save them into public/.
 * The browser can render the real galaxy (WebGL, fonts, bloom) far better than any
 * offline script, so we let it, and just catch the bytes.
 *
 *   npx tsx scripts/capture-receiver.ts      # listens on http://127.0.0.1:5199
 *
 * Then, in the app's console:
 *   fetch('http://127.0.0.1:5199/og-image.jpg', { method: 'POST', body: await blob.arrayBuffer() })
 *
 * Only these two names are accepted, and it exits after 5 minutes.
 */
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED = new Set(['og-image.jpg', 'apple-touch-icon.png']);
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  if (req.method === 'OPTIONS') return void res.end();
  const name = (req.url ?? '').replace(/^\//, '');
  if (req.method !== 'POST' || !ALLOWED.has(name)) {
    res.statusCode = 404;
    return void res.end();
  }
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', async () => {
    const body = Buffer.concat(chunks);
    // Signature check: refuse anything that isn't a PNG or JPEG.
    const png = body.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    const jpg = body.subarray(0, 3).toString('hex') === 'ffd8ff';
    if (!png && !jpg) {
      res.statusCode = 400;
      return void res.end('not an image');
    }
    await writeFile(join(publicDir, name), body);
    console.log(`saved public/${name} (${(body.length / 1024).toFixed(0)} KB)`);
    res.end('ok');
  });
});

server.listen(5199, '127.0.0.1', () => console.log('capture receiver on http://127.0.0.1:5199'));
setTimeout(() => {
  console.log('receiver timed out');
  process.exit(0);
}, 5 * 60_000).unref();
