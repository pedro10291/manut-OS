
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

 const firebaseConfig = {
    apiKey: "AIzaSyBhg5OtVBvO8UwN9urmmGN8EC2n21iL_u4",
    authDomain: "sistema-os-5923c.firebaseapp.com",
    projectId: "sistema-os-5923c",
    storageBucket: "sistema-os-5923c.firebasestorage.app",
    messagingSenderId: "1087548477429",
    appId: "1:1087548477429:web:aacf473df2836eb43e1abc",
    measurementId: "G-48B1Y9HQHV"
  };

const app = initializeApp(firebaseConfig);

const database = getDatabase(app);

export { database };