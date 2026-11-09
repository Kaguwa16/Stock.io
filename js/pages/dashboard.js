import { formatIDR } from '../utils.js';

let outgoingChart, donutChart, categoryChart;

// Helper internal untuk mengganti teks elemen dengan aman
const setElementText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
};

export function renderDashboardPage(state) {
  if (!document.getElementById('kpiTotalAssetValue')) return; // Keluar jika bukan halaman index.html

  renderFinancialKPIs(state);
  renderFinanceView(state);
  renderFinancialCharts(state);
  renderLowStockAlerts(state);
  renderLossLeaderboard(state);
  renderTopOutgoingLeaderboard(state);
}

export function renderFinancialKPIs(state) {
  const products = state.products || [];
  const totalStockPcs = products.reduce((sum, p) => sum + Number(p.stock), 0);
  const totalAssetValue = products.reduce((sum, p) => sum + (Number(p.stock) * Number(p.hpp || 0)), 0);
  const totalTurnoverPotential = products.reduce((sum, p) => sum + (Number(p.stock) * Number(p.price || 0)), 0);
  const totalProfitPotential = totalTurnoverPotential - totalAssetValue;

  const totalLossPcs = products.reduce((sum, p) => sum + (Number(p.supplierDamaged || 0) + Number(p.shippingDamaged || 0)), 0);
  const totalLossValue = products.reduce((sum, p) => {
    const supLoss = Number(p.supplierDamaged || 0) * Number(p.hpp || 0);
    const shipLoss = Number(p.shippingDamaged || 0) * Number(p.price || 0);
    return sum + supLoss + shipLoss;
  }, 0);

  const lossRatio = totalAssetValue > 0 ? ((totalLossValue / totalAssetValue) * 100) : 0;

  setElementText('kpiTotalAssetValue', formatIDR(totalAssetValue));
  setElementText('kpiTotalStockPcs', totalStockPcs.toLocaleString('id-ID'));
  setElementText('kpiTotalSKU', products.length);
  setElementText('kpiTurnoverPotential', formatIDR(totalTurnoverPotential));
  setElementText('kpiProfitPotential', formatIDR(totalProfitPotential));
  setElementText('kpiTotalLossValue', formatIDR(totalLossValue));
  setElementText('kpiLossPcsBadge', `${totalLossPcs} Pcs`);
  setElementText('kpiLossRatio', `${lossRatio.toFixed(2)}%`);

  const lowCount = products.filter(p => p.stock <= p.minStock).length;
  setElementText('kpiLowStockCount', `${lowCount} SKU`);
}

export function renderFinanceView(state) {
  const products = state.products || [];
  const expenses = state.expenses || [];
  const monthlyArchives = state.monthlyArchives || [];
  const activePeriodName = state.activePeriodName || '';

  setElementText('activePeriodLabel', activePeriodName);

  const totalAssetValue = products.reduce((sum, p) => sum + (Number(p.stock) * Number(p.hpp || 0)), 0);
  const totalTurnover = products.reduce((sum, p) => sum + (Number(p.outgoing || 0) * Number(p.price || 0)), 0);
  const totalCogsSales = products.reduce((sum, p) => sum + (Number(p.outgoing || 0) * Number(p.hpp || 0)), 0);
  const grossProfit = totalTurnover - totalCogsSales;

  const lossSupplier = products.reduce((sum, p) => sum + (Number(p.supplierDamaged || 0) * Number(p.hpp || 0)), 0);
  const lossShipping = products.reduce((sum, p) => sum + (Number(p.shippingDamaged || 0) * Number(p.price || 0)), 0);
  const totalLoss = lossSupplier + lossShipping;

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = grossProfit - totalLoss - totalExpenses;

  setElementText('finValAsset', formatIDR(totalAssetValue));
  setElementText('finValTurnover', formatIDR(totalTurnover));
  setElementText('finValGrossProfit', formatIDR(grossProfit));
  setElementText('finValNetProfit', formatIDR(netProfit));

  setElementText('finLossSupplierNominal', formatIDR(lossSupplier));
  setElementText('finLossShippingNominal', formatIDR(lossShipping));
  setElementText('finTotalExpensesNominal', formatIDR(totalExpenses));

  const expContainer = document.getElementById('expenseListContainer');
  if (expContainer) {
    if (expenses.length === 0) {
      expContainer.innerHTML = '<div class="text-center py-6 text-slate-400 text-xs">Belum ada catatan biaya operasional bulan ini.</div>';
    } else {
      expContainer.innerHTML = expenses.map((exp) => `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition">
          <div>
            <span class="text-xs font-bold text-slate-800 block">${exp.name}</span>
            <span class="text-[10px] text-slate-400">${exp.category} &bull; ${exp.date}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-xs font-extrabold text-slate-700">${formatIDR(exp.amount)}</span>
            <button onclick="deleteExpense('${exp.docId}')" class="text-slate-400 hover:text-rose-600 p-1 text-xs">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  const archiveTbody = document.getElementById('archiveTableBody');
  if (archiveTbody) {
    if (monthlyArchives.length === 0) {
      archiveTbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-slate-400 text-xs">Belum ada arsip tutup buku periode sebelumnya.</td></tr>';
    } else {
      archiveTbody.innerHTML = monthlyArchives.map(arc => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="py-3 px-4 font-bold text-slate-800">${arc.period}</td>
          <td class="py-3 px-4 text-right font-semibold text-emerald-600">${formatIDR(arc.turnover)}</td>
          <td class="py-3 px-4 text-right font-semibold text-blue-600">${formatIDR(arc.grossProfit)}</td>
          <td class="py-3 px-4 text-right font-semibold text-rose-600">${formatIDR(arc.totalLoss)}</td>
          <td class="py-3 px-4 text-right font-semibold text-slate-600">${formatIDR(arc.expenses)}</td>
          <td class="py-3 px-4 text-right font-extrabold text-purple-700">${formatIDR(arc.netProfit)}</td>
        </tr>
      `).join('');
    }
  }
}

