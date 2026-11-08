import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==================== KONFIGURASI FIREBASE ====================
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-stock-app-id';
const firebaseConfig = {
  apiKey: "AIzaSyCpkSNCxVKr7pQz6mKZKqlJGz4-k6pMCMQ",
  authDomain: "monitor-stock-1dab6.firebaseapp.com",
  projectId: "monitor-stock-1dab6",
  storageBucket: "monitor-stock-1dab6.firebasestorage.app",
  messagingSenderId: "28635188865",
  appId: "1:28635188865:web:3921fbe9c21f4c4d0bc780",
  measurementId: "G-KE8B9FG4H8"
};

let app, db, auth;
let currentUser = null;
let isOfflineFallbackMode = false;

// ==================== STATE APLIKASI ====================
let products = [];
let categories = ["Tempered Glass", "Hydrogel", "Casing", "Kabel & Charger", "Aksesoris"];
let expenses = [];
let monthlyArchives = [];
let activePeriodName = "November 2026";

let currentPage = 1;
const itemsPerPage = 10;
let outgoingChartInstance = null;
let donutChartInstance = null;
let categoryChartInstance = null;

// Katalog Default (83 Tipe Produk)
const rawProductNames = [
  "INFINIX HOT 10", "INFINIX HOT 9", "INFINIX HOT 9 PLAY", "INFINIX NOTE 10", "INFINIX NOTE 7", "INFINIX NOTE 8", "INFINIX SMART 5",
  "IPHONE 11", "IPHONE 11 PRO MAX", "IPHONE 12", "IPHONE 12 PRO MAX", "IPHONE 13 MINI", "IPHONE 13 PRO MAX", "IPHONE 14", "IPHONE 15 PRO MAX", "IPHONE 16", "IPHONE 16 PRO MAX", "IPHONE 16 PRO", "IPHONE 7", "IPHONE 8", "IPHONE 8 PLUS", "IPHONE X",
  "OPPO A1K", "OPPO A3S", "OPPO A39", "OPPO A6", "OPPO A92S", "OPPO A93", "OPPO FIND X", "OPPO NEO 7", "OPPO A52", "OPPO F3+",
  "REDMI 12", "REDMI 5", "REDMI 6", "REDMI 6 PRO", "REDMI 7", "REDMI 9", "REDMI NOTE 5A", "REDMI NOTE 6 PRO",
  "SAMSUNG A01", "SAMSUNG A01 CORE", "SAMSUNG A05", "SAMSUNG A11", "SAMSUNG A15", "SAMSUNG A20", "SAMSUNG A320 / A3 2017", "SAMSUNG A34", "SAMSUNG A35", "SAMSUNG A40", "SAMSUNG A51", "SAMSUNG A54", "SAMSUNG A6", "SAMSUNG A60", "SAMSUNG A7 2018", "SAMSUNG A71", "SAMSUNG A80", "SAMSUNG A9 2018", "SAMSUNG J2 PRIME", "SAMSUNG J5 2016", "SAMSUNG M20", "SAMSUNG M21", "SAMSUNG NOTE 3",
  "VIVO V15", "VIVO V17", "VIVO V19 INTER", "VIVO V23 5G", "VIVO V70 5G", "VIVO V9", "VIVO Y53", "VIVO Y67", "VIVO Y91",
  "XIAOMI MI 10T", "XIAOMI MI 4", "XIAOMI MI 6", "XIAOMI MI 8", "XIAOMI MI A3", "XIAOMI MI MIX 3", "XIAOMI MI PLAY", "XIAOMI POCO C40", "XIAOMI POCO C75", "XIAOMI POCO C81", "XIAOMI POCO X2"
];

// ==================== HELPER UTILITY ====================
function getBrandName(name) {
  const upper = name.toUpperCase();
  if (upper.startsWith('INFINIX')) return 'Infinix';
  if (upper.startsWith('IPHONE')) return 'iPhone';
  if (upper.startsWith('OPPO')) return 'Oppo';
  if (upper.startsWith('REDMI')) return 'Redmi';
  if (upper.startsWith('SAMSUNG')) return 'Samsung';
  if (upper.startsWith('VIVO')) return 'Vivo';
  if (upper.startsWith('XIAOMI')) return 'Xiaomi';
  return 'Lainnya';
}

window.setElText = function(id, txt) {
  const el = document.getElementById(id);
  if (el) el.innerText = txt;
};

window.formatIDR = function(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);
};

window.showToast = function(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  let iconClass = 'fa-circle-check text-emerald-500';
  let borderClass = 'border-emerald-200';

  if (type === 'error') {
    iconClass = 'fa-circle-xmark text-rose-500';
    borderClass = 'border-rose-200';
  } else if (type === 'warning') {
    iconClass = 'fa-triangle-exclamation text-amber-500';
    borderClass = 'border-amber-200';
  } else if (type === 'info') {
    iconClass = 'fa-circle-info text-blue-500';
    borderClass = 'border-blue-200';
  }

  toast.className = `pointer-events-auto flex items-center space-x-3 bg-white border ${borderClass} px-4 py-3 rounded-xl shadow-lg transform transition-all duration-300 translate-y-2 opacity-0 max-w-sm`;
  toast.innerHTML = `<i class="fa-solid ${iconClass} text-lg"></i><p class="text-xs font-semibold text-slate-700 leading-tight">${message}</p>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

// ==================== INISIALISASI SAAT DOM READY ====================
window.addEventListener('DOMContentLoaded', async () => {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = user;
        const uidDisplay = document.getElementById('authUserIdDisplay');
        if (uidDisplay) {
          uidDisplay.innerText = `Online: ${user.email || user.uid.substring(0, 8)}`;
        }
        initCloudSync();
      } else {
        window.location.href = "login.html";
      }
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await signOut(auth);
          window.location.href = "login.html";
        } catch (error) {
          console.error("Gagal logout:", error);
        }
      });
    }
  } catch (err) {
    console.error("Gagal menginisialisasi Firebase:", err);
    activateLocalStorageFallbackMode();
  }

  initRealtimeClock();
  setupEventListeners();
});

// ==================== CLOUD SYNC & FALLBACK LOCALSTORAGE ====================
function initCloudSync() {
  if (!currentUser || !db) return;
  const storeRef = doc(db, 'artifacts', appId, 'dashboard_store', 'main_state');

  onSnapshot(storeRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      products = data.products || [];
      categories = data.categories || ["Tempered Glass", "Hydrogel", "Casing", "Kabel & Charger", "Aksesoris"];
      expenses = data.expenses || [];
      monthlyArchives = data.monthlyArchives || [];
      activePeriodName = data.activePeriodName || "November 2026";
    } else {
      seedDefaultState(storeRef);
    }
    refreshDashboardData();
    renderCategoryDropdowns();
    renderCategoryManagementList();
  }, (error) => {
    console.warn("Firestore error, beralih ke mode offline:", error);
    activateLocalStorageFallbackMode();
  });
}

async function seedDefaultState(storeRef) {
  if (!currentUser || !db || isOfflineFallbackMode) return;
  try {
    const initialProducts = rawProductNames.map((name, index) => ({
      docId: `prod_${index + 1}`,
      id: `TG-${String(index + 1).padStart(3, '0')}`,
      name: name,
      category: 'Tempered Glass',
      brand: getBrandName(name),
      hpp: 0,
      price: 0,
      stock: 0,
      minStock: 10,
      unit: 'Pcs',
      outgoing: 0,
      supplierDamaged: 0,
      shippingDamaged: 0
    }));

    const initialState = {
      products: initialProducts,
      categories: ["Tempered Glass", "Hydrogel", "Casing", "Kabel & Charger", "Aksesoris"],
      expenses: [],
      monthlyArchives: [],
      activePeriodName: "November 2026",
      updatedAt: new Date().toISOString()
    };

    await setDoc(storeRef, initialState);
  } catch (err) {
    console.warn("Gagal seeding default state:", err);
    activateLocalStorageFallbackMode();
  }
}

async function saveStateToCloud() {
  if (isOfflineFallbackMode || !db || !currentUser) return;
  try {
    const storeRef = doc(db, 'artifacts', appId, 'dashboard_store', 'main_state');
    await setDoc(storeRef, {
      products: products,
      categories: categories,
      expenses: expenses,
      monthlyArchives: monthlyArchives,
      activePeriodName: activePeriodName,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error("Gagal menyimpan ke cloud:", err);
    activateLocalStorageFallbackMode();
  }
}

function activateLocalStorageFallbackMode() {
  isOfflineFallbackMode = true;
  const uidDisplay = document.getElementById('authUserIdDisplay');
  if (uidDisplay) uidDisplay.innerText = `Mode Lokal (Standalone)`;

  const indicator = document.getElementById('syncStatusIndicator');
  if (indicator) {
    indicator.classList.remove('bg-emerald-400');
    indicator.classList.add('bg-amber-400');
  }

  const localProds = localStorage.getItem('stock_prods_fallback_v1');
  if (localProds) {
    products = JSON.parse(localProds);
  } else {
    products = rawProductNames.map((name, index) => ({
      docId: `local-${index + 1}`,
      id: `TG-${String(index + 1).padStart(3, '0')}`,
      name: name,
      category: 'Tempered Glass',
      brand: getBrandName(name),
      hpp: 0,
      price: 0,
      stock: 0,
      minStock: 10,
      unit: 'Pcs',
      outgoing: 0,
      supplierDamaged: 0,
      shippingDamaged: 0
    }));
    localStorage.setItem('stock_prods_fallback_v1', JSON.stringify(products));
  }

  const localCats = localStorage.getItem('stock_cats_fallback_v1');
  if (localCats) categories = JSON.parse(localCats);

  const localExps = localStorage.getItem('stock_exps_fallback_v1');
  if (localExps) expenses = JSON.parse(localExps);

  const localArcs = localStorage.getItem('stock_arcs_fallback_v1');
  if (localArcs) monthlyArchives = JSON.parse(localArcs);

  renderCategoryDropdowns();
  renderCategoryManagementList();
  refreshDashboardData();
}

function saveLocalStorageFallback() {
  if (!isOfflineFallbackMode) return;
  localStorage.setItem('stock_prods_fallback_v1', JSON.stringify(products));
  localStorage.setItem('stock_cats_fallback_v1', JSON.stringify(categories));
  localStorage.setItem('stock_exps_fallback_v1', JSON.stringify(expenses));
  localStorage.setItem('stock_arcs_fallback_v1', JSON.stringify(monthlyArchives));
  refreshDashboardData();
}

window.forceCloudRefresh = function() {
  refreshDashboardData();
  window.showToast("Data berhasil disinkronkan!", "success");
};

// ==================== EVENT LISTENERS & UI NAVIGATION ====================
function setupEventListeners() {
  const globalSearch = document.getElementById('globalSearchInput');
  const tableSearch = document.getElementById('tableSearchInput');
  const catFilter = document.getElementById('categoryFilter');
  const brandFilter = document.getElementById('brandFilter');
  const statusFilter = document.getElementById('statusFilter');

  if (globalSearch) globalSearch.addEventListener('input', () => { currentPage = 1; renderMasterTable(); });
  if (tableSearch) tableSearch.addEventListener('input', () => { currentPage = 1; renderMasterTable(); });
  if (catFilter) catFilter.addEventListener('change', () => { currentPage = 1; renderMasterTable(); });
  if (brandFilter) brandFilter.addEventListener('change', () => { currentPage = 1; renderMasterTable(); });
  if (statusFilter) statusFilter.addEventListener('change', () => { currentPage = 1; renderMasterTable(); });

  const openSidebarBtn = document.getElementById('openSidebarMobile');
  if (openSidebarBtn) {
    openSidebarBtn.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('-translate-x-full');
      document.getElementById('sidebarOverlay')?.classList.remove('hidden');
    });
  }

  const closeSidebar = () => {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebarOverlay')?.classList.add('hidden');
  };

  const closeSidebarBtn = document.getElementById('closeSidebarMobile');
  const overlayBtn = document.getElementById('sidebarOverlay');
  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
  if (overlayBtn) overlayBtn.addEventListener('click', closeSidebar);
}

window.switchView = function(viewName) {
  const views = ['dashboard', 'finance', 'catalog'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const nav = document.getElementById(`nav-${v}`);
    if (el) {
      if (v === viewName) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
    if (nav) {
      if (v === viewName) {
        nav.classList.add('bg-indigo-600', 'text-white');
        nav.classList.remove('text-slate-400', 'hover:bg-slate-800', 'hover:text-white');
      } else {
        nav.classList.remove('bg-indigo-600', 'text-white');
        nav.classList.add('text-slate-400', 'hover:bg-slate-800', 'hover:text-white');
      }
    }
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function initRealtimeClock() {
  const clockEl = document.getElementById('realtimeClock');
  function update() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    if (clockEl) {
      clockEl.innerHTML = `<i class="fa-regular fa-clock text-indigo-500"></i> ${now.toLocaleDateString('id-ID', options)} WIB`;
    }
  }
  update();
  setInterval(update, 1000);
}

// ==================== RENDERING DASHBOARD & FINANSIAL ====================
function refreshDashboardData() {
  renderFinancialKPIs();
  renderFinanceView();
  renderFinancialCharts();
  renderLowStockAlerts();
  renderLossLeaderboard();
  renderTopOutgoingLeaderboard();
  renderMasterTable();
  populateTransactionProductSelect();
  renderCategoryManagementList();
}

function renderFinancialKPIs() {
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

  window.setElText('kpiTotalAssetValue', window.formatIDR(totalAssetValue));
  window.setElText('kpiTotalStockPcs', totalStockPcs.toLocaleString('id-ID'));
  window.setElText('kpiTotalSKU', products.length);

  window.setElText('kpiTurnoverPotential', window.formatIDR(totalTurnoverPotential));
  window.setElText('kpiProfitPotential', window.formatIDR(totalProfitPotential));
  window.setElText('kpiTotalLossValue', window.formatIDR(totalLossValue));
  window.setElText('kpiLossPcsBadge', `${totalLossPcs} Pcs`);
  window.setElText('kpiLossRatio', `${lossRatio.toFixed(2)}%`);

  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const lowCount = lowStockProducts.length;
  window.setElText('kpiLowStockCount', `${lowCount} SKU`);
  window.setElText('navLowStockBadge', lowCount);
  window.setElText('lowStockBadgeHeader', `${lowCount} Item`);
}

function renderFinanceView() {
  window.setElText('activePeriodLabel', activePeriodName);

  const totalAssetValue = products.reduce((sum, p) => sum + (Number(p.stock) * Number(p.hpp || 0)), 0);
  const totalTurnover = products.reduce((sum, p) => sum + (Number(p.outgoing || 0) * Number(p.price || 0)), 0);
  const totalCogsSales = products.reduce((sum, p) => sum + (Number(p.outgoing || 0) * Number(p.hpp || 0)), 0);
  const grossProfit = totalTurnover - totalCogsSales;

  const lossSupplier = products.reduce((sum, p) => sum + (Number(p.supplierDamaged || 0) * Number(p.hpp || 0)), 0);
  const lossShipping = products.reduce((sum, p) => sum + (Number(p.shippingDamaged || 0) * Number(p.price || 0)), 0);
  const totalLoss = lossSupplier + lossShipping;

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = grossProfit - totalLoss - totalExpenses;

  window.setElText('finValAsset', window.formatIDR(totalAssetValue));
  window.setElText('finValTurnover', window.formatIDR(totalTurnover));
  window.setElText('finValGrossProfit', window.formatIDR(grossProfit));
  window.setElText('finValNetProfit', window.formatIDR(netProfit));

  window.setElText('finLossSupplierNominal', window.formatIDR(lossSupplier));
  window.setElText('finLossShippingNominal', window.formatIDR(lossShipping));
  window.setElText('finTotalExpensesNominal', window.formatIDR(totalExpenses));

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
            <span class="text-xs font-extrabold text-slate-700">${window.formatIDR(exp.amount)}</span>
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
      archiveTbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400 text-xs">Belum ada arsip tutup buku periode sebelumnya.</td></tr>';
    } else {
      archiveTbody.innerHTML = monthlyArchives.map(arc => `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-3 px-4 font-bold text-slate-800">${arc.period}</td>
          <td class="py-3 px-4 text-right font-semibold text-emerald-600">${window.formatIDR(arc.turnover)}</td>
          <td class="py-3 px-4 text-right font-semibold text-blue-600">${window.formatIDR(arc.grossProfit)}</td>
          <td class="py-3 px-4 text-right font-semibold text-rose-600">${window.formatIDR(arc.totalLoss)}</td>
          <td class="py-3 px-4 text-right font-semibold text-slate-600">${window.formatIDR(arc.expenses)}</td>
          <td class="py-3 px-4 text-right font-extrabold text-purple-700">${window.formatIDR(arc.netProfit)}</td>
          <td class="py-3 px-4 text-center"><span class="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full">TERARSIP</span></td>
        </tr>
      `).join('');
    }
  }
}

// ==================== RENDERING GRAFIK CHART.JS ====================
function renderFinancialCharts() {
  const sortedOut = [...products].sort((a, b) => (b.outgoing * (b.price || 0)) - (a.outgoing * (a.price || 0))).slice(0, 5);
  const labels = sortedOut.map(p => p.name.length > 14 ? p.name.substring(0, 14) + '...' : p.name);
  const turnoverData = sortedOut.map(p => p.outgoing * (p.price || 0));
  const shippingLossValData = sortedOut.map(p => (p.shippingDamaged || 0) * (p.price || 0));

  const ctxOut = document.getElementById('financialOutgoingChart')?.getContext('2d');
  if (ctxOut) {
    if (outgoingChartInstance) outgoingChartInstance.destroy();
    outgoingChartInstance = new Chart(ctxOut, {
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

  const totalAssetValue = products.reduce((sum, p) => sum + (Number(p.stock) * Number(p.hpp || 0)), 0);
  const totalTurnoverPotential = products.reduce((sum, p) => sum + (Number(p.stock) * Number(p.price || 0)), 0);
  const totalProfitPotential = totalTurnoverPotential - totalAssetValue;
  const totalLossValue = products.reduce((sum, p) => {
    const supLoss = Number(p.supplierDamaged || 0) * Number(p.hpp || 0);
    const shipLoss = Number(p.shippingDamaged || 0) * Number(p.price || 0);
    return sum + supLoss + shipLoss;
  }, 0);

  window.setElText('donutAssetVal', window.formatIDR(totalAssetValue));
  window.setElText('donutProfitVal', window.formatIDR(totalProfitPotential));
  window.setElText('donutLossVal', window.formatIDR(totalLossValue));

  const ctxDonut = document.getElementById('financialDonutChart')?.getContext('2d');
  if (ctxDonut) {
    if (donutChartInstance) donutChartInstance.destroy();
    donutChartInstance = new Chart(ctxDonut, {
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

  const catValuations = {};
  const catLosses = {};
  categories.forEach(c => { catValuations[c] = 0; catLosses[c] = 0; });
  products.forEach(p => {
    const c = p.category || 'Lainnya';
    if (catValuations[c] === undefined) { catValuations[c] = 0; catLosses[c] = 0; }
    catValuations[c] += (Number(p.stock) * Number(p.hpp || 0));
    catLosses[c] += ((Number(p.supplierDamaged || 0) * Number(p.hpp || 0)) + (Number(p.shippingDamaged || 0) * Number(p.price || 0)));
  });

  const ctxCat = document.getElementById('financialCategoryChart')?.getContext('2d');
  if (ctxCat) {
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctxCat, {
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

// ==================== RENDERING WIDGET & AUDIT LOGS ====================
function renderLowStockAlerts() {
  const container = document.getElementById('lowStockContainer');
  if (!container) return;
  const lowItems = products.filter(p => p.stock <= p.minStock).sort((a,b) => a.stock - b.stock);

  if (lowItems.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400">
        <i class="fa-solid fa-circle-check text-3xl text-emerald-500 mb-2"></i>
        <p class="text-xs font-semibold text-slate-600">Semua Stok Produk Aman</p>
      </div>`;
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

function renderLossLeaderboard() {
  const container = document.getElementById('lossContainer');
  if (!container) return;
  const lossItems = products.filter(p => (p.supplierDamaged || 0) > 0 || (p.shippingDamaged || 0) > 0)
                            .sort((a, b) => {
                              const lossA = (a.supplierDamaged||0)*(a.hpp||0) + (a.shippingDamaged||0)*(a.price||0);
                              const lossB = (b.supplierDamaged||0)*(b.hpp||0) + (b.shippingDamaged||0)*(b.price||0);
                              return lossB - lossA;
                            });

  if (lossItems.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400">
        <i class="fa-solid fa-shield-halved text-3xl text-indigo-400 mb-2"></i>
        <p class="text-xs font-semibold text-slate-600">Belum Ada Kerusakan / Barang Pecah</p>
      </div>`;
    return;
  }

  container.innerHTML = lossItems.slice(0, 10).map((item) => {
    const supLossVal = (item.supplierDamaged || 0) * (item.hpp || 0);
    const shipLossVal = (item.shippingDamaged || 0) * (item.price || 0);
    const totalVal = supLossVal + shipLossVal;

    return `
      <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition space-y-1.5">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-xs text-slate-800 truncate" title="${item.name}">${item.name}</h4>
          <span class="text-xs font-extrabold text-rose-600">${window.formatIDR(totalVal)}</span>
        </div>
        <div class="flex items-center gap-2 text-[10px]">
          <span class="bg-rose-100 text-rose-700 font-semibold px-2 py-0.5 rounded">Supplier: ${item.supplierDamaged||0} Pcs</span>
          <span class="bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded">Transit: ${item.shippingDamaged||0} Pcs</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderTopOutgoingLeaderboard() {
  const container = document.getElementById('topOutgoingContainer');
  if (!container) return;
  const sorted = [...products].sort((a, b) => (b.outgoing * (b.price||0)) - (a.outgoing * (a.price||0))).slice(0, 5);

  container.innerHTML = sorted.map((item, idx) => {
    const turnover = item.outgoing * (item.price || 0);
    return `
      <div class="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
        <div class="flex items-center space-x-3 overflow-hidden">
          <div class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0">
            ${idx + 1}
          </div>
          <div class="overflow-hidden">
            <h4 class="font-semibold text-xs text-slate-800 truncate" title="${item.name}">${item.name}</h4>
            <p class="text-[10px] text-slate-400">${item.outgoing} Pcs terjual</p>
          </div>
        </div>
        <div class="text-right shrink-0 ml-2">
          <span class="font-extrabold text-xs text-emerald-600">${window.formatIDR(turnover)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== MASTER KATALOG & TABEL ====================
function renderCategoryDropdowns() {
  const filterSelect = document.getElementById('categoryFilter');
  if (filterSelect) {
    let filterHtml = '<option value="ALL">Semua Kategori</option>';
    categories.forEach(cat => { filterHtml += `<option value="${cat}">${cat}</option>`; });
    filterSelect.innerHTML = filterHtml;
  }

  const prodCatSelect = document.getElementById('prodCategory');
  if (prodCatSelect) {
    let catFormHtml = '';
    categories.forEach(cat => { catFormHtml += `<option value="${cat}">${cat}</option>`; });
    prodCatSelect.innerHTML = catFormHtml;
  }
}

function populateTransactionProductSelect() {
  const select = document.getElementById('transProductSelect');
  if (select) {
    select.innerHTML = products.map(p => 
      `<option value="${p.docId}">[${p.id}] ${p.name} - Stok: ${p.stock} Pcs (HPP: ${window.formatIDR(p.hpp)})</option>`
    ).join('');
  }
}

function getFilteredProducts() {
  const globalQuery = (document.getElementById('globalSearchInput')?.value || '').toLowerCase().trim();
  const tableQuery = (document.getElementById('tableSearchInput')?.value || '').toLowerCase().trim();
  const categoryVal = document.getElementById('categoryFilter')?.value || 'ALL';
  const brandVal = (document.getElementById('brandFilter')?.value || 'ALL').toUpperCase();
  const statusVal = document.getElementById('statusFilter')?.value || 'ALL';

  const searchQuery = tableQuery || globalQuery;

  return products.filter(p => {
    const pBrand = (p.brand || getBrandName(p.name)).toUpperCase();
    const matchSearch = p.name.toLowerCase().includes(searchQuery) || p.id.toLowerCase().includes(searchQuery) || (p.category && p.category.toLowerCase().includes(searchQuery));
    
    let matchCat = (categoryVal === 'ALL') || (p.category === categoryVal);
    let matchBrand = true;
    if (brandVal !== 'ALL') {
      if (brandVal === 'LAINNYA') {
        matchBrand = !['INFINIX','IPHONE','OPPO','REDMI','SAMSUNG','VIVO','XIAOMI'].includes(pBrand);
      } else {
        matchBrand = pBrand.includes(brandVal);
      }
    }

    let matchStatus = true;
    if (statusVal === 'AMAN') matchStatus = p.stock > p.minStock;
    else if (statusVal === 'MENIPIS') matchStatus = p.stock <= p.minStock && p.stock > 0;
    else if (statusVal === 'HABIS') matchStatus = p.stock === 0;
    else if (statusVal === 'ADA_PECAH') matchStatus = ((p.supplierDamaged || 0) + (p.shippingDamaged || 0)) > 0;

    return matchSearch && matchCat && matchBrand && matchStatus;
  });
}

function renderMasterTable() {
  const filtered = getFilteredProducts();
  const tbody = document.getElementById('masterTableBody');
  const infoText = document.getElementById('tableInfoText');

  if (!tbody) return;

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

  if (infoText) infoText.innerText = `Menampilkan ${totalItems === 0 ? 0 : startIdx + 1} - ${Math.min(startIdx + itemsPerPage, totalItems)} dari ${totalItems} produk`;

  if (pageItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-8 text-slate-400">
          <i class="fa-solid fa-box-open text-3xl mb-2 text-slate-300"></i>
          <p class="text-xs font-semibold">Tidak Ada Produk Ditemukan</p>
        </td>
      </tr>`;
    renderPagination(totalPages);
    return;
  }

  tbody.innerHTML = pageItems.map(item => {
    let statusBadge = '';
    if (item.stock === 0) {
      statusBadge = `<span class="bg-rose-100 text-rose-700 font-bold text-[10px] px-2.5 py-1 rounded-full">Habis</span>`;
    } else if (item.stock <= item.minStock) {
      statusBadge = `<span class="bg-amber-100 text-amber-800 font-bold text-[10px] px-2.5 py-1 rounded-full">Menipis</span>`;
    } else {
      statusBadge = `<span class="bg-emerald-100 text-emerald-700 font-bold text-[10px] px-2.5 py-1 rounded-full">Aman</span>`;
    }

    const assetValue = item.stock * (item.hpp || 0);
    const supLoss = (item.supplierDamaged || 0) * (item.hpp || 0);
    const shipLoss = (item.shippingDamaged || 0) * (item.price || 0);
    const totalLoss = supLoss + shipLoss;
    const turnover = item.outgoing * (item.price || 0);

    return `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="py-3 px-4 font-mono font-semibold text-xs text-indigo-600">${item.id}</td>
        <td class="py-3 px-4 font-bold text-slate-800">${item.name}</td>
        <td class="py-3 px-4">
          <span class="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded text-[11px] font-semibold">${item.category}</span>
        </td>
        <td class="py-3 px-4 text-right font-extrabold ${item.stock === 0 ? 'text-rose-600' : 'text-slate-800'}">${item.stock} <span class="text-[10px] font-normal text-slate-400">Pcs</span></td>
        <td class="py-3 px-4 text-right font-semibold text-slate-700">${window.formatIDR(item.hpp)}</td>
        <td class="py-3 px-4 text-right font-semibold text-emerald-600">${window.formatIDR(item.price)}</td>
        <td class="py-3 px-4 text-right font-bold text-slate-800">${window.formatIDR(assetValue)}</td>
        <td class="py-3 px-4 text-right font-bold ${totalLoss > 0 ? 'text-rose-600' : 'text-slate-400'}">${window.formatIDR(totalLoss)}</td>
        <td class="py-3 px-4 text-right font-bold text-emerald-600">${window.formatIDR(turnover)}</td>
        <td class="py-3 px-4 text-center">${statusBadge}</td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center space-x-1">
            <button onclick="quickRestock('${item.docId}')" title="Restock / Input Loss" class="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
              <i class="fa-solid fa-plus-circle"></i>
            </button>
            <button onclick="editProduct('${item.docId}')" title="Edit Produk & HPP" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="openDeleteModal('${item.docId}')" title="Hapus Produk" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const controls = document.getElementById('paginationControls');
  if (!controls) return;
  let html = '';

  html += `
    <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 border rounded-lg"' : 'class="px-2.5 py-1 border rounded-lg hover:bg-slate-100"'}>
      <i class="fa-solid fa-angle-left"></i>
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      html += `<button class="px-3 py-1 bg-indigo-600 text-white font-bold rounded-lg text-xs">${i}</button>`;
    } else if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button onclick="changePage(${i})" class="px-3 py-1 border rounded-lg hover:bg-slate-100 text-xs">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="px-1 text-slate-400">...</span>`;
    }
  }

  html += `
    <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 border rounded-lg"' : 'class="px-2.5 py-1 border rounded-lg hover:bg-slate-100"'}>
      <i class="fa-solid fa-angle-right"></i>
    </button>
  `;

  controls.innerHTML = html;
}

window.changePage = function(page) {
  currentPage = page;
  renderMasterTable();
};

window.resetFilters = function() {
  if (document.getElementById('globalSearchInput')) document.getElementById('globalSearchInput').value = '';
  if (document.getElementById('tableSearchInput')) document.getElementById('tableSearchInput').value = '';
  if (document.getElementById('categoryFilter')) document.getElementById('categoryFilter').value = 'ALL';
  if (document.getElementById('brandFilter')) document.getElementById('brandFilter').value = 'ALL';
  if (document.getElementById('statusFilter')) document.getElementById('statusFilter').value = 'ALL';
  currentPage = 1;
  renderMasterTable();
  window.showToast('Filter pencarian berhasil di-reset', 'info');
};

// ==================== KELOLA KATEGORI ====================
function renderCategoryManagementList() {
  const container = document.getElementById('categoryListContainer');
  if (!container) return;
  if (categories.length === 0) {
    container.innerHTML = '<div class="p-3 text-center text-xs text-slate-400">Belum ada kategori</div>';
    return;
  }

  container.innerHTML = categories.map((cat, idx) => `
    <div class="flex items-center justify-between p-3 hover:bg-slate-50 transition">
      <span class="text-xs font-bold text-slate-700 flex items-center gap-2">
        <i class="fa-solid fa-tag text-purple-500 text-xs"></i> ${cat}
      </span>
      <button onclick="deleteCategory(${idx})" class="text-slate-400 hover:text-rose-600 p-1 text-xs transition" title="Hapus Kategori">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join('');
}

window.handleAddCategory = async function(e) {
  e.preventDefault();
  const input = document.getElementById('newCategoryInput');
  const catName = input?.value.trim();

  if (!catName) return;
  if (categories.some(c => c.toLowerCase() === catName.toLowerCase())) {
    window.showToast(`Kategori "${catName}" sudah ada!`, 'warning');
    return;
  }

  categories.push(catName);
  await saveStateToCloud();
  saveLocalStorageFallback();

  if (input) input.value = '';
  window.showToast(`Kategori baru "${catName}" ditambahkan`, 'success');
  window.closeModal('categoryModal');

  renderCategoryDropdowns();
  renderCategoryManagementList();
};

window.deleteCategory = async function(index) {
  const catToDelete = categories[index];
  const isInUse = products.some(p => p.category === catToDelete);

  if (isInUse) {
    window.showToast(`Kategori "${catToDelete}" sedang digunakan oleh produk!`, 'error');
    return;
  }

  categories.splice(index, 1);
  await saveStateToCloud();
  saveLocalStorageFallback();

  window.showToast(`Kategori "${catToDelete}" berhasil dihapus`, 'info');
  renderCategoryDropdowns();
  renderCategoryManagementList();
};

// ==================== MODAL CONTROLLER & AKSI FORM ====================
window.toggleTransFields = function() {
  const type = document.querySelector('input[name="transType"]:checked')?.value;
  const fieldIn = document.getElementById('fieldStockIn');
  const fieldOut = document.getElementById('fieldStockOut');

  if (type === 'IN') {
    fieldIn?.classList.remove('hidden');
    fieldOut?.classList.add('hidden');
  } else {
    fieldIn?.classList.add('hidden');
    fieldOut?.classList.remove('hidden');
  }
};

window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  if (id === 'productModal') {
    document.getElementById('productForm')?.reset();
    if (document.getElementById('editDocId')) document.getElementById('editDocId').value = '';
    window.setElText('productModalTitle', 'Tambah Produk & Finansial');
  } else if (id === 'closeMonthModal') {
    if (document.getElementById('closeMonthPassword')) document.getElementById('closeMonthPassword').value = '';
  }
};

window.quickRestock = function(docId) {
  window.openModal('transactionModal');
  const select = document.getElementById('transProductSelect');
  if (select) select.value = docId;
  const radioIn = document.querySelector('input[name="transType"][value="IN"]');
  if (radioIn) radioIn.checked = true;
  window.toggleTransFields();
  if (document.getElementById('transQtyGood')) document.getElementById('transQtyGood').value = '';
  if (document.getElementById('transQtySupplierDamaged')) document.getElementById('transQtySupplierDamaged').value = '0';
  if (document.getElementById('transNote')) document.getElementById('transNote').value = 'Kulakan Supplier';
};

window.editProduct = function(docId) {
  const item = products.find(p => p.docId === docId);
  if (!item) return;

  if (document.getElementById('editDocId')) document.getElementById('editDocId').value = item.docId;
  if (document.getElementById('prodSku')) document.getElementById('prodSku').value = item.id;
  if (document.getElementById('prodName')) document.getElementById('prodName').value = item.name;
  if (document.getElementById('prodCategory')) document.getElementById('prodCategory').value = item.category || categories[0];
  if (document.getElementById('prodHpp')) document.getElementById('prodHpp').value = item.hpp || 0;
  if (document.getElementById('prodPrice')) document.getElementById('prodPrice').value = item.price || 0;
  if (document.getElementById('prodBrand')) document.getElementById('prodBrand').value = item.brand || getBrandName(item.name);
  if (document.getElementById('prodStock')) document.getElementById('prodStock').value = item.stock;
  if (document.getElementById('prodMinStock')) document.getElementById('prodMinStock').value = item.minStock;

  window.setElText('productModalTitle', 'Edit Produk & HPP');
  window.openModal('productModal');
};

window.openDeleteModal = function(docId) {
  const item = products.find(p => p.docId === docId);
  if (!item) return;

  if (document.getElementById('deleteDocId')) document.getElementById('deleteDocId').value = docId;
  window.setElText('deleteProductName', `"${item.name}" [${item.id}]`);
  window.openModal('deleteModal');
};

window.handleTransactionSubmit = async function(e) {
  e.preventDefault();
  const docId = document.getElementById('transProductSelect')?.value;
  const type = document.querySelector('input[name="transType"]:checked')?.value;

  const product = products.find(p => p.docId === docId);
  if (!product) return;

  let newStock = Number(product.stock);
  let newSupplierDamaged = Number(product.supplierDamaged || 0);
  let newShippingDamaged = Number(product.shippingDamaged || 0);
  let newOutgoing = Number(product.outgoing || 0);

  if (type === 'IN') {
    const qtyGood = parseInt(document.getElementById('transQtyGood')?.value, 10) || 0;
    const qtySupplierDamaged = parseInt(document.getElementById('transQtySupplierDamaged')?.value, 10) || 0;

    if (qtyGood === 0 && qtySupplierDamaged === 0) {
      window.showToast('Masukkan kuantitas stok bagus atau barang pecah supplier!', 'warning');
      return;
    }

    newStock += qtyGood;
    newSupplierDamaged += qtySupplierDamaged;

    product.stock = newStock;
    product.supplierDamaged = newSupplierDamaged;

    await saveStateToCloud();
    saveLocalStorageFallback();

    window.closeModal('transactionModal');
    document.getElementById('transactionForm')?.reset();
    window.showToast(`Kulakan Tercatat: +${qtyGood} Stok Bagus, ${qtySupplierDamaged} Pecah Supplier`, 'success');
  } else {
    const reason = document.getElementById('transOutReason')?.value;
    const qtyOut = parseInt(document.getElementById('transQtyOut')?.value, 10) || 0;

    if (qtyOut <= 0) {
      window.showToast('Masukkan kuantitas keluar yang valid!', 'warning');
      return;
    }

    if (qtyOut > newStock) {
      window.showToast(`Stok layak tidak cukup! Sisa stok saat ini: ${newStock} Pcs`, 'error');
      return;
    }

    newStock -= qtyOut;
    if (reason === 'NORMAL') {
      newOutgoing += qtyOut;
      window.showToast(`Penjualan Tercatat: -${qtyOut} Pcs ${product.name}`, 'warning');
    } else {
      newShippingDamaged += qtyOut;
      window.showToast(`Record Kerusakan Transit: ${qtyOut} Pcs ${product.name} (Retur Uang)`, 'error');
    }

    product.stock = newStock;
    product.outgoing = newOutgoing;
    product.shippingDamaged = newShippingDamaged;

    await saveStateToCloud();
    saveLocalStorageFallback();

    window.closeModal('transactionModal');
    document.getElementById('transactionForm')?.reset();
  }
};

window.handleProductSubmit = async function(e) {
  e.preventDefault();
  const editDocId = document.getElementById('editDocId')?.value;
  const sku = document.getElementById('prodSku')?.value.trim();
  const name = document.getElementById('prodName')?.value.trim().toUpperCase();
  const category = document.getElementById('prodCategory')?.value;
  const hpp = parseFloat(document.getElementById('prodHpp')?.value) || 0;
  const price = parseFloat(document.getElementById('prodPrice')?.value) || 0;
  const stock = parseInt(document.getElementById('prodStock')?.value, 10) || 0;
  const minStock = parseInt(document.getElementById('prodMinStock')?.value, 10) || 10;
  let brand = document.getElementById('prodBrand')?.value.trim();
  if (!brand) brand = getBrandName(name);

  const stableDocId = `prod_${sku.replace(/[^a-zA-Z0-9]/g, '_')}`;

  if (editDocId) {
    const item = products.find(p => p.docId === editDocId);
    if (item) {
      item.id = sku;
      item.name = name;
      item.category = category;
      item.brand = brand;
      item.hpp = hpp;
      item.price = price;
      item.stock = stock;
      item.minStock = minStock;
    }
    window.showToast(`Produk ${name} berhasil diperbarui`, 'success');
  } else {
    const newProd = {
      docId: stableDocId,
      id: sku,
      name: name,
      category: category,
      brand: brand,
      hpp: hpp,
      price: price,
      stock: stock,
      minStock: minStock,
      unit: 'Pcs',
      outgoing: 0,
      supplierDamaged: 0,
      shippingDamaged: 0
    };
    
    const existingIndex = products.findIndex(p => p.id === sku || p.docId === stableDocId);
    if (existingIndex >= 0) {
      products[existingIndex] = newProd;
    } else {
      products.unshift(newProd);
    }
    window.showToast(`Produk ${name} ditambahkan`, 'success');
  }

  await saveStateToCloud();
  saveLocalStorageFallback();

  window.closeModal('productModal');
  refreshDashboardData();
};

window.confirmDeleteProduct = async function() {
  const docId = document.getElementById('deleteDocId')?.value;
  if (!docId) return;

  products = products.filter(p => p.docId !== docId);

  await saveStateToCloud();
  saveLocalStorageFallback();

  window.closeModal('deleteModal');
  refreshDashboardData();
  window.showToast("Produk berhasil dihapus permanen", "success");
};

window.handleAddExpense = async function(e) {
  e.preventDefault();
  const category = document.getElementById('expCategory')?.value || 'OPERASIONAL';
  const name = document.getElementById('expName')?.value.trim();
  const amount = parseFloat(document.getElementById('expAmount')?.value) || 0;

  if (!name || amount <= 0) {
    window.showToast('Mohon masukkan nama biaya dan nominal yang valid!', 'warning');
    return;
  }

  const newExp = {
    docId: `exp-${Date.now()}`,
    category: category,
    name: name,
    amount: amount,
    date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  };
  expenses.push(newExp);

  await saveStateToCloud();
  saveLocalStorageFallback();

  window.closeModal('expenseModal');
  document.getElementById('expenseForm')?.reset();
  window.showToast('Biaya pengeluaran tersimpan', 'success');
};

window.deleteExpense = async function(docId) {
  expenses = expenses.filter(e => e.docId !== docId);

  await saveStateToCloud();
  saveLocalStorageFallback();

  window.showToast('Catatan biaya dihapus', 'info');
};

window.togglePasswordVisibility = function(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input || !icon) return;

  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
};

window.confirmCloseMonth = async function() {
  const nextMonthInput = document.getElementById('nextMonthLabel');
  const passwordInput = document.getElementById('closeMonthPassword');

  const nextPeriod = nextMonthInput?.value.trim();
  const pass = passwordInput?.value;

  if (!pass || pass !== 'admin123') {
    window.showToast('Password konfirmasi salah! Tutup buku dibatalkan.', 'error');
    if (passwordInput) passwordInput.value = '';
    return;
  }

  if (!nextPeriod) {
    window.showToast('Masukkan nama periode bulan baru!', 'warning');
    return;
  }

  const turnover = products.reduce((sum, p) => sum + (Number(p.outgoing || 0) * Number(p.price || 0)), 0);
  const cogsSales = products.reduce((sum, p) => sum + (Number(p.outgoing || 0) * Number(p.hpp || 0)), 0);
  const grossProfit = turnover - cogsSales;

  const lossSupplier = products.reduce((sum, p) => sum + (Number(p.supplierDamaged || 0) * Number(p.hpp || 0)), 0);
  const lossShipping = products.reduce((sum, p) => sum + (Number(p.shippingDamaged || 0) * Number(p.price || 0)), 0);
  const totalLoss = lossSupplier + lossShipping;

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = grossProfit - totalLoss - totalExpenses;

  const newArchive = {
    docId: `arc-${Date.now()}`,
    period: activePeriodName,
    turnover: turnover,
    grossProfit: grossProfit,
    totalLoss: totalLoss,
    expenses: totalExpenses,
    netProfit: netProfit
  };
  monthlyArchives.push(newArchive);

  products.forEach(p => {
    p.outgoing = 0;
    p.supplierDamaged = 0;
    p.shippingDamaged = 0;
  });

  expenses = [];
  activePeriodName = nextPeriod;

  await saveStateToCloud();
  saveLocalStorageFallback();

  window.closeModal('closeMonthModal');
  window.showToast(`Periode ${activePeriodName} dimulai & laporan diarsipkan!`, 'success');
};
