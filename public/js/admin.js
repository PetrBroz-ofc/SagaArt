'use strict';
// Sága Art — admin. Přihlášení drží HttpOnly cookie (JavaScript k ní nemá přístup → XSS ji neukradne).

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const safeId = s => String(s ?? '').replace(/[^A-Za-z0-9_-]/g, '');
// Cloudinary nebo fotky uložené přímo na webu (/img/produkty/...)
const safeUrl = u => /^(https:\/\/res\.cloudinary\.com\/[^\s"'<>]+|\/img\/produkty\/[a-z0-9-]+\/\d+\.jpg)$/.test(String(u || '')) ? String(u) : '';
const $ = id => document.getElementById(id);

const CAT_LABELS = { nahrdelniky:'Náhrdelníky', nausnice:'Náušnice', naramky:'Náramky', soupravy:'Sety' };
const MAX_IMGS = 10;
const MAX_FILE = 10 * 1024 * 1024;
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

let products = [];
let editingId = null;
let imgs = [];

// ── API helper — cookie se posílá automaticky, Origin hlídá server ──
async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && path !== '/api/auth') {
    showToast('Přihlášení vypršelo, přihlaste se znovu.');
    showLogin();
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Chyba ' + res.status);
  return data;
}

// ── PŘIHLÁŠENÍ ──
function showLogin() {
  $('loginScreen').style.display = 'flex';
  $('adminScreen').style.display = 'none';
  $('loginPass').value = '';
  $('loginTotp').value = '';
  products = [];
  $('productsList').innerHTML = '';
}
function showAdmin() {
  $('loginScreen').style.display = 'none';
  $('adminScreen').style.display = 'block';
  loadProducts();
}

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('loginBtn');
  $('loginError').textContent = '';
  btn.disabled = true;
  try {
    await api('/api/auth', 'POST', { password: $('loginPass').value, totp: $('loginTotp').value.trim() });
    $('loginPass').value = '';
    showAdmin();
  } catch (err) {
    $('loginError').textContent = err.message;
    $('loginTotp').value = '';
  } finally {
    btn.disabled = false;
  }
});

async function logout() {
  try { await api('/api/auth', 'DELETE', {}); } catch {}
  showLogin();
}

// ── ŠPERKY ──
async function loadProducts() {
  $('productsList').innerHTML = '<div class="loading">Načítám šperky…</div>';
  try {
    products = await api('/api/products');
    renderProducts();
  } catch (err) {
    if (err.message !== 'unauthorized') {
      $('productsList').innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><p>Chyba načítání.</p></div>';
    }
  }
}

const mainImg = p => safeUrl(Array.isArray(p.imgs) ? p.imgs[0] : '');

function renderProducts() {
  $('statTotal').textContent = products.length;
  $('statInStock').textContent = products.filter(p => p.inStock !== false).length;
  $('statCollections').textContent = new Set(products.map(p => p.collection).filter(Boolean)).size;

  if (!products.length) {
    $('productsList').innerHTML = '<div class="empty"><div class="empty-icon">🤍</div><p>Žádné šperky. Přidej první!</p></div>';
    return;
  }
  $('productsList').innerHTML = products.map(p => {
    const img = mainImg(p), id = safeId(p.id);
    return `
    <div class="table-row">
      <div>${img ? `<img class="table-img" src="${esc(img)}" alt=""/>` : '<span class="table-img empty"></span>'}</div>
      <div>
        <div class="table-name">${esc(p.name)}</div>
        <div class="table-material">${esc(p.collection ? p.collection + ' · ' : '')}${esc(p.material)}</div>
      </div>
      <div class="table-price">${Number(p.price) || 0} Kč</div>
      <div><span class="cat-badge">${esc(CAT_LABELS[p.cat] || p.cat || '—')}</span></div>
      <div><span class="stock-badge ${p.inStock !== false ? 'stock-yes' : 'stock-no'}">${p.inStock !== false ? 'Skladem' : 'Prodáno'}</span></div>
      <div class="row-actions">
        <button class="btn-edit" data-action="openModal" data-arg="${id}">Upravit</button>
        <button class="btn-delete" data-action="deleteProduct" data-arg="${id}">Smazat</button>
      </div>
    </div>`;
  }).join('');
}

