import { db, auth } from "./firebase-config.js";
import { collection, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

// DOM Elements
const shortsContainer = document.getElementById("shortsContainer");
const shortsLoader = document.getElementById("shortsLoader");

// Global State
const enabledChannels = [];
const watchedVideoIds = new Set();
const watchedCache = new Set();
const allShorts = [];
const channelShorts = {};

let currentRenderIndex = 0;
let observer;
let watchTimer = null; 
let globalPlayer = null; 
let isPlayerReady = false;

// સિંગલ પ્લેયર કન્ટેનર
const globalPlayerContainer = document.createElement("div");
globalPlayerContainer.id = "global-player-container";
globalPlayerContainer.style.position = "fixed";
globalPlayerContainer.style.top = "0";
globalPlayerContainer.style.left = "0";
globalPlayerContainer.style.width = "100%";
globalPlayerContainer.style.height = "100%";
globalPlayerContainer.style.zIndex = "1"; 
globalPlayerContainer.style.pointerEvents = "none"; 
globalPlayerContainer.style.display = "none";
document.body.appendChild(globalPlayerContainer);

const API_KEY = "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE";

// 1. LocalStorage અને Firebase માંથી Watched Videos લોડ કરવા
const localWatchedVideos = JSON.parse(localStorage.getItem("watchedVideos") || "[]");
localWatchedVideos.forEach(videoId => watchedVideoIds.add(videoId));

const user = auth.currentUser;
if (user) {
    const watchedSnapshot = await getDocs(collection(db, "users", user.uid, "watchedShorts"));
    watchedSnapshot.forEach(doc => watchedVideoIds.add(doc.id));
}
console.log("શરૂઆતમાં લોડ થયેલા જોયેલા વિડિયોની સંખ્યા:", watchedVideoIds.size);

// 2. સક્રિય ચેનલો મેળવવી
const channelsSnapshot = await getDocs(collection(db, "channels"));
channelsSnapshot.forEach((doc) => {
    const channel = doc.data();
    if (channel.enabled) enabledChannels.push(channel);
});

shortsLoader.innerHTML = `Found ${enabledChannels.length} Channels`;

function convertDurationToSeconds(duration) {
    if (!duration) return 9999;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 9999;
    return (parseInt(match[1] || 0) * 3600 + parseInt(match[2] || 0) * 60 + parseInt(match[3] || 0));
}

// 3. વિડિયો સેવ કરવાનું પાવરફુલ લોજિક
async function markShortAsWatched(videoId) {
    if (watchedCache.has(videoId)) return;
    watchedCache.add(videoId);
    watchedVideoIds.add(videoId); 

    // A. LocalStorage માં સેવ કરો
    const savedVideos = JSON.parse(localStorage.getItem("watchedVideos") || "[]");
    if (!savedVideos.includes(videoId)) {
        savedVideos.push(videoId);
        localStorage.setItem("watchedVideos", JSON.stringify(savedVideos));
        console.log("LOCAL STORAGE SAVED:", videoId);
    }

    // B. Firebase Firestore માં સેવ કરો
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
        await setDoc(doc(db, "users", currentUser.uid, "watchedShorts", videoId), {
            videoId,
            watchedAt: Date.now()
        });
        console.log("FIREBASE SAVED:", videoId);
    } catch (error) {
        console.error("ફાયરબેઝમાં સેવ કરવામાં એરર:", error);
    }
}

// એરર આવે ત્યારે નેક્સ્ટ વિડિયો પર આપોઆપ સ્ક્રોલ કરવાનું ફંક્શન
function skipToNextShort() {
    setTimeout(() => {
        const currentScroll = shortsContainer.scrollTop;
        const viewHeight = window.innerHeight;
        // આગામી શોર્ટ કાર્ડ પર સ્મૂધ સ્ક્રોલ કરો
        shortsContainer.scrollTo({
            top: currentScroll + viewHeight,
            behavior: 'smooth'
        });
        console.log("Unavailable વિડિયો હતો એટલે આપોઆપ આગળ સ્ક્રોલ કર્યું.");
    }, 300); // યુઝરને ખબર પણ નહીં પડે અને સ્ક્રોલ થઈ જશે
}

// 4. ગ્લોબલ પ્લેયર સેટઅપ (Error Handling સાથે)
function initGlobalPlayer() {
    return new Promise((resolve) => {
        const dummyDiv = document.createElement("div");
        dummyDiv.id = "yt-player-element";
        globalPlayerContainer.appendChild(dummyDiv);

        globalPlayer = new YT.Player("yt-player-element", {
            height: '100%',
            width: '100%',
            playerVars: {
                controls: 0,
                modestbranding: 1,
                rel: 0,
                playsinline: 1,
                autoplay: 1,
                iv_load_policy: 3,
                origin: window.location.origin 
            },
            events: {
                onReady: () => {
                    console.log("GLOBAL FIXED PLAYER READY");
                    isPlayerReady = true;
                    resolve();
                },
                onStateChange: (event) => {
                    const currentVideoId = globalPlayerContainer.dataset.videoid;
                    if (!currentVideoId) return;

                    if (event.data === YT.PlayerState.PLAYING) {
                        if (watchTimer) clearTimeout(watchTimer);
                        
                        watchTimer = setTimeout(() => {
                            markShortAsWatched(currentVideoId);
                        }, 5000); 
                    }

                    if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
                        if (watchTimer) {
                            clearTimeout(watchTimer);
                            watchTimer = null;
                        }
                    }

                    if (event.data === YT.PlayerState.ENDED) {
                        globalPlayer.playVideo(); 
                    }
                },
                // CRITICAL FIX: વિડિયો એરર પકડવા માટેનું લોજિક
                onError: (event) => {
                    const brokenVideoId = globalPlayerContainer.dataset.videoid;
                    console.warn(`વિડિયો એરર આવી! ID: ${brokenVideoId}, એરર કોડ: ${event.data}`);
                    
                    if (brokenVideoId) {
                        // ૧. એ જ માઇક્રોસેકન્ડે જોયેલા (Unavailable) વિડિયો તરીકે સેવ કરો
                        markShortAsWatched(brokenVideoId);
                        
                        // ૨. સ્ક્રીન પર એરર દેખાય તે પહેલા જ આગલા વિડિયો પર સ્ક્રોલ કરી દો
                        skipToNextShort();
                    }
                }
            }
        });
    });
}

