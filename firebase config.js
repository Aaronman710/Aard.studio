// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

// Config de ton projet Firebase
const firebaseConfig = {
  apiKey:            "AIzaSyARwLHrXIHqmYGsDVlKSVIrkaJ9RL-3eqc",
  authDomain:        "aard-studio-c2fa8.firebaseapp.com",
  projectId:         "aard-studio-c2fa8",
  storageBucket:     "aard-studio-c2fa8.firebasestorage.app",
  messagingSenderId: "284439582375",
  appId:             "1:284439582375:web:bf13708881823065472d82"
};

// Initialisation
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function signup(email, password) {
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      console.log("Compte créé :", user.email);
    })
    .catch((error) => {
      console.error(error.code, error.message);
    });
}
