
// Firebase app + Firestore config (Option C)
// Uses ESM CDN imports to work on GitHub Pages without bundling
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyC8pzBOqExWyNNx3OOssPAAmC8XgcobO8M',
  authDomain: 'rtfjom26.firebaseapp.com',
  projectId: 'rtfjom26',
  storageBucket: 'rtfjom26.firebasestorage.app',
  messagingSenderId: '901133745338',
  appId: '1:901133745338:web:6cbf4a556108b599879683',
  measurementId: 'G-3SQ368P9RG'
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

console.log('[JOM26] Firebase initialized, db ready');
