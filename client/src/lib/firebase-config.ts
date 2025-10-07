// Firebase config for client
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD8rSfprxxMT9mfuoaKTM5YM-P_aY_nSo4",
  authDomain: "stagetrackerpro-a193d.firebaseapp.com",
  databaseURL: "https://stagetrackerpro-a193d-default-rtdb.firebaseio.com",
  projectId: "stagetrackerpro-a193d",
  storageBucket: "stagetrackerpro-a193d.appspot.com",
  messagingSenderId: "885349041871",
  appId: "1:885349041871:web:6e92489488fc66e86dd9ba"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
