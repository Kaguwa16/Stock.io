import { state, saveState, saveLocalStorageFallback } from '../state.js';

// ==================== STATE LEVEL MODUL ====================
let appState = { sales: [], products: [] };
let channel = 'offline';      // 'online' | 'offline' | 'status'
let statusFilter = 'ALL';     // 'ALL' | 'BELUM' | 'SUDAH'
let currentPage = 1;
const itemsPerPage = 10;

const byId = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const notify = (msg, type = 'success') => window.showToast?.(msg, type);

function getSales() {
  if (!appState.sales) appState.sales = [];
  return appState.sales;
}
function getProducts() {
  return appState?.products || [];
}
function findProduct(docId) {
  return docId ? getProducts().find(p => p.docId === docId) : null;
}

// Satu ID penjualan bisa punya banyak produk (items).
// Data lama (persamaan/productDocId tunggal) otomatis dibaca sebagai 1 item.
function getItems(s) {
  if (Array.isArray(s.items)) return s.items;
  if (s.persamaan || s.productDocId || s.hp) {
    return [{
      hp: s.hp || '',
      productDocId: s.productDocId || '',
      persamaan: s.persamaan || '',
      qty: s.qty || 0,
      stockDeducted: s.stockDeducted || 0
    }];
  }
  return [];
}

// Satu penjualan (satu ID) boleh memiliki beberapa pasangan tipe HP dan persamaan.
// Setiap pasangan dirender sebagai baris kecil yang sejajar di dua kolom tabel.
function getItemLines(s) {
  return getItems(s).filter(item =>
    String(item.hp || s.hp || '').trim() || String(item.persamaan || '').trim()
  );
}

function buyerHpHtml(s) {
  const lines = getItemLines(s);
  if (!lines.length) return '<span class="text-slate-300">-</span>';
  return lines.map(item =>
    `<div class="whitespace-nowrap">${esc(item.hp || s.hp || '-')}</div>`
  ).join('');
}

function itemsHtml(s) {
  const lines = getItemLines(s).filter(item => String(item.persamaan || '').trim());
  if (!lines.length) return '<span class="text-slate-300">-</span>';
  return lines.map(item =>
    `<div class="whitespace-nowrap">${esc(item.persamaan)} <span class="text-slate-400 font-semibold">x${Math.max(1, Number(item.qty) || 1)}</span></div>`
  ).join('');
}

// ==================== ENTRY POINT ====================
export function renderPenjualanPage(stateData) {
  appState = stateData || state || appState;
  if (!appState.sales) appState.sales = [];

  purgeExpiredSales();

  const tbody = byId('saleTableBody');
  if (!tbody) return;

  if (!tbody.dataset.initialized) {
    const tipe = new URLSearchParams(location.search).get('tipe');
    if (['online', 'offline', 'status'].includes(tipe)) channel = tipe;
    tbody.dataset.initialized = 'true';
  }

  setupPenjualanEventListeners();
  renderSalesTable();
}

// ==================== HELPER TANGGAL ====================
const pad2 = (n) => String(n).padStart(2, '0');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function fmtDate(s) {
  const [y, m, d] = (s || '').split('-');
  return `${d}/${m}/${y}`;
}

function expiryDate(tanggal) {
  const [y, m, d] = (tanggal || todayStr()).split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const lastDay = new Date(ny, nm, 0).getDate();
  return `${ny}-${pad2(nm)}-${pad2(Math.min(d, lastDay))}`;
}
function isExpired(sale) {
  return todayStr() >= expiryDate(sale.tanggal);
}

let purging = false;
async function purgeExpiredSales() {
  if (purging) return;
  const sales = getSales();
  const keep = sales.filter(s => !isExpired(s));
  if (keep.length === sales.length) return;

  purging = true;
  try {
    appState.sales = keep;
    await persist();
  } finally {
    purging = false;
  }
}

