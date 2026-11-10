import { state, saveState, saveLocalStorageFallback } from '../state.js';

// ==================== STATE LEVEL MODUL ====================
let appState = { sales: [], products: [] };
let channel = 'offline';      // 'online' | 'offline'
let statusFilter = 'ALL';     // 'ALL' | 'BELUM' | 'SUDAH'
let selectedMonth = '';       // 'YYYY-MM'
let currentPage = 1;
const itemsPerPage = 10;

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

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

// ==================== ENTRY POINT (dipanggil dari main.js) ====================
export function renderPenjualanPage(stateData) {
  appState = stateData || state || appState;

  const tbody = byId('saleTableBody');
  if (!tbody) return; // Keluar jika bukan halaman penjualan

  if (!appState.sales) appState.sales = [];

  // channel dari URL (?tipe=online) hanya dibaca sekali saat pertama render
  if (!tbody.dataset.initialized) {
    const tipe = new URLSearchParams(location.search).get('tipe');
    if (tipe === 'online' || tipe === 'offline') channel = tipe;
    tbody.dataset.initialized = 'true';
  }

  setupPenjualanEventListeners();
  renderSalesTable();
}

// ==================== HELPER TANGGAL ====================
function currentMonthKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function todayStr() {
  const d = new Date();
  return currentMonthKey() + '-' + String(d.getDate()).padStart(2, '0');
}
function monthLabel(key) {
  const [y, m] = key.split('-');
  return BULAN[parseInt(m, 10) - 1] + ' ' + y;
}
function fmtDate(s) {
  const [y, m, d] = (s || '').split('-');
  return `${d}/${m}/${y}`;
}

// ==================== FILTER BULAN (ARSIP) ====================
function buildMonthOptions() {
  const select = byId('monthFilter');
  if (!select) return;

  const keys = new Set([currentMonthKey()]);
  getSales().forEach(s => { if (s.tanggal) keys.add(s.tanggal.slice(0, 7)); });
  const sorted = [...keys].sort().reverse();

  select.innerHTML = sorted.map(k =>
    `<option value="${k}">${monthLabel(k)}${k === currentMonthKey() ? ' (Bulan ini)' : ' (Arsip)'}</option>`
  ).join('');

  if (!selectedMonth || !keys.has(selectedMonth)) selectedMonth = currentMonthKey();
  select.value = selectedMonth;
}

// ==================== RENDER TABEL ====================
function renderSalesTable() {
  const tbody = byId('saleTableBody');
  if (!tbody) return;

  buildMonthOptions();
  const isArchive = selectedMonth !== currentMonthKey();
  byId('archiveBanner')?.classList.toggle('hidden', !isArchive);

  const q = (byId('searchInput')?.value || '').toLowerCase().trim();
  const base = getSales().filter(s => s.channel === channel && (s.tanggal || '').slice(0, 7) === selectedMonth);
  const belum = base.filter(s => !s.packed);
  const sudah = base.filter(s => s.packed);
  const sumQty = (arr) => arr.reduce((a, s) => a + (s.qty || 0), 0);

  // Kotak status (hanya info)
  byId('countBelum').innerText = belum.length;
  byId('countSudah').innerText = sudah.length;
  byId('pcsBelum').innerText = sumQty(belum) + ' pcs';
  byId('pcsSudah').innerText = sumQty(sudah) + ' pcs';

  let rows = base;
  if (statusFilter === 'BELUM') rows = belum;
  else if (statusFilter === 'SUDAH') rows = sudah;
  if (q) {
    rows = rows.filter(s => [s.kode, s.marketplace, s.hp, s.resi, s.persamaan].join(' ').toLowerCase().includes(q));
  }
  rows = [...rows].sort((a, b) => ((b.tanggal || '') + (b.createdAt || '')).localeCompare((a.tanggal || '') + (a.createdAt || '')));

  // Pagination: 10 data per halaman
  const totalItems = rows.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageItems = rows.slice(startIdx, startIdx + itemsPerPage);

  const chLabel = channel === 'online' ? 'Online' : 'Offline';
  byId('tableTitle').innerText = `Penjualan ${chLabel} - ${monthLabel(selectedMonth)}`;
  byId('pageTitle').innerText = `Penjualan ${chLabel}`;

  tbody.innerHTML = pageItems.length ? pageItems.map(s => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-100">
      <td class="py-3 px-4 whitespace-nowrap">${fmtDate(s.tanggal)}</td>
      <td class="py-3 px-4 font-semibold text-slate-800">${esc(s.kode)}</td>
      <td class="py-3 px-4">${esc(s.marketplace) || '<span class="text-slate-300">-</span>'}</td>
      <td class="py-3 px-4">${esc(s.hp)}</td>
      <td class="py-3 px-4">${esc(s.resi) || '<span class="text-slate-300">-</span>'}</td>
      <td class="py-3 px-4">${esc(s.persamaan) || '<span class="text-slate-300">-</span>'}</td>
      <td class="py-3 px-4 text-right font-semibold">${s.qty}</td>
      <td class="py-3 px-4 text-center">
        ${isArchive
          ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-semibold ${s.packed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${s.packed ? 'Sudah' : 'Belum'}</span>`
          : `<button type="button" onclick="togglePacked('${s.docId}')" title="Klik untuk ubah status" class="px-2.5 py-1 rounded-full text-[10px] font-semibold transition ${s.packed ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}">
              <i class="fa-solid ${s.packed ? 'fa-check' : 'fa-hourglass-half'} mr-1"></i>${s.packed ? 'Sudah Dipacking' : 'Belum Dipacking'}
            </button>`}
      </td>
      <td class="py-3 px-4 text-center whitespace-nowrap">
        ${isArchive ? '<span class="text-slate-300 text-xs"><i class="fa-solid fa-lock"></i></span>' : `
        <button type="button" onclick="openSaleModal('${s.docId}')" title="Edit" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><i class="fa-solid fa-pen-to-square"></i></button>
        <button type="button" onclick="openDeleteSale('${s.docId}')" title="Hapus" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"><i class="fa-solid fa-trash-can"></i></button>`}
      </td>
    </tr>`).join('')
    : `<tr><td colspan="9" class="text-center py-8 text-slate-400"><p class="text-xs font-semibold">Belum ada data</p></td></tr>`;

  byId('tableInfoText').innerText = `Menampilkan ${totalItems === 0 ? 0 : startIdx + 1} - ${Math.min(startIdx + itemsPerPage, totalItems)} dari ${totalItems} data`;
  byId('totalPcsText').innerText = 'Total: ' + sumQty(rows) + ' pcs';
  renderPagination(totalPages);

  // Highlight submenu sidebar
  document.querySelectorAll('.subNavBtn').forEach(b => {
    const on = b.dataset.channel === channel;
    b.className = 'subNavBtn w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ' +
      (on ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white');
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

// ==================== DROPDOWN PRODUK KATALOG (Persamaan HP) ====================
function getEditingSale() {
  const editId = byId('editSaleId')?.value;
  return editId ? getSales().find(x => x.docId === editId) : null;
}

// Stok yang masih bisa dipakai. Saat edit, jumlah yang dulu sudah dikurangkan dihitung kembali.
function getAvailableStock(docId, editItem) {
  const p = findProduct(docId);
  if (!p) return 0;
  const back = (editItem && editItem.productDocId === docId) ? (editItem.stockDeducted || 0) : 0;
  return (p.stock || 0) + back;
}

function renderPersamaanDropdown(showAll = false) {
  const box = byId('persamaanDropdown');
  const input = byId('salePersamaan');
  if (!box || !input) return;

  const tokens = showAll ? [] : input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const editItem = getEditingSale();
  const selectedId = byId('salePersamaanId')?.value;
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

function hidePersamaanDropdown() {
  byId('persamaanDropdown')?.classList.add('hidden');
}

function selectPersamaan(docId) {
  const p = findProduct(docId);
  if (!p) return;
  byId('salePersamaan').value = p.name;
  byId('salePersamaanId').value = p.docId;
  hidePersamaanDropdown();
  updatePersamaanInfo();
}

function updatePersamaanInfo() {
  const info = byId('persamaanInfo');
  if (!info) return;
  const id = byId('salePersamaanId')?.value;
  const p = findProduct(id);

  if (!p) {
    info.className = 'text-[10px] text-slate-400 mt-1';
    info.innerText = 'Opsional. Pilih produk dari katalog, stok akan berkurang sesuai jumlah.';
    return;
  }
  const avail = getAvailableStock(id, getEditingSale());
  const qty = parseInt(byId('saleQty')?.value, 10) || 0;
  if (qty > avail) {
    info.className = 'text-[10px] text-rose-600 font-semibold mt-1';
    info.innerText = `Stok tidak cukup. Tersedia ${avail} pcs, jumlah diinput ${qty} pcs.`;
  } else {
    info.className = 'text-[10px] text-emerald-600 font-semibold mt-1';
    info.innerText = `Stok tersedia ${avail} pcs, sisa setelah penjualan: ${avail - qty} pcs.`;
  }
}

// ==================== EVENT LISTENERS (dipasang sekali) ====================
function setupPenjualanEventListeners() {
  const once = (el, evt, fn) => {
    if (el && !el.dataset.listenerAttached) {
      el.addEventListener(evt, fn);
      el.dataset.listenerAttached = 'true';
    }
  };

  once(byId('searchInput'), 'input', () => { currentPage = 1; renderSalesTable(); });
  once(byId('statusFilter'), 'change', (e) => { statusFilter = e.target.value; currentPage = 1; renderSalesTable(); });
  once(byId('monthFilter'), 'change', (e) => { selectedMonth = e.target.value; currentPage = 1; renderSalesTable(); });

  document.querySelectorAll('.subNavBtn').forEach(btn => {
    once(btn, 'click', () => {
      channel = btn.dataset.channel;
      currentPage = 1;
      renderSalesTable();
      byId('sidebar')?.classList.add('-translate-x-full'); // tutup sidebar di HP
    });
  });

  once(byId('penjualanToggle'), 'click', () => {
    byId('penjualanSub')?.classList.toggle('hidden');
    byId('penjualanChevron')?.classList.toggle('rotate-180');
  });

  // Dropdown produk katalog
  const pInput = byId('salePersamaan');
  once(pInput, 'input', () => {
    byId('salePersamaanId').value = '';   // ketikan baru = pilihan lama dibatalkan
    updatePersamaanInfo();
    renderPersamaanDropdown();
  });
  once(pInput, 'focus', () => renderPersamaanDropdown(!!byId('salePersamaanId').value));
  once(pInput, 'keydown', (e) => { if (e.key === 'Escape') hidePersamaanDropdown(); });
  once(byId('persamaanDropdown'), 'mousedown', (e) => {
    const btn = e.target.closest('.persamaanItem');
    if (!btn) return;
    e.preventDefault();
    if (btn.dataset.disabled) return;
    selectPersamaan(btn.dataset.id);
  });
  once(byId('saleQty'), 'input', updatePersamaanInfo);

  if (!document.body.dataset.persamaanOutsideClick) {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#persamaanWrap')) hidePersamaanDropdown();
    });
    document.body.dataset.persamaanOutsideClick = 'true';
  }
}

// ==================== MODAL (fallback jika belum ada dari katalog.js) ====================
if (!window.openModal) window.openModal = (id) => document.getElementById(id)?.classList.remove('hidden');
if (!window.closeModal) window.closeModal = (id) => document.getElementById(id)?.classList.add('hidden');

// ==================== AKSI (nama diberi ciri penjualan agar tidak bentrok dgn katalog.js) ====================
window.resetPenjualanFilters = function () {
  if (byId('searchInput')) byId('searchInput').value = '';
  if (byId('statusFilter')) byId('statusFilter').value = 'ALL';
  statusFilter = 'ALL';
  selectedMonth = currentMonthKey();
  currentPage = 1;
  renderSalesTable();
  window.showToast?.('Filter di-reset', 'info');
};

window.openSaleModal = function (docId) {
  byId('saleForm')?.reset();
  byId('editSaleId').value = '';
  byId('salePersamaanId').value = '';
  byId('saleDate').value = todayStr();
  byId('saleChannel').value = channel;
  byId('salePacked').value = 'false';
  byId('saleQty').value = 1;
  byId('saleModalTitle').innerText = 'Tambah Penjualan';
  hidePersamaanDropdown();

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
      byId('salePersamaan').value = s.persamaan || '';
      byId('salePersamaanId').value = findProduct(s.productDocId) ? s.productDocId : '';
      byId('saleQty').value = s.qty;
      byId('salePacked').value = String(!!s.packed);
    }
  }
  updatePersamaanInfo();
  window.openModal('saleModal');
};

async function persist() {
  await saveState();            // menyimpan products (stok) dan sales sekaligus
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
    hp: byId('saleHp').value.trim(),
    resi: byId('saleResi').value.trim(),
    qty: Math.max(1, parseInt(byId('saleQty').value, 10) || 1),
    packed: byId('salePacked').value === 'true'
  };

  // ----- Produk katalog (persamaan HP) -----
  const typed = byId('salePersamaan').value.trim();
  const product = findProduct(byId('salePersamaanId').value);

  // Data lama (teks bebas / produk yang sudah dihapus dari katalog) boleh tetap dipertahankan saat diedit
  const keepLegacyText = !!editItem && typed !== '' && typed === editItem.persamaan &&
    (!editItem.productDocId || !findProduct(editItem.productDocId));

  if (typed && !product && !keepLegacyText) {
    notify('Pilih produk dari daftar dropdown katalog', 'error');
    return;
  }

  const prevProduct = editItem?.productDocId ? findProduct(editItem.productDocId) : null;
  const prevQty = prevProduct ? (editItem.stockDeducted || 0) : 0;

  if (product) {
    const available = (product.stock || 0) + (prevProduct && prevProduct.docId === product.docId ? prevQty : 0);
    if (data.qty > available) {
      notify(`Stok ${product.name} tidak cukup (tersisa ${available} pcs)`, 'error');
      return;
    }
  }

  // Kembalikan stok lama (kalau edit), lalu kurangi stok sesuai jumlah baru
  if (prevProduct) prevProduct.stock = (prevProduct.stock || 0) + prevQty;
  if (product) product.stock = (product.stock || 0) - data.qty;

  data.productDocId = product ? product.docId : '';
  data.persamaan = product ? product.name : (keepLegacyText ? typed : '');
  data.stockDeducted = product ? data.qty : 0;

  if (editItem) {
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
  selectedMonth = data.tanggal.slice(0, 7);
  renderSalesTable();
  window.closeModal('saleModal');
  notify(editItem ? 'Data penjualan diperbarui' : 'Penjualan berhasil disimpan');
};

window.togglePacked = async function (docId) {
  const item = getSales().find(x => x.docId === docId);
  if (!item) return;
  item.packed = !item.packed;
  await persist();
  renderSalesTable();
  notify(item.packed ? 'Ditandai sudah dipacking' : 'Dikembalikan ke belum dipacking');
};

window.openDeleteSale = function (docId) {
  const item = getSales().find(x => x.docId === docId);
  if (!item) return;
  byId('deleteSaleId').value = docId;

  const prod = findProduct(item.productDocId);
  const note = prod && item.stockDeducted ? ` Stok ${prod.name} dikembalikan +${item.stockDeducted} pcs.` : '';
  byId('deleteSaleName').innerText = `"${item.kode} - ${item.hp}" akan dihapus permanen.${note}`;
  window.openModal('deleteSaleModal');
};

window.confirmDeleteSale = async function () {
  const docId = byId('deleteSaleId')?.value;
  if (!docId) return;

  const item = getSales().find(x => x.docId === docId);
  const prod = item ? findProduct(item.productDocId) : null;
  if (prod && item.stockDeducted) prod.stock = (prod.stock || 0) + item.stockDeducted;

  appState.sales = getSales().filter(x => x.docId !== docId);
  await persist();
  renderSalesTable();
  window.closeModal('deleteSaleModal');
  notify('Data penjualan dihapus');
};
