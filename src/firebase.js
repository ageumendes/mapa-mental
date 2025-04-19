import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCTxiHuPMmBcxBYutMYkoypLPx5rJwwXVo",
  authDomain: "mapa-mental-13a52.firebaseapp.com",
  projectId: "mapa-mental-13a52",
  storageBucket: "mapa-mental-13a52.firebasestorage.app",
  messagingSenderId: "348092495158",
  appId: "1:348092495158:web:7ff566ca1490cde89a6f97"
};

// Inicializar o Firebase
const app = initializeApp(firebaseConfig);

// Configurar Firestore com long polling
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true // Força polling para evitar erros de WebChannel
});

// Configurar autenticação
const auth = getAuth(app);

export { db, auth };