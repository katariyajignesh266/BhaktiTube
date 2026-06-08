import { db } from "./firebase-config.js";

import {
collection,
getDocs
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const channelsSnapshot =
await getDocs(
collection(db,"channels")
);

let currentIframe = null;

let observer;

const enabledChannels = [];

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

<iframe
loading="lazy"
src="https://www.youtube.com/embed/${short.videoId}?enablejsapi=1&controls=0&modestbranding=1&rel=0&playsinline=1"
data-videoid="${short.videoId}"
allowfullscreen>
</iframe>

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

const response = await fetch(
`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${channel.uploadsPlaylistId}&maxResults=50&key=${API_KEY}`
);

const data = await response.json();

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

for(let i = 0; i < data.items.length; i++){

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

const iframe =
entry.target.querySelector("iframe");

if(!iframe) return;

if(entry.isIntersecting){

if(
currentIframe &&
currentIframe !== iframe
){

console.log(
"VISIBLE:",
entry.target
);

currentIframe.contentWindow.postMessage(
JSON.stringify({
event:"command",
func:"pauseVideo",
args:[]
}),
"*"
);

}

currentIframe = iframe;

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