// ==================== RENDER TABEL ====================
function renderSummaryCards(isStatusView, belum, sudah, diterima, pecah, sumQty) {
  const cardA = byId('cardA'), cardB = byId('cardB');
  if (!cardA || !cardB) return;

  if (isStatusView) {
    cardA.className = 'p-4 rounded-2xl border bg-emerald-50 border-emerald-200 text-emerald-800 cursor-default';
    cardB.className = 'p-4 rounded-2xl border bg-rose-50 border-rose-200 text-rose-800 cursor-default';
    byId('lblA').innerHTML = '<i class="fa-solid fa-circle-check mr-1.5"></i>Diterima';
    byId('lblB').innerHTML = '<i class="fa-solid fa-heart-crack mr-1.5"></i>Pecah';
    byId('countBelum').innerText = diterima.length;
    byId('countSudah').innerText = pecah.length;
    byId('pcsBelum').innerText = sumQty(diterima) + ' pcs';
    byId('pcsSudah').innerText = sumQty(pecah) + ' pcs';
  } else {
    cardA.className = 'p-4 rounded-2xl border bg-amber-50 border-amber-200 text-amber-800 cursor-default';
    cardB.className = 'p-4 rounded-2xl border bg-emerald-50 border-emerald-200 text-emerald-800 cursor-default';
    byId('lblA').innerHTML = '<i class="fa-solid fa-hourglass-half mr-1.5"></i>Belum Dipacking';
    byId('lblB').innerHTML = '<i class="fa-solid fa-box-open mr-1.5"></i>Sudah Dipacking';
    byId('countBelum').innerText = belum.length;
    byId('countSudah').innerText = sudah.length;
    byId('pcsBelum').innerText = sumQty(belum) + ' pcs';
    byId('pcsSudah').innerText = sumQty(sudah) + ' pcs';
  }
}

function renderSalesTable() {
  const tbody = byId('saleTableBody');
  const thead = document.querySelector('table thead');
  if (!tbody) return;

  const isStatusView = channel === 'status';

  const q = (byId('searchInput')?.value || '').toLowerCase().trim();

  // Status Penjualan Online hanya berisi penjualan online yang SUDAH dipacking
  const online = getSales().filter(s => s.channel === 'online' && !isExpired(s));
  const base = isStatusView
    ? online.filter(s => s.packed)
    : getSales().filter(s => s.channel === channel && !isExpired(s));

  const belum = base.filter(s => !s.packed);
  const sudah = base.filter(s => s.packed);
  const diterima = base.filter(s => s.deliveryStatus === 'DITERIMA');
  const pecah = base.filter(s => s.deliveryStatus === 'PECAH');
  const sumQty = (arr) => arr.reduce((a, s) => a + (s.qty || 0), 0);

  renderSummaryCards(isStatusView, belum, sudah, diterima, pecah, sumQty);
  byId('statusFilter')?.classList.toggle('hidden', isStatusView);

  let rows = base;
  if (!isStatusView) {
    if (statusFilter === 'BELUM') rows = belum;
    else if (statusFilter === 'SUDAH') rows = sudah;
  }
  if (q) {
    rows = rows.filter(s => [
      s.kode, s.marketplace, s.hp, s.resi, s.persamaan,
      getItems(s).map(i => `${i.hp || ''} ${i.persamaan || ''}`).join(' ')
    ].join(' ').toLowerCase().includes(q));
  }
  rows = [...rows].sort((a, b) => ((b.tanggal || '') + (b.createdAt || '')).localeCompare((a.tanggal || '') + (a.createdAt || '')));

  // Header Tabel Dinamis
  if (thead) {
    if (isStatusView) {
      thead.innerHTML = `
        <tr class="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] border-b">
          <th class="py-3.5 px-4">Tanggal</th>
          <th class="py-3.5 px-4">ID</th>
          <th class="py-3.5 px-4">Marketplace</th>
          <th class="py-3.5 px-4">Tipe HP Pembeli</th>
          <th class="py-3.5 px-4">Persamaan HP</th>
          <th class="py-3.5 px-4 text-right">Jumlah (pcs)</th>
          <th class="py-3.5 px-4 text-center">Status</th>
          <th class="py-3.5 px-4 text-center">Aksi</th>
        </tr>`;
    } else {
      thead.innerHTML = `
        <tr class="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] border-b">
          <th class="py-3.5 px-4">Tanggal</th>
          <th class="py-3.5 px-4">ID</th>
          <th class="py-3.5 px-4">Marketplace</th>
          <th class="py-3.5 px-4">Tipe HP Pembeli</th>
          <th class="py-3.5 px-4">Resi</th>
          <th class="py-3.5 px-4">Persamaan HP</th>
          <th class="py-3.5 px-4 text-right">Jumlah (pcs)</th>
          <th class="py-3.5 px-4 text-center">Status</th>
          <th class="py-3.5 px-4 text-center">Aksi</th>
        </tr>`;
    }
  }

  // Pagination
  const totalItems = rows.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageItems = rows.slice(startIdx, startIdx + itemsPerPage);

  const titleText = isStatusView ? 'Status Penjualan Online' : `Penjualan ${channel === 'online' ? 'Online' : 'Offline'}`;
  byId('tableTitle').innerText = titleText;
  byId('pageTitle').innerText = titleText;

  // Render Baris Data
  if (!pageItems.length) {
    const colSpan = isStatusView ? 8 : 9;
    const msg = isStatusView ? 'Belum ada penjualan online yang sudah dipacking' : 'Belum ada data';
    tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-8 text-slate-400"><p class="text-xs font-semibold">${msg}</p></td></tr>`;
  } else if (isStatusView) {
    tbody.innerHTML = pageItems.map(s => {
      let statusBadge;
      if (s.deliveryStatus === 'DITERIMA') {
        statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700"><i class="fa-solid fa-circle-check mr-1"></i>Diterima</span>';
      } else if (s.deliveryStatus === 'PECAH') {
        statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700"><i class="fa-solid fa-heart-crack mr-1"></i>Pecah</span>';
      } else {
        statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-400">Belum ditandai</span>';
      }

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="py-3 px-4 whitespace-nowrap">${fmtDate(s.tanggal)}<div class="text-[10px] text-slate-400">dihapus ${fmtDate(expiryDate(s.tanggal))}</div></td>
          <td class="py-3 px-4 font-semibold text-slate-800">${esc(s.kode)}</td>
          <td class="py-3 px-4">${esc(s.marketplace) || '<span class="text-slate-300">-</span>'}</td>
          <td class="py-3 px-4">${buyerHpHtml(s)}</td>
          <td class="py-3 px-4">${itemsHtml(s)}</td>
          <td class="py-3 px-4 text-right font-semibold">${s.qty}</td>
          <td class="py-3 px-4 text-center">${statusBadge}</td>
          <td class="py-3 px-4 text-center whitespace-nowrap space-x-1">
            <button type="button" onclick="setDeliveryStatus('${s.docId}', 'DITERIMA')" title="Tandai Diterima" class="px-2.5 py-1 border rounded-lg text-xs font-semibold transition ${s.deliveryStatus === 'DITERIMA' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'}">
              <i class="fa-solid fa-check mr-1"></i>Diterima
            </button>
            <button type="button" onclick="setDeliveryStatus('${s.docId}', 'PECAH')" title="Tandai Pecah" class="px-2.5 py-1 border rounded-lg text-xs font-semibold transition ${s.deliveryStatus === 'PECAH' ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'}">
              <i class="fa-solid fa-ban mr-1"></i>Pecah
            </button>
          </td>
        </tr>`;
    }).join('');
  } else {
    tbody.innerHTML = pageItems.map(s => `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="py-3 px-4 whitespace-nowrap">${fmtDate(s.tanggal)}<div class="text-[10px] text-slate-400">dihapus ${fmtDate(expiryDate(s.tanggal))}</div></td>
        <td class="py-3 px-4 font-semibold text-slate-800">${esc(s.kode)}</td>
        <td class="py-3 px-4">${esc(s.marketplace) || '<span class="text-slate-300">-</span>'}</td>
        <td class="py-3 px-4">${buyerHpHtml(s)}</td>
        <td class="py-3 px-4">${esc(s.resi) || '<span class="text-slate-300">-</span>'}</td>
        <td class="py-3 px-4">${itemsHtml(s)}</td>
        <td class="py-3 px-4 text-right font-semibold">${s.qty}</td>
        <td class="py-3 px-4 text-center">
          <button type="button" onclick="togglePacked('${s.docId}')" title="Klik untuk ubah status" class="px-2.5 py-1 rounded-full text-[10px] font-semibold transition ${s.packed ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}">
            <i class="fa-solid ${s.packed ? 'fa-check' : 'fa-hourglass-half'} mr-1"></i>${s.packed ? 'Sudah Dipacking' : 'Belum Dipacking'}
          </button>
        </td>
        <td class="py-3 px-4 text-center whitespace-nowrap">
          <button type="button" onclick="openSaleModal('${s.docId}')" title="Edit" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><i class="fa-solid fa-pen-to-square"></i></button>
          <button type="button" onclick="openDeleteSale('${s.docId}')" title="Hapus" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      </tr>`).join('');
  }

  byId('tableInfoText').innerText = `Menampilkan ${totalItems === 0 ? 0 : startIdx + 1} - ${Math.min(startIdx + itemsPerPage, totalItems)} dari ${totalItems} data`;
  byId('totalPcsText').innerText = 'Total: ' + sumQty(rows) + ' pcs';
  renderPagination(totalPages);

  document.querySelectorAll('.subNavBtn').forEach(b => {
    const on = b.dataset.channel === channel;
    b.className = 'subNavBtn w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ' +
      (on ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-white');
  });
}

function renderPagination(totalPages) {
  const controls = byId('paginationControls');
  if (!controls) return;
  if (totalPages <= 1) { controls.innerHTML = ''; return; }

  let html = `<button type="button" onclick="changePenjualanPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 border rounded-lg"' : 'class="px-2.5 py-1 border rounded-lg hover:bg-slate-100"'}>&lt;</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      html += `<button type="button" class="px-3 py-1 bg-indigo-600 text-white font-bold rounded-lg text-xs">${i}</button>`;
    } else if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button type="button" onclick="changePenjualanPage(${i})" class="px-3 py-1 border rounded-lg hover:bg-slate-100 text-xs">${i}</button>`;
    }
  }

  html += `<button type="button" onclick="changePenjualanPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 border rounded-lg"' : 'class="px-2.5 py-1 border rounded-lg hover:bg-slate-100"'}>&gt;</button>`;
  controls.innerHTML = html;
}

window.changePenjualanPage = function (page) {
  currentPage = page;
  renderSalesTable();
};

// ==================== BARIS PRODUK (MULTI PRODUK PER ID) ====================
function getEditingSale() {
  const editId = byId('editSaleId')?.value;
  return editId ? getSales().find(x => x.docId === editId) : null;
}

// Stok tersedia = stok sekarang + stok yang dulu dipotong oleh penjualan yang sedang diedit
function getAvailableStock(docId, editItem) {
  const p = findProduct(docId);
  if (!p) return 0;
  const back = editItem
    ? getItems(editItem).filter(i => i.productDocId === docId).reduce((a, i) => a + (i.stockDeducted || 0), 0)
    : 0;
  return (p.stock || 0) + back;
}

function itemRowHtml(item = {}) {
  const valid = item.productDocId && findProduct(item.productDocId) ? item.productDocId : '';
  const defaultHp = item.hp || byId('saleHp')?.value?.trim() || '';
  return `
    <div class="itemRow relative border border-slate-200 rounded-xl p-3 bg-slate-50/60">
      <div class="grid grid-cols-1 sm:grid-cols-[minmax(110px,0.8fr)_minmax(180px,1.5fr)_76px_auto] gap-2 items-start">
        <div class="min-w-0">
          <label class="block text-[10px] font-semibold text-slate-500 mb-1">Tipe HP Pembeli</label>
          <input type="text" value="${esc(defaultHp)}" placeholder="Contoh: A52" class="itemHp w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none">
        </div>
        <div class="min-w-0">
          <label class="block text-[10px] font-semibold text-slate-500 mb-1">Persamaan HP</label>
          <input type="text" autocomplete="off" value="${esc(item.persamaan || '')}" placeholder="Ketik untuk cari produk katalog..." class="itemPersamaan w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none">
          <input type="hidden" class="itemProductId" value="${esc(valid)}">
        </div>
        <div class="min-w-0">
          <label class="block text-[10px] font-semibold text-slate-500 mb-1">Pcs</label>
          <input type="number" min="1" value="${item.qty || 1}" title="Jumlah (pcs)" class="itemQty w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none">
        </div>
        <button type="button" onclick="removeItemRow(this)" title="Hapus pasangan tipe HP" class="mt-5 p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"><i class="fa-solid fa-trash-can"></i></button>
      </div>
      <div class="itemDropdown hidden absolute z-20 left-3 right-3 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100"></div>
      <p class="itemInfo text-[10px] text-slate-400 mt-1.5"></p>
    </div>`;
}

window.addItemRow = function (item) {
  const box = byId('itemsContainer');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', itemRowHtml(item && (item.persamaan !== undefined || item.hp !== undefined) ? item : {}));
  updateAllInfo();
};

window.removeItemRow = function (btn) {
  const box = byId('itemsContainer');
  const row = btn.closest('.itemRow');
  if (!box || !row) return;
  if (box.querySelectorAll('.itemRow').length <= 1) {
    row.querySelector('.itemHp').value = '';
    row.querySelector('.itemPersamaan').value = '';
    row.querySelector('.itemProductId').value = '';
    row.querySelector('.itemQty').value = 1;
  } else {
    row.remove();
  }
  updateAllInfo();
};

function readRows() {
  return [...document.querySelectorAll('#itemsContainer .itemRow')].map(r => ({
    row: r,
    hp: r.querySelector('.itemHp')?.value.trim() || '',
    text: r.querySelector('.itemPersamaan').value.trim(),
    productDocId: r.querySelector('.itemProductId').value,
    qty: Math.max(1, parseInt(r.querySelector('.itemQty').value, 10) || 1)
  }));
}

function updateAllInfo() {
  const editItem = getEditingSale();
  const rows = readRows();

  // total pemakaian per produk dari semua baris
  const need = {};
  rows.forEach(r => { if (r.productDocId) need[r.productDocId] = (need[r.productDocId] || 0) + r.qty; });

  rows.forEach(r => {
    const info = r.row.querySelector('.itemInfo');
    const p = findProduct(r.productDocId);
    if (!p) {
      info.className = 'itemInfo text-[10px] text-slate-400 mt-1.5';
      info.innerText = 'Opsional. Pilih produk dari katalog, stok akan berkurang sesuai jumlah.';
      return;
    }
    const avail = getAvailableStock(r.productDocId, editItem);
    const total = need[r.productDocId];
    if (total > avail) {
      info.className = 'itemInfo text-[10px] text-rose-600 font-semibold mt-1.5';
      info.innerText = `Stok tidak cukup. Tersedia ${avail} pcs, total diinput ${total} pcs.`;
    } else {
      info.className = 'itemInfo text-[10px] text-emerald-600 font-semibold mt-1.5';
      info.innerText = `Stok tersedia ${avail} pcs, sisa setelah penjualan: ${avail - total} pcs.`;
    }
  });

  const totalQty = rows.reduce((a, r) => a + r.qty, 0);
  const t = byId('saleTotalQty');
  if (t) t.innerText = `${totalQty} pcs`;
}

function renderItemDropdown(row, showAll = false) {
  const box = row.querySelector('.itemDropdown');
  const input = row.querySelector('.itemPersamaan');
  if (!box || !input) return;

  document.querySelectorAll('#itemsContainer .itemDropdown').forEach(d => { if (d !== box) d.classList.add('hidden'); });

  const tokens = showAll ? [] : input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const editItem = getEditingSale();
  const selectedId = row.querySelector('.itemProductId').value;
  const products = getProducts();

  const list = products
    .filter(p => {
      const hay = `${p.id} ${p.name} ${p.brand || ''} ${p.category || ''}`.toLowerCase();
      return tokens.every(t => hay.includes(t));
    })
    .slice(0, 50);

  if (!products.length) {
    box.innerHTML = '<div class="px-3 py-2.5 text-xs text-slate-400">Katalog masih kosong. Tambahkan produk di Master Katalog.</div>';
  } else if (!list.length) {
    box.innerHTML = '<div class="px-3 py-2.5 text-xs text-slate-400">Produk tidak ditemukan</div>';
  } else {
    box.innerHTML = list.map(p => {
      const avail = getAvailableStock(p.docId, editItem);
      const habis = avail <= 0;
      return `
        <button type="button" data-id="${esc(p.docId)}" ${habis ? 'data-disabled="true"' : ''}
          class="persamaanItem w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition ${habis ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-50'} ${p.docId === selectedId ? 'bg-indigo-50' : ''}">
          <span class="truncate"><span class="font-mono font-semibold text-indigo-600">${esc(p.id)}</span> <span class="text-slate-700">${esc(p.name)}</span></span>
          <span class="shrink-0 font-semibold ${habis ? 'text-rose-600' : 'text-emerald-600'}">${habis ? 'Habis' : 'Stok: ' + avail}</span>
        </button>`;
    }).join('');
  }
  box.classList.remove('hidden');
}

function hideAllDropdowns() {
  document.querySelectorAll('#itemsContainer .itemDropdown').forEach(d => d.classList.add('hidden'));
}

function selectPersamaan(row, docId) {
  const p = findProduct(docId);
  if (!p) return;
  row.querySelector('.itemPersamaan').value = p.name;
  row.querySelector('.itemProductId').value = p.docId;
  row.querySelector('.itemDropdown').classList.add('hidden');
  updateAllInfo();
}

// ==================== EVENT LISTENERS ====================
function setupPenjualanEventListeners() {
  // Simpan penanda listener per jenis event.
  // Sebelumnya semua event memakai listenerAttached yang sama, sehingga setelah
  // event input terpasang, focusin/mousedown/click pada elemen yang sama terlewat.
  const once = (el, evt, fn) => {
    if (!el) return;
    const key = `listener${evt.replace(/[^a-z0-9]/gi, '')}`;
    if (el.dataset[key] === 'true') return;
    el.addEventListener(evt, fn);
    el.dataset[key] = 'true';
  };

  once(byId('searchInput'), 'input', () => { currentPage = 1; renderSalesTable(); });
  once(byId('statusFilter'), 'change', (e) => { statusFilter = e.target.value; currentPage = 1; renderSalesTable(); });

  document.querySelectorAll('.subNavBtn').forEach(btn => {
    once(btn, 'click', () => {
      channel = btn.dataset.channel;
      currentPage = 1;
      renderSalesTable();
      byId('sidebar')?.classList.add('-translate-x-full');
    });
  });

  once(byId('penjualanToggle'), 'click', () => {
    byId('penjualanSub')?.classList.toggle('hidden');
    byId('penjualanChevron')?.classList.toggle('rotate-180');
  });

  // Delegasi event untuk semua baris produk
  const container = byId('itemsContainer');
  once(container, 'input', (e) => {
    const row = e.target.closest('.itemRow');
    if (!row) return;
    if (e.target.classList.contains('itemPersamaan')) {
      row.querySelector('.itemProductId').value = '';
      renderItemDropdown(row);
    }
    updateAllInfo();
  });
  once(container, 'focusin', (e) => {
    if (!e.target.classList.contains('itemPersamaan')) return;
    const row = e.target.closest('.itemRow');
    renderItemDropdown(row, !!row.querySelector('.itemProductId').value);
  });
  once(container, 'keydown', (e) => { if (e.key === 'Escape') hideAllDropdowns(); });
  // Gunakan click agar pemilihan produk bekerja dengan mouse maupun perangkat sentuh.
  once(container, 'click', (e) => {
    const btn = e.target.closest('.persamaanItem');
    if (!btn || !container.contains(btn)) return;
    e.preventDefault();
    if (btn.dataset.disabled) return;
    selectPersamaan(btn.closest('.itemRow'), btn.dataset.id);
  });

  if (!document.body.dataset.persamaanOutsideClick) {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.itemRow')) hideAllDropdowns();
    });
    document.body.dataset.persamaanOutsideClick = 'true';
  }
}

