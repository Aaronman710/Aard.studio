/* ================================================
   AARD.STUDIO — firebase-config.js
   ================================================
   1. Créez un projet sur https://console.firebase.google.com
   2. Allez dans "Paramètres du projet" > "Vos applications" > ajoutez une app Web
   3. Copiez les valeurs firebaseConfig et collez-les ci-dessous
   4. Dans Firebase Console, activez "Authentication" > "Email/Mot de passe"
   ================================================ */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyARwLHrXIHqmYGsDVlKSVIrkaJ9RL-3eqc",
  authDomain:        "aard-studio-c2fa8.firebaseapp.com",
  projectId:         "aard-studio-c2fa8",
  storageBucket:     "aard-studio-c2fa8.firebasestorage.app",
  messagingSenderId: "284439582375",
  appId:             "1:284439582375:web:bf13708881823065472d82"
};

/* ================================================
   NE PAS MODIFIER EN DESSOUS
   ================================================ */
window.FIREBASE_CONFIG = FIREBASE_CONFIG;

// Vérifie si la config a été remplie
window.FIREBASE_CONFIGURED = (
  FIREBASE_CONFIG.apiKey !== "AIzaSyARwLHrXIHqmYGsDVlKSVIrkaJ9RL-3eqc" &&
  FIREBASE_CONFIG.apiKey !== ""
);