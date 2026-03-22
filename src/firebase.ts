import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB1zvDchzk-vbfx2Q1P813jXdYEeSYGNSs",
  authDomain: "appdatabase-29393.firebaseapp.com",
  projectId: "appdatabase-29393",
  storageBucket: "appdatabase-29393.firebasestorage.app",
  messagingSenderId: "762327563232",
  appId: "1:762327563232:web:e28d0785a93fe970108985",
  measurementId: "G-Q1Z239924P"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
