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

// 5. KHUSUS SIDEBAR 
function setupGlobalEventListeners() {
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

// Fungsi global untuk membuka/menutup submenu sidebar via ikon titik tiga
window.toggleSubmenu = function(submenuId, event) {
  event.preventDefault();
  event.stopPropagation();
  
  const submenu = document.getElementById(submenuId);
  if (submenu) {
    // Tutup submenu lain jika ingin efek accordion (opsional)
    document.querySelectorAll('[id$="Submenu"]').forEach(el => {
      if (el.id !== submenuId) el.classList.add('hidden');
    });

    // Toggle visibilitas submenu yang dipilih
    submenu.classList.toggle('hidden');
  }
};