// 5. શોર્ટ્સ કાર્ડ્સ રેન્ડર કરવા
function renderNextShorts(count = 1) {
    for (let i = 0; i < count && currentRenderIndex < allShorts.length; i++) {
        const short = allShorts[currentRenderIndex];
        const tempDiv = document.createElement("div");

        tempDiv.innerHTML = `
            <div class="short-card" data-videoid="${short.videoId}">
                <div class="youtube-player" style="pointer-events: none;"></div>
                
                <div class="top-mask"></div>
                <div class="gradient"></div>
                
                <div class="channel-overlay">
                    <img src="${short.channelLogo}" class="channel-logo">
                    <div>
                        <h4>${short.channelName}</h4>
                        <p>${short.title}</p>
                    </div>
                </div>
                
                <div class="actions">
                    <button class="action-btn">❤️</button>
                    <button class="action-btn">👍</button>
                    <button class="action-btn share-btn" data-videoid="${short.videoId}">🔗</button>
                </div>
            </div>
        `;

        const newCard = tempDiv.firstElementChild;
        shortsContainer.appendChild(newCard);

        if (observer) {
            observer.observe(newCard);
        }
        currentRenderIndex++;
    }
}

// 6. API ડેટા ફેચિંગ અને ફિલ્ટરિંગ
const channelFetchPromises = [];
enabledChannels.forEach(channel => {
    channelFetchPromises.push((async () => {
        let nextPageToken = "";
        let unseenFound = 0;

        while (unseenFound < 30) {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${channel.uploadsPlaylistId}&maxResults=50&pageToken=${nextPageToken}&key=${API_KEY}`
            );
            const data = await response.json();
            if (!data.items?.length) break;

            const videoIds = data.items.map(item => item.snippet.resourceId.videoId);
            const detailsResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds.join(",")}&key=${API_KEY}`
            );
            const detailsData = await detailsResponse.json();

            for (let i = 0; i < data.items.length; i++) {
                const item = data.items[i];
                const videoDetails = detailsData.items[i];
                const videoId = item.snippet.resourceId.videoId;

                if (!videoDetails || !videoDetails.contentDetails) continue;

                const duration = videoDetails.contentDetails.duration;
                const seconds = convertDurationToSeconds(duration);

                if (seconds <= 60) {
                    if (watchedVideoIds.has(videoId)) {
                        continue; 
                    }

                    if (!channelShorts[channel.channelName]) {
                        channelShorts[channel.channelName] = [];
                    }

                    channelShorts[channel.channelName].push({
                        videoId,
                        title: item.snippet.title,
                        channelName: channel.channelName,
                        channelLogo: channel.channelLogo
                    });
                    unseenFound++;
                }
            }
            nextPageToken = data.nextPageToken;
            if (!nextPageToken) break;
        }
    })());
});

await Promise.all(channelFetchPromises);

const channelNames = Object.keys(channelShorts);
let shortsRemaining = true;
while (shortsRemaining) {
    shortsRemaining = false;
    for (const channelName of channelNames) {
        if (channelShorts[channelName] && channelShorts[channelName].length) {
            allShorts.push(channelShorts[channelName].shift());
            shortsRemaining = true;
        }
    }
}

// 7. ઇન્ટરસેક્શન ઓબ્ઝર્વર
observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const card = entry.target;
            const videoId = card.dataset.videoid;

            if (!isPlayerReady) return;

            if (watchTimer) {
                clearTimeout(watchTimer);
                watchTimer = null;
            }

            globalPlayerContainer.style.display = "block";
            globalPlayerContainer.dataset.videoid = videoId;

            try {
                globalPlayer.loadVideoById(videoId);
            } catch (err) {
                console.error("Error swapping video:", err);
            }

            renderNextShorts(2);
        }
    });
}, { 
    threshold: 0.6 
});

async function startApp() {
    if (typeof YT !== 'undefined' && YT.loaded) {
        await initGlobalPlayer();
    } else {
        window.onYouTubeIframeAPIReady = async () => {
            await initGlobalPlayer();
        };
    }
    
    renderNextShorts(3);
    shortsLoader.style.display = "none";
    
    const firstCards = document.querySelectorAll(".short-card");
    firstCards.forEach(card => observer.observe(card));
}

startApp();

// લાઈક, શેર બટન ઈવેન્ટ્સ
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("action-btn")) {
        if (e.target.innerText === "❤️") {
            e.target.classList.toggle("like-active");
            e.target.classList.toggle("active");
        }
        if (e.target.innerText === "👍") {
            e.target.classList.toggle("thumb-active");
            e.target.classList.toggle("active");
        }
    }
});

document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("share-btn")) {
        const videoId = e.target.dataset.videoid;
        const shortLink = `https://youtube.com/shorts/${videoId}`;
        try {
            await navigator.clipboard.writeText(shortLink);
            e.target.innerText = "✅";
            setTimeout(() => { e.target.innerText = "🔗"; }, 1500);
        } catch (err) {
            console.error(err);
        }
    }
});