// iSETU Reviews (read-only from filesystem)
// - Expects JSON files in <ISETU_DIR> (default: "reviews"), each with:
//     { "rating": 1..5, "image": "filename.ext" | "reviews/imgs/filename.ext", "caption": "optional" }
// - Images must reside under <ISETU_IMGS_DIR> (default: "reviews/imgs") and be statically served.
// - GET /api/reviews/isetu  -> { items: [{rating, url, name, caption, createdAt}], stats: { total, dist:{1..5} } }

import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const ISETU_DIR = path.resolve(ROOT, process.env.ISETU_DIR || 'reviews');
const ISETU_IMGS_DIR = path.resolve(ROOT, process.env.ISETU_IMGS_DIR || 'reviews/imgs');
// Public URL base for images (ensure trailing slash). If your site is hosted under a subpath, include it.
const ISETU_IMGS_WEB_BASE = (process.env.ISETU_IMGS_WEB_BASE || '/reviews/imgs/').replace(/\/?$/, '/');

function ok(res, obj){ setCors(res); res.setHeader('Content-Type','application/json'); return res.status(200).json(obj); }
function bad(res, code, error){ setCors(res); res.setHeader('Content-Type','application/json'); return res.status(code).json({ error }); }
function setCors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Vary', 'Origin');
}

function clampRating(r){
  const n = Number.parseInt(r, 10);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

function toWebUrlFor(fileBaseName){
  // Encode URI components to be safe
  return ISETU_IMGS_WEB_BASE + encodeURIComponent(fileBaseName);
}

async function listJsonFiles(dir){
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter(d => d.isFile() && /\.json$/i.test(d.name)).map(d => path.join(dir, d.name));
}

export default async function handler(req, res){
  if (req.method === 'OPTIONS'){
    setCors(res);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  if (req.method !== 'GET') return bad(res, 405, 'Method not allowed');

  try {
    const files = await listJsonFiles(ISETU_DIR);
    const items = [];
    const dist = {1:0,2:0,3:0,4:0,5:0};

    for (const f of files){
      try {
        const raw = await fs.readFile(f, 'utf8');
        const data = JSON.parse(raw);
        const rating = clampRating(data.rating);
        if (!rating) continue;

        let image = String(data.image || '').trim();
        if (!image) continue;

        // Resolve to basename to avoid directory traversal; require image be under ISETU_IMGS_DIR
        const base = path.basename(image);
        const diskPath = path.join(ISETU_IMGS_DIR, base);

        // Ensure the image exists
        const st = await fs.stat(diskPath).catch(() => null);
        if (!st) continue;

        const jsonStat = await fs.stat(f).catch(() => null);
        const createdAt = jsonStat ? jsonStat.mtimeMs : Date.now();

        items.push({
          rating,
          url: toWebUrlFor(base),
          name: base,
          caption: (data.caption || '').toString().slice(0, 200),
          createdAt,
          jsonName: path.basename(f),
        });
        dist[rating] += 1;
      } catch (e){
        // Skip malformed files
        // eslint-disable-next-line no-console
        console.warn('Skipping iSETU JSON:', f, e?.message);
        continue;
      }
    }

    // Sort newest first by default
    items.sort((a,b) => b.createdAt - a.createdAt);

    return ok(res, { items, stats: { total: items.length, dist } });
  } catch (err){
    // eslint-disable-next-line no-console
    console.error(err);
    return bad(res, 500, 'Failed to load iSETU items');
  }
}