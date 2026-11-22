import { state, saveState } from '../state.js';

// --- HELPER GLOBAL ---
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

// --- MODAL HANDLERS GLOBAL (Selalu center di tengah layar) ---
window.openModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  const today = new Date().toISOString().split('T')[0];
  if (modalId === 'incomeModal') {
    const incDate = document.getElementById('incDate');
    if (incDate && !incDate.value) incDate.value = today;
  } else if (modalId === 'expenseModal') {
    const expDate = document.getElementById('expDate');
    if (expDate && !expDate.value) expDate.value = today;
  }
};

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
  modal.style.display = 'none';
};

// --- DETEKSI TRANSAKSI OFFLINE & PENCOCOKAN KE KATALOG PRODUK ---
function isOfflineSale(sale) {
  if (!sale || typeof sale !== 'object') return false;
  if (sale.isOffline === true) return true;

  const fields = [
    sale.tipe,
    sale.type,
    sale.channel,
    sale.jenis,
    sale.kategori,
    sale.mode,
    sale.marketplace,
    sale.platform,
    sale.toko
  ];

  return fields.some((val) => {
    const str = String(val || '').toLowerCase().trim();
    return str === 'offline' || str === 'toko langsung' || str.includes('offline');
  });
}

function getProductName(product) {
  return String(product.name || product.nama || product.model || product.tipe || '')
    .trim()
    .toLowerCase();
}

function getProductPrice(product) {
  return Number(product.price ?? product.harga ?? product.hargaJual ?? 0);
}

function getProductHpp(product) {
  return Number(product.hpp ?? product.modal ?? product.hargaBeli ?? 0);
}

// Membersihkan teks seperti "INFINIX HOT 10 x1" -> { cleanName: "infinix hot 10", parsedQty: 1 }
function parseNameAndQty(rawText) {
  const str = String(rawText || '').trim();
  const match = str.match(/^(.*?)\s*[xX×]\s*(\d+)$/);
  if (match) {
    return {
      cleanName: match[1].trim().toLowerCase(),
      parsedQty: Number(match[2])
    };
  }
  return {
    cleanName: str.toLowerCase(),
    parsedQty: null
  };
}

function findCatalogProduct(products, itemObj) {
  if (!itemObj || typeof itemObj !== 'object') return null;

  // 1. Cek berdasarkan ID produk
  const targetId =
    itemObj.productId || itemObj.idProduk || itemObj.produkId || itemObj.catalogId || itemObj.itemId;
  if (targetId) {
    const byId = products.find(
      (p) => String(p.id) === String(targetId) || String(p.docId) === String(targetId)
    );
    if (byId) return byId;
  }

  // 2. Cek properti nama produk yang umum digunakan
  const candidateKeys = [
    itemObj.persamaanHp,
    itemObj.persamaan,
    itemObj.productName,
    itemObj.namaProduk,
    itemObj.name,
    itemObj.nama,
    itemObj.model,
    itemObj.tipeHp,
    itemObj.tipe,
    itemObj.produk,
    itemObj.barang,
    itemObj.title
  ];

  for (const val of candidateKeys) {
    if (!val) continue;
    const { cleanName } = parseNameAndQty(val);
    if (!cleanName) continue;
    const found = products.find((p) => getProductName(p) === cleanName);
    if (found) return found;
  }

  // 3. Fallback: Pindai seluruh nilai string pada objek untuk dicocokkan dengan nama di katalog
  const ignoredKeys = new Set([
    'id', 'docId', 'tanggal', 'date', 'status', 'marketplace', 'platform',
    'resi', 'tipe', 'type', 'channel', 'jenis', 'catatan', 'note', 'createdAt', 'updatedAt'
  ]);

  for (const [key, val] of Object.entries(itemObj)) {
    if (ignoredKeys.has(key) || typeof val !== 'string') continue;
    const { cleanName } = parseNameAndQty(val);
    if (!cleanName) continue;
    const found = products.find((p) => getProductName(p) === cleanName);
    if (found) return found;
  }

  return null;
}

function extractSaleEntries(sale) {
  // Cek jika transaksi menyimpan daftar barang dalam bentuk array (items / products / produk / barang / details)
  const itemList =
    (Array.isArray(sale.items) && sale.items) ||
    (Array.isArray(sale.products) && sale.products) ||
    (Array.isArray(sale.produk) && sale.produk) ||
    (Array.isArray(sale.barang) && sale.barang) ||
    (Array.isArray(sale.details) && sale.details) ||
    null;

  if (itemList && itemList.length > 0) {
    return itemList.map((it) => {
      const rawName =
        it.persamaanHp || it.persamaan || it.productName || it.namaProduk || it.name || it.nama || it.model || '';
      const { parsedQty } = parseNameAndQty(rawName);
      const explicitQty = it.qty ?? it.jumlah ?? it.pcs ?? it.quantity ?? it.count;
      return {
        rawObj: it,
        qty: Number(explicitQty ?? parsedQty ?? 1)
      };
    });
  }

  // Jika transaksi menyimpan 1 produk langsung di objek utama sale
  const rawName =
    sale.persamaanHp || sale.persamaan || sale.productName || sale.namaProduk || sale.name || sale.nama || sale.model || '';
  const { parsedQty } = parseNameAndQty(rawName);
  const explicitQty =
    sale.qty ?? sale.jumlah ?? sale.totalPcs ?? sale.jumlahPcs ?? sale.pcs ?? sale.quantity;

  return [
    {
      rawObj: sale,
      qty: Number(explicitQty ?? parsedQty ?? 1)
    }
  ];
}

// --- KALKULASI RINGKASAN KEUANGAN ---
function calculateFinanceSummary(products, expenses, incomes, sales) {
  // 1. Nilai Aset Stok Layak
  const totalAssetValue = products.reduce(
    (sum, p) => sum + Number(p.stock || 0) * getProductHpp(p),
    0
  );

  // 2. Hitung Omset & HPP khusus dari Penjualan Offline berdasarkan harga di Katalog Produk
  let offlineTurnover = 0;
  let totalCogsSales = 0;

  const offlineSales = (sales || []).filter(isOfflineSale);

  // Log diagnostik di Console (F12) untuk memastikan struktur data sales terbaca
  console.log('[Keuangan] Total sales:', (sales || []).length, '| Offline sales:', offlineSales);

  offlineSales.forEach((sale) => {
    const status = String(sale.status || '').toLowerCase();
    if (status === 'batal' || status === 'cancelled') return;

    const entries = extractSaleEntries(sale);
    entries.forEach(({ rawObj, qty }) => {
      if (qty <= 0) return;

      const catalogProd = findCatalogProduct(products, rawObj);
      const unitPrice = catalogProd
        ? getProductPrice(catalogProd)
        : Number(rawObj.price ?? rawObj.harga ?? 0);
      const unitHpp = catalogProd
        ? getProductHpp(catalogProd)
        : Number(rawObj.hpp ?? rawObj.modal ?? 0);

      offlineTurnover += qty * unitPrice;
      totalCogsSales += qty * unitHpp;
    });
  });

  // 3. Total Pendapatan Lain
  const totalOtherIncome = incomes.reduce((sum, inc) => sum + Number(inc.amount || 0), 0);

  // 4. Omset Penjualan = Penjualan Offline + Pendapatan Lain
  const totalTurnover = offlineTurnover + totalOtherIncome;

  // 5. Laba Kotor = Total Omset - Total HPP Terjual Offline
  const grossProfit = totalTurnover - totalCogsSales;

  // 6. Kerugian Barang Pecah
  const lossSupplier = products.reduce(
    (sum, p) => sum + Number(p.supplierDamaged || 0) * getProductHpp(p),
    0
  );
  const lossShipping = products.reduce(
    (sum, p) => sum + Number(p.shippingDamaged || 0) * getProductPrice(p),
    0
  );
  const totalLoss = lossSupplier + lossShipping;

  // 7. Biaya Operasional & Laba Bersih
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = grossProfit - totalLoss - totalExpenses;

  return {
    totalAssetValue,
    offlineTurnover,
    totalTurnover,
    grossProfit,
    totalOtherIncome,
    lossSupplier,
    lossShipping,
    totalLoss,
    totalExpenses,
    netProfit
  };
}

