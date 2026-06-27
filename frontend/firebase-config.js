import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE",
  authDomain: "bhaktitube-9d672.firebaseapp.com",
  projectId: "bhaktitube-9d672",
  storageBucket: "bhaktitube-9d672.firebasestorage.app",
  messagingSenderId: "965011590447",
  appId: "1:965011590447:web:01fb112ac3e7e55d8d25da"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);