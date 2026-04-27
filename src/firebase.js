import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your actual Firebase project configuration
// You can get this from: Firebase Console -> Project Settings -> General -> Your Apps
const firebaseConfig = {
  apiKey: "AIzaSyBRNa-7SLw6jdpXoMNjhL--drM9EJQF6L8",
  authDomain: "tasks-b9e9e.firebaseapp.com",
  projectId: "tasks-b9e9e",
  storageBucket: "tasks-b9e9e.firebasestorage.app",
  messagingSenderId: "870169332106",
  appId: "1:870169332106:web:3e237e6fa4319d68d22073"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
