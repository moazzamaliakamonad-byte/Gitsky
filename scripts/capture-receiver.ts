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
 * Accepted: og-image.jpg and apple-touch-icon.png (saved into public/), and
 * media/<name>.jpg|png for the README (saved into docs/media/; <name> is lowercase
 * letters, digits and dashes). It exits after 5 minutes, or `--minutes N`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED = new Set(['og-image.jpg', 'apple-touch-icon.png']);
const MEDIA = /^media\/([a-z0-9-]{1,60})\.(jpg|png)$/;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const mediaDir = join(root, 'docs', 'media');
const minutesArg = process.argv.indexOf('--minutes');
const minutes = minutesArg > 0 ? Number(process.argv[minutesArg + 1]) || 5 : 5;

/** Where a posted name is saved, or null if it isn't one we accept. */
function target(name: string): string | null {
  if (ALLOWED.has(name)) return join(publicDir, name);
  const m = MEDIA.exec(name);
  return m ? join(mediaDir, `${m[1]}.${m[2]}`) : null;
}

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  if (req.method === 'OPTIONS') return void res.end();
  const name = (req.url ?? '').replace(/^\//, '');
  const file = target(name);
  if (req.method !== 'POST' || !file) {
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
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
    console.log(`saved ${name} (${(body.length / 1024).toFixed(0)} KB)`);
    res.end('ok');
  });
});

server.listen(5199, '127.0.0.1', () => console.log('capture receiver on http://127.0.0.1:5199'));
setTimeout(() => {
  console.log('receiver timed out');
  process.exit(0);
}, minutes * 60_000).unref();
