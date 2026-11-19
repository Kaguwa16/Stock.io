// js/pages/keuangan.js
import { db } from '../firebase-config.js';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Simpan state terakhir agar bisa diakses saat aksi Tutup Buku
let latestState = {
  products: [],
  expenses: [],
  monthlyArchives: [],
  activePeriodName: 'November 2026'
};

// --- HELPER GLOBAL (Fallback jika belum tersedia di utils.js) ---
const formatIDR = window.formatIDR || ((angka) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(Number(angka) || 0)
);

const setElText = window.setElText || ((id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
});

const showToast = window.showToast || ((message, type = 'success') => {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const bgColor = type === 'error' ? 'bg-rose-600' : 'bg-slate-900';
  const icon = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check text-emerald-400';

  const toast = document.createElement('div');
  toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center space-x-2.5 transition-all duration-300`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
});

// --- MODAL HANDLERS GLOBAL (Untuk onclick di keuangan.html) ---
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

// --- FUNGSI UTAMA YANG DIPANGGIL OLEH main.js ---
export function renderKeuanganPage(currentState = {}) {
  // Guard Clause: hentikan eksekusi jika user sedang membuka halaman lain (misal index.html / katalog.html)
  if (!document.getElementById('finValAsset')) return;

  const products = currentState.products || [];
  const expenses = currentState.expenses || [];
  const monthlyArchives = currentState.monthlyArchives || currentState.archives || [];
  const activePeriodName = currentState.activePeriodName || currentState.activePeriod || 'November 2026';

  latestState = { products, expenses, monthlyArchives, activePeriodName };

  setElText('activePeriodLabel', activePeriodName);

  const summary = calculateFinanceSummary(products, expenses);

  // 1. Update 4 Kartu Ringkasan
  setElText('finValAsset', formatIDR(summary.totalAssetValue));
  setElText('finValTurnover', formatIDR(summary.totalTurnover));
  setElText('finValGrossProfit', formatIDR(summary.grossProfit));
  setElText('finValNetProfit', formatIDR(summary.netProfit));

  // 2. Update Rincian Kerugian Pecah & Total Biaya
  setElText('finLossSupplierNominal', formatIDR(summary.lossSupplier));
  setElText('finLossShippingNominal', formatIDR(summary.lossShipping));
  setElText('finTotalExpensesNominal', formatIDR(summary.totalExpenses));

  // 3. Render Log Biaya Operasional
  const expContainer = document.getElementById('expenseListContainer');
  if (expContainer) {
    if (expenses.length === 0) {
      expContainer.innerHTML =
        '<div class="text-center py-6 text-slate-400 text-xs">Belum ada catatan biaya operasional bulan ini.</div>';
    } else {
      expContainer.innerHTML = expenses
        .map(
          (exp) => `
          <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition">
            <div>
              <span class="text-xs font-bold text-slate-800 block">${exp.name}</span>
              <span class="text-[10px] text-slate-400">${exp.category || 'Operasional'} &bull; ${exp.date || '-'}</span>
            </div>
            <div class="flex items-center space-x-2">
              <span class="text-xs font-extrabold text-slate-700">${formatIDR(exp.amount)}</span>
              <button onclick="deleteExpense('${exp.docId || exp.id}')" class="text-slate-400 hover:text-rose-600 p-1 text-xs">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        `
        )
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

// --- AKSI CRUD: HAPUS BIAYA OPERASIONAL ---
window.deleteExpense = async function (docId) {
  if (!docId) return;
  if (!confirm('Hapus catatan biaya operasional ini?')) return;

  try {
    await deleteDoc(doc(db, 'expenses', docId));
    showToast('Biaya operasional berhasil dihapus.');
  } catch (err) {
    console.error('Gagal menghapus biaya:', err);
    showToast('Gagal menghapus biaya operasional.', 'error');
  }
};

// --- EVENT DELEGATION UNTUK FORM MODAL (Aman dari duplikasi saat re-render) ---
document.addEventListener('submit', async (e) => {
  // 1. Submit Tambah Biaya Operasional
  if (e.target.id === 'expenseForm') {
    e.preventDefault();
    const name = document.getElementById('expName')?.value.trim();
    const category = document.getElementById('expCategory')?.value || 'Operasional';
    const amount = Number(document.getElementById('expAmount')?.value || 0);
    const date = document.getElementById('expDate')?.value || new Date().toISOString().split('T')[0];

    if (!name || amount <= 0) {
      showToast('Nama biaya dan nominal harus diisi dengan benar.', 'error');
      return;
    }

    try {
      await addDoc(collection(db, 'expenses'), {
        name,
        category,
        amount,
        date,
        createdAt: serverTimestamp()
      });
      e.target.reset();
      window.closeModal('expenseModal');
      showToast('Biaya operasional berhasil disimpan.');
    } catch (err) {
      console.error('Gagal menyimpan biaya:', err);
      showToast('Gagal menyimpan biaya operasional.', 'error');
    }
  }

  // 2. Submit Tutup Buku Bulanan
  if (e.target.id === 'closeMonthForm') {
    e.preventDefault();
    const nextPeriodInput = document.getElementById('nextPeriodName')?.value.trim();
    if (!nextPeriodInput) {
      showToast('Masukkan nama periode bulan berikutnya.', 'error');
      return;
    }

    const { products, expenses, activePeriodName } = latestState;
    const summary = calculateFinanceSummary(products, expenses);

    try {
      await addDoc(collection(db, 'monthlyArchives'), {
        period: activePeriodName,
        turnover: summary.totalTurnover,
        grossProfit: summary.grossProfit,
        totalLoss: summary.totalLoss,
        expenses: summary.totalExpenses,
        netProfit: summary.netProfit,
        archivedAt: serverTimestamp()
      });

      const batch = writeBatch(db);

      products.forEach((p) => {
        const id = p.docId || p.id;
        if (id) {
          batch.update(doc(db, 'products', id), {
            outgoing: 0,
            supplierDamaged: 0,
            shippingDamaged: 0
          });
        }
      });

      expenses.forEach((exp) => {
        const id = exp.docId || exp.id;
        if (id) {
          batch.delete(doc(db, 'expenses', id));
        }
      });

      batch.set(doc(db, 'settings', 'financePeriod'), { activePeriod: nextPeriodInput }, { merge: true });

      await batch.commit();
      e.target.reset();
      window.closeModal('closeMonthModal');
      showToast(`Tutup buku ${activePeriodName} selesai!`);
    } catch (err) {
      console.error('Gagal tutup buku:', err);
      showToast('Terjadi kesalahan saat proses tutup buku.', 'error');
    }
  }
});
