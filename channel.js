import { db } from "./firebase-config.js";

import {
collection,
getDocs
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const API_KEY = "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE";

let nextPageToken = "";
let loading = false;

const params =
new URLSearchParams(
window.location.search
);

const channelId =
params.get("id");

console.log("Channel ID:", channelId);

loadChannel();

async function loadChannel(){

const snapshot =
await getDocs(
collection(db,"channels")
);

snapshot.forEach((doc)=>{

const channel =
doc.data();

if(
channel.channelId === channelId
){

document.getElementById(
"channelLogo"
).src =
channel.channelLogo;

document.getElementById(
"channelName"
).textContent =
channel.channelName;

document.getElementById(
"channelSubscribers"
).textContent =
"Subscribers : " +
channel.subscribers;

document.getElementById(
"channelVideos"
).textContent =
"Videos : " +
channel.totalVideos;

getUploadsPlaylist(channel.channelId);

}

});

}

async function getUploadsPlaylist(channelId){

try{

const response = await fetch(
`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`
);

const data = await response.json();

console.log(data);

if(data.error){

console.error(
"YouTube API Error:",
data.error.message
);

alert(
"YouTube API Error: " +
data.error.message
);

return;
}

if(!data.items || data.items.length === 0){

alert("Channel not found");

return;
}

const uploadsPlaylistId =
data.items[0]
.contentDetails
.relatedPlaylists
.uploads;

loadYouTubeVideos(
uploadsPlaylistId
);

}
catch(error){

console.error(error);

}

}



async function loadYouTubeVideos(
playlistId,
pageToken = ""
){

const loader =
document.getElementById("loader");

loader.style.display = "block";

try{

const response = await fetch(
`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${pageToken}&key=${API_KEY}`
);

if(!response.ok){

console.log(
"YouTube API Error",
response.status
);

return;

}

const data =
await response.json();

if(!data.items){

console.log(data);

return;

}

nextPageToken =
data.nextPageToken || "";

const container =
document.getElementById(
"channelVideosContainer"
);

data.items.forEach(video=>{

if(video.snippet && video.snippet.resourceId){

container.innerHTML += `
<div
class="video-card"
onclick="openVideo('${video.snippet.resourceId.videoId}')">

<img
src="${video.snippet.thumbnails.high.url}">

<h3>
${video.snippet.title}
</h3>

</div>
`;

}

});

}
catch(error){

console.error(error);

}
finally{

loader.style.display = "none";

}

}


window.openVideo = async function(videoId){

const popup =
document.getElementById("videoPopup");

const player =
document.getElementById("youtubePlayer");

popup.style.display = "flex";

player.src =
`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=0&fs=1`;

setTimeout(async()=>{

try{

if(player.requestFullscreen){

await player.requestFullscreen();

}

}
catch(err){

console.log(err);

}

},1000);

}

window.closeVideo = function(){

document.getElementById(
"videoPopup"
).style.display = "none";

document.getElementById(
"youtubePlayer"
).src = "";

}

const observer =
new IntersectionObserver(
async(entries)=>{

if(
entries[0].isIntersecting &&
!loading &&
nextPageToken
){

loading = true;

await loadYouTubeVideos(
channelId,
nextPageToken
);

loading = false;

}

},
{
threshold:0.1
}
);

observer.observe(
document.getElementById(
"loadMoreTrigger"
)
);


const youtubePlayer =
document.getElementById(
"youtubePlayer"
);

document.addEventListener(
"fullscreenchange",

async ()=>{

if(document.fullscreenElement){

try{

await screen.orientation.lock(
"landscape"
);

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

}
);

window.goHome = function(){

window.location.href =
"index.html";

}