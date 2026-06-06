// firebaseConfig.js
// Firebase initialization for SmartRoute Delivery System
// Author: Aiden Ooi (0207157)

import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyALkkgBa1w4L21ri2gv0RBgmTzAfL0vd9s",
  authDomain: "smartroute-25bed.firebaseapp.com",
  projectId: "smartroute-25bed",
  storageBucket: "smartroute-25bed.firebasestorage.app",
  messagingSenderId: "607042827749",
  appId: "1:607042827749:web:8accb6baa7d442a1ca2b0c",
  measurementId: "G-783F6RVV14"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage for session persistence
// This keeps the user logged in after app restarts
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Initialize Firestore database
export const db = getFirestore(app);