import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initRealtimeClock } from './utils.js';
import { state, subscribeState, initCloudSync } from './state.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderKatalogPage } from './pages/katalog.js';

// 1. Inisialisasi Fitur Umum
initRealtimeClock();

// 2. Auth Guard
onAuthStateChanged(auth, (user) => {
  if (user) {
    initCloudSync();
  } else {
    window.location.href = "login.html";
  }
});

// 3. Re-render UI otomatis saat Data State berubah
subscribeState((currentState) => {
  renderDashboardPage(currentState);
  renderKatalogPage(currentState);
});

// 4. Expose Global Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// 5. Mobile Sidebar
function setupEventListeners() {
  const tableSearch = document.getElementById('tableSearchInput');
  const catFilter = document.getElementById('categoryFilter');
  const brandFilter = document.getElementById('brandFilter');

  if (tableSearch) tableSearch.addEventListener('input', () => { currentPage = 1; renderMasterTable(); });
  if (catFilter) catFilter.addEventListener('change', () => { currentPage = 1; renderMasterTable(); });
  if (brandFilter) brandFilter.addEventListener('change', () => { currentPage = 1; renderMasterTable(); });

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

  document.getElementById('closeSidebarMobile')?.addEventListener('click', closeSidebar);
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);
}
