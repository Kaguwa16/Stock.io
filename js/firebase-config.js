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
