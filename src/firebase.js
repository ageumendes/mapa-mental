import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBnePXkvd1lwNksiZDwjgqCh5_FhobDO18",
    authDomain: "mapa-mental-17072.firebaseapp.com",
    projectId: "mapa-mental-17072",
    storageBucket: "mapa-mental-17072.firebasestorage.app",
    messagingSenderId: "750676016941",
    appId: "1:750676016941:web:1ab183b8a2662a37c29da4",
    measurementId: "G-X1HC2V0WL5"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };