  // Import the functions you need from the SDKs you need
  import { initializeApp } from "firebase/app";
  import { getFirestore } from "firebase/firestore";
  import { getAuth } from "firebase/auth";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyBdoejqqrqEOUyCcLH6KwmUVcglBQNM33I",
    authDomain: "my-book-history-d8b8e.firebaseapp.com",
    projectId: "my-book-history-d8b8e",
    storageBucket: "my-book-history-d8b8e.firebasestorage.app",
    messagingSenderId: "967856062859",
    appId: "1:967856062859:web:38fcbe49de80c3b0f3af8e"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  export { db, auth };