if (!window.openModal) window.openModal = (id) => document.getElementById(id)?.classList.remove('hidden');
if (!window.closeModal) window.closeModal = (id) => document.getElementById(id)?.classList.add('hidden');

// ==================== AKSI PENJUALAN & STATUS ====================
window.resetPenjualanFilters = function () {
  if (byId('searchInput')) byId('searchInput').value = '';
  if (byId('statusFilter')) byId('statusFilter').value = 'ALL';
  statusFilter = 'ALL';
  currentPage = 1;
  renderSalesTable();
  window.showToast?.('Filter di-reset', 'info');
};

// Tandai Diterima / Pecah (klik lagi pada status yang sama untuk membatalkan)
window.setDeliveryStatus = async function (docId, newStatus) {
  const item = getSales().find(x => x.docId === docId);
  if (!item) return;

  if (item.deliveryStatus === newStatus) {
    item.deliveryStatus = '';
    await persist();
    renderSalesTable();
    notify(`Status ${item.kode} dikosongkan`, 'info');
    return;
  }

  item.deliveryStatus = newStatus;
  await persist();
  renderSalesTable();

  const label = newStatus === 'DITERIMA' ? 'Diterima' : 'Pecah';
  notify(`Status ${item.kode} diperbarui: ${label}`, newStatus === 'PECAH' ? 'error' : 'success');
};

window.openSaleModal = function (docId) {
  byId('saleForm')?.reset();
  // Tipe HP sekarang diisi per baris pasangan; field lama menjadi default opsional.
  if (byId('saleHp')) {
    byId('saleHp').required = false;
    byId('saleHp').placeholder = 'Default tipe HP (opsional; bisa berbeda per baris)';
    byId('saleHp').title = 'Boleh dikosongkan. Isi tipe HP masing-masing pada setiap baris pasangan di bawah.';
    const hpLabel = document.querySelector('label[for="saleHp"]');
    if (hpLabel) hpLabel.textContent = 'Tipe HP Default (opsional)';
  }
  byId('editSaleId').value = '';
  byId('saleDate').value = todayStr();
  byId('saleChannel').value = channel === 'status' ? 'online' : channel;
  byId('salePacked').value = 'false';
  byId('saleModalTitle').innerText = 'Tambah Penjualan';
  const box = byId('itemsContainer');
  box.innerHTML = '';
  let items = [];

  if (docId) {
    const s = getSales().find(x => x.docId === docId);
    if (s) {
      byId('saleModalTitle').innerText = 'Edit Penjualan';
      byId('editSaleId').value = s.docId;
      byId('saleDate').value = s.tanggal;
      byId('saleChannel').value = s.channel;
      byId('saleCode').value = s.kode;
      byId('saleMarketplace').value = s.marketplace || '';
      byId('saleHp').value = s.hp;
      byId('saleResi').value = s.resi || '';
      byId('salePacked').value = String(!!s.packed);
      items = getItems(s);
      // data lama tanpa produk: pertahankan jumlahnya
      if (!items.length) items = [{ persamaan: '', productDocId: '', qty: s.qty || 1 }];
    }
  }
  if (!items.length) items = [{ persamaan: '', productDocId: '', qty: 1 }];

  items.forEach(i => box.insertAdjacentHTML('beforeend', itemRowHtml({ ...i, hp: i.hp || byId('saleHp').value.trim() })));
  updateAllInfo();
  window.openModal('saleModal');
};

