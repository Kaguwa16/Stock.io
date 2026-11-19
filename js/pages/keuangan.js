import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  serverTimestamp
} 
// --- STATE LOKAL ---
let products = [];
let expenses = [];
let monthlyArchives = [];
let activePeriodName = "November 2026";

// --- HELPER GLOBAL (Fallback jika belum didefinisikan di main.js) ---
window.formatIDR = window.formatIDR || function (angka) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(Number(angka) || 0);
};

window.setElText = window.setElText || function (id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

window.showToast = window.showToast || function (message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const bgColor = type === "error" ? "bg-rose-600" : "bg-slate-900";
  const icon = type === "error" ? "fa-circle-exclamation" : "fa-circle-check text-emerald-400";

  const toast = document.createElement("div");
  toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center space-x-2.5 transform transition-all duration-300 translate-y-2 opacity-0`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove("translate-y-2", "opacity-0"));

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// --- MODAL HANDLERS (Untuk tombol onclick di HTML) ---
window.openModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
};

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

// --- KALKULASI KEUANGAN TERPUSAT ---
function calculateFinanceSummary() {
  const totalAssetValue = products.reduce(
    (sum, p) => sum + Number(p.stock || 0) * Number(p.hpp || 0),
    0
  );
  const totalTurnover = products.reduce(
    (sum, p) => sum + Number(p.outgoing || 0) * Number(p.price || 0),
    0
  );
  const totalCogsSales = products.reduce(
    (sum, p) => sum + Number(p.outgoing || 0) * Number(p.hpp || 0),
    0
  );
  const grossProfit = totalTurnover - totalCogsSales;

  const lossSupplier = products.reduce(
    (sum, p) => sum + Number(p.supplierDamaged || 0) * Number(p.hpp || 0),
    0
  );
  const lossShipping = products.reduce(
    (sum, p) => sum + Number(p.shippingDamaged || 0) * Number(p.price || 0),
    0
  );
  const totalLoss = lossSupplier + lossShipping;

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = grossProfit - totalLoss - totalExpenses;

  return {
    totalAssetValue,
    totalTurnover,
    totalCogsSales,
    grossProfit,
    lossSupplier,
    lossShipping,
    totalLoss,
    totalExpenses,
    netProfit
  };
}

// --- RENDER TAMPILAN KEUANGAN ---
export function renderFinanceView() {
  window.setElText("activePeriodLabel", activePeriodName);

  const summary = calculateFinanceSummary();

  // 1. Update 4 Kartu Ringkasan Utama
  window.setElText("finValAsset", window.formatIDR(summary.totalAssetValue));
  window.setElText("finValTurnover", window.formatIDR(summary.totalTurnover));
  window.setElText("finValGrossProfit", window.formatIDR(summary.grossProfit));
  window.setElText("finValNetProfit", window.formatIDR(summary.netProfit));

  // 2. Update Rincian Kerugian Pecah & Total Biaya
  window.setElText("finLossSupplierNominal", window.formatIDR(summary.lossSupplier));
  window.setElText("finLossShippingNominal", window.formatIDR(summary.lossShipping));
  window.setElText("finTotalExpensesNominal", window.formatIDR(summary.totalExpenses));

  // 3. Render Log Biaya Operasional Bulan Ini
  const expContainer = document.getElementById("expenseListContainer");
  if (expContainer) {
    if (expenses.length === 0) {
      expContainer.innerHTML =
        '<div class="text-center py-8 text-slate-400 text-xs">Belum ada catatan biaya operasional bulan ini.</div>';
    } else {
      expContainer.innerHTML = expenses
        .map(
          (exp) => `
          <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition">
            <div>
              <span class="text-xs font-bold text-slate-800 block">${exp.name}</span>
              <span class="text-[10px] text-slate-400">${exp.category || "Operasional"} &bull; ${exp.date || "-"}</span>
            </div>
            <div class="flex items-center space-x-2">
              <span class="text-xs font-extrabold text-slate-700">${window.formatIDR(exp.amount)}</span>
              <button onclick="deleteExpense('${exp.docId}')" title="Hapus Biaya" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition text-xs">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        `
        )
        .join("");
    }
  }

  // 4. Render Tabel Arsip Bulanan (Disesuaikan menjadi 6 kolom sesuai thead di keuangan.html)
  const archiveTbody = document.getElementById("archiveTableBody");
  if (archiveTbody) {
    if (monthlyArchives.length === 0) {
      archiveTbody.innerHTML =
        '<tr><td colspan="6" class="text-center py-8 text-slate-400 text-xs">Belum ada arsip tutup buku periode sebelumnya.</td></tr>';
    } else {
      archiveTbody.innerHTML = monthlyArchives
        .map(
          (arc) => `
          <tr class="hover:bg-slate-50 transition">
            <td class="py-3.5 px-4 font-bold text-slate-800">${arc.period}</td>
            <td class="py-3.5 px-4 text-right font-semibold text-emerald-600">${window.formatIDR(arc.turnover)}</td>
            <td class="py-3.5 px-4 text-right font-semibold text-blue-600">${window.formatIDR(arc.grossProfit)}</td>
            <td class="py-3.5 px-4 text-right font-semibold text-rose-600">${window.formatIDR(arc.totalLoss)}</td>
            <td class="py-3.5 px-4 text-right font-semibold text-slate-600">${window.formatIDR(arc.expenses)}</td>
            <td class="py-3.5 px-4 text-right font-extrabold text-purple-700">${window.formatIDR(arc.netProfit)}</td>
          </tr>
        `
        )
        .join("");
    }
  }
}

