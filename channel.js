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
let controlsTimeout = null; // ઓટો-હાઇડ ટાઈમર રાખવા માટેનો વેરીએબલ

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
  if (loader) loader.style.display = "block";

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
      if (container) container.innerHTML = "";
    }

    data.items.forEach(video => {
      if (video.snippet && video.snippet.resourceId && container) {
        container.innerHTML += `
          <div class="video-card" onclick="openVideo('${video.snippet.resourceId.videoId}')" style="margin-bottom: 20px; background: #1f1f1f; border-radius: 8px; overflow: hidden; padding-bottom: 10px; cursor: pointer;">
            <img src="${video.snippet.thumbnails.high.url}" style="width: 100%; display: block;">
            
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
    if (loader) loader.style.display = "none";
  }
}

// વિડિયો પર ક્લિક કરવાથી પોપઅપ ખુલશે અને કસ્ટમ કંટ્રોલ્સ સેટ થશે
window.openVideo = async function(videoId) {
  const popup = document.getElementById("videoPopup");
  const playerIframe = document.getElementById("youtubePlayer");

  if (popup) popup.style.display = "flex";

  // controls=0 થી કંટ્રોલ્સ ગાયબ થશે અનેenablejsapi=1 એક્ટિવેટ થશે
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
    });
  }
}

// કસ્ટમ બટન્સ માટેના કંટ્રોલ ફંક્શન્સ
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
  if (!container) return;
  
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (container.requestFullscreen) {
      container.requestFullscreen().catch(err => console.log(err.message));
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

// જ્યારે આખું કન્ટેનર ફૂલસ્ક્રીન મોડમાં જાય/આવે ત્યારે કંટ્રોલ્સ સેટ કરવા
const handleFullscreenChange = async () => {
  const playerIframe = document.getElementById("youtubePlayer");
  const container = document.querySelector('.video-container');
  const lastBtn = document.querySelector('.custom-controls button:last-child');
  
  const isFS = document.fullscreenElement || document.webkitFullscreenElement;
  
  if (isFS) {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape").catch(e => console.log(e));
      }
      if (playerIframe) playerIframe.classList.add("fullscreen");
      
      // પાવરફુલ જાવાસ્ક્રિપ્ટ ફિક્સ: બટનને સેન્ટરમાંથી ખેંચીને સાવ જમણે નીચે ફિક્સ કરવા માટે
      if (lastBtn) {
        lastBtn.style.setProperty('position', 'fixed', 'important');
        lastBtn.style.setProperty('right', '20px', 'important');
        lastBtn.style.setProperty('bottom', '20px', 'important');
        lastBtn.style.setProperty('left', 'auto', 'important');
        lastBtn.style.setProperty('top', 'auto', 'important');
        lastBtn.style.setProperty('margin', '0', 'important');
        lastBtn.style.setProperty('transform', 'none', 'important');
      }
      
      showControlsAndSetTimeout();
      
      if (container) {
        container.addEventListener('mousemove', showControlsAndSetTimeout);
        container.addEventListener('touchstart', showControlsAndSetTimeout);
      }

    } catch (err) {
      console.log("FS Entry Error: ", err);
    }
  } else {
    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
      if (playerIframe) playerIframe.classList.remove("fullscreen");
      
      // નોર્મલ મોડમાં આવતા જ ફોર્સ કરેલી સ્ટાઈલ હટાવી દો
      if (lastBtn) {
        lastBtn.style.removeProperty('position');
        lastBtn.style.removeProperty('right');
        lastBtn.style.removeProperty('bottom');
        lastBtn.style.removeProperty('left');
        lastBtn.style.removeProperty('top');
        lastBtn.style.removeProperty('margin');
        lastBtn.style.removeProperty('transform');
      }
      
      clearTimeout(controlsTimeout);
      if (container) {
        container.removeEventListener('mousemove', showControlsAndSetTimeout);
        container.removeEventListener('touchstart', showControlsAndSetTimeout);
        container.classList.remove('hide-controls-active');
      }
    } catch (err) {
      console.log(err);
    }
  }
};

document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

// બટન બતાવવા અને ૨ સેકન્ડ પછી છુપાવવાનું ફંક્શન
function showControlsAndSetTimeout() {
  const container = document.querySelector('.video-container');
  if (!container) return;
  
  container.classList.remove('hide-controls-active');
  clearTimeout(controlsTimeout);
  
  controlsTimeout = setTimeout(() => {
    const isFS = document.fullscreenElement || document.webkitFullscreenElement;
    if (isFS) {
      container.classList.add('hide-controls-active');
    }
  }, 2000); 
}

// વિડિયો બંધ કરવાનું ફંક્શન
window.closeVideo = function() {
  const popup = document.getElementById("videoPopup");
  const playerIframe = document.getElementById("youtubePlayer");
  
  if (popup) popup.style.display = "none";
  if (playerIframe) playerIframe.src = "";
  
  if (ytPlayer && typeof ytPlayer.stopVideo === "function") {
    ytPlayer.stopVideo();
  }
}

// ઇન્ફિનિટ સ્ક્રોલ લોડર (Intersection Observer)
const trigger = document.getElementById("loadMoreTrigger");
if (trigger) {
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
  observer.observe(trigger);
}

window.goHome = function() {
  window.location.href = "index.html";
}

// જ્યારે વેબસાઇટ બેકગ્રાઉન્ડમાં જાય ત્યારે વિડિયો સ્ટોપ થાય
document.addEventListener("visibilitychange", function() {
  if (document.hidden) {
    if (typeof window.closeVideo === "function") {
      window.closeVideo();
    }
  }
});