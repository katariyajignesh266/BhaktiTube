import { auth }
from "../firebase-config.js";

import {
onAuthStateChanged,
signOut,
updateProfile
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

// history.pushState(
// null,
// null,
// location.href
// );

// window.addEventListener(
// "popstate",
// function () {

// history.pushState(
// null,
// null,
// location.href
// );

// }
// );

const editProfileBtn =
document.getElementById("editProfileBtn");

editProfileBtn.addEventListener(
"click",

()=>{

    document.getElementById(
"editNameInput"
).value =
auth.currentUser.displayName || "";

    editProfileModal.style.display =
    "flex";

    

}
);

const editProfileModal =
document.getElementById("editProfileModal");

const closeModalBtn =
document.getElementById("closeModalBtn");

closeModalBtn.addEventListener(
"click",

()=>{

    editProfileModal.style.display =
    "none";

}
);

const editName =
document.getElementById("editName");

const userName =
document.getElementById("userName");

const userEmail =
document.getElementById("userEmail");



onAuthStateChanged(
auth,

(user)=>{

    if(user){

        userName.textContent =
        user.displayName || "BhaktiTube User";

        userEmail.textContent =
        user.email;

        const accountType = document.getElementById("accountType");

        accountType.textContent = user.providerData[0].providerId;

        const joinedDate = document.getElementById("joinedDate");

        joinedDate.textContent = new Date( user.metadata.creationTime ).toLocaleDateString();

        document.getElementById("profileImage").src = user.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

        accountType.textContent = user.providerData[0].providerId ===
        "google.com"
        ? "Google Account"
        : "Email Account";

    }

    else{

        window.location.replace(
"login.html"
);

    }

});



const logoutBtn =
document.getElementById("logoutBtn");

logoutBtn.addEventListener(
"click",

async ()=>{

    await signOut(auth);

history.replaceState(
null,
null,
"login.html"
);

window.location.replace(
"login.html"
);

}
);




const saveProfileBtn =
document.getElementById(
"saveProfileBtn"
);

saveProfileBtn.addEventListener(
"click",

async ()=>{

console.log("Save Clicked");

const newName =
document.getElementById(
"editNameInput"
).value.trim();

if(!newName){

alert("Enter Name");

return;

}

try{

await updateProfile(
auth.currentUser,
{
displayName:newName
}
);

userName.textContent =
newName;

document.getElementById(
"editProfileModal"
).style.display = "none";

alert(
"Profile Updated Successfully"
);

}

catch(error){

alert(error.message);

}

});


