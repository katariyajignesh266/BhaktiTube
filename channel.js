import { db } from "./firebase-config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const API_KEY = "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE";

let nextPageToken = "";
let loading = false;
let uploadsPlaylistId = "";

let ytPlayer = null;
let isMuted = false;
let controlsTimeout = null;

const params = new URLSearchParams(window.location.search);
const channelId = params.get("id");

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
  if (loader) loader.style.display = "block";
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${pageToken}&key=${API_KEY}`
    );
    if (!response.ok) return;
    const data = await response.json();
    if (!data.items) return;

    nextPageToken = data.nextPageToken || "";
    const container = document.getElementById("channelVideosContainer");
    if (pageToken === "" && container) container.innerHTML = "";

    data.items.forEach(video => {
      if (video.snippet && video.snippet.resourceId && container) {
        container.innerHTML += `
          <div class="video-card" onclick="openVideo('${video.snippet.resourceId.videoId}')" style="margin-bottom: 20px; background: #1f1f1f; border-radius: 8px; overflow: hidden; padding-bottom: 10px; cursor: pointer;">
            <img src="${video.snippet.thumbnails.high.url}" style="width: 100%; display: block;">
            <h3 style="font-size: 14px !important; font-weight: 500; line-height: 1.5 !important; margin: 10px; color: #ffffff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; height: 50px;">
              ${video.snippet.title}
            </h3>
          </div>
        `;
      }
    });
  } catch (error) {
    console.error(error);
  } finally {
    if (loader) loader.style.display = "none";
  }
}

window.openVideo = async function(videoId) {
  const popup = document.getElementById("videoPopup");
  const playerIframe = document.getElementById("youtubePlayer");
  if (popup) popup.style.display = "flex";
  if (playerIframe) {
    playerIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1&rel=0&enablejsapi=1&playsinline=1&iv_load_policy=3&origin=${window.location.origin}`;
  }
  if (!ytPlayer) {
    ytPlayer = new YT.Player('youtubePlayer', {
      events: {
        'onReady': (event) => {
          event.target.playVideo();
          isMuted = false;
          const muteBtn = document.getElementById('muteBtn');
          if(muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        }
      }
    }
    );
  }
}

window.playVideo = function() { if (ytPlayer && typeof ytPlayer.playVideo === "function") ytPlayer.playVideo(); }
window.pauseVideo = function() { if (ytPlayer && typeof ytPlayer.pauseVideo === "function") ytPlayer.pauseVideo(); }
window.toggleMute = function() {
  const muteBtn = document.getElementById('muteBtn');
  if (ytPlayer && typeof ytPlayer.mute === "function") {
    if (isMuted) {
      ytPlayer.unMute(); isMuted = false;
      if(muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    } else {
      ytPlayer.mute(); isMuted = true;
      if(muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    }
  }
}

window.toggleFullScreen = function() {
  const container = document.getElementById('videoContainer');
  if (!container) return;
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (container.requestFullscreen) { container.requestFullscreen().catch(e => console.log(e)); }
    else if (container.webkitRequestFullscreen) { container.webkitRequestFullscreen(); }
  } else {
    if (document.exitFullscreen) { document.exitFullscreen(); }
    else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
  }
}

// 🌟 ફૂલસ્ક્રીન દરમિયાન આખી સ્ક્રીન પર ગમે ત્યાં ટચ કરવાથી બટન શો/હાઈડ કરવાનું લોજિક
window.handleOverlayTouch = function() {
  const overlay = document.getElementById('fullscreenOverlay');
  if (!overlay) return;

  // જો બટન ઓલરેડી હાઇડ હોય, તો શો કરો અને ટાઈમર સેટ કરો
  if (overlay.classList.contains('hide-fs-btn')) {
    overlay.classList.remove('hide-fs-btn');
    startControlsTimer();
  } else {
    // જો દેખાતું હોય, તો ટચ કરવાથી તરત હાઇડ કરી દો
    overlay.classList.add('hide-fs-btn');
    clearTimeout(controlsTimeout);
  }
}

function startControlsTimer() {
  clearTimeout(controlsTimeout);
  controlsTimeout = setTimeout(() => {
    const overlay = document.getElementById('fullscreenOverlay');
    const isFS = document.fullscreenElement || document.webkitFullscreenElement;
    if (isFS && overlay) {
      overlay.classList.add('hide-fs-btn'); // ૨ સેકન્ડ પછી આપોઆપ હાઇડ થશે
    }
  }, 2000);
}

const handleFullscreenChange = async () => {
  const playerIframe = document.getElementById("youtubePlayer");
  const overlay = document.getElementById("fullscreenOverlay");
  const isFS = document.fullscreenElement || document.webkitFullscreenElement;
  
  if (isFS) {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape").catch(e => console.log(e));
      }
      if (playerIframe) playerIframe.classList.add("fullscreen");
      
      // ફૂલસ્ક્રીન થતાં જ ઓવરલે બટન બતાવો અને ટાઈમર શરૂ કરો
      if (overlay) overlay.classList.remove('hide-fs-btn');
      startControlsTimer();

    } catch (err) {
      console.log("FS Entry Error: ", err);
    }
  } else {
    try {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      if (playerIframe) playerIframe.classList.remove("fullscreen");
      clearTimeout(controlsTimeout);
      if (overlay) overlay.classList.remove('hide-fs-btn');
    } catch (err) {
      console.log(err);
    }
  }
};

document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

window.closeVideo = function() {
  const popup = document.getElementById("videoPopup");
  const playerIframe = document.getElementById("youtubePlayer");
  if (popup) popup.style.display = "none";
  if (playerIframe) playerIframe.src = "";
  if (ytPlayer && typeof ytPlayer.stopVideo === "function") ytPlayer.stopVideo();
}

const trigger = document.getElementById("loadMoreTrigger");
if (trigger) {
  const observer = new IntersectionObserver(async (entries) => {
    if (entries[0].isIntersecting && !loading && nextPageToken) {
      loading = true;
      await loadYouTubeVideos(uploadsPlaylistId, nextPageToken);
      loading = false;
    }
  }, { threshold: 0.1 });
  observer.observe(trigger);
}

window.goHome = function() { window.location.href = "index.html"; }

document.addEventListener("visibilitychange", function() {
  if (document.hidden && typeof window.closeVideo === "function") {
    window.closeVideo();
  }
});