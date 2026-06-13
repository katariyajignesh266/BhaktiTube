import { db } from "./firebase-config.js";

import {
collection,
getDocs
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const API_KEY = "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE";

let nextPageToken = "";
let loading = false;

let uploadsPlaylistId = "";

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

uploadsPlaylistId =
channel.uploadsPlaylistId;

loadYouTubeVideos(
    channel.uploadsPlaylistId
);

}

});

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

if(pageToken === ""){
container.innerHTML = "";
}

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

    const popup = document.getElementById("videoPopup");
    const player = document.getElementById("youtubePlayer");

    popup.style.display = "flex";

    // અહીં આપણે થોડા વધારાના પેરામીટર્સ (iv_load_policy, modestbranding, અને controls) ઉમેર્યા છે
    // જેથી પ્લેયરનો લુક એકદમ પ્રીમિયમ અને મીડિયમ સાઇઝના ફોન્ટ વાળો લાગે
    player.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=0&fs=1&modestbranding=1&iv_load_policy=3&controls=1`;

    setTimeout(async()=>{
        try{
            if(player.requestFullscreen){
                await player.requestFullscreen();
                player.classList.add("fullscreen");
            } else if(player.webkitRequestFullscreen) { /* Safari / iOS માટે */
                await player.webkitRequestFullscreen();
                player.classList.add("fullscreen");
            }
        }
        catch(err){
            console.log("Fullscreen Error: ", err);
        }
    }, 400); // ૧ સેકન્ડ (1000ms) ના બદલે 400ms કર્યું જેથી યુઝરને બહુ મોટો લેગ (ઝટકો) ન દેખાય
}

// ફૂલસ્ક્રીન ચેન્જ લોજિક
const youtubePlayer = document.getElementById("youtubePlayer");

document.addEventListener("fullscreenchange", async () => {
    if (document.fullscreenElement) {
        try {
            // સ્ક્રીનને લેન્ડસ્કેપ લોક કરવી
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock("landscape");
            }
        } catch (err) {
            console.log("Orientation Lock Error: ", err);
        }
    } else {
        try {
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
            youtubePlayer.classList.remove("fullscreen"); 
        } catch (err) {
            console.log(err);
        }
    }
});




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
uploadsPlaylistId,
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

document.addEventListener("fullscreenchange", async () => {
    if (document.fullscreenElement) {
        try {
            await screen.orientation.lock("landscape");
        } catch (err) {
            console.log(err);
        }
    } else {
        try {
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
            // અહિયાં 'player' ની જગ્યાએ 'youtubePlayer' લખવું કારણ કે ઉપર વેરિએબલ એ નામે છે
            youtubePlayer.classList.remove("fullscreen"); 
        } catch (err) {
            console.log(err);
        }
    }
});

window.goHome = function(){

window.location.href =
"index.html";

}


// જ્યારે યુઝર હોમ બટન દબાવે અથવા સ્ક્રીન ઓફ કરે ત્યારે આ ઇવેન્ટ ટ્રિગર થશે
document.addEventListener("visibilitychange", function() {
    
    // જો વેબસાઇટ બેકગ્રાઉન્ડમાં જતી રહે (Hidden થઈ જાય)
    if (document.hidden) {
        
        console.log("વેબસાઇટ બેકગ્રાઉન્ડમાં ગઈ, વિડિયો સ્ટોપ થાય છે...");
        
        // રીત ૧: જો વિડિયો પોપઅપમાં પ્લે થતો હોય, તો તેને બંધ (Close) કરી દો
        // આનાથી વિડિયો પણ બંધ થઈ જશે અને પ્લેયર પણ ક્લીન થઈ જશે
        if (typeof window.closeVideo === "function") {
            window.closeVideo();
        }
        
        /* // રીત ૨: જો તમારે પોપઅપ બંધ ન કરવું હોય અને માત્ર વિડિયો પોઝ કરવો હોય, 
        // તો નીચેનો કોડ વાપરી શકો (iframe નો સોર્સ ખાલી કરવા માટે):
        const player = document.getElementById("youtubePlayer");
        if (player) {
            player.src = ""; 
        }
        */
    }
});