function openModal(id) {
  editingId = id || null;
  const p = (editingId && products.find(x => x.id === editingId)) || {};
  $('modalTitle').textContent = editingId ? 'Upravit šperk' : 'Nový šperk';
  $('fName').value = p.name || '';
  $('fPrice').value = p.price || '';
  $('fCat').value = p.cat || 'nahrdelniky';
  $('fCollection').value = p.collection || '';
  $('fMaterial').value = p.material || '';
  $('fDesc').value = p.desc || '';
  $('fBadge').value = p.badge || '';
  $('fStock').value = p.inStock !== false ? 'true' : 'false';
  imgs = (Array.isArray(p.imgs) ? p.imgs : []).map(safeUrl).filter(Boolean);
  $('uploadProgress').textContent = '';
  renderImgs();
  $('productModal').classList.add('open');
}
function closeModal() { $('productModal').classList.remove('open'); editingId = null; }

function renderImgs() {
  $('imgPreview').innerHTML = imgs.map((u, i) => `
    <div class="thumb">
      <img src="${esc(u)}" alt=""/>
      ${i > 0 ? `<button type="button" class="main" data-action="mainImg" data-arg="${i}" title="Nastavit jako hlavní">★</button>` : ''}
      <button type="button" data-action="removeImg" data-arg="${i}" title="Odebrat">✕</button>
    </div>`).join('');
}

$('productForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('fName').value.trim();
  const price = Number($('fPrice').value);
  if (!name || !Number.isInteger(price) || price <= 0) { showToast('Vyplň název a cenu (celé Kč)!'); return; }

  const data = {
    name, price,
    cat: $('fCat').value,
    collection: $('fCollection').value.trim(),
    material: $('fMaterial').value.trim(),
    desc: $('fDesc').value.trim(),
    imgs,
    badge: $('fBadge').value.trim(),
    inStock: $('fStock').value === 'true',
  };
  const btn = $('saveBtn');
  btn.disabled = true;
  try {
    await api('/api/products', editingId ? 'PUT' : 'POST', editingId ? { id: editingId, ...data } : data);
    showToast(editingId ? 'Šperk upraven ✓' : 'Šperk přidán ✓');
    closeModal();
    loadProducts();
  } catch (err) {
    if (err.message !== 'unauthorized') showToast('Chyba: ' + err.message);
  } finally {
    btn.disabled = false;
  }
});

async function deleteProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p || !confirm('Opravdu smazat „' + p.name + '“?')) return;
  try {
    await api('/api/products', 'DELETE', { id });
    showToast('Smazáno.');
    loadProducts();
  } catch (err) {
    if (err.message !== 'unauthorized') showToast('Chyba při mazání: ' + err.message);
  }
}

// ── NAHRÁVÁNÍ FOTEK — podepsaný upload (Cloudinary secret zůstává na serveru) ──
$('fImgFile').addEventListener('change', async e => {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  const progress = $('uploadProgress');
  for (const [n, file] of files.entries()) {
    if (imgs.length >= MAX_IMGS) { progress.textContent = `Maximálně ${MAX_IMGS} fotek.`; break; }
    if (!FILE_TYPES.includes(file.type) || file.size > MAX_FILE) {
      progress.textContent = `❌ ${file.name}: povolené jsou JPG, PNG, WebP do 10 MB`;
      continue;
    }
    progress.textContent = `⏳ Nahrávám fotku ${n + 1} / ${files.length}…`;
    try {
      const sig = await api('/api/upload-sign', 'POST', {});
      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sig.apiKey);
      fd.append('timestamp', sig.timestamp);
      fd.append('folder', sig.folder);
      fd.append('allowed_formats', sig.allowed_formats);
      fd.append('signature', sig.signature);
      fd.append('signature_algorithm', sig.signatureAlgorithm);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(sig.cloud)}/image/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      const url = safeUrl(data.secure_url);
      if (!url) throw new Error(data.error?.message || 'Neznámá chyba');
      imgs.push(url);
      renderImgs();
      progress.textContent = '✅ Nahráno';
    } catch (err) {
      if (err.message === 'unauthorized') return;
      progress.textContent = '❌ Chyba nahrávání: ' + err.message;
      return;
    }
  }
});

// ── TOAST ──
let toastTimer;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── UDÁLOSTI ──
const ACTIONS = {
  logout,
  openModal: arg => openModal(arg),
  closeModal,
  closeModalOutside: (arg, el, e) => { if (e.target === el) closeModal(); },
  deleteProduct: arg => deleteProduct(arg),
  pickFiles: () => $('fImgFile').click(),
  removeImg: arg => { imgs.splice(Number(arg), 1); renderImgs(); },
  mainImg: arg => { const [u] = imgs.splice(Number(arg), 1); imgs.unshift(u); renderImgs(); },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) fn(el.dataset.arg ?? '', el, e);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Při načtení zjistit, jestli je platná session
(async () => {
  try {
    const { authenticated } = await api('/api/auth');
    authenticated ? showAdmin() : showLogin();
  } catch {
    showLogin();
  }
})();
