import {
db,
auth
}
from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  setDoc
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import {
watchProgressEngine
}
from "./analytics-engine.js";

const API_KEY = "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE";

const watchedVideos =
new Set(
JSON.parse(
localStorage.getItem(
"watchedChannelVideos"
) || "[]"
)
);

let currentVideoId = null;
let watchedSaved = false;
let channelVideoMeta = new Map();

let nextPageToken = "";
let loading = false;
let uploadsPlaylistId = "";

let ytPlayer = null;
let isMuted = false;
let controlsTimeout = null;
let timeUpdateInterval = null;
let playbackSessionStarted = false;

const params = new URLSearchParams(window.location.search);
const channelId = params.get("id");

watchProgressEngine.init({
source:"channel"
});

// ૧. પેજ લોડ થતા જ ફાયરબેઝમાંથી ચેનલ ડેટા મેળવવો
loadChannel();

async function loadChannel() {
  const user =
auth.currentUser;

if(user){

const watchedSnapshot =
await getDocs(

collection(
db,
"users",
user.uid,
"watchedChannelVideos"
)

);

watchedSnapshot.forEach(doc=>{

watchedVideos.add(
doc.id
);

});

}
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

    const videoIds =
data.items
.map(item =>
item.snippet.resourceId.videoId
)
.join(",");

const detailsResponse =
await fetch(
`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${API_KEY}`
);

const detailsData =
await detailsResponse.json();

for(
let i = 0;
i < data.items.length;
i++
){

const item =
data.items[i];

const details =
detailsData.items[i];

if(
!details ||
!details.contentDetails
){
continue;
}

const duration =
details.contentDetails.duration;

const seconds =
convertDurationToSeconds(
duration
);

const videoId =
item.snippet.resourceId.videoId;

channelVideoMeta.set(
videoId,
{
videoId,
videoTitle:item.snippet.title,
title:item.snippet.title,
channelId:item.snippet.channelId || channelId,
channelName:item.snippet.videoOwnerChannelTitle || document.getElementById("channelName").textContent || "BhaktiTube",
thumbnailUrl:item.snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
duration:seconds
}
);

if(seconds < 300){
continue;
}

if(
watchedVideos.has(
videoId
)
){
continue;
}

container.innerHTML += `
<div
class="video-card"
onclick="openVideo('${videoId}')"
style="
margin-bottom:20px;
background:#111;
border-radius:1px;
overflow:hidden;
padding-bottom:10px;
cursor:pointer;
padding-top: 0px;
padding-left: 0px;
padding-right: 0px;
">

<img
src="${item.snippet.thumbnails.high.url}"
style="
width:100%;
display:block;
">

<h3
style="
font-size:14px !important;
font-weight:500;
line-height:1.5 !important;
margin:10px;
color:#ffffff;
display:-webkit-box;
-webkit-line-clamp:2;
-webkit-box-orient:vertical;
overflow:hidden;
text-overflow:ellipsis;
height:50px;
">

${item.snippet.title}

</h3>

</div>
`;

}
  } catch (error) {
    console.error(error);
  } finally {
    if (loader) loader.style.display = "none";
  }
}

// ૩. કસ્ટમ વીડિયો પ્લેયર પોપઅપ ઓપન કરવું
window.openVideo = async function(videoId) {

  currentVideoId = videoId;
watchedSaved = false;
playbackSessionStarted = false;


  const popup = document.getElementById("videoPopup");
  const playerIframe = document.getElementById("youtubePlayer");
  if (popup) popup.style.display = "flex";

  let resumePosition = 0;

  try{

    const session =
    await watchProgressEngine.startSession(
      getChannelVideoMeta(videoId),
      {
        source:"channel"
      }
    );

    resumePosition =
    session.resumePosition || 0;

    playbackSessionStarted = true;

  }
  catch(error){

    resumePosition = 0;

  }
  
  if (playerIframe) {
    // આઇફ્રેમમાં યુટ્યુબના ડિફોલ્ટ બટનો અને કીબોર્ડ બંધ કરવા માટેના પેરામીટર્સ સેટ કર્યા છે
    playerIframe.src = buildChannelEmbedUrl(
      videoId,
      resumePosition
    );
  }
  
  if (!ytPlayer) {
    ytPlayer = new YT.Player('youtubePlayer', {
      events: {
        'onReady': (event) => {
          if(resumePosition > 0){
            event.target.seekTo(
              resumePosition,
              true
            );
          }

          event.target.playVideo();
          isMuted = false;
          updateMuteButtons();
          startTimeTracking();
          startControlsTimer();
        },
        'onStateChange': (event) => {
          // જો યુઝર બેકગ્રાઉન્ડમાં વીડિયો પ્લે કરે તો પણ ટ્રેકિંગ ચાલુ રાખવું
          if (event.data === YT.PlayerState.PLAYING) {
            watchProgressEngine.setPlaybackState(
              "playing",
              {
                currentPosition:getPlayerCurrentTime(),
                duration:getPlayerDuration()
              }
            );
            startTimeTracking();
          } else {
            if(event.data === YT.PlayerState.PAUSED){
              watchProgressEngine.setPlaybackState(
                "paused",
                {
                  currentPosition:getPlayerCurrentTime(),
                  duration:getPlayerDuration()
                }
              );
            }

            if(event.data === YT.PlayerState.BUFFERING){
              watchProgressEngine.setPlaybackState(
                "buffering",
                {
                  currentPosition:getPlayerCurrentTime(),
                  duration:getPlayerDuration()
                }
              );
            }

            if(event.data === YT.PlayerState.ENDED){
              handleChannelVideoCompleted();
            }

            clearInterval(timeUpdateInterval);
          }
        }
      }
    });
  } else {
    setTimeout(() => {
      if(ytPlayer && typeof ytPlayer.loadVideoById === "function") {
        ytPlayer.loadVideoById({
          videoId,
          startSeconds:resumePosition
        });
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
      const current = getPlayerCurrentTime();
      const total = getPlayerDuration();

      if(total > 0){
        watchProgressEngine.touchPlayback(
          current,
          total
        );
      }

      if(
total > 0 &&
!watchedSaved &&
(current / total) >= 0.95
){

    watchedSaved = true;

    saveWatchedVideo(
        currentVideoId
    );

}
      
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
    watchProgressEngine.recordSeek(seconds);
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
  const current =
  getPlayerCurrentTime();

  const total =
  getPlayerDuration();

  if(playbackSessionStarted && total > 0){
    watchProgressEngine.touchPlayback(
      current,
      total,
      {
        force:true,
        reason:"closed"
      }
    );
  }

  watchProgressEngine.endSession("closed");

  clearInterval(timeUpdateInterval);
  const popup = document.getElementById("videoPopup");
  const playerIframe = document.getElementById("youtubePlayer");
  if (popup) popup.style.display = "none";
  if (playerIframe) playerIframe.src = "";
  if (ytPlayer && typeof ytPlayer.stopVideo === "function") ytPlayer.stopVideo();
  currentVideoId = null;
  playbackSessionStarted = false;
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


function convertDurationToSeconds(duration){

  const match =
  duration.match(
  /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
  );

  if(!match){
    return 0;
  }

  const hours =
  parseInt(match[1] || 0);

  const minutes =
  parseInt(match[2] || 0);

  const seconds =
  parseInt(match[3] || 0);

  return (
    hours * 3600 +
    minutes * 60 +
    seconds
  );

}


async function saveWatchedVideo(videoId){

    if(!videoId) return;

    watchedVideos.add(videoId);

    localStorage.setItem(
        "watchedChannelVideos",
        JSON.stringify(
            [...watchedVideos]
        )
    );

    const user =
    auth.currentUser;

    if(!user) return;

    try{

        await setDoc(

            doc(
                db,
                "users",
                user.uid,
                "watchedChannelVideos",
                videoId
            ),

            {
                videoId,
                watchedAt:
                Date.now()
            }

        );

        console.log(
            "WATCHED SAVED:",
            videoId
        );

    }
    catch(err){

        console.error(err);

    }

}

function getChannelVideoMeta(videoId){

  return channelVideoMeta.get(videoId) || {
    videoId,
    videoTitle:"BhaktiTube Channel Video",
    title:"BhaktiTube Channel Video",
    channelId,
    channelName:document.getElementById("channelName").textContent || "BhaktiTube",
    thumbnailUrl:`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration:0
  };

}

function buildChannelEmbedUrl(videoId,startSeconds = 0){

  const startParam =
  startSeconds > 0
  ? `&start=${Math.floor(startSeconds)}`
  : "";

  return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&enablejsapi=1&playsinline=1&iv_load_policy=3&origin=${window.location.origin}${startParam}`;

}

function getPlayerCurrentTime(){

  try{
    return ytPlayer && typeof ytPlayer.getCurrentTime === "function"
    ? ytPlayer.getCurrentTime()
    : 0;
  }
  catch(error){
    return 0;
  }

}

function getPlayerDuration(){

  try{
    return ytPlayer && typeof ytPlayer.getDuration === "function"
    ? ytPlayer.getDuration()
    : 0;
  }
  catch(error){
    return 0;
  }

}

function handleChannelVideoCompleted(){

  const total =
  getPlayerDuration();

  watchProgressEngine.setPlaybackState(
    "ended",
    {
      currentPosition:total,
      duration:total
    }
  );

  if(!watchedSaved){
    watchedSaved = true;
    saveWatchedVideo(currentVideoId);
  }

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
