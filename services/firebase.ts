// @ts-ignore
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ============================================================================
//   CONFIGURACIÓN FIREBASE
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAVTQZUfLW3BMoRRwI1vodd7CLCumfUbMQ",
  authDomain: "eventomanager-7943c.firebaseapp.com",
  projectId: "eventomanager-7943c",
  storageBucket: "eventomanager-7943c.firebasestorage.app",
  messagingSenderId: "773548265820",
  appId: "1:773548265820:web:6321e345c3234374277199"
};

let db: any = null;
let isConfigured = false;

const initFirebase = () => {
    try {
        if (firebaseConfig.apiKey) {
            // Garantizar una única instancia de la aplicación
            const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
            
            // Vincular Firestore directamente a la instancia de la app
            db = getFirestore(app);
            isConfigured = true;
            
            console.log("✅ Firebase Cloud: Servicio Firestore activo.");
        }
    } catch (e: any) {
        console.error("❌ Error Crítico Firebase:", e.message);
        isConfigured = false;
    }
};

initFirebase();

export { db, isConfigured };