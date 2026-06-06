// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyALkkgBa1w4L21ri2gv0RBgmTzAfL0vd9s",
  authDomain:        "smartroute-25bed.firebaseapp.com",
  projectId:         "smartroute-25bed",
  storageBucket:     "smartroute-25bed.appspot.com",
  messagingSenderId: "1051712345678",
  appId:             "1:1051712345678:web:abcdef1234567890"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
