import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCau4kej2QCoz-nhFFETkFo_JkfAMK9-Eo",
  authDomain: "landzoningbd.firebaseapp.com",
  projectId: "landzoningbd",
  storageBucket: "landzoningbd.firebasestorage.app",
  messagingSenderId: "876521541683",
  appId: "1:876521541683:web:8c409e84b5b84dfa2c1346",
  measurementId: "G-Y3Z88J2CXX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);