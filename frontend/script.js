import { db } from "./firebase-config.js";

import { auth }
from "./firebase-config.js";

import {
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
  updateDoc,
  increment,
  onSnapshot
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

import {
signOut
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import {
watchProgressEngine,
formatWatchTime,
formatRelativeTime
}
from "./analytics-engine.js";

import { playVideo } from "./player-core.js";
import { renderDashboard } from "./dashboard-renderer.js";
import { getChannelCardMarkup } from "./channel-card-renderer.js";

const logoutBtn =
document.getElementById("logoutBtn");

logoutBtn.addEventListener("click",async()=>{

await signOut(auth);

window.location.href =
"./user/signup.html";

});



console.log("BhaktiTube Loaded");

const videoPopup =
document.getElementById("videoPopup");

const youtubePlayer =
document.getElementById("youtubePlayer");

const adPopup =
document.getElementById("adPopup");

const adVideo =
document.getElementById("adVideo");

const skipAdBtn =
document.getElementById("skipAdBtn");

const visitAdBtn =
document.getElementById("visitAdBtn");

const bellBtn =
document.querySelector(".fa-bell");

const notificationPopup =
document.getElementById("notificationPopup");

const notificationList =
document.getElementById("notificationList");

const journeySection =
document.getElementById("journeySection");

const continueWatchingSection =
document.getElementById("continueWatchingSection");

let homePlayer = null;
let homeTrackInterval = null;
let currentHomeVideoId = null;
let currentHomeView = "dashboard";
let youtubeApiReadyPromise = null;
let historyVideoMeta = new Map();

watchProgressEngine.init({
source:"home"
});

// Apply cached theme immediately to prevent FOUC (flash of unthemed card style)
const cachedCardTheme = localStorage.getItem("bt_channel_card_theme") || "dark-glass";
document.body.setAttribute("data-cc-theme", cachedCardTheme);

// Asynchronously sync the card theme from Firestore
async function syncGlobalChannelCardTheme() {
    try {
        const themeDoc = await getDoc(doc(db, "settings", "channelCardTheme"));
        if (themeDoc.exists()) {
            const savedTheme = themeDoc.data().themeId;
            const currentTheme = localStorage.getItem("bt_channel_card_theme");
            if (savedTheme !== currentTheme) {
                localStorage.setItem("bt_channel_card_theme", savedTheme);
                document.body.setAttribute("data-cc-theme", savedTheme);
            }
        }
    } catch (e) {
        console.error("Error syncing global card theme:", e);
    }
}
syncGlobalChannelCardTheme();



async function getAdvertisement(){

console.log("Loading Random Advertisement...");

const snapshot =
await getDocs(
collection(db,"advertisements")
);

const ads = [];

snapshot.forEach((doc)=>{

const ad = doc.data();

if(ad.active){

ads.push({
id: doc.id,
...ad
});

}

});

if(ads.length === 0){

return null;

}

const randomIndex =
Math.floor(
Math.random() * ads.length
);

return ads[randomIndex];

}

function getVideoMetadata(videoId){

const video =
allVideos.find(item => item.videoId === videoId) || historyVideoMeta.get(videoId) || {};

return {
videoId,
videoTitle: video.title || video.videoTitle || "BhaktiTube Video",
channelName: video.channel || video.channelName || "BhaktiTube",
thumbnailUrl: video.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
duration: Number(video.duration || 0)
};

}

function getYouTubeApiReady(){

if(window.YT && window.YT.Player){
return Promise.resolve();
}

if(!youtubeApiReadyPromise){

youtubeApiReadyPromise =
new Promise((resolve)=>{

const previousReady =
window.onYouTubeIframeAPIReady;

window.onYouTubeIframeAPIReady = ()=>{

if(typeof previousReady === "function"){
previousReady();
}

resolve();

};

});

}

return youtubeApiReadyPromise;

}

// Player logic remapped to player-core.js



const videosContainer =
document.getElementById("videosContainer");

function escapeHtml(value){

return String(value || "")
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;");

}

function getVideoCardMarkup(video){

const videoId =
escapeHtml(video.videoId);

return `

    <div
      class="video-card"
      onclick="openVideo('${videoId}')"
    >

      <div class="thumbnail">

        <img
          src="https://img.youtube.com/vi/${videoId}/maxresdefault.jpg"
          alt="${escapeHtml(video.title || "Video thumbnail")}"
          loading="lazy"
        >

        <span class="video-time">
          Video
        </span>

      </div>

      <div class="video-info">

        <div class="channel-logo">
          ${escapeHtml(video.logo || "B")}
        </div>

        <div class="video-details">

          <h3>
            ${escapeHtml(video.title)}
          </h3>

          <p class="channel-name">
            ${escapeHtml(video.channel)}
          </p>

          <p class="video-stats">
            ${escapeHtml(video.views)} • ${escapeHtml(video.date)}
          </p>

        </div>

      </div>

    </div>

    `;

}

function setHomeView(viewName){

currentHomeView =
viewName;

const showDashboard =
viewName === "dashboard";

const showVideos =
viewName === "videos";

const showChannels =
viewName === "channels";

const showJourney =
viewName === "journey";

categorySection.style.display =
showDashboard ? "flex" : "none";

channelsSection.style.display =
showDashboard || showChannels ? "block" : "none";

videosSection.style.display =
showDashboard || showVideos ? "grid" : "none";

continueWatchingSection.style.display =
showDashboard ? "" : "none";

journeySection.classList.toggle(
"active",
showJourney
);

if(showJourney){
refreshPersonalSections();
}

sidebar.classList.remove("active");
sidebarOverlay.classList.remove("active");

}

function getThumbnailUrl(item){

return item.thumbnailUrl ||
`https://img.youtube.com/vi/${escapeHtml(item.videoId)}/maxresdefault.jpg`;

}

function getProgressPercent(item){

const percent =
Number(item.completionPercentage || 0);

if(percent > 0){
return Math.min(100, Math.max(0, percent));
}

const duration =
Number(item.duration || 0);

const current =
Number(item.currentPosition || 0);

return duration > 0
? Math.min(100, Math.round((current / duration) * 100))
: 0;

}

async function refreshPersonalSections(){

try{

const analytics =
await watchProgressEngine.getUserAnalytics();

if (analytics && analytics.history) {
  analytics.history.forEach(item => {
    if (item && item.videoId) {
      historyVideoMeta.set(item.videoId, item);
    }
  });
}
if (analytics && analytics.continueWatching) {
  analytics.continueWatching.forEach(item => {
    if (item && item.videoId) {
      historyVideoMeta.set(item.videoId, item);
    }
  });
}

renderContinueWatching(
analytics.continueWatching || []
);

renderDashboard(journeySection, analytics, window.openVideo);

}
catch(error){

if(continueWatchingSection){
continueWatchingSection.style.display = "none";
}

}

}

function renderContinueWatching(items){

const list =
document.getElementById("continueWatchingList");

if(!list) return;

if(!items.length || currentHomeView !== "dashboard"){

list.innerHTML = "";
continueWatchingSection.style.display = "none";
return;

}

continueWatchingSection.style.display = "";

list.innerHTML =
items.slice(0,8).map((item)=>{

const videoId =
escapeHtml(item.videoId);

const progress =
getProgressPercent(item);

return `
<div class="continue-card" onclick="openVideo('${videoId}')">
  <div class="continue-thumb">
    <img src="${escapeHtml(getThumbnailUrl(item))}" alt="${escapeHtml(item.videoTitle || "Continue watching")}" loading="lazy">
    <div class="continue-progress"><span style="width:${progress}%"></span></div>
  </div>
  <div class="continue-body">
    <h3>${escapeHtml(item.videoTitle)}</h3>
    <div class="continue-meta">
      <span>${escapeHtml(item.channelName || "BhaktiTube")}</span>
      <span>${formatRelativeTime(item.lastViewedMs)}</span>
    </div>
  </div>
</div>
`;

}).join("");

}



async function loadVideos(){

  videosContainer.innerHTML = "";

  const completedVideos =
  await watchProgressEngine.getCompletedVideoIds();

  const q = query(
    collection(db,"videos"),
    orderBy("createdAt","desc")
  );

  const snapshot = await getDocs(q);

  allVideos = [];

  snapshot.forEach((doc)=>{

    const video = doc.data();

    if(
      completedVideos.has(
        video.videoId
      )
    ){
      return;
    }

    allVideos.push(video);

    videosContainer.innerHTML +=
    getVideoCardMarkup(video);

    return;

    videosContainer.innerHTML += `

    <div
      class="video-card"
      onclick="openVideo('${video.videoId}')"
    >

      <div class="thumbnail">

        <img
          src="https://img.youtube.com/vi/${video.videoId}/maxresdefault.jpg"
        >

        <span class="video-time">
          Video
        </span>

      </div>

      <div class="video-info">

        <div class="channel-logo">
          ${video.logo}
        </div>

        <div class="video-details">

          <h3>
            ${video.title}
          </h3>

          <p class="channel-name">
            ${video.channel}
          </p>

          <p class="video-stats">
            ${video.views} • ${video.date}
          </p>

        </div>

      </div>

    </div>

    `;

  });

  refreshPersonalSections();

}

async function loadChannels(){

const channelsContainer =
document.getElementById(
"channelsContainer"
);

channelsContainer.innerHTML = "";

const q = query(
collection(db,"channels"),
orderBy("createdAt","desc")
);

const snapshot =
await getDocs(q);

snapshot.forEach((docSnap)=>{

const channel =
docSnap.data();

if(channel.enabled !== true){
return;
}

channelsContainer.innerHTML += getChannelCardMarkup(channel);

});

}



function renderVideos(videos){

    videosContainer.innerHTML = "";

    videos.forEach((video)=>{

        videosContainer.innerHTML +=
        getVideoCardMarkup(video);

        return;

        videosContainer.innerHTML += `

        <div
          class="video-card"
          onclick="openVideo('${video.videoId}')"
        >

          <div class="thumbnail">

            <img
              src="https://img.youtube.com/vi/${video.videoId}/maxresdefault.jpg"
            >

            <span class="video-time">
              Video
            </span>

          </div>

          <div class="video-info">

            <div class="channel-logo">
              ${video.logo}
            </div>

            <div class="video-details">

              <h3>${video.title}</h3>

              <p class="channel-name">
                ${video.channel}
              </p>

              <p class="video-stats">
                ${video.views} • ${video.date}
              </p>

            </div>

          </div>

        </div>

        `;

    });

}

let allVideos = [];


const savedTheme =
localStorage.getItem("theme");

if(savedTheme === "light"){

document.body.classList.add(
"light-mode"
);

}

loadVideos();
loadChannels();
loadNotifications();

const menuBtn =
document.querySelector(".fa-bars");

const sidebar =
document.getElementById("sidebar");

const sidebarOverlay =
document.getElementById("sidebarOverlay");

menuBtn.addEventListener("click",()=>{

sidebar.classList.add("active");

sidebarOverlay.classList.add("active");

});

sidebarOverlay.addEventListener("click",()=>{

sidebar.classList.remove("active");

sidebarOverlay.classList.remove("active");

});

const dashboardBtn =
document.getElementById("dashboardBtn");

const videosBtn =
document.getElementById("videosBtn");

const channelsBtn =
document.getElementById("channelsBtn");

const journeyBtn =
document.getElementById("journeyBtn");

const categorySection =
document.getElementById("categorySection");

const channelsSection =
document.getElementById("channelsSection");

const videosSection =
document.getElementById("videosContainer");

dashboardBtn.addEventListener("click",(e)=>{

e.preventDefault();

setHomeView("dashboard");

});

videosBtn.addEventListener("click",(e)=>{

e.preventDefault();

setHomeView("videos");

});

channelsBtn.addEventListener("click",(e)=>{

e.preventDefault();

setHomeView("channels");

});

journeyBtn.addEventListener("click",(e)=>{

e.preventDefault();

setHomeView("journey");


});


const settingsBtn =
document.getElementById("settingsBtn");

const settingsModal =
document.getElementById("settingsModal");

const closeSettings =
document.getElementById("closeSettings");

settingsBtn.addEventListener("click",(e)=>{

e.preventDefault();

settingsModal.style.display =
"flex";

});

closeSettings.addEventListener("click",()=>{

settingsModal.style.display =
"none";

});


const darkModeBtn =
document.getElementById("darkModeBtn");

darkModeBtn.addEventListener("click",()=>{

document.body.classList.remove("light-mode");

localStorage.setItem(
"theme",
"dark"
);

});

const lightModeBtn =
document.getElementById("lightModeBtn");

lightModeBtn.addEventListener("click",()=>{

document.body.classList.add("light-mode");

localStorage.setItem(
"theme",
"light"
);

});


const searchBtn =
document.getElementById("searchBtn");

const searchOverlay =
document.getElementById("searchOverlay");

searchBtn.addEventListener("click",()=>{

    searchOverlay.classList.toggle("active");

});

const searchInput =
document.getElementById("searchInput");

searchInput.addEventListener("input",()=>{

    const value =
    searchInput.value.toLowerCase();

    const filtered =
    allVideos.filter((video)=>{

        return (

            video.title.toLowerCase().includes(value)

            ||

            video.channel.toLowerCase().includes(value)

        );

    });

    renderVideos(filtered);

});

const closeSearch =
document.getElementById("closeSearch");

closeSearch.addEventListener("click",()=>{

    searchOverlay.classList.remove("active");

});

const voiceBtn =
document.getElementById("voiceBtn");

const SpeechRecognition =
window.SpeechRecognition ||
window.webkitSpeechRecognition;

if(SpeechRecognition){

    const recognition =
    new SpeechRecognition();

    recognition.lang = "gu-IN";

    recognition.continuous = false;

    recognition.interimResults = false;

    const voicePopup =
document.getElementById("voicePopup");

voiceBtn.addEventListener("click",()=>{

    voicePopup.style.display = "flex";

    recognition.start();

});

    recognition.addEventListener("result",(e)=>{

      voicePopup.style.display = "none";

        const text =
        e.results[0][0].transcript;

        searchInput.value = text;

        const filtered =
        allVideos.filter((video)=>{

            return (

                video.title
                .toLowerCase()
                .includes(text.toLowerCase())

                ||

                video.channel
                .toLowerCase()
                .includes(text.toLowerCase())

            );

        });

        renderVideos(filtered);

    });

}else{

    alert(
      "Voice Search not supported"
    );

}

const profileBtn =
document.getElementById("profileBtn");

onAuthStateChanged(auth,(user)=>{

profileBtn.addEventListener("click",()=>{

if(user){

window.location.href =
"./user/profile.html";

}else{

window.location.href =
"./user/signup.html";

}

});

});



window.openVideo = (videoId) => playVideo(videoId, getVideoMetadata(videoId), false);
window.onPlayerClosed = refreshPersonalSections;


const profilePhoto =
document.getElementById("profilePhoto");

onAuthStateChanged(

auth,

(user)=>{

if(user){

profilePhoto.src =

user.photoURL ||

"https://cdn-icons-png.flaticon.com/512/149/149071.png";

}

}

);

bellBtn.addEventListener("click", () => {

  notificationPopup.style.display =
  notificationPopup.style.display === "block"
  ? "none"
  : "block";

});

async function loadNotifications(){

  let notificationCount = 0;

  notificationList.innerHTML = "";

  const videosRef =
collection(db,"videos");

  onSnapshot(videosRef, (snapshot) => {


  const now = Date.now();

  snapshot.forEach(docSnap => {

    const video = docSnap.data();

    if(!video.createdAt) return;

    let createdTime;

if(video.createdAt?.seconds){

    createdTime =
    video.createdAt.seconds * 1000;

}else{

    createdTime =
    Number(video.createdAt);

}
    const hours24 =
    24 * 60 * 60 * 1000;

    if(now - createdTime <= hours24){

    notificationCount++;

   notificationList.innerHTML += `

<div
class="notification-item"
onclick="openVideo('${video.videoId}')"
>

    <img
    src="https://img.youtube.com/vi/${video.videoId}/maxresdefault.jpg">

    <div class="notification-details">

        <h4>${video.title}</h4>

        <p>${video.channel}</p>

        <span>🆕 New Video</span>

    </div>

</div>

`;

}

  });

  document.getElementById(
"notificationCount"
).innerText = notificationCount;

});

}


document.getElementById(
"channelsLoader"
).style.display = "none";

document.getElementById(
"videosLoader"
).style.display = "none";


document.querySelectorAll('.logo,.sidebar-logo')
.forEach(el => {

    el.addEventListener('click',()=>{

        window.location.href = "index.html";

    });

});

const openShortsBtn =
document.getElementById(
"openShortsBtn"
);

if(openShortsBtn){

openShortsBtn.addEventListener(
"click",
()=>{

window.location.href =
"shorts.html";

});

}

document.addEventListener("gesturestart", function(e){
    e.preventDefault();
});

document.addEventListener("gesturechange", function(e){
    e.preventDefault();
});

document.addEventListener("gestureend", function(e){
    e.preventDefault();
});

let lastTouchEnd = 0;

document.addEventListener("touchend", function(event){

    const now = Date.now();

    if(now - lastTouchEnd <= 300){
        event.preventDefault();
    }

    lastTouchEnd = now;

}, { passive:false });
