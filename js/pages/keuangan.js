import { state, saveState } from '../state.js';

// --- HELPER GLOBAL (Menggunakan bawaan utils.js jika ada, atau fallback) ---
const formatIDR = (angka) => {
  if (typeof window.formatIDR === 'function') return window.formatIDR(angka);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(Number(angka) || 0);
};

const setElText = (id, text) => {
  if (typeof window.setElText === 'function') {
    window.setElText(id, text);
    return;
  }
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

const notify = (message, type = 'success') => {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const bgColor = type === 'error' ? 'bg-rose-600' : 'bg-slate-900';
  const icon = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check text-emerald-400';

  const toast = document.createElement('div');
  toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center space-x-2.5 transition-all duration-300`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};

// --- MODAL HANDLERS GLOBAL ---
window.openModal = window.openModal || function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeModal = window.closeModal || function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

// --- KALKULASI RINGKASAN KEUANGAN ---
function calculateFinanceSummary(products, expenses) {
  const totalAssetValue = products.reduce(
    (sum, p) => sum + (Number(p.stock || 0) * Number(p.hpp || 0)),
    0
  );
  const totalTurnover = products.reduce(
    (sum, p) => sum + (Number(p.outgoing || 0) * Number(p.price || 0)),
    0
  );
  const totalCogsSales = products.reduce(
    (sum, p) => sum + (Number(p.outgoing || 0) * Number(p.hpp || 0)),
    0
  );
  const grossProfit = totalTurnover - totalCogsSales;

  const lossSupplier = products.reduce(
    (sum, p) => sum + (Number(p.supplierDamaged || 0) * Number(p.hpp || 0)),
    0
  );
  const lossShipping = products.reduce(
    (sum, p) => sum + (Number(p.shippingDamaged || 0) * Number(p.price || 0)),
    0
  );
  const totalLoss = lossSupplier + lossShipping;

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = grossProfit - totalLoss - totalExpenses;

  return {
    totalAssetValue,
    totalTurnover,
    grossProfit,
    lossSupplier,
    lossShipping,
    totalLoss,
    totalExpenses,
    netProfit
  };
}

// --- RENDER HALAMAN KEUANGAN (Dipanggil oleh main.js saat state berubah) ---
export function renderKeuanganPage(currentState = state) {
  // Guard Clause: hentikan jika bukan di halaman keuangan.html
  if (!document.getElementById('finValAsset')) return;

  const products = currentState.products || [];
  const expenses = currentState.expenses || [];
  const monthlyArchives = currentState.monthlyArchives || [];
  const activePeriodName = currentState.activePeriodName || 'November 2026';

  setElText('activePeriodLabel', activePeriodName);

  const summary = calculateFinanceSummary(products, expenses);

  // 1. Update 4 Kartu Ringkasan Utama
  setElText('finValAsset', formatIDR(summary.totalAssetValue));
  setElText('finValTurnover', formatIDR(summary.totalTurnover));
  setElText('finValGrossProfit', formatIDR(summary.grossProfit));
  setElText('finValNetProfit', formatIDR(summary.netProfit));

  // 2. Update Rincian Kerugian Pecah & Total Biaya
  setElText('finLossSupplierNominal', formatIDR(summary.lossSupplier));
  setElText('finLossShippingNominal', formatIDR(summary.lossShipping));
  setElText('finTotalExpensesNominal', formatIDR(summary.totalExpenses));

  // 3. Render Log Biaya Operasional Bulan Ini
  const expContainer = document.getElementById('expenseListContainer');
  if (expContainer) {
    if (expenses.length === 0) {
      expContainer.innerHTML =
        '<div class="text-center py-6 text-slate-400 text-xs">Belum ada catatan biaya operasional bulan ini.</div>';
    } else {
      expContainer.innerHTML = expenses
        .map((exp, idx) => {
          const itemId = exp.id || exp.docId || String(idx);
          return `
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition">
              <div>
                <span class="text-xs font-bold text-slate-800 block">${exp.name}</span>
                <span class="text-[10px] text-slate-400">${exp.category || 'Operasional'} &bull; ${exp.date || '-'}</span>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-xs font-extrabold text-slate-700">${formatIDR(exp.amount)}</span>
                <button onclick="deleteExpense('${itemId}')" class="text-slate-400 hover:text-rose-600 p-1 text-xs">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  // 4. Render Tabel Arsip Bulanan (6 Kolom sesuai thead di keuangan.html)
  const archiveTbody = document.getElementById('archiveTableBody');
  if (archiveTbody) {
    if (monthlyArchives.length === 0) {
      archiveTbody.innerHTML =
        '<tr><td colspan="6" class="text-center py-6 text-slate-400 text-xs">Belum ada arsip tutup buku periode sebelumnya.</td></tr>';
    } else {
      archiveTbody.innerHTML = monthlyArchives
        .map(
          (arc) => `
          <tr class="hover:bg-slate-50 transition">
            <td class="py-3.5 px-4 font-bold text-slate-800">${arc.period}</td>
            <td class="py-3.5 px-4 text-right font-semibold text-emerald-600">${formatIDR(arc.turnover)}</td>
            <td class="py-3.5 px-4 text-right font-semibold text-blue-600">${formatIDR(arc.grossProfit)}</td>
            <td class="py-3.5 px-4 text-right font-semibold text-rose-600">${formatIDR(arc.totalLoss)}</td>
            <td class="py-3.5 px-4 text-right font-semibold text-slate-600">${formatIDR(arc.expenses)}</td>
            <td class="py-3.5 px-4 text-right font-extrabold text-purple-700">${formatIDR(arc.netProfit)}</td>
          </tr>
        `
        )
        .join('');
    }
  }
}

// --- HAPUS BIAYA OPERASIONAL VIA STATE ---
window.deleteExpense = async function (targetId) {
  if (!targetId) return;
  if (!confirm('Hapus catatan biaya operasional ini?')) return;

  state.expenses = (state.expenses || []).filter(
    (exp, idx) => String(exp.id || exp.docId || idx) !== String(targetId)
  );

  renderKeuanganPage(state);
  await saveState();
  notify('Biaya operasional berhasil dihapus.');
};

// --- SUBMIT FORM MODAL (BIAYA OPERASIONAL & TUTUP BUKU) ---
document.addEventListener('submit', async (e) => {
  // 1. Tambah Biaya Operasional
  if (e.target.id === 'expenseForm') {
    e.preventDefault();
    const name = document.getElementById('expName')?.value.trim();
    const category = document.getElementById('expCategory')?.value || 'Operasional';
    const amount = Number(document.getElementById('expAmount')?.value || 0);
    const date = document.getElementById('expDate')?.value || new Date().toISOString().split('T')[0];

    if (!name || amount <= 0) {
      notify('Nama biaya dan nominal harus diisi dengan benar.', 'error');
      return;
    }

    const newId = Date.now().toString();
    state.expenses = [
      {
        id: newId,
        docId: newId,
        name,
        category,
        amount,
        date
      },
      ...(state.expenses || [])
    ];

    e.target.reset();
    window.closeModal('expenseModal');
    renderKeuanganPage(state);
    await saveState();
    notify('Biaya operasional berhasil disimpan.');
  }

  // 2. Tutup Buku Bulanan
  if (e.target.id === 'closeMonthForm') {
    e.preventDefault();
    const nextPeriodInput = document.getElementById('nextPeriodName')?.value.trim();
    if (!nextPeriodInput) {
      notify('Masukkan nama periode bulan berikutnya.', 'error');
      return;
    }

    const summary = calculateFinanceSummary(state.products || [], state.expenses || []);

    // Tambahkan rekap bulan ini ke arsip
    state.monthlyArchives = [
      {
        period: state.activePeriodName || 'November 2026',
        turnover: summary.totalTurnover,
        grossProfit: summary.grossProfit,
        totalLoss: summary.totalLoss,
        expenses: summary.totalExpenses,
        netProfit: summary.netProfit,
        archivedAt: new Date().toISOString()
      },
      ...(state.monthlyArchives || [])
    ];

    // Reset counter bulanan pada semua produk
    state.products = (state.products || []).map((p) => ({
      ...p,
      outgoing: 0,
      supplierDamaged: 0,
      shippingDamaged: 0
    }));

    // Kosongkan log biaya operasional bulan berjalan & perbarui nama periode
    state.expenses = [];
    state.activePeriodName = nextPeriodInput;

    e.target.reset();
    window.closeModal('closeMonthModal');
    renderKeuanganPage(state);
    await saveState();
    notify(`Tutup buku selesai! Periode aktif sekarang: ${nextPeriodInput}`);
  }
});
