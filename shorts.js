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

const channelsSnapshot =
await getDocs(
collection(db,"channels")
);

const players = {};

const watchTimers = {};

let currentPlayerDiv = null;

let observer;

const watchedCache =
new Set();

const enabledChannels = [];

const watchedVideoIds =
new Set();

const localWatchedVideos =
JSON.parse(
localStorage.getItem(
"watchedVideos"
) || "[]"
);

localWatchedVideos.forEach(
videoId => {

watchedVideoIds.add(
videoId
);

}
);

const user = auth.currentUser;

if(user){

const watchedSnapshot =
await getDocs(

collection(
db,
"users",
user.uid,
"watchedShorts"
)

);

watchedSnapshot.forEach(doc=>{

watchedVideoIds.add(
doc.id
);

});

console.log(
"WATCHED:",
watchedVideoIds.size
);

}

channelsSnapshot.forEach((doc)=>{

const channel = doc.data();

if(channel.enabled){

enabledChannels.push(channel);

}

});

console.log(
"Enabled Channels:",
enabledChannels
);

document.getElementById(
"shortsLoader"
).innerHTML =
`Found ${enabledChannels.length} Channels`;


console.log("------------");

enabledChannels.forEach(channel => {

console.log(
channel.channelName
);

console.log(
channel.uploadsPlaylistId
);

});

function convertDurationToSeconds(duration){

if(!duration)
return 9999;

const match =
duration.match(
/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
);

if(!match)
return 9999;

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


async function markShortAsWatched(videoId){

if(
watchedCache.has(videoId)
){
return;
}

watchedCache.add(videoId);

const savedVideos =
JSON.parse(
localStorage.getItem(
"watchedVideos"
) || "[]"
);

if(
!savedVideos.includes(
videoId
)
){

savedVideos.push(
videoId
);

localStorage.setItem(
"watchedVideos",
JSON.stringify(
savedVideos
)
);

}

const user =
auth.currentUser;

if(!user)
return;

try{

await setDoc(

doc(
db,
"users",
user.uid,
"watchedShorts",
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
catch(error){

console.error(
error
);

}

}


const API_KEY = "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE";

const allShorts = [];

const shortsContainer =
document.getElementById(
"shortsContainer"
);

let currentRenderIndex = 0;

function renderNextShorts(count = 1){

for(
let i = 0;
i < count &&
currentRenderIndex < allShorts.length;
i++
){

const short =
allShorts[currentRenderIndex];

const tempDiv =
document.createElement("div");

tempDiv.innerHTML = `

<div class="short-card">

<div
class="youtube-player"
id="player-${short.videoId}"
data-videoid="${short.videoId}">
</div>

<div class="top-mask"></div>

<div class="gradient"></div>

<div class="channel-overlay">

<img
src="${short.channelLogo}"
class="channel-logo">

<div>

<h4>${short.channelName}</h4>

<p>${short.title}</p>

</div>

</div>

<div class="actions">

<button class="action-btn">❤️</button>

<button class="action-btn">👍</button>

<button
class="action-btn share-btn"
data-videoid="${short.videoId}">
🔗
</button>

</div>

</div>

`;

const newCard =
tempDiv.firstElementChild;

shortsContainer.appendChild(
newCard
);

setTimeout(()=>{

const videoId =
short.videoId;

players[videoId] =
new YT.Player(

`player-${videoId}`,

{

videoId,

playerVars:{
controls:0,
modestbranding:1,
rel:0,
playsinline:1
},

events:{

onReady:(event)=>{

console.log(
"PLAYER READY:",
videoId
);

},

onStateChange:(event)=>{

    

if(
event.data ===
YT.PlayerState.PLAYING
){

if(
watchTimers[videoId]
){
return;
}

watchTimers[videoId] =
setTimeout(()=>{

markShortAsWatched(
videoId
);

},5000);

}

if(

event.data ===
YT.PlayerState.PAUSED ||

event.data ===
YT.PlayerState.ENDED

){

clearTimeout(
watchTimers[videoId]
);

delete watchTimers[
videoId
];

}

}

}

}

);

},100);

if(observer){

observer.observe(
newCard
);

}

currentRenderIndex++;

}

}

const channelFetchPromises = [];

const channelShorts = {};

enabledChannels.forEach(channel => {

channelFetchPromises.push(

(async()=>{

let nextPageToken = "";

let unseenFound = 0;

while(unseenFound < 30){

const response = await fetch(

`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${channel.uploadsPlaylistId}&maxResults=50&pageToken=${nextPageToken}&key=${API_KEY}`

);

const data = await response.json();

if(!data.items?.length){
break;
}

const videoIds =
data.items.map(
item =>
item.snippet.resourceId.videoId
);

const detailsResponse =
await fetch(

`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds.join(",")}&key=${API_KEY}`

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

const videoDetails =
detailsData.items[i];

const videoId =
item.snippet.resourceId.videoId;

if(
!videoDetails ||
!videoDetails.contentDetails
){
continue;
}

const duration =
videoDetails.contentDetails.duration;

const seconds =
convertDurationToSeconds(duration);

if(seconds <= 60){

if(
watchedVideoIds.has(
videoId
)
){
continue;
}



console.log(
"SHORT FOUND:",
item.snippet.title,
seconds
);

if(!channelShorts[channel.channelName]){

channelShorts[channel.channelName] = [];

}

channelShorts[channel.channelName].push({

videoId,
title:item.snippet.title,
channelName:channel.channelName,
channelLogo:channel.channelLogo

});

unseenFound++;

}
}

nextPageToken =
data.nextPageToken;

if(!nextPageToken){
break;
}
}


})()

);

});



await Promise.all(
channelFetchPromises
);

console.log(
"CHANNEL SHORTS:",
channelShorts
);

const channelNames =
Object.keys(channelShorts);

let shortsRemaining = true;

while(shortsRemaining){

shortsRemaining = false;

for(const channelName of channelNames){

if(
channelShorts[channelName] &&
channelShorts[channelName].length
){

allShorts.push(
channelShorts[channelName].shift()
);

shortsRemaining = true;

}

}

}

console.log(
"ALL SHORTS:",
allShorts
);

renderNextShorts(3);

document.getElementById(
"shortsLoader"
).style.display = "none";

observer =
new IntersectionObserver(

(entries)=>{

entries.forEach(entry=>{

const playerDiv =
entry.target.querySelector(
".youtube-player"
);

if(!playerDiv) return;

if(entry.isIntersecting){

Object.keys(players)
.forEach(id=>{

try{

players[id].pauseVideo();

}
catch(err){}

});

currentPlayerDiv =
playerDiv;

const currentVideoId =
playerDiv.dataset.videoid;

if(
players[currentVideoId]
){

players[currentVideoId]
.playVideo();

}

renderNextShorts(2);

}

});

},

{
threshold:0.7
}

);

document
.querySelectorAll(".short-card")
.forEach(card=>{

observer.observe(card);

});


document.addEventListener("click",(e)=>{

if(
e.target.classList.contains("action-btn")
){

if(
e.target.innerText === "❤️"
){

e.target.classList.toggle(
"like-active"
);

e.target.classList.toggle(
"active"
);

}

if(
e.target.innerText === "👍"
){

e.target.classList.toggle(
"thumb-active"
);

e.target.classList.toggle(
"active"
);

}

}

});


document.addEventListener("click",async(e)=>{

if(
e.target.classList.contains(
"share-btn"
)
){

const videoId =
e.target.dataset.videoid;

const shortLink =
`https://youtube.com/shorts/${videoId}`;

try{

await navigator.clipboard.writeText(
shortLink
);

e.target.innerText = "✅";

setTimeout(()=>{

e.target.innerText = "🔗";

},1500);

}catch(err){

console.error(err);

}

}

});

