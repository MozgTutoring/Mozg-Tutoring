// Review images API
// - GET  /api/reviews/images               -> { images: [{url, name, caption, createdAt}] }
// - POST /api/reviews/images {dataUrl, caption?, filename?, token}  -> { ok, url }
// Requires env REVIEWS_UPLOAD_TOKEN for POST.
// Stores files under public/reviews-images and captions under data/review-images.json

import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public'); // For some frameworks; fallback to ROOT
const STATIC_BASE = await dirExists(PUBLIC_DIR) ? PUBLIC_DIR : ROOT;
const IMAGES_DIR = path.join(STATIC_BASE, 'reviews-images');
const DATA_DIR = path.join(ROOT, 'data');
const META_FILE = path.join(DATA_DIR, 'review-images.json');

function ok(res, obj){ setCors(res); res.setHeader('Content-Type','application/json'); return res.status(200).json(obj); }
function bad(res, code, error){ setCors(res); res.setHeader('Content-Type','application/json'); return res.status(code).json({ error }); }
function setCors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Vary', 'Origin');
}

async function dirExists(p){
  try { const st = await fs.stat(p); return st.isDirectory(); } catch { return false; }
}

async function ensureDirs(){
  await fs.mkdir(IMAGES_DIR, { recursive: true }).catch(()=>{});
  await fs.mkdir(path.dirname(META_FILE), { recursive: true }).catch(()=>{});
}

async function readMeta(){
  await ensureDirs();
  try {
    const raw = await fs.readFile(META_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

async function writeMeta(meta){
  await ensureDirs();
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf8');
}

function parseDataUrl(dataUrl){
  const m = /^data:(image\/(png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl || '');
  if (!m) return null;
  return { mime: m[1], ext: m[2] === 'jpeg' ? 'jpg' : m[2], buffer: Buffer.from(m[3].replace(/\s/g,''), 'base64') };
}

function safeSlug(name, ext){
  const base = (name || '').toLowerCase().replace(/\.[a-z0-9]+$/i,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'review';
  const stamp = Date.now();
  return `${base}-${stamp}.${ext}`;
}

function publicUrlFor(file){
  // If deployed with a custom base path, adjust accordingly.
  return `/reviews-images/${encodeURIComponent(path.basename(file))}`;
}

export default async function handler(req, res){
  if (req.method === 'OPTIONS'){
    setCors(res);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method === 'GET'){
    try {
      await ensureDirs();
      const meta = await readMeta();
      let files = [];
      try {
        files = await fs.readdir(IMAGES_DIR);
      } catch { files = []; }
      const stats = await Promise.all(files.map(async f => {
        const p = path.join(IMAGES_DIR, f);
        const st = await fs.stat(p).catch(()=>null);
        return st ? { name: f, mtime: st.mtimeMs } : null;
      }));
      const images = stats.filter(Boolean).sort((a,b)=>b.mtime-a.mtime).map(s => ({
        url: publicUrlFor(s.name),
        name: s.name,
        caption: meta[s.name]?.caption || '',
        createdAt: s.mtime
      }));
      return ok(res, { images });
    } catch (err){
      console.error(err);
      return bad(res, 500, 'Failed to list images');
    }
  }

  if (req.method === 'POST'){
    try {
      const { dataUrl, caption='', filename='', token='' } = req.body || {};
      const requiredToken = process.env.REVIEWS_UPLOAD_TOKEN || '';
      if (!requiredToken) return bad(res, 500, 'Upload token not configured');
      if (!token || token !== requiredToken) return bad(res, 401, 'Unauthorized');

      const parsed = parseDataUrl(dataUrl);
      if (!parsed) return bad(res, 400, 'Invalid image data');

      const fname = safeSlug(filename, parsed.ext);
      await ensureDirs();
      const outPath = path.join(IMAGES_DIR, fname);
      await fs.writeFile(outPath, parsed.buffer);

      const meta = await readMeta();
      meta[fname] = { caption: (caption||'').toString().slice(0,200) };
      await writeMeta(meta);

      return ok(res, { ok: true, url: publicUrlFor(fname), name: fname });
    } catch (err){
      console.error(err);
      return bad(res, 500, 'Failed to upload image');
    }
  }

  return bad(res, 405, 'Method not allowed');
}