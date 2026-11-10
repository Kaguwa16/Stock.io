import { db, appId, auth } from './firebase-config.js';
import { doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export const state = {
  products: [],
  categories: ["Tempered Glass", "Hydrogel", "Casing", "Kabel & Charger", "Aksesoris"],
  expenses: [],
  sales: [],
  monthlyArchives: [],
  activePeriodName: "November 2026",
  isOffline: false
};

const subscribers = [];

export function subscribeState(callback) {
  subscribers.push(callback);
}

function notifySubscribers() {
  subscribers.forEach(cb => cb(state));
}

export function initCloudSync() {
  if (!auth.currentUser || !db) return;
  const storeRef = doc(db, 'artifacts', appId, 'dashboard_store', 'main_state');

  onSnapshot(storeRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      state.products = data.products || [];
      state.categories = data.categories || state.categories;
      state.expenses = data.expenses || [];
      state.sales = data.sales || [];
      state.monthlyArchives = data.monthlyArchives || [];
      state.activePeriodName = data.activePeriodName || "November 2026";
    }
    notifySubscribers();
  }, (err) => {
    console.warn("Firestore offline fallback:", err);
    loadLocalStorageFallback();
  });
}

export async function saveState() {
  if (state.isOffline) {
    localStorage.setItem('stock_store_v1', JSON.stringify(state));
    notifySubscribers();
    return;
  }
  try {
    const storeRef = doc(db, 'artifacts', appId, 'dashboard_store', 'main_state');
    await setDoc(storeRef, {
      products: state.products,
      categories: state.categories,
      expenses: state.expenses,
      sales: state.sales,
      monthlyArchives: state.monthlyArchives,
      activePeriodName: state.activePeriodName,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error("Gagal simpan cloud:", err);
  }
}

function loadLocalStorageFallback() {
  state.isOffline = true;
  const local = localStorage.getItem('stock_store_v1');
  if (local) {
    const parsed = JSON.parse(local);
    Object.assign(state, parsed);
  }
  notifySubscribers();
}

export function saveLocalStorageFallback() {
  try {
    localStorage.setItem('stock_io_state_fallback', JSON.stringify(state));
    console.log("Data berhasil disimpan ke LocalStorage");
  } catch (error) {
    console.error("Gagal menyimpan ke LocalStorage:", error);
  }
}
