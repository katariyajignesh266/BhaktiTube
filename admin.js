import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

console.log("ADMIN JS LOADED");

onAuthStateChanged(auth, (user) => {

    if (!user) {

        window.location.href = "login.html";

    } else {

        loadVideos();

    }

});

async function loadVideos() {

    const videosList =
    document.getElementById("videosList");

    videosList.innerHTML = "";

    const snapshot =
    await getDocs(collection(db, "videos"));

    snapshot.forEach((videoDoc) => {

        const video = videoDoc.data();

        videosList.innerHTML += `
        <div class="video-item">

            <h3>${video.title}</h3>

            <p>📺 ${video.channel}</p>

            <p>👁 ${video.views}</p>

            <p>📅 ${video.date}</p>

            <button
            class="delete-btn"
            onclick="deleteVideo('${videoDoc.id}')">
            Delete
            </button>

        </div>
        `;
    });
}

window.deleteVideo = async function(id) {

    const confirmDelete =
    confirm("Delete this video?");

    if (!confirmDelete) return;

    try {

        await deleteDoc(
            doc(db, "videos", id)
        );

        alert("Video Deleted");

        loadVideos();

    } catch(error) {

        console.error(error);

        alert(error.message);

    }

};

const form =
document.getElementById("videoForm");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const videoId =
    document.getElementById("videoId").value;

    const title =
    document.getElementById("title").value;

    const channel =
    document.getElementById("channel").value;

    const logo =
    document.getElementById("logo").value;

    const views =
    document.getElementById("views").value;

    const date =
    document.getElementById("date").value;

    try {

        await addDoc(
            collection(db, "videos"),
            {
                videoId,
                title,
                channel,
                logo,
                views,
                date,
                createdAt: Date.now()
            }
        );

        alert("Video Uploaded Successfully");

        form.reset();

        loadVideos();

    } catch(error) {

        console.error(error);

        alert(error.message);

    }

});