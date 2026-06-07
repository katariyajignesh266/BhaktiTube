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


/* OPEN VIDEO */

async function openVideo(videoId){

  notificationPopup.style.display = "none";

  console.log("Video Clicked");

const ad =
await getAdvertisement();

if(ad){

await updateDoc(
doc(db,"advertisements",ad.id),
{
views: increment(1)
}
);

}


if(ad && ad.active){

adPopup.style.display = "flex";

adVideo.src =
ad.videoUrl;

visitAdBtn.onclick = async ()=>{

await updateDoc(
doc(db,"advertisements",ad.id),
{
clicks: increment(1)
}
);

window.open(
ad.redirectLink,
"_blank"
);

};

let seconds =
ad.skipAfter;

skipAdBtn.disabled = true;

skipAdBtn.textContent =
`Skip Ad (${seconds})`;

const timer =
setInterval(()=>{

seconds--;

skipAdBtn.textContent =
`Skip Ad (${seconds})`;

if(seconds <= 0){

clearInterval(timer);

skipAdBtn.disabled = false;

skipAdBtn.textContent =
"Skip Ad";

}

},1000);

function startMainVideo(){

adPopup.style.display =
"none";

adVideo.pause();

adVideo.src = "";

videoPopup.style.display =
"flex";

document.body.style.overflow =
"hidden";

youtubePlayer.src =
`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&fs=1&playsinline=0`;

}

skipAdBtn.onclick = ()=>{

startMainVideo();

};

adVideo.onended = ()=>{

startMainVideo();

};

}
else{

videoPopup.style.display =
"flex";

youtubePlayer.src =
`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&fs=1&playsinline=0`;

}

}



/* CLOSE VIDEO */

function closeVideo(){

    youtubePlayer.src = "";

    videoPopup.style.display = "none";

    document.body.style.overflow = "auto";



    /* PORTRAIT BACK */

    if(screen.orientation){

        screen.orientation.unlock();

    }

}



/* CLICK OUTSIDE */

videoPopup.addEventListener("click",(e)=>{

    if(e.target === videoPopup){

        closeVideo();

    }

});



/* FULLSCREEN AUTO LANDSCAPE */

youtubePlayer.addEventListener("fullscreenchange", async ()=>{

    if(document.fullscreenElement){

        try{

            await screen.orientation.lock("landscape");

        }catch(err){

            console.log(err);

        }

    }else{

        try{

            screen.orientation.unlock();

        }catch(err){

            console.log(err);

        }

    }

});



const videosContainer =
document.getElementById("videosContainer");

async function loadVideos(){

  videosContainer.innerHTML = "";

  const q = query(
    collection(db,"videos"),
    orderBy("createdAt","desc")
  );

  const snapshot = await getDocs(q);

  allVideos = [];

  snapshot.forEach((doc)=>{

    const video = doc.data();

    allVideos.push(video);

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

channelsContainer.innerHTML += `

<div class="channel-card">

<img
src="${channel.channelLogo}"
class="channel-img">

<h3>${channel.channelName}</h3>

<p>👥 ${channel.subscribers}</p>

<p>🎬 ${channel.totalVideos} Videos</p>

<a
href="channel.html?id=${channel.channelId}">

View Channel

</a>

</div>

`;

});

}



function renderVideos(videos){

    videosContainer.innerHTML = "";

    videos.forEach((video)=>{

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

const categorySection =
document.getElementById("categorySection");

const channelsSection =
document.getElementById("channelsSection");

const videosSection =
document.getElementById("videosContainer");

dashboardBtn.addEventListener("click",(e)=>{

e.preventDefault();

categorySection.style.display =
"flex";

channelsSection.style.display =
"block";

videosSection.style.display =
"grid";

sidebar.classList.remove("active");

sidebarOverlay.classList.remove("active");

});

videosBtn.addEventListener("click",(e)=>{

e.preventDefault();

categorySection.style.display =
"none";

channelsSection.style.display =
"none";

videosSection.style.display =
"grid";

sidebar.classList.remove("active");

sidebarOverlay.classList.remove("active");

});

channelsBtn.addEventListener("click",(e)=>{

e.preventDefault();

categorySection.style.display =
"none";

channelsSection.style.display =
"block";

videosSection.style.display =
"none";

sidebar.classList.remove("active");

sidebarOverlay.classList.remove("active");

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



window.openVideo = openVideo;
window.closeVideo = closeVideo;


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