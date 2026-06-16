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
let timeUpdateInterval = null;

const params = new URLSearchParams(window.location.search);
const channelId = params.get("id");

// ૧. પેજ લોડ થતા જ ફાયરબેઝમાંથી ચેનલ ડેટા મેળવવો
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

// ૨. યુટ્યુબ API માંથી વીડિયો લીસ્ટ લોડ કરવું
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

// ૩. કસ્ટમ વીડિયો પ્લેયર પોપઅપ ઓપન કરવું
window.openVideo = async function(videoId) {
  const popup = document.getElementById("videoPopup");
  const playerIframe = document.getElementById("youtubePlayer");
  if (popup) popup.style.display = "flex";
  
  if (playerIframe) {
    // આઇફ્રેમમાં યુટ્યુબના ડિફોલ્ટ બટનો અને કીબોર્ડ બંધ કરવા માટેના પેરામીટર્સ સેટ કર્યા છે
    playerIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&enablejsapi=1&playsinline=1&iv_load_policy=3&origin=${window.location.origin}`;
  }
  
  if (!ytPlayer) {
    ytPlayer = new YT.Player('youtubePlayer', {
      events: {
        'onReady': (event) => {
          event.target.playVideo();
          isMuted = false;
          updateMuteButtons();
          startTimeTracking();
          startControlsTimer();
        },
        'onStateChange': (event) => {
          // જો યુઝર બેકગ્રાઉન્ડમાં વીડિયો પ્લે કરે તો પણ ટ્રેકિંગ ચાલુ રાખવું
          if (event.data === YT.PlayerState.PLAYING) {
            startTimeTracking();
          } else {
            clearInterval(timeUpdateInterval);
          }
        }
      }
    });
  } else {
    setTimeout(() => {
      if(ytPlayer && typeof ytPlayer.cueVideoById === "function") {
        ytPlayer.cueVideoById(videoId);
        ytPlayer.playVideo();
        startTimeTracking();
        startControlsTimer();
      }
    }, 500);
  }
}

// ૪. રિયલ-ટાઇમ પ્રોગ્રેસ બાર અને ટાઇમર અપડેટ લોજિક
function startTimeTracking() {
  clearInterval(timeUpdateInterval);
  timeUpdateInterval = setInterval(() => {
    if (ytPlayer && typeof ytPlayer.getCurrentTime === "function") {
      const current = ytPlayer.getCurrentTime();
      const total = ytPlayer.getDuration();
      
      if (total > 0) {
        // ગ્રીન પ્રોગ્રેસ બારની વિડ્થ (લાંબી લાઈન) સેટ કરવી
        const pct = (current / total) * 100;
        const pBar = document.getElementById("progressBar");
        if (pBar) pBar.style.width = pct + "%";
        
        // HTML માં ટાઇમ અપડેટ કરવો (દા.ત. 00:26 / 01:24)
        document.getElementById("currentTime").textContent = formatTime(current);
        document.getElementById("totalTime").textContent = formatTime(total);
      }
    }
  }, 500);
}

// સેકન્ડ્સને પ્રોપર MM:SS ફોર્મેટમાં ફેરવવાનું હેલ્પર ફંક્શન
function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ૫. ૧૦ સેકન્ડ આગળ અથવા પાછળ સ્કીપ કરવાનું ફંક્શન
window.skipTime = function(seconds) {
  if (ytPlayer && typeof ytPlayer.getCurrentTime === "function" && typeof ytPlayer.seekTo === "function") {
    const currentTime = ytPlayer.getCurrentTime();
    ytPlayer.seekTo(currentTime + seconds, true);
    
    // આઇફ્રેમ પરથી ફોકસ હટાવવું જેથી ડિફોલ્ટ બટનો જલ્દી ગાયબ થાય
    if (document.activeElement) {
        document.activeElement.blur();
    }
    
    startControlsTimer();
  }
}

// ૬. મ્યુટ / અનમ્યુટ કરવાનું ફંક્શન
window.toggleMute = function() {
  if (ytPlayer && typeof ytPlayer.mute === "function") {
    if (isMuted) {
      ytPlayer.unMute(); isMuted = false;
    } else {
      ytPlayer.mute(); isMuted = true;
    }
    updateMuteButtons();
  }
}

function updateMuteButtons() {
  const muteBtn = document.getElementById('muteBtn');
  const icon = isMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
  if(muteBtn) muteBtn.innerHTML = icon;
}

// ૭. વીડિયો પ્લેબેક સ્પીડ બદલવાનું લોજિક
window.toggleSpeedMenu = function() {
  const menu = document.getElementById("speedMenu");
  if (menu) menu.classList.toggle("show");
}

window.changeSpeed = function(speed) {
  if (ytPlayer && typeof ytPlayer.setPlaybackRate === "function") {
    ytPlayer.setPlaybackRate(speed);
    document.getElementById("speedTxt").textContent = speed === 1 ? "Normal" : speed + "x";
    document.getElementById("speedMenu").classList.remove("show");
  }
}

// ૮. ફુલસ્ક્રીન એન્ટર / એક્ઝિટ કંટ્રોલ
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

// ૯. સ્ક્રીન પર ટચ કરવાથી કંટ્રોલ્સ લાવવા/છુપાવવાનું માસ્ટર ફંક્શન
window.handleOverlayTouch = function() {
  const overlay = document.getElementById('customOverlay');
  if (!overlay) return;

  if (overlay.classList.contains('hide-controls')) {
    overlay.classList.remove('hide-controls');
    startControlsTimer();
  } else {
    overlay.classList.add('hide-controls');
    clearTimeout(controlsTimeout);
  }
}

// ૨.૫ સેકન્ડ સુધી કોઈ ટચ ન થાય તો કંટ્રોલ્સ ઓટોમેટિક ગાયબ કરવા
function startControlsTimer() {
  clearTimeout(controlsTimeout);
  controlsTimeout = setTimeout(() => {
    const overlay = document.getElementById('customOverlay');
    if (overlay) {
      overlay.classList.add('hide-controls');
    }
  }, 2500); 
}

// ૧૦. સ્ક્રીન રોટેશન અને ઓરિએન્ટેશન લોક (Landscape mode)
const handleFullscreenChange = async () => {
  const playerIframe = document.getElementById("youtubePlayer");
  const fsBtn = document.getElementById("fsBtn");
  const isFS = document.fullscreenElement || document.webkitFullscreenElement;
  
  if (isFS) {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape").catch(e => console.log(e));
      }
      if (playerIframe) playerIframe.classList.add("fullscreen");
      if (fsBtn) fsBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
      startControlsTimer();
    } catch (err) {
      console.log("FS Entry Error: ", err);
    }
  } else {
    try {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      if (playerIframe) playerIframe.classList.remove("fullscreen");
      if (fsBtn) fsBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
      startControlsTimer();
    } catch (err) {
      console.log(err);
    }
  }
};

document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

// ૧૧. વીડિયો પ્લેયર પોપઅપ બંધ કરવું
window.closeVideo = function() {
  clearInterval(timeUpdateInterval);
  const popup = document.getElementById("videoPopup");
  const playerIframe = document.getElementById("youtubePlayer");
  if (popup) popup.style.display = "none";
  if (playerIframe) playerIframe.src = "";
  if (ytPlayer && typeof ytPlayer.stopVideo === "function") ytPlayer.stopVideo();
}

// ૧૨. ઈન્ફિનાઈટ સ્ક્રોલ (Load More Videos) લોજિક
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

// જો યુઝર એપ મિનિમાઇઝ કરે કે ટેબ બદલે તો વીડિયો ઓટોમેટિક બંધ કરવો
document.addEventListener("visibilitychange", function() {
  if (document.hidden && typeof window.closeVideo === "function") {
    window.closeVideo();
  }
});