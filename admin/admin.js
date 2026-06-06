import { auth } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import { db } from "../firebase-config.js";

import {
collection,
getDocs,
addDoc,
doc,
deleteDoc,
updateDoc,
serverTimestamp,
query,
orderBy
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";



console.log("ADMIN JS LOADED");

const YOUTUBE_API_KEY = "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE";


document.addEventListener("click", async(e)=>{

if(
e.target.classList.contains(
"toggleChannelBtn"
)
){

const channelDocId =
e.target.dataset.id;

const currentState =
e.target.dataset.enabled === "true";

await updateDoc(

doc(
db,
"channels",
channelDocId
),

{
enabled: !currentState
}

);

loadChannels();

}

});



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

        await auth.signOut();

        localStorage.removeItem(
            "loginTime"
        );

        window.location.href =
        "Login.html";

        return;
    }

    console.log("Logged In:", user.uid);

    loadVideos();

    loadAdvertisements();

    loadChannels();



});

async function loadVideos() {

    const videosList =
    document.getElementById("videosList");

    videosList.innerHTML = "";

    const q = query(
collection(db, "videos"),
orderBy("createdAt", "desc")
);

const snapshot =
await getDocs(q);

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

console.log(data);

alert(data.error.message);

return;
}

        if(!data.items || !data.items.length){
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

const channelForm =
document.getElementById("channelForm");

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
                createdAt: serverTimestamp()
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

const q = query(
collection(db,"advertisements"),
orderBy("createdAt","desc")
);



const snapshot =
await getDocs(q);

console.log(
"Ads Found:",
snapshot.size
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

    console.log("ADS CLICKED");

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

const toggleChannels =
document.getElementById("toggleChannels");

const channelsList =
document.getElementById("channelsList");

channelsList.classList.add("hidden");

toggleChannels.addEventListener("click",()=>{

    channelsList.classList.toggle("hidden");

    if(
        channelsList.classList.contains("hidden")
    ){

        toggleChannels.innerHTML =
        "📺 Manage Channels ▼";

    }else{

        toggleChannels.innerHTML =
        "📺 Manage Channels ▲";

    }

});

const fetchChannelBtn =
document.getElementById(
"fetchChannelBtn"
);

const manualAddChannelBtn =
document.getElementById(
"manualAddChannelBtn"
);

const preview =
document.getElementById(
"channelPreview"
);

let fetchedChannel = null;

channelForm.addEventListener(
"submit",

async(e)=>{

e.preventDefault();

if(!fetchedChannel){

alert(
"Fetch Channel First"
);

return;

}

try{

const snapshot =
await getDocs(
collection(db,"channels")
);

const exists =
snapshot.docs.some(doc =>
doc.data().channelId ===
fetchedChannel.channelId
);

if(exists){

alert(
"Channel Already Added"
);

return;
}

await addDoc(

collection(
db,
"channels"
),

{

channelId:
fetchedChannel.channelId,

channelName:
fetchedChannel.channelName,

channelLogo:
fetchedChannel.channelLogo,

subscribers:
fetchedChannel.subscribers,

totalVideos:
fetchedChannel.totalVideos,

channelUrl:
fetchedChannel.channelUrl,

uploadsPlaylistId:
fetchedChannel.uploadsPlaylistId,

enabled:true,

createdAt:
serverTimestamp()



}

);

alert(
"Channel Added Successfully"
);

channelForm.reset();

preview.style.display =
"none";

fetchedChannel = null;

loadChannels();

}
catch(error){

console.error(error);

alert(
error.message
);

}

});


async function loadChannels(){

const channelsList =
document.getElementById(
"channelsList"
);

channelsList.innerHTML="";

const q = query(
collection(db,"channels"),
orderBy("createdAt","desc")
);

const snapshot =
await getDocs(q);

snapshot.forEach((channel)=>{

const data =
channel.data();

channelsList.innerHTML += `

<div class="channel-item">

<img
src="${data.channelLogo}"
class="channel-logo">

<h3>
${data.channelName}
</h3>

<p>
👥 ${data.subscribers}
Subscribers
</p>

<p>
🎬 ${data.totalVideos}
Videos
</p>

<a
href="${data.channelUrl}"
target="_blank">

Visit Channel

</a>

<button
class="channel-delete"
onclick="deleteChannel('${channel.id}')">

Delete

</button>

<button
class="toggleChannelBtn"
data-id="${channel.id}"
data-enabled="${data.enabled}">
${data.enabled ? "Disable" : "Enable"}
</button>

</div>

`;

});

}

window.deleteChannel =
async function(id){

const ok =
confirm(
"Delete Channel ?"
);

if(!ok) return;

await deleteDoc(
doc(db,"channels",id)
);

loadChannels();

}

fetchChannelBtn.addEventListener(
"click",

async ()=>{

const url =
document.getElementById(
"channelUrl"
).value.trim();

if(!url){

alert(
"Paste Channel URL"
);

return;

}

const match =
url.match(/@([^/?]+)/);

if(!match){

alert(
"Invalid Channel URL"
);

return;

}

const handle =
match[1];

console.log(
"CHANNEL HANDLE:",
handle
);

try{

const response =
await fetch(

`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${handle}&maxResults=1&key=${YOUTUBE_API_KEY}`

);

const data =
await response.json();

console.log(data);

alert(
JSON.stringify(data)
);

if(!data.items || !data.items.length){
alert(
"Channel Not Found"
);

return;

}

const channelId =
data.items[0].snippet.channelId;

const channelResponse =
await fetch(
`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`
);

const channelData =
await channelResponse.json();

const channel =
channelData.items[0];

const uploadsPlaylistId =
channel.contentDetails
.relatedPlaylists
.uploads;

console.log(
channelData
);


const channelName =
channel.snippet.title;

const subscribers =
Number(
channel.statistics.subscriberCount
).toLocaleString();

const totalVideos =
Number(
channel.statistics.videoCount
).toLocaleString();

const logo =
channel.snippet.thumbnails.high.url;

console.log(
channelName,
subscribers,
totalVideos,
logo
);

fetchedChannel = {

channelId,

uploadsPlaylistId,

channelName,

channelLogo: logo,

subscribers,

totalVideos,

channelUrl: url

};

preview.style.display = "block";

document.getElementById(
"previewLogo"
).src = logo;

document.getElementById(
"previewName"
).textContent =
channelName;

document.getElementById(
"previewSubscribers"
).textContent =
"Subscribers : " +
subscribers;

document.getElementById(
"previewVideos"
).textContent =
"Videos : " +
totalVideos;



}
catch(error){

console.error(error);

alert(error.message);

}

});


manualAddChannelBtn.addEventListener(
"click",

async ()=>{

const channelId =
document.getElementById(
"manualChannelId"
).value.trim();

const uploadsPlaylistId =
document.getElementById(
"manualUploadsPlaylistId"
).value.trim();

const channelName =
document.getElementById(
"manualChannelName"
).value.trim();

const channelLogo =
document.getElementById(
"manualChannelLogo"
).value.trim();

const subscribers =
document.getElementById(
"manualSubscribers"
).value.trim();

const totalVideos =
document.getElementById(
"manualTotalVideos"
).value.trim();

const channelUrl =
document.getElementById(
"channelUrl"
).value.trim();

if(
!channelId ||
!uploadsPlaylistId ||
!channelName
){

alert(
"Fill Required Fields"
);

return;

}

try{

await addDoc(
collection(db,"channels"),
{

channelId,

uploadsPlaylistId,

channelName,

channelLogo,

subscribers,

totalVideos,

channelUrl,

active:true,

enabled:true,

createdAt:
serverTimestamp()

}
);

alert(
"Channel Added Successfully"
);

loadChannels();

}
catch(error){

console.error(error);

alert(error.message);

}

});