import { auth }
from "../firebase-config.js";

import {
signInWithEmailAndPassword,
GoogleAuthProvider,
signInWithPopup,
onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

onAuthStateChanged(
auth,
(user)=>{

if(user){

window.location.replace(
"profile.html");

}

}
);



const provider =
new GoogleAuthProvider();

document
.getElementById("loginBtn")
.addEventListener("click", async ()=>{

    const email =
    document.getElementById("email").value;

    const password =
    document.getElementById("password").value;

    try{

        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        window.location.href =
        "../index.html";

    }

    catch(error){

        alert(error.message);

    }

});

document
.getElementById("googleLoginBtn")
.addEventListener(

"click",

async ()=>{

    try{

        await signInWithPopup(
            auth,
            provider
        );

        window.location.href =
        "profile.html";

    }

    catch(error){

        alert(error.message);

    }

}
);