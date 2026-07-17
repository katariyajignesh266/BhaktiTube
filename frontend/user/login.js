import { auth, db } from "../firebase-config.js";
import { watchProgressEngine } from "../analytics-engine.js";

import {
signInWithEmailAndPassword,
GoogleAuthProvider,
signInWithPopup,
onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import {
collection,
getDocs,
query,
orderBy,
doc,
getDoc,
setDoc
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

// Mark all existing channels as seen for first-time users
async function markAllExistingChannelsAsSeen(user) {
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (!userDoc.exists() || !userDoc.data().announcementsSeen) {
            const q = query(collection(db, "channels"), orderBy("announcementCreatedAt", "desc"));
            const snapshot = await getDocs(q);
            
            const seenChannels = {};
            
            snapshot.forEach((docSnap) => {
                const channel = docSnap.data();
                if (channel.enabled === true && channel.announcementEnabled === true) {
                    seenChannels[channel.channelId] = true;
                }
            });
            
            if (Object.keys(seenChannels).length > 0) {
                await setDoc(doc(db, "users", user.uid), { 
                    announcementsSeen: seenChannels 
                }, { merge: true });
                console.log(`✅ Marked ${Object.keys(seenChannels).length} existing channels as seen for new user`);
            }
        }
    } catch (e) {
        console.error("Error marking existing channels as seen:", e);
    }
}

onAuthStateChanged(
auth,
async (user)=>{

if(user){
        // Mark existing channels as seen for first-time login
        await markAllExistingChannelsAsSeen(user);
        await watchProgressEngine.ensureUserProfile(user);

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

        const result = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        // Mark existing channels as seen for first-time login
        await markAllExistingChannelsAsSeen(result.user);
        await watchProgressEngine.ensureUserProfile(result.user);

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

        const result = await signInWithPopup(
            auth,
            provider
        );

        // Mark existing channels as seen for first-time login
        await markAllExistingChannelsAsSeen(result.user);
        await watchProgressEngine.ensureUserProfile(result.user);

        window.location.href =
        "profile.html";

    }

    catch(error){

        alert(error.message);

    }

}
);