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

import { playVideo } from "./player-core.js";

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

// State remapped to player-core.js

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
// Video opening remapped to player-core.js
window.openVideo = (videoId) => playVideo(videoId, getChannelVideoMeta(videoId), true);

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
// Visibility remapped to player-core.js


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


// watched save remapped to player-core.js

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

// Embed building and completion remapped to player-core.js

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