export function renderFinancialCharts(state) {
  const products = state.products || [];
  const categories = state.categories || [];

  // 1. Chart Omset vs Loss Retur Transit
  const ctxOut = document.getElementById('financialOutgoingChart')?.getContext('2d');
  if (ctxOut) {
    const sortedOut = [...products].sort((a, b) => (b.outgoing * (b.price || 0)) - (a.outgoing * (a.price || 0))).slice(0, 5);
    const labels = sortedOut.map(p => p.name.length > 14 ? p.name.substring(0, 14) + '...' : p.name);
    const turnoverData = sortedOut.map(p => p.outgoing * (p.price || 0));
    const shippingLossValData = sortedOut.map(p => (p.shippingDamaged || 0) * (p.price || 0));

    if (outgoingChart) outgoingChart.destroy();
    outgoingChart = new Chart(ctxOut, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Omset Terjual (Rp)', data: turnoverData, backgroundColor: '#10b981', borderRadius: 6 },
          { label: 'Loss Retur Transit (Rp)', data: shippingLossValData, backgroundColor: '#f43f5e', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#f1f5f9' } } }
      }
    });
  }

  // 2. Donut Chart Rasio Valuasi
  const ctxDonut = document.getElementById('financialDonutChart')?.getContext('2d');
  if (ctxDonut) {
    const totalAssetValue = products.reduce((sum, p) => sum + (Number(p.stock) * Number(p.hpp || 0)), 0);
    const totalTurnoverPotential = products.reduce((sum, p) => sum + (Number(p.stock) * Number(p.price || 0)), 0);
    const totalProfitPotential = totalTurnoverPotential - totalAssetValue;
    const totalLossValue = products.reduce((sum, p) => {
      return sum + ((p.supplierDamaged || 0) * (p.hpp || 0)) + ((p.shippingDamaged || 0) * (p.price || 0));
    }, 0);

    if (donutChart) donutChart.destroy();
    donutChart = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: ['Modal Aset', 'Potensi Profit', 'Rugi Loss QC'],
        datasets: [{
          data: [totalAssetValue || 1, totalProfitPotential > 0 ? totalProfitPotential : 0, totalLossValue],
          backgroundColor: ['#6366f1', '#10b981', '#f43f5e'],
          borderWidth: 2
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }
    });
  }

  // 3. Category Chart
  const ctxCat = document.getElementById('financialCategoryChart')?.getContext('2d');
  if (ctxCat) {
    const catValuations = {};
    const catLosses = {};
    categories.forEach(c => { catValuations[c] = 0; catLosses[c] = 0; });
    products.forEach(p => {
      const c = p.category || 'Lainnya';
      if (catValuations[c] === undefined) { catValuations[c] = 0; catLosses[c] = 0; }
      catValuations[c] += (Number(p.stock) * Number(p.hpp || 0));
      catLosses[c] += ((Number(p.supplierDamaged || 0) * Number(p.hpp || 0)) + (Number(p.shippingDamaged || 0) * Number(p.price || 0)));
    });

    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctxCat, {
      type: 'bar',
      data: {
        labels: Object.keys(catValuations),
        datasets: [
          { label: 'Valuasi Modal Aset (Rp)', data: Object.values(catValuations), backgroundColor: '#6366f1', borderRadius: 6 },
          { label: 'Nominal Loss QC (Rp)', data: Object.values(catLosses), backgroundColor: '#f59e0b', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
      }
    });
  }
}

export function renderLowStockAlerts(state) {
  const container = document.getElementById('lowStockContainer');
  if (!container) return;
  const products = state.products || [];
  const lowItems = products.filter(p => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock);

  if (lowItems.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400"><i class="fa-solid fa-circle-check text-3xl text-emerald-500 mb-2"></i><p class="text-xs font-semibold text-slate-600">Semua Stok Produk Aman</p></div>`;
    return;
  }

  container.innerHTML = lowItems.slice(0, 15).map(item => {
    const isOut = item.stock === 0;
    const badgeBg = isOut ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800';
    const badgeText = isOut ? 'HABIS' : 'MENIPIS';

    return `
      <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition">
        <div class="overflow-hidden pr-2">
          <div class="flex items-center space-x-2">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded ${badgeBg}">${badgeText}</span>
            <span class="text-xs font-mono text-slate-400">${item.id}</span>
          </div>
          <h4 class="font-bold text-xs text-slate-800 mt-1 truncate" title="${item.name}">${item.name}</h4>
          <p class="text-[11px] text-slate-500">Sisa Stok: <span class="font-bold ${isOut ? 'text-rose-600' : 'text-slate-700'}">${item.stock}</span> Pcs</p>
        </div>
        <button onclick="quickRestock('${item.docId}')" class="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shrink-0 shadow-sm transition">
          + Kulakan
        </button>
      </div>
    `;
  }).join('');
}

export function renderLossLeaderboard(state) {
  const container = document.getElementById('lossContainer');
  if (!container) return;
  const products = state.products || [];
  const lossItems = products.filter(p => (p.supplierDamaged || 0) > 0 || (p.shippingDamaged || 0) > 0)
    .sort((a, b) => {
      const lossA = (a.supplierDamaged || 0) * (a.hpp || 0) + (a.shippingDamaged || 0) * (a.price || 0);
      const lossB = (b.supplierDamaged || 0) * (b.hpp || 0) + (b.shippingDamaged || 0) * (b.price || 0);
      return lossB - lossA;
    });

  if (lossItems.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400"><i class="fa-solid fa-shield-halved text-3xl text-indigo-400 mb-2"></i><p class="text-xs font-semibold text-slate-600">Belum Ada Kerusakan / Barang Pecah</p></div>`;
    return;
  }

  container.innerHTML = lossItems.slice(0, 10).map((item) => {
    const totalVal = ((item.supplierDamaged || 0) * (item.hpp || 0)) + ((item.shippingDamaged || 0) * (item.price || 0));
    return `
      <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition space-y-1.5">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-xs text-slate-800 truncate" title="${item.name}">${item.name}</h4>
          <span class="text-xs font-extrabold text-rose-600">${formatIDR(totalVal)}</span>
        </div>
        <div class="flex items-center gap-2 text-[10px]">
          <span class="bg-rose-100 text-rose-700 font-semibold px-2 py-0.5 rounded">Supplier: ${item.supplierDamaged || 0} Pcs</span>
          <span class="bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded">Transit: ${item.shippingDamaged || 0} Pcs</span>
        </div>
      </div>
    `;
  }).join('');
}

export function renderTopOutgoingLeaderboard(state) {
  const container = document.getElementById('topOutgoingContainer');
  if (!container) return;
  const products = state.products || [];
  const sorted = [...products].sort((a, b) => (b.outgoing * (b.price || 0)) - (a.outgoing * (a.price || 0))).slice(0, 5);

  container.innerHTML = sorted.map((item, idx) => {
    const turnover = item.outgoing * (item.price || 0);
    return `
      <div class="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
        <div class="flex items-center space-x-3 overflow-hidden">
          <div class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0">${idx + 1}</div>
          <div class="overflow-hidden">
            <h4 class="font-semibold text-xs text-slate-800 truncate" title="${item.name}">${item.name}</h4>
            <p class="text-[10px] text-slate-400">${item.outgoing} Pcs terjual</p>
          </div>
        </div>
        <div class="text-right shrink-0 ml-2">
          <span class="font-extrabold text-xs text-emerald-600">${formatIDR(turnover)}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.forceCloudRefresh = function() {
      refreshDashboardData();
      window.showToast("Data berhasil disinkronkan!", "success");
    };
