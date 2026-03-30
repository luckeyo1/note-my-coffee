// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    doc, 
    deleteDoc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Firebase Configuration
 * 
 * TO GET YOUR CONFIG:
 * 1. Go to Firebase Console (https://console.firebase.google.com/)
 * 2. Select your project.
 * 3. Click the Gear icon (Project settings) > General.
 * 4. Scroll down to 'Your apps' and find the 'Firebase SDK snippet' for Config.
 * 5. Copy and paste the firebaseConfig object below.
 */
const firebaseConfig = {
    apiKey: "AIzaSyB8B6CDTnycxxCWey1p-0WV3cRRbGa_cj0",
    authDomain: "note-my-coffee.firebaseapp.com",
    databaseURL: "https://note-my-coffee-default-rtdb.firebaseio.com",
    projectId: "note-my-coffee",
    storageBucket: "note-my-coffee.firebasestorage.app",
    messagingSenderId: "755801853184",
    appId: "1:755801853184:web:fed55e6029b3f8c23eb7e5",
    measurementId: "G-Q0HWKB2MBP"
};
    
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { 
    auth, 
    db, 
    googleProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    doc, 
    deleteDoc, 
    updateDoc
};
