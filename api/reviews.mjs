// Reviews API
// - GET  /api/reviews           -> { stats, reviews }  (reviews exclude iSETU text)
// - POST /api/reviews {name?, rating:1..5, text?, is_iSETU?:bool}
// Storage: JSON file at data/reviews.json

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = process.env.REVIEWS_DB_PATH || path.join(DATA_DIR, 'reviews.json');

function ok(res, obj){ setCors(res); res.setHeader('Content-Type','application/json'); return res.status(200).json(obj); }
function bad(res, code, error){ setCors(res); res.setHeader('Content-Type','application/json'); return res.status(code).json({ error }); }
function setCors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Vary', 'Origin');
}

async function ensureFile(){
  try { await fs.mkdir(path.dirname(DB_FILE), { recursive: true }); } catch {}
  try { await fs.access(DB_FILE); }
  catch { await fs.writeFile(DB_FILE, JSON.stringify({ reviews: [] }, null, 2), 'utf8'); }
}

async function readDB(){
  await ensureFile();
  const raw = await fs.readFile(DB_FILE, 'utf8');
  const data = JSON.parse(raw || '{"reviews":[]}');
  if (!Array.isArray(data.reviews)) data.reviews = [];
  return data;
}

async function writeDB(data){
  await ensureFile();
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function computeStats(reviews){
  const count = reviews.length;
  const dist = {1:0,2:0,3:0,4:0,5:0};
  let sum = 0, public_count = 0, isetu_count = 0;
  for (const r of reviews){
    dist[r.rating] = (dist[r.rating] || 0) + 1;
    sum += r.rating;
    if (r.is_iSETU) isetu_count++; else public_count++;
  }
  const avg = count ? sum / count : 0;
  return { avg, count, public_count, isetu_count, dist };
}

function sanitizeStr(s, max){ return (s || '').toString().trim().slice(0, max); }

export default async function handler(req, res){
  if (req.method === 'OPTIONS'){
    setCors(res);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method === 'GET'){
    try {
      const db = await readDB();
      const stats = computeStats(db.reviews);
      // Only return public reviews' text
      const reviews = db.reviews
        .filter(r => !r.is_iSETU)
        .sort((a,b) => b.createdAt - a.createdAt)
        .map(r => ({ id: r.id, name: r.name, rating: r.rating, text: r.text, createdAt: r.createdAt }));
      return ok(res, { stats, reviews });
    } catch (err){
      console.error(err);
      return bad(res, 500, 'Failed to read reviews');
    }
  }

  if (req.method === 'POST'){
    try {
      const body = req.body || {};
      const name = sanitizeStr(body.name, 100);
      const text = sanitizeStr(body.text, 4000);
      const is_iSETU = Boolean(body.is_iSETU);
      const rating = Number.parseInt(body.rating, 10);

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad(res, 400, 'Rating must be an integer 1–5');
      if (!is_iSETU && !text) return bad(res, 400, 'Text is required for public reviews');

      const db = await readDB();
      const now = Date.now();
      const id = crypto.randomUUID ? crypto.randomUUID() : crypto.createHash('sha256').update(String(now)+Math.random()).digest('hex').slice(0,24);

      db.reviews.push({ id, name, text, rating, is_iSETU, createdAt: now });
      await writeDB(db);
      const stats = computeStats(db.reviews);
      return ok(res, { ok: true, id, stats });
    } catch (err){
      console.error(err);
      return bad(res, 500, 'Failed to save review');
    }
  }

  return bad(res, 405, 'Method not allowed');
}