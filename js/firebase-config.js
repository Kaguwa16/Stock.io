import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCpkSNCxVKr7pQz6mKZKqlJGz4-k6pMCMQ",
  authDomain: "monitor-stock-1dab6.firebaseapp.com",
  projectId: "monitor-stock-1dab6",
  storageBucket: "monitor-stock-1dab6.firebasestorage.app",
  messagingSenderId: "28635188865",
  appId: "1:28635188865:web:3921fbe9c21f4c4d0bc780",
  measurementId: "G-KE8B9FG4H8"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-stock-app-id';
