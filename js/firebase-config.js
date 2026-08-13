import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// Замените значения ниже на объект firebaseConfig из Firebase Console:
// Project settings → General → Your apps → SDK setup and configuration.
// Firebase Web API key не является паролем и может находиться в клиентском сайте.
export const firebaseConfig = {
  apiKey: "AIzaSyBRAmvgBasO2ozqJGKq9PTQxQ0jygVdClo",
  authDomain: "gamestracker-80629.firebaseapp.com",
  projectId: "gamestracker-80629",
  storageBucket: "gamestracker-80629.firebasestorage.app",
  messagingSenderId: "727334013407",
  appId: "1:727334013407:web:4249733fd604e91b139c6a"
};

export const isFirebaseConfigured = !Object.values(firebaseConfig).some((value) =>
  String(value).includes("PASTE_YOUR")
);

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export function requireFirebaseConfig() {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }

  return { app, auth, db };
}
