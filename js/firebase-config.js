import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, getDocs, orderBy, query, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB8aAn9f6jmORaE7a7sfISljTohIdhbtZA",
  authDomain: "hamza-website-58dd5.firebaseapp.com",
  projectId: "hamza-website-58dd5",
  storageBucket: "hamza-website-58dd5.firebasestorage.app",
  messagingSenderId: "193883924499",
  appId: "1:193883924499:web:b3bb40b70bb4078b2f37e6",
  measurementId: "G-BYXXJYS6P3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

export { app, db, auth, storage, provider, collection, addDoc, getDocs, orderBy, query, doc, updateDoc, deleteDoc, signInWithPopup, signOut, onAuthStateChanged, analytics, ref, uploadBytes, getDownloadURL };