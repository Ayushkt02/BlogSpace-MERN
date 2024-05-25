
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyDVIIv4HU4Shc2Jb8ktgD8K7geAhCkIzO0",
  authDomain: "blogging-website-4065b.firebaseapp.com",
  projectId: "blogging-website-4065b",
  storageBucket: "blogging-website-4065b.appspot.com",
  messagingSenderId: "623226614203",
  appId: "1:623226614203:web:e80505769684842375549e",
//   storageBucket: "gs://blogging-website-4065b.appspot.com"
};

export const app = initializeApp(firebaseConfig);


// google auth

const provider = new GoogleAuthProvider();

const auth = getAuth();

export const authWithGoogle = async () => {
    let user = null;

    await signInWithPopup(auth, provider)
    .then((result) => {
        user = result.user;
    })
    .catch((err) => {
        console.log(err);
    })

    return user;
}