async function persist() {
  await saveState();
  saveLocalStorageFallback();
}

window.handleSaleSubmit = async function (e) {
  e.preventDefault();

  const sales = getSales();
  const editDocId = byId('editSaleId')?.value;
  const editItem = editDocId ? sales.find(x => x.docId === editDocId) : null;

  const data = {
    tanggal: byId('saleDate').value,
    channel: byId('saleChannel').value,
    kode: byId('saleCode').value.trim(),
    marketplace: byId('saleMarketplace').value.trim(),
    hp: byId('saleHp')?.value.trim() || '',
    resi: byId('saleResi').value.trim(),
    packed: byId('salePacked').value === 'true'
  };

  if (isExpired({ tanggal: data.tanggal })) {
    notify('Tanggal sudah lebih dari 1 bulan lalu, data akan langsung terhapus otomatis.', 'error');
    return;
  }

  const prevItems = editItem ? getItems(editItem) : [];
  const rows = readRows();

  // Setiap baris adalah pasangan: tipe HP pembeli + persamaan + jumlah pcs.
  // Input saleHp lama tetap dipakai sebagai default untuk menjaga kompatibilitas data/form lama.
  const newItems = [];
  for (const r of rows) {
    const product = findProduct(r.productDocId);
    const hasPairData = !!(r.hp || r.text || product);
    if (!hasPairData) continue; // baris kosong diabaikan

    if (r.text && !product) {
      const legacy = prevItems.some(pi => pi.persamaan === r.text && !findProduct(pi.productDocId));
      if (!legacy) {
        notify(`Pilih produk dari dropdown katalog: "${r.text}"`, 'error');
        return;
      }
    }

    if (!r.text && !product) {
      notify(`Pilih persamaan HP untuk tipe ${r.hp || data.hp || 'yang diinput'}.`, 'error');
      return;
    }

    const buyerHp = r.hp || data.hp;
    if (!buyerHp) {
      notify('Isi Tipe HP Pembeli pada setiap pasangan sebelum menyimpan.', 'error');
      return;
    }

    newItems.push({
      hp: buyerHp,
      productDocId: product ? product.docId : '',
      persamaan: product ? product.name : r.text,
      qty: r.qty,
      stockDeducted: product ? r.qty : 0
    });
  }
  if (!newItems.length) newItems.push({ hp: data.hp, productDocId: '', persamaan: '', qty: 1, stockDeducted: 0 });

  // Cek stok per produk (gabungan semua baris dengan produk yang sama)
  const need = {};
  newItems.forEach(i => { if (i.productDocId) need[i.productDocId] = (need[i.productDocId] || 0) + i.qty; });
  for (const pid of Object.keys(need)) {
    const avail = getAvailableStock(pid, editItem);
    if (need[pid] > avail) {
      notify(`Stok ${findProduct(pid).name} tidak cukup (tersisa ${avail} pcs, diminta ${need[pid]} pcs)`, 'error');
      return;
    }
  }

  // Kembalikan stok lama, lalu potong stok baru
  prevItems.forEach(pi => {
    const p = findProduct(pi.productDocId);
    if (p) p.stock = (p.stock || 0) + (pi.stockDeducted || 0);
  });
  newItems.forEach(ni => {
    const p = findProduct(ni.productDocId);
    if (p) p.stock = (p.stock || 0) - ni.qty;
  });

  data.items = newItems;
  data.qty = newItems.reduce((a, i) => a + i.qty, 0);
  // Ringkasan kolom lama disimpan agar pencarian/data lama tetap kompatibel.
  data.hp = [...new Set(newItems.map(i => i.hp).filter(Boolean))].join(', ');
  data.persamaan = newItems.map(i => i.persamaan).filter(Boolean).join(', ');

  if (editItem) {
    // bersihkan field tunggal lama
    delete editItem.productDocId;
    delete editItem.stockDeducted;
    Object.assign(editItem, data);
  } else {
    sales.unshift({
      docId: `sale_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      ...data
    });
    currentPage = 1;
  }

  await persist();

  channel = data.channel;
  renderSalesTable();
  window.closeModal('saleModal');
  notify(editItem ? 'Data penjualan diperbarui' : 'Penjualan berhasil disimpan');
};

window.togglePacked = async function (docId) {
  const item = getSales().find(x => x.docId === docId);
  if (!item) return;
  item.packed = !item.packed;
  // kalau dikembalikan ke belum dipacking, keluar dari Status Penjualan Online
  if (!item.packed) item.deliveryStatus = '';
  await persist();
  renderSalesTable();
  notify(item.packed ? 'Ditandai sudah dipacking (masuk ke Status Penjualan Online)' : 'Dikembalikan ke belum dipacking');
};

window.openDeleteSale = function (docId) {
  const item = getSales().find(x => x.docId === docId);
  if (!item) return;
  byId('deleteSaleId').value = docId;

  const restored = getItems(item).filter(i => i.stockDeducted && findProduct(i.productDocId));
  const note = restored.length
    ? ' Stok dikembalikan: ' + restored.map(i => `${i.persamaan} +${i.stockDeducted}`).join(', ') + ' pcs.'
    : '';
  byId('deleteSaleName').innerText = `"${item.kode} - ${item.hp}" akan dihapus permanen.${note}`;
  window.openModal('deleteSaleModal');
};

window.confirmDeleteSale = async function () {
  const docId = byId('deleteSaleId')?.value;
  if (!docId) return;

  const item = getSales().find(x => x.docId === docId);
  if (item) {
    getItems(item).forEach(i => {
      const p = findProduct(i.productDocId);
      if (p && i.stockDeducted) p.stock = (p.stock || 0) + i.stockDeducted;
    });
  }

  appState.sales = getSales().filter(x => x.docId !== docId);
  await persist();
  renderSalesTable();
  window.closeModal('deleteSaleModal');
  notify('Data penjualan dihapus');
};
