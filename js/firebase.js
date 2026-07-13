/* =======================================================
   SISTEMA OS v2 — Firebase Configuration
   ======================================================= */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getDatabase }   from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getStorage }    from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js';

const firebaseConfig = {
  apiKey:            'AIzaSyBhg5OtVBvO8UwN9urmmGN8EC2n21iL_u4',
  authDomain:        'sistema-os-5923c.firebaseapp.com',
  databaseURL:       'https://sistema-os-5923c-default-rtdb.firebaseio.com',
  projectId:         'sistema-os-5923c',
  storageBucket:     'sistema-os-5923c.firebasestorage.app',
  messagingSenderId: '1087548477429',
  appId:             '1:1087548477429:web:aacf473df2836eb43e1abc',
  measurementId:     'G-48B1Y9HQHV'
};

const app      = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth     = getAuth(app);
const storage  = getStorage(app);

export { app, database, auth, storage };
