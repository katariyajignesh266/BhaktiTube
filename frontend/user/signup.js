import { auth, db } from "../firebase-config.js";
import { watchProgressEngine } from "../analytics-engine.js";

import {
createUserWithEmailAndPassword,
GoogleAuthProvider,
signInWithPopup
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

const provider = new GoogleAuthProvider();

document
.getElementById("googleSignupBtn")
.addEventListener("click", async () => {

    try {

        const result = await signInWithPopup(
            auth,
            provider
        );

        // Mark existing channels as seen for first-time signup
        await markAllExistingChannelsAsSeen(result.user);
        await watchProgressEngine.ensureUserProfile(result.user);

        alert("Google Sign In Successful");

        window.location.href =
        "profile.html";

    }

    catch(error){

        alert(error.message);

    }

});

document
.getElementById("signupBtn")
.addEventListener("click", async ()=>{

    const email =
    document.getElementById("email").value;

    const password =
    document.getElementById("password").value;

    try{

        const result = await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

        // Mark existing channels as seen for first-time signup
        await markAllExistingChannelsAsSeen(result.user);
        await watchProgressEngine.ensureUserProfile(result.user);

        alert("Account Created Successfully");

        window.location.href =
"profile.html";

    }

    catch(error){

        alert(error.message);

    }

});