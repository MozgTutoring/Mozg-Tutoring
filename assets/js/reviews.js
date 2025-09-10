const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function escapeHTML(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function renderStars(container, value, size='normal'){
  container.innerHTML = '';
  const n = Math.max(0, Math.min(5, Math.round(value)));
  for (let i=1;i<=5;i++){
    const span = document.createElement('span');
    span.className = 'star' + (i <= n ? ' filled' : '');
    if (size==='lg') span.classList.add('stars-lg');
    container.appendChild(span);
  }
}

function renderStarInput(container, hiddenInput){
  container.innerHTML = '';
  let current = 0;
  for (let i=1;i<=5;i++){
    const s = document.createElement('span');
    s.className = 'star';
    s.role = 'radio';
    s.tabIndex = 0;
    s.setAttribute('aria-label', `${i} star${i>1?'s':''}`);
    s.addEventListener('mouseenter', () => highlight(i));
    s.addEventListener('mouseleave', () => highlight(current));
    s.addEventListener('click', () => set(i));
    s.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(i); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(Math.max(1, current-1)); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(Math.min(5, current+1)); }
    });
    container.appendChild(s);
  }
  function highlight(v){
    $$('.star', container).forEach((el, idx) => {
      el.classList.toggle('filled', idx < v);
    });
  }
  function set(v){
    current = v;
    hiddenInput.value = String(v);
    highlight(v);
  }
}

async function fetchJSON(url){
  const res = await fetch(url, { headers: { 'Accept': 'application/json' }});
  if (!res.ok) throw new Error(`GET ${url} failed (${res.status})`);
  return res.json();
}

async function postJSON(url, body){
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(data.error || `POST ${url} failed (${res.status})`);
  return data;
}

function setStatus(el, msg, kind='help'){ el.className = kind; el.textContent = msg; }

function renderStats(stats){
  const avg = $('#avg-rating'); const stars = $('#avg-stars'); const dist = $('#rating-dist');
  const rc = $('#review-count'); const ic = $('#isetu-count');
  avg.textContent = (stats.avg || 0).toFixed(2);
  renderStars(stars, stats.avg);
  rc.textContent = stats.public_count || 0;
  ic.textContent = stats.isetu_count || 0;

  dist.innerHTML = '';
  const total = Math.max(1, stats.count || 0);
  for (let r=1;r<=5;r++){
    const v = (stats.dist && stats.dist[r]) ? stats.dist[r] : 0;
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${Math.round((v/total)*100)}%`;
    bar.dataset.label = r;
    dist.appendChild(bar);
  }
}

function renderReviews(list){
  const root = $('#reviews-list');
  root.innerHTML = '';
  if (!list || !list.length){
    root.innerHTML = '<p class="help">No public reviews yet.</p>';
    return;
  }
  list.forEach(r => {
    const div = document.createElement('article');
    div.className = 'review';
    const header = document.createElement('header');
    const name = document.createElement('div'); name.className = 'name'; name.textContent = r.name || 'Anonymous';
    const date = document.createElement('div'); date.className = 'date'; date.textContent = new Date(r.createdAt).toLocaleDateString();
    header.appendChild(name); header.appendChild(date);

    const stars = document.createElement('div'); stars.className = 'stars';
    renderStars(stars, r.rating);

    const text = document.createElement('p'); text.innerHTML = escapeHTML(r.text || '');

    div.appendChild(header);
    div.appendChild(stars);
    if (r.text) div.appendChild(text);
    root.appendChild(div);
  });
}

function renderImages(images){
  const root = $('#image-gallery');
  root.innerHTML = '';
  if (!images || !images.length){
    root.innerHTML = '<p class="help">No images uploaded yet.</p>';
    return;
  }
  images.forEach(img => {
    const fig = document.createElement('figure');
    const el = document.createElement('img');
    el.src = img.url;
    el.alt = img.caption || 'Review image';
    const cap = document.createElement('figcaption');
    cap.textContent = img.caption || '';
    fig.appendChild(el);
    fig.appendChild(cap);
    root.appendChild(fig);
  });
}

async function loadAll(){
  try {
    const data = await fetchJSON('/api/reviews');
    renderStats(data.stats || {});
    renderReviews(data.reviews || []);
  } catch (e) {
    console.error(e);
    $('#reviews-list').innerHTML = '<p class="error">Failed to load reviews.</p>';
  }
  try {
    const imgs = await fetchJSON('/api/reviews/images');
    renderImages(imgs.images || []);
  } catch (e) {
    console.error(e);
    $('#image-gallery').innerHTML = '<p class="error">Failed to load images.</p>';
  }
}

function bindForms(){
  // Review form
  const form = $('#review-form');
  const status = $('#review-status');
  const btn = $('button[type="submit"]', form);
  const starContainer = $('#r-rating');
  const hiddenRating = $('#r-rating-val');
  renderStarInput(starContainer, hiddenRating);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#r-name').value.trim();
    const rating = parseInt(hiddenRating.value, 10);
    const text = $('#r-text').value.trim();
    const is_iSETU = $('#r-isetu').checked;

    if (!rating || rating < 1 || rating > 5){
      setStatus(status, 'Please select a rating from 1 to 5.', 'error');
      return;
    }
    if (!is_iSETU && !text){
      setStatus(status, 'Please enter a review or mark it as iSETU.', 'error');
      return;
    }

    try {
      btn.disabled = true;
      setStatus(status, 'Submitting...', 'help');
      await postJSON('/api/reviews', { name, rating, text, is_iSETU });
      setStatus(status, 'Thank you! Your review has been submitted.', 'success');
      form.reset();
      hiddenRating.value = '';
      renderStarInput(starContainer, hiddenRating);
      await loadAll();
    } catch (err) {
      console.error(err);
      setStatus(status, err.message || 'Submission failed', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Image upload form (admin)
  const iform = $('#image-form');
  const istatus = $('#image-status');
  const ibtn = $('button[type="submit"]', iform);
  iform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = $('#img-file').files[0];
    const caption = $('#img-caption').value.trim();
    const token = $('#img-token').value.trim();

    if (!file){ setStatus(istatus, 'Select an image.', 'error'); return; }
    if (!token){ setStatus(istatus, 'Admin token is required.', 'error'); return; }
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)){ setStatus(istatus, 'Only PNG, JPEG, or WEBP allowed.', 'error'); return; }
    if (file.size > 5*1024*1024){ setStatus(istatus, 'Max size is 5MB.', 'error'); return; }

    try {
      ibtn.disabled = true;
      setStatus(istatus, 'Uploading...', 'help');

      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Failed to read file'));
        r.readAsDataURL(file);
      });

      const resp = await postJSON('/api/reviews/images', { dataUrl, caption, token, filename: file.name });
      setStatus(istatus, 'Uploaded successfully.', 'success');
      iform.reset();
      await loadAll();
    } catch (err) {
      console.error(err);
      setStatus(istatus, err.message || 'Upload failed', 'error');
    } finally {
      ibtn.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  bindForms();
});