// --- RENDER HALAMAN KEUANGAN ---
export function renderKeuanganPage(currentState = state) {
  if (!document.getElementById('finValAsset')) return;

  const products = currentState.products || [];
  const expenses = currentState.expenses || [];
  const incomes = currentState.incomes || [];
  const sales = currentState.sales || [];
  const monthlyArchives = currentState.monthlyArchives || [];
  const activePeriodName = currentState.activePeriodName || 'November 2026';

  setElText('activePeriodLabel', activePeriodName);

  const summary = calculateFinanceSummary(products, expenses, incomes, sales);

  // 1. Update 4 Kartu Ringkasan Utama
  setElText('finValAsset', formatIDR(summary.totalAssetValue));
  setElText('finValTurnover', formatIDR(summary.totalTurnover));
  setElText('finValGrossProfit', formatIDR(summary.grossProfit));
  setElText('finValNetProfit', formatIDR(summary.netProfit));

  // 2. Update Rincian Arus & Kerugian Pecah
  setElText('finOfflineSalesNominal', formatIDR(summary.offlineTurnover));
  setElText('finTotalIncomeNominal', formatIDR(summary.totalOtherIncome));
  setElText('finLossSupplierNominal', formatIDR(summary.lossSupplier));
  setElText('finLossShippingNominal', formatIDR(summary.lossShipping));
  setElText('finTotalExpensesNominal', formatIDR(summary.totalExpenses));

  // 3. Render Log Pendapatan Lain Bulan Ini
  const incContainer = document.getElementById('incomeListContainer');
  if (incContainer) {
    if (incomes.length === 0) {
      incContainer.innerHTML =
        '<div class="text-center py-4 text-slate-400 text-xs">Belum ada catatan pendapatan lain bulan ini.</div>';
    } else {
      incContainer.innerHTML = incomes
        .map((inc, idx) => {
          const itemId = inc.id || inc.docId || String(idx);
          return `
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 hover:border-indigo-200 transition">
              <div>
                <span class="text-xs font-bold text-slate-800 block">${inc.source || inc.name}</span>
                <span class="text-[10px] text-indigo-500 font-medium">${inc.date || '-'}</span>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-xs font-extrabold text-indigo-700">+ ${formatIDR(inc.amount)}</span>
                <button onclick="deleteIncome('${itemId}')" title="Hapus Pendapatan" class="text-slate-400 hover:text-rose-600 p-1 text-xs">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  // 4. Render Log Biaya Operasional Bulan Ini
  const expContainer = document.getElementById('expenseListContainer');
  if (expContainer) {
    if (expenses.length === 0) {
      expContainer.innerHTML =
        '<div class="text-center py-4 text-slate-400 text-xs">Belum ada catatan biaya operasional bulan ini.</div>';
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
                <button onclick="deleteExpense('${itemId}')" title="Hapus Biaya" class="text-slate-400 hover:text-rose-600 p-1 text-xs">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  // 5. Render Tabel Arsip Bulanan (7 Kolom)
  const archiveTbody = document.getElementById('archiveTableBody');
  if (archiveTbody) {
    if (monthlyArchives.length === 0) {
      archiveTbody.innerHTML =
        '<tr><td colspan="7" class="text-center py-6 text-slate-400 text-xs">Belum ada arsip tutup buku periode sebelumnya.</td></tr>';
    } else {
      archiveTbody.innerHTML = monthlyArchives
        .map((arc, idx) => {
          const arcId = arc.id || arc.archivedAt || String(idx);
          const detailParts = [];
          if (Number(arc.offlineTurnover || 0) > 0) detailParts.push(`Offline: ${formatIDR(arc.offlineTurnover)}`);
          if (Number(arc.otherIncome || 0) > 0) detailParts.push(`Lainnya: ${formatIDR(arc.otherIncome)}`);
          const subDetail =
            detailParts.length > 0
              ? `<span class="block text-[10px] text-slate-400 font-normal">${detailParts.join(' + ')}</span>`
              : '';

          return `
            <tr class="hover:bg-slate-50 transition">
              <td class="py-3.5 px-4 font-bold text-slate-800">${arc.period}</td>
              <td class="py-3.5 px-4 text-right font-semibold text-emerald-600">
                ${formatIDR(arc.turnover)}
                ${subDetail}
              </td>
              <td class="py-3.5 px-4 text-right font-semibold text-blue-600">${formatIDR(arc.grossProfit)}</td>
              <td class="py-3.5 px-4 text-right font-semibold text-rose-600">${formatIDR(arc.totalLoss)}</td>
              <td class="py-3.5 px-4 text-right font-semibold text-slate-600">${formatIDR(arc.expenses)}</td>
              <td class="py-3.5 px-4 text-right font-extrabold text-purple-700">${formatIDR(arc.netProfit)}</td>
              <td class="py-3.5 px-4 text-center">
                <button onclick="deleteArchive('${arcId}')" title="Hapus Arsip Periode Ini" class="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition text-xs">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }
}

// --- AKSI HAPUS PENDAPATAN ---
window.deleteIncome = async function (targetId) {
  if (!targetId) return;
  if (!confirm('Hapus catatan pendapatan ini?')) return;

  state.incomes = (state.incomes || []).filter(
    (inc, idx) => String(inc.id || inc.docId || idx) !== String(targetId)
  );

  renderKeuanganPage(state);
  await saveState();
  notify('Catatan pendapatan berhasil dihapus.');
};

// --- AKSI HAPUS BIAYA OPERASIONAL ---
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

// --- AKSI HAPUS ARSIP BULANAN ---
window.deleteArchive = async function (targetId) {
  if (!targetId) return;
  if (!confirm('Hapus data arsip rekap keuangan bulanan ini secara permanen?')) return;

  state.monthlyArchives = (state.monthlyArchives || []).filter(
    (arc, idx) => String(arc.id || arc.archivedAt || idx) !== String(targetId)
  );

  renderKeuanganPage(state);
  await saveState();
  notify('Arsip rekap bulanan berhasil dihapus.');
};

// --- SUBMIT FORM MODAL (PENDAPATAN, BIAYA OPERASIONAL, & TUTUP BUKU) ---
document.addEventListener('submit', async (e) => {
  // 1. Tambah Pendapatan Lain
  if (e.target.id === 'incomeForm') {
    e.preventDefault();
    const date = document.getElementById('incDate')?.value || new Date().toISOString().split('T')[0];
    const amount = Number(document.getElementById('incAmount')?.value || 0);
    const source = document.getElementById('incSource')?.value.trim();

    if (!source || amount <= 0) {
      notify('Keterangan sumber dan nilai pendapatan harus diisi dengan benar.', 'error');
      return;
    }

    const newId = Date.now().toString();
    state.incomes = [
      {
        id: newId,
        docId: newId,
        date,
        amount,
        source
      },
      ...(state.incomes || [])
    ];

    e.target.reset();
    window.closeModal('incomeModal');
    renderKeuanganPage(state);
    await saveState();
    notify('Pendapatan berhasil dicatat.');
  }

  // 2. Tambah Biaya Operasional
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

  // 3. Tutup Buku Bulanan
  if (e.target.id === 'closeMonthForm') {
    e.preventDefault();
    const nextPeriodInput = document.getElementById('nextPeriodName')?.value.trim();
    if (!nextPeriodInput) {
      notify('Masukkan nama periode bulan berikutnya.', 'error');
      return;
    }

    const summary = calculateFinanceSummary(
      state.products || [],
      state.expenses || [],
      state.incomes || [],
      state.sales || []
    );

    const archiveId = Date.now().toString();
    state.monthlyArchives = [
      {
        id: archiveId,
        period: state.activePeriodName || 'November 2026',
        turnover: summary.totalTurnover,
        offlineTurnover: summary.offlineTurnover,
        otherIncome: summary.totalOtherIncome,
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

    // Hapus hanya penjualan offline periode berjalan (penjualan online tetap dipertahankan)
    state.sales = (state.sales || []).filter((s) => !isOfflineSale(s));
    state.expenses = [];
    state.incomes = [];
    state.activePeriodName = nextPeriodInput;

    e.target.reset();
    window.closeModal('closeMonthModal');
    renderKeuanganPage(state);
    await saveState();
    notify(`Tutup buku selesai! Periode aktif sekarang: ${nextPeriodInput}`);
  }
});
