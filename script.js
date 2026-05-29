import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";




console.log("BhaktiTube Loaded");

const videoPopup =
document.getElementById("videoPopup");

const youtubePlayer =
document.getElementById("youtubePlayer");



/* OPEN VIDEO */

function openVideo(videoId){

    videoPopup.style.display = "flex";

    document.body.style.overflow = "hidden";



    youtubePlayer.src =
    `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=0`;

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

  snapshot.forEach((doc)=>{

    const video = doc.data();

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

loadVideos();



window.openVideo = openVideo;
window.closeVideo = closeVideo;