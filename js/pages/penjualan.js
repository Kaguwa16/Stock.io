import { state, saveState, saveLocalStorageFallback } from '../state.js';

// ==================== STATE LEVEL MODUL ====================
let appState = { sales: [] };
let channel = 'offline';      // 'online' | 'offline'
let statusFilter = 'ALL';     // 'ALL' | 'BELUM' | 'SUDAH'
let selectedMonth = '';       // 'YYYY-MM'

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const byId = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

function getSales() {
  if (!appState.sales) appState.sales = [];
  return appState.sales;
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
  const [y, m, d] = s.split('-');
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

  const chLabel = channel === 'online' ? 'Online' : 'Offline';
  byId('tableTitle').innerText = `Penjualan ${chLabel} - ${monthLabel(selectedMonth)}`;
  byId('pageTitle').innerText = `Penjualan ${chLabel}`;

  tbody.innerHTML = rows.length ? rows.map(s => `
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

  byId('tableInfoText').innerText = `Menampilkan ${rows.length} data`;
  byId('totalPcsText').innerText = 'Total: ' + sumQty(rows) + ' pcs';

  // Highlight submenu sidebar
  document.querySelectorAll('.subNavBtn').forEach(b => {
    const on = b.dataset.channel === channel;
    b.className = 'subNavBtn w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ' +
      (on ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white');
  });
}

// ==================== EVENT LISTENERS (dipasang sekali) ====================
function setupPenjualanEventListeners() {
  const once = (el, evt, fn) => {
    if (el && !el.dataset.listenerAttached) {
      el.addEventListener(evt, fn);
      el.dataset.listenerAttached = 'true';
    }
  };

  once(byId('searchInput'), 'input', renderSalesTable);
  once(byId('statusFilter'), 'change', (e) => { statusFilter = e.target.value; renderSalesTable(); });
  once(byId('monthFilter'), 'change', (e) => { selectedMonth = e.target.value; renderSalesTable(); });

  document.querySelectorAll('.subNavBtn').forEach(btn => {
    once(btn, 'click', () => {
      channel = btn.dataset.channel;
      renderSalesTable();
      byId('sidebar')?.classList.add('-translate-x-full'); // tutup sidebar di HP
    });
  });

  once(byId('penjualanToggle'), 'click', () => {
    byId('penjualanSub')?.classList.toggle('hidden');
    byId('penjualanChevron')?.classList.toggle('rotate-180');
  });
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
  renderSalesTable();
  window.showToast?.('Filter di-reset', 'info');
};

window.openSaleModal = function (docId) {
  byId('saleForm')?.reset();
  byId('editSaleId').value = '';
  byId('saleDate').value = todayStr();
  byId('saleChannel').value = channel;
  byId('salePacked').value = 'false';
  byId('saleQty').value = 1;
  byId('saleModalTitle').innerText = 'Tambah Penjualan';

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
      byId('saleQty').value = s.qty;
      byId('salePacked').value = String(!!s.packed);
    }
  }
  window.openModal('saleModal');
};

async function persist() {
  await saveState();
  saveLocalStorageFallback();
}

window.handleSaleSubmit = async function (e) {
  e.preventDefault();

  const editDocId = byId('editSaleId')?.value;
  const data = {
    tanggal: byId('saleDate').value,
    channel: byId('saleChannel').value,
    kode: byId('saleCode').value.trim(),
    marketplace: byId('saleMarketplace').value.trim(),
    hp: byId('saleHp').value.trim(),
    resi: byId('saleResi').value.trim(),
    persamaan: byId('salePersamaan').value.trim(),
    qty: Math.max(1, parseInt(byId('saleQty').value, 10) || 1),
    packed: byId('salePacked').value === 'true'
  };

  const sales = getSales();
  if (editDocId) {
    const item = sales.find(x => x.docId === editDocId);
    if (item) Object.assign(item, data);
  } else {
    sales.unshift({
      docId: `sale_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      ...data
    });
  }

  await persist();

  channel = data.channel;
  selectedMonth = data.tanggal.slice(0, 7);
  renderSalesTable();
  window.closeModal('saleModal');
  window.showToast?.(editDocId ? 'Data penjualan diperbarui' : 'Penjualan berhasil disimpan', 'success');
};

window.togglePacked = async function (docId) {
  const item = getSales().find(x => x.docId === docId);
  if (!item) return;
  item.packed = !item.packed;
  await persist();
  renderSalesTable();
  window.showToast?.(item.packed ? 'Ditandai sudah dipacking' : 'Dikembalikan ke belum dipacking', 'success');
};

window.openDeleteSale = function (docId) {
  const item = getSales().find(x => x.docId === docId);
  if (!item) return;
  byId('deleteSaleId').value = docId;
  byId('deleteSaleName').innerText = `"${item.kode} - ${item.hp}" akan dihapus permanen.`;
  window.openModal('deleteSaleModal');
};

window.confirmDeleteSale = async function () {
  const docId = byId('deleteSaleId')?.value;
  if (!docId) return;
  appState.sales = getSales().filter(x => x.docId !== docId);
  await persist();
  renderSalesTable();
  window.closeModal('deleteSaleModal');
  window.showToast?.('Data penjualan dihapus', 'success');
};
