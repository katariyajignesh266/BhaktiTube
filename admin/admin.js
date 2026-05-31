import { auth } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import { db } from "../firebase-config.js";

import {
collection,
getDocs,
addDoc,
doc,
deleteDoc,
serverTimestamp
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";


console.log("ADMIN JS LOADED");

const YOUTUBE_API_KEY = "AIzaSyDo_afCx6xlSQeJP5LyYydZA2_519toMDo";



onAuthStateChanged(auth, async (user) => {

    const loginTime =
    localStorage.getItem("loginTime");

    const now =
    Date.now();

    const tenMinutes =
    10 * 60 * 1000;

    if(
        !user ||
        !loginTime ||
        (now - loginTime) > tenMinutes
    ){

    
        console.log("ADMIN UID:",user.uid);

        await auth.signOut();

        localStorage.removeItem(
            "loginTime"
        );

        window.location.href =
        "Login.html";

        return;
    }

    loadVideos();

    loadAdvertisements();

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

setInterval(async ()=>{

    const loginTime =
    localStorage.getItem("loginTime");

    if(!loginTime) return;

    const now =
    Date.now();

    const tenMinutes =
    10 * 60 * 1000;

    if(
        (now - loginTime)
        > tenMinutes
    ){

        await auth.signOut();

        localStorage.removeItem(
            "loginTime"
        );

        alert("Session Expired");

        window.location.href =
        "Login.html";
    }

},1000);


const fetchBtn =
document.getElementById("fetchBtn");

fetchBtn.addEventListener("click", fetchVideoDetails);

async function fetchVideoDetails(){

    const url =
    document.getElementById("youtubeUrl").value;

    if(!url){
        alert("Paste YouTube URL");
        return;
    }

    let videoId = "";

if(url.includes("youtube.com/watch")){

    videoId =
    new URL(url).searchParams.get("v");

}
else if(url.includes("youtu.be/")){

    videoId =
    url.split("youtu.be/")[1].split("?")[0];

}

if(!videoId){

    alert("Invalid YouTube URL");

    return;
}

    try{

        const response =
        await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`
        );

        const data =
        await response.json();

        console.log(data);

        if(data.error){
    alert(data.error.message);
    return;
}

        if(!data.items.length){
            alert("Video Not Found");
            return;
        }

        const video =
        data.items[0];

        document.getElementById("videoId").value =
        videoId;

        document.getElementById("title").value =
        video.snippet.title;

        document.getElementById("channel").value =
        video.snippet.channelTitle;

        document.getElementById("views").value =
        Number(video.statistics.viewCount)
        .toLocaleString() + " views";

        document.getElementById("logo").value =
        video.snippet.channelTitle.charAt(0);

        document.getElementById("date").value =
        getTimeAgo(
        video.snippet.publishedAt
        );

    }catch(error){

        console.error(error);

        alert(error.message);

    }

}

const form =
document.getElementById("videoForm");

function getTimeAgo(dateString){

    const published =
    new Date(dateString);

    const now =
    new Date();

    const diff =
    now - published;

    const days =
    Math.floor(
    diff / (1000*60*60*24)
    );

    if(days < 7){
        return `${days} days ago`;
    }

    if(days < 30){
        return `${Math.floor(days/7)} weeks ago`;
    }

    if(days < 365){
        return `${Math.floor(days/30)} months ago`;
    }

    return `${Math.floor(days/365)} years ago`;
}

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


const adForm =
document.getElementById("adForm");

adForm.addEventListener(
"submit",

async (e)=>{

e.preventDefault();

const title =
document.getElementById(
"adTitle"
).value;

const videoUrl =
document.getElementById(
"adVideoUrl"
).value;

const redirectLink =
document.getElementById(
"adRedirectLink"
).value;

const skipAfter =
Number(
document.getElementById(
"adSkipAfter"
).value
);

try{

await addDoc(
collection(
db,
"advertisements"
),
{
title,
videoUrl,
redirectLink,
skipAfter,
active:true,
views:0,
clicks:0,
createdAt:
serverTimestamp()
}
);

alert(
"Advertisement Uploaded"
);

adForm.reset();

}

catch(error){
  console.error(error);
  console.error("ERROR CODE:", error.code);
  console.error("ERROR MESSAGE:", error.message);

  alert(error.message);
}

});


async function loadAdvertisements(){

const adsList =
document.getElementById("adsList");

adsList.innerHTML="";

const snapshot =
await getDocs(
collection(db,"advertisements")
);

snapshot.forEach((ad)=>{

const data = ad.data();

adsList.innerHTML += `

<div class="ad-item">

<h3>${data.title}</h3>

<p>Views : ${data.views || 0}</p>

<p>Clicks : ${data.clicks || 0}</p>

<p>Skip After :
${data.skipAfter}s</p>

<button
class="ad-delete"
onclick="deleteAd('${ad.id}')">

Delete

</button>

</div>

`;

});

}


window.deleteAd =
async function(id){

const ok =
confirm(
"Delete Advertisement ?"
);

if(!ok) return;

await deleteDoc(
doc(db,"advertisements",id)
);

loadAdvertisements();

}

const toggleVideos =
document.getElementById("toggleVideos");

const videosList =
document.getElementById("videosList");

videosList.classList.add("hidden");

toggleVideos.addEventListener("click",()=>{

    videosList.classList.toggle("hidden");

    if(
        videosList.classList.contains("hidden")
    ){

        toggleVideos.innerHTML =
        "📹 Manage Videos ▼";

    }else{

        toggleVideos.innerHTML =
        "📹 Manage Videos ▲";

    }

});

const toggleAds =
document.getElementById("toggleAds");

const adsList =
document.getElementById("adsList");

adsList.classList.add("hidden");

toggleAds.addEventListener("click",()=>{

    adsList.classList.toggle("hidden");

    if(
        adsList.classList.contains("hidden")
    ){

        toggleAds.innerHTML =
        "📢 Manage Advertisements ▼";

    }else{

        toggleAds.innerHTML =
        "📢 Manage Advertisements ▲";

    }

});