import { db } from "./firebase-config.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const API_KEY = "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE";

let nextPageToken = "";
let loading = false;
let uploadsPlaylistId = "";

// YouTube Player Instance અને મ્યુટ સ્ટેટ રાખવા માટેના ગ્લોબલ વેરીએબલ્સ
let ytPlayer = null;
let isMuted = false;

const params = new URLSearchParams(window.location.search);
const channelId = params.get("id");

console.log("Channel ID:", channelId);

loadChannel();

async function loadChannel() {
  const snapshot = await getDocs(collection(db, "channels"));

  snapshot.forEach((doc) => {
    const channel = doc.data();

    if (channel.channelId === channelId) {
      document.getElementById("channelLogo").src = channel.channelLogo;
      document.getElementById("channelName").textContent = channel.channelName;
      document.getElementById("channelSubscribers").textContent = "Subscribers : " + channel.subscribers;
      document.getElementById("channelVideos").textContent = "Videos : " + channel.totalVideos;

      uploadsPlaylistId = channel.uploadsPlaylistId;
      loadYouTubeVideos(channel.uploadsPlaylistId);
    }
  });
}

async function loadYouTubeVideos(playlistId, pageToken = "") {
  const loader = document.getElementById("loader");
  loader.style.display = "block";

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${pageToken}&key=${API_KEY}`
    );

    if (!response.ok) {
      console.log("YouTube API Error", response.status);
      return;
    }

    const data = await response.json();

    if (!data.items) {
      console.log(data);
      return;
    }

    nextPageToken = data.nextPageToken || "";

    const container = document.getElementById("channelVideosContainer");

    if (pageToken === "") {
      container.innerHTML = "";
    }

data.items.forEach(video => {
  if (video.snippet && video.snippet.resourceId) {
    container.innerHTML += `
      <div class="video-card" onclick="openVideo('${video.snippet.resourceId.videoId}')" style="margin-bottom: 20px; background: #1f1f1f; border-radius: 8px; overflow: hidden; padding-bottom: 10px;">
        <img src="${video.snippet.thumbnails.high.url}" style="width: 100%; display: block;">
        
        <!-- અક્ષરો નાના કરવા, લાઇન વચ્ચે સ્પેસ રાખવા અને ટેક્સ્ટ કપાય નહીં તે માટેનું ફિક્સ -->
        <h3 style="
          font-size: 14px !important; 
          font-weight: 500; 
          line-height: 1.5 !important; 
          margin: 10px; 
          color: #ffffff;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          height: 50px;
        ">
          ${video.snippet.title}
        </h3>
      </div>
    `;
  }
});

  } catch (error) {
    console.error(error);
  } finally {
    loader.style.display = "none";
  }
}

// વિડિયો પર ક્લિક કરવાથી પોપઅપ ખુલશે અને કસ્ટમ કંટ્રોલ્સ સેટ થશે
window.openVideo = async function(videoId) {
  const popup = document.getElementById("videoPopup");
  const playerIframe = document.getElementById("youtubePlayer");

  popup.style.display = "flex";

  // controls=0 થી જુના નાના કંટ્રોલ્સ ગાયબ થશે, અને enablejsapi=1 થી API એક્ટિવેટ થશે
  playerIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1&rel=0&enablejsapi=1&playsinline=1&iv_load_policy=3&origin=${window.location.origin}`;

  // જો આઈફ્રેમ પ્લેયર પહેલેથી બનેલું ન હોય, તો નવું કન્સ્ટ્રક્ટ કરવું
  if (!ytPlayer) {
    ytPlayer = new YT.Player('youtubePlayer', {
      events: {
        'onReady': (event) => {
          event.target.playVideo();
          // મ્યુટ સ્ટેટ રીસેટ કરવું
          isMuted = false;
          const muteBtn = document.getElementById('muteBtn');
          if(muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        }
      }
    });
  }
}

// કસ્ટમ બટન્સ માટેના કંટ્રોલ ફંક્શન્સ (HTML માંથી ઓન-ક્લિક પર ચાલશે)
window.playVideo = function() {
  if (ytPlayer && typeof ytPlayer.playVideo === "function") {
    ytPlayer.playVideo();
  }
}

window.pauseVideo = function() {
  if (ytPlayer && typeof ytPlayer.pauseVideo === "function") {
    ytPlayer.pauseVideo();
  }
}

window.toggleMute = function() {
  const muteBtn = document.getElementById('muteBtn');
  if (ytPlayer && typeof ytPlayer.mute === "function") {
    if (isMuted) {
      ytPlayer.unMute();
      isMuted = false;
      if(muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    } else {
      ytPlayer.mute();
      isMuted = true;
      if(muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    }
  }
}

// કસ્ટમ ફૂલસ્ક્રીન અને આડી (Landscape) સ્ક્રીન લોક કરવાનું લોજિક
window.toggleFullScreen = function() {
  const container = document.querySelector('.video-container');
  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => {
      console.log(`Error full screen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}

// જ્યારે આખું કન્ટેનર ફૂલસ્ક્રીન મોડમાં જાય/આવે ત્યારે ઓરિએન્ટેશન સેટ કરવું
document.addEventListener("fullscreenchange", async () => {
  const playerIframe = document.getElementById("youtubePlayer");
  if (document.fullscreenElement) {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape");
      }
      playerIframe.classList.add("fullscreen");
    } catch (err) {
      console.log("Orientation Lock Error: ", err);
    }
  } else {
    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
      playerIframe.classList.remove("fullscreen");
    } catch (err) {
      console.log(err);
    }
  }
});

// વિડિયો બંધ કરવાનું ફંક્શન
window.closeVideo = function() {
  document.getElementById("videoPopup").style.display = "none";
  document.getElementById("youtubePlayer").src = "";
  
  if (ytPlayer && typeof ytPlayer.stopVideo === "function") {
    ytPlayer.stopVideo();
  }
}

// ઇન્ફિનิต સ્ક્રોલ લોડર (Intersection Observer)
const observer = new IntersectionObserver(
  async (entries) => {
    if (entries[0].isIntersecting && !loading && nextPageToken) {
      loading = true;
      await loadYouTubeVideos(uploadsPlaylistId, nextPageToken);
      loading = false;
    }
  },
  { threshold: 0.1 }
);

observer.observe(document.getElementById("loadMoreTrigger"));

window.goHome = function() {
  window.location.href = "index.html";
}

// જ્યારે વેબસાઇટ બેકગ્રાઉન્ડમાં જાય ત્યારે વિડિયો સ્ટોપ થાય
document.addEventListener("visibilitychange", function() {
  if (document.hidden) {
    console.log("વેબસાઇટ બેકગ્રાઉન્ડમાં ગઈ, વિડિયો સ્ટોપ થાય છે...");
    if (typeof window.closeVideo === "function") {
      window.closeVideo();
    }
  }
});