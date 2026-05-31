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
  getDoc
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";




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

  console.log("Video Clicked");

const ad =
await getAdvertisement();



if(ad && ad.active){

adPopup.style.display = "flex";

adVideo.src =
ad.videoUrl;

visitAdBtn.onclick = ()=>{

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
`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;

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
`https://www.youtube.com/embed/${videoId}?autoplay=1`;

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

loadVideos();

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

if(profileBtn){

    profileBtn.addEventListener(
        "click",

        ()=>{

            window.location.href =
            "user/profile.html";

        }

    );

}



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

