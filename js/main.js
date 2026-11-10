import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initRealtimeClock } from './utils.js';
import { state, subscribeState, initCloudSync } from './state.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderKatalogPage } from './pages/katalog.js';
import { renderPenjualanPage } from './pages/penjualan.js';

// 1. Inisialisasi Fitur Umum
initRealtimeClock();

// 2. Auth Guard
onAuthStateChanged(auth, (user) => {
  if (user) {
    const idEl = document.getElementById('authUserIdDisplay');
    if (idEl) idEl.innerText = user.email || user.uid;
    initCloudSync();
  } else {
    window.location.href = "login.html";
  }
});

// 3. Re-render UI otomatis saat Data State berubah
subscribeState((currentState) => {
  renderDashboardPage(currentState);
  renderKatalogPage(currentState);
  renderPenjualanPage(currentState);
});

// 4. Expose Global Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// 5. Sidebar
document.addEventListener('DOMContentLoaded', () => {
  const openSidebarBtn = document.getElementById('openSidebarMobile');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const closeSidebarBtn = document.getElementById('closeSidebarMobile');

  // Ketika tombol hamburger diklik -> Buka Sidebar
  if (openSidebarBtn) {
    openSidebarBtn.addEventListener('click', () => {
      sidebar?.classList.remove('-translate-x-full');
      overlay?.classList.remove('hidden');
    });
  }

  // Fungsi untuk menutup sidebar
  const closeSidebar = () => {
    sidebar?.classList.add('-translate-x-full');
    overlay?.classList.add('hidden');
  };

  // Ketika tombol silang (X) atau area gelap (overlay) diklik -> Tutup Sidebar
  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', closeSidebar);
  }
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }
});
