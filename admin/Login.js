import { auth } from "../firebase-config.js";

import {
signInWithEmailAndPassword
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

window.Login = async function() {

const email =
document.getElementById("email").value;

const password =
document.getElementById("password").value;

try {

await signInWithEmailAndPassword(
auth,
email,
password
);

localStorage.setItem(
    "loginTime",
    Date.now()
);

window.location.href =
"admin.html";

}
catch(error){

alert(error.message);

}

console.log("Login Clicked");

}

document
.getElementById("loginBtn")
.addEventListener("click", Login);