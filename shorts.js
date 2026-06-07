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

for(const channel of enabledChannels){

const response = await fetch(
`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${channel.uploadsPlaylistId}&maxResults=50&key=${API_KEY}`
);

const data = await response.json();

for(const item of data.items){

const videoId =
item.snippet.resourceId.videoId;

const detailsResponse =
await fetch(
`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${API_KEY}`
);

const detailsData =
await detailsResponse.json();

if(!detailsData.items.length)
continue;

const videoDetails =
detailsData.items[0];

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

allShorts.push({

videoId,

title:
item.snippet.title,

channelName:
channel.channelName,

channelLogo:
channel.channelLogo

});

}

}

}

console.log(
"ALL SHORTS:",
allShorts
);


const shortsContainer =
document.getElementById(
"shortsContainer"
);

allShorts.forEach((short,index) => {

shortsContainer.innerHTML += `

<div class="short-card">

<iframe
loading="lazy"
src="https://www.youtube.com/embed/${short.videoId}?enablejsapi=1&controls=0&modestbranding=1&rel=0&playsinline=1"
data-videoid="${short.videoId}"
allowfullscreen>
</iframe>

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

<button class="action-btn">
❤️
</button>

<button class="action-btn">
👍
</button>

<button
class="action-btn share-btn"
data-videoid="${short.videoId}">
🔗
</button>

</div>

</div>

`;

});

document.getElementById(
"shortsLoader"
).style.display = "none";

const observer =
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

