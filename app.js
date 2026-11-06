// Import Firebase SDK v10 dari CDN resmi
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  collection, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Konfigurasi Firebase (terhubung ke project monitor-stock-1dab6)
const firebaseConfig = {
  apiKey: "AIzaSyCpkSNCxVKr7pQz6mKZKqlJGz4-k6pMCMQ",
  authDomain: "monitor-stock-1dab6.firebaseapp.com",
  projectId: "monitor-stock-1dab6",
  storageBucket: "monitor-stock-1dab6.firebasestorage.app",
  messagingSenderId: "28635188865",
  appId: "1:28635188865:web:3921fbe9c21f4c4d0bc780",
  measurementId: "G-KE8B9FG4H8"
};


// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore dengan Offline Persistence (menggunakan IndexedDB)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

console.log("Stock.io berhasil terhubung ke Firestore (monitor-stock-1dab6)!");

// Fungsi untuk mengambil dan menampilkan data stok dari koleksi 'products' di Firestore
async function loadStockData() {
  const stockTableBody = document.getElementById("stock-table-body");
  if (!stockTableBody) return;

  // Tampilkan indikator loading
  stockTableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-gray-500">Memuat data stok dari database...</td></tr>`;

  try {
    // Mengambil data dari koleksi 'products'
    const querySnapshot = await getDocs(collection(db, "products"));
    stockTableBody.innerHTML = ""; // Bersihkan loading

    if (querySnapshot.empty) {
      stockTableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-gray-500">Belum ada data stok barang di Firestore.</td></tr>`;
      return;
    }

    // Loop data dokumen dan masukkan ke dalam tabel HTML
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const row = document.createElement("tr");
      row.className = "border-b hover:bg-slate-50 transition-colors";
      
      row.innerHTML = `
        <td class="p-3 font-medium text-slate-800">${data.namaBarang || "Tanpa Nama"}</td>
        <td class="p-3 text-center font-semibold">${data.stok || 0}</td>
        <td class="p-3 text-right">Rp ${(data.harga || 0).toLocaleString('id-ID')}</td>
        <td class="p-3 text-center">
          <span class="px-2 py-1 text-xs rounded-full font-medium ${data.stok > 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
            ${data.stok > 5 ? 'Aman' : 'Menipis'}
          </span>
        </td>
      `;
      stockTableBody.appendChild(row);
    });

  } catch (error) {
    console.error("Gagal mengambil data Firestore:", error);
    stockTableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-rose-600">Gagal memuat data (Mode Offline atau Cek Koneksi).</td></tr>`;
  }
}

// Jalankan fungsi saat halaman HTML selesai dimuat
document.addEventListener("DOMContentLoaded", () => {
  loadStockData();
});