// --- AKSI CRUD: TAMBAH & HAPUS BIAYA OPERASIONAL ---
async function handleAddExpense(e) {
  e.preventDefault();
  const name = document.getElementById("expName")?.value.trim();
  const category = document.getElementById("expCategory")?.value || "Operasional";
  const amount = Number(document.getElementById("expAmount")?.value || 0);
  const date = document.getElementById("expDate")?.value || new Date().toISOString().split("T")[0];

  if (!name || amount <= 0) {
    window.showToast("Nama biaya dan nominal harus diisi dengan benar.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "expenses"), {
      name,
      category,
      amount,
      date,
      createdAt: serverTimestamp()
    });
    e.target.reset();
    window.closeModal("expenseModal");
    window.showToast("Biaya operasional berhasil dicatat.");
  } catch (err) {
    console.error("Gagal menambah biaya:", err);
    window.showToast("Gagal menyimpan biaya operasional.", "error");
  }
}

window.deleteExpense = async function (docId) {
  if (!docId) return;
  if (!confirm("Hapus catatan biaya operasional ini?")) return;

  try {
    await deleteDoc(doc(db, "expenses", docId));
    window.showToast("Biaya operasional dihapus.");
  } catch (err) {
    console.error("Gagal menghapus biaya:", err);
    window.showToast("Gagal menghapus data.", "error");
  }
};

// --- AKSI TUTUP BUKU BULANAN ---
async function handleCloseMonth(e) {
  e.preventDefault();
  const nextPeriodInput = document.getElementById("nextPeriodName")?.value.trim();
  if (!nextPeriodInput) {
    window.showToast("Masukkan nama periode bulan berikutnya.", "error");
    return;
  }

  const summary = calculateFinanceSummary();

  try {
    // 1. Simpan rekap periode berjalan ke koleksi monthlyArchives
    await addDoc(collection(db, "monthlyArchives"), {
      period: activePeriodName,
      turnover: summary.totalTurnover,
      grossProfit: summary.grossProfit,
      totalLoss: summary.totalLoss,
      expenses: summary.totalExpenses,
      netProfit: summary.netProfit,
      archivedAt: serverTimestamp()
    });

    // 2. Batch Reset counter bulanan produk & hapus biaya operasional bulan berjalan
    const batch = writeBatch(db);

    products.forEach((p) => {
      const pRef = doc(db, "products", p.docId);
      batch.update(pRef, {
        outgoing: 0,
        supplierDamaged: 0,
        shippingDamaged: 0
      });
    });

    expenses.forEach((exp) => {
      const eRef = doc(db, "expenses", exp.docId);
      batch.delete(eRef);
    });

    // 3. Perbarui nama periode aktif
    const settingsRef = doc(db, "settings", "financePeriod");
    batch.set(settingsRef, { activePeriod: nextPeriodInput }, { merge: true });

    await batch.commit();

    e.target.reset();
    window.closeModal("closeMonthModal");
    window.showToast(`Tutup buku ${activePeriodName} selesai!`);
  } catch (err) {
    console.error("Gagal melakukan tutup buku:", err);
    window.showToast("Terjadi kesalahan saat tutup buku.", "error");
  }
}
