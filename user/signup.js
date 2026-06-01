import { auth } from "../firebase-config.js";

import {
createUserWithEmailAndPassword
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

document
.getElementById("signupBtn")
.addEventListener("click", async ()=>{

    const email =
    document.getElementById("email").value;

    const password =
    document.getElementById("password").value;

    try{

        await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

        alert("Account Created Successfully");

        window.location.href =
"profile.html";

    }

    catch(error){

        alert(error.message);

    }

});