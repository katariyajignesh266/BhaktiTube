import { db, auth } from "./firebase-config.js";
import { collection, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { YOUTUBE_API_KEY } from "./config.js";

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

// લોડિંગ વગર ઇન્સ્ટન્ટ પ્લે કરવા માટે બેકગ્રાઉન્ડ પ્રીલોડર આઇફ્રેમ (Hidden Preloader)
const preloaderContainer = document.createElement("div");
preloaderContainer.id = "hidden-preloader-container";
preloaderContainer.style.position = "fixed";
preloaderContainer.style.width = "1px";
preloaderContainer.style.height = "1px";
preloaderContainer.style.opacity = "0.01";
preloaderContainer.style.pointerEvents = "none";
document.body.appendChild(preloaderContainer);
let preloaderPlayer = null;

// મેઈન સિંગલ પ્લેયર કન્ટેનર
const globalPlayerContainer = document.createElement("div");
globalPlayerContainer.id = "global-player-container";
document.body.appendChild(globalPlayerContainer);

const API_KEY = YOUTUBE_API_KEY;

// 1. LocalStorage અને Firebase માંથી Watched Videos લોડ કરવા
const localWatchedVideos = JSON.parse(localStorage.getItem("watchedVideos") || "[]");
localWatchedVideos.forEach(videoId => watchedVideoIds.add(videoId));

const user = auth.currentUser;
if (user) {
    const watchedSnapshot = await getDocs(collection(db, "users", user.uid, "watchedShorts"));
    watchedSnapshot.forEach(doc => watchedVideoIds.add(doc.id));
}

// 2. સક્રિય ચેનલો મેળવવી
const channelsSnapshot = await getDocs(collection(db, "channels"));
channelsSnapshot.forEach((doc) => {
    const channel = doc.data();
    if (channel.enabled) enabledChannels.push(channel);
});

if (shortsLoader) {
    shortsLoader.innerHTML = `Found ${enabledChannels.length} Channels`;
}

function convertDurationToSeconds(duration) {
    if (!duration) return 9999;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 9999;
    return (parseInt(match[1] || 0) * 3600 + parseInt(match[2] || 0) * 60 + parseInt(match[3] || 0));
}

// સંખ્યાને યુટ્યુબ શોર્ટ્સ ફોર્મેટ (Lakh/K) માં ફોર્મેટ કરવાનું ફંક્શન
function formatLikes(count) {
    if (!count) return "Like";
    const num = parseInt(count);
    if (num >= 100000) {
        return (num / 100000).toFixed(1) + " Lakh";
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + "K";
    }
    return num;
}

// 3. વિડિયો સેવ કરવાનું લોજિક (Firebase + LocalStorage)
async function markShortAsWatched(videoId) {
    if (watchedCache.has(videoId)) return;
    watchedCache.add(videoId);
    watchedVideoIds.add(videoId); 

    const savedVideos = JSON.parse(localStorage.getItem("watchedVideos") || "[]");
    if (!savedVideos.includes(videoId)) {
        savedVideos.push(videoId);
        localStorage.setItem("watchedVideos", JSON.stringify(savedVideos));
    }

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
        await setDoc(doc(db, "users", currentUser.uid, "watchedShorts", videoId), {
            videoId,
            watchedAt: Date.now()
        });
    } catch (error) {
        console.error(error);
    }
}

function skipToNextShort() {
    if (!shortsContainer) return;
    setTimeout(() => {
        const currentScroll = shortsContainer.scrollTop;
        const viewHeight = window.innerHeight;
        shortsContainer.scrollTo({
            top: currentScroll + viewHeight,
            behavior: 'smooth'
        });
    }, 300);
}

// 4. મેઈન પ્લેયર અને બેકગ્રાઉન્ડ પ્રીલોડર સેટઅપ
function initPlayers() {
    return new Promise((resolve) => {
        const dummyMain = document.createElement("div");
        dummyMain.id = "yt-main-element";
        globalPlayerContainer.appendChild(dummyMain);

        globalPlayer = new YT.Player("yt-main-element", {
            height: '100%',
            width: '100%',
            playerVars: {
                controls: 0,            // બધા કંટ્રોલ્સ કમ્પલસરી હાઇડ
                modestbranding: 1,      // યુટ્યુબ બ્રાન્ડિંગ ઓફ
                rel: 0,                 
                playsinline: 1,
                autoplay: 1,
                iv_load_policy: 3,
                disablekb: 1,
                fs: 0,
                showinfo: 0,            
                autohide: 1,            
                origin: window.location.origin 
            },
            events: {
                onReady: () => {
                    isPlayerReady = true;
                    checkAndInitializePreloader(resolve);
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
                        globalPlayer.playVideo(); // લૂપમાં ચલાવવા માટે
                    }
                },
                onError: (event) => {
                    const brokenVideoId = globalPlayerContainer.dataset.videoid;
                    if (brokenVideoId) {
                        markShortAsWatched(brokenVideoId);
                        skipToNextShort();
                    }
                }
            }
        });
    });
}

// આ સીએસએસ સ્ટાઇલ ડાયનેમિકલી એડ કરવાથી સિંગલ લાઇન સ્ટ્રક્ચર પ્રોપર સેટ થઈ જશે અને મોટું નામ થતાં જ ઓટોમેટિક '...' આવી જશે.
const style = document.createElement('style');
style.innerHTML = `
    .channel-profile-row {
        display: flex;
        align-items: center;
        width: 100%;
        max-width: calc(100vw - 90px); /* એક્શન્સ બટન અને સ્પેસિંગ છોડીને પ્રોપર કન્ટેનર વિડ્થ */
        gap: 8px;
        overflow: hidden;
    }
    .channel-logo {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        flex-shrink: 0; /* લોગો ક્યારેય દબાવો કે અડધો કટ ન થવો જોઈએ */
    }
    .channel-profile-row h4 {
        margin: 0;
        color: #ffffff;
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis; /* વધારે લાંબુ નામ હોય તો પાછળ ત્રણ ટપકા (...) કરવા માટે */
        flex-grow: 1;
        min-width: 0; /* સીએસએસ ફ્લેક્સ બોક્સમાં એલિપ્સિસ કામ કરવા માટે જરૂરી */
    }
    .subscribe-btn {
        flex-shrink: 0; /* બટન પણ પોતાની સાઈઝમાં ફિક્સ રહેશે */
    }
`;
document.head.appendChild(style);

function checkAndInitializePreloader(resolve) {
    const dummyPreload = document.createElement("div");
    dummyPreload.id = "yt-preload-element";
    preloaderContainer.appendChild(dummyPreload);

    preloaderPlayer = new YT.Player("yt-preload-element", {
        height: '100%',
        width: '100%',
        playerVars: {
            controls: 0,
            autoplay: 0,
            mute: 1, 
            playsinline: 1,
            origin: window.location.origin
        },
        events: {
            onReady: () => {
                resolve();
            }
        }
    });
}

function preloadNextVideo(index) {
    if (preloaderPlayer && allShorts[index]) {
        const nextVideoId = allShorts[index].videoId;
        try {
            preloaderPlayer.cueVideoById(nextVideoId);
        } catch (e) {}
    }
}

// 5. શોર્ટ્સカード્સ રેન્ડર કરવા (ઓરિજિનલ લાઇક્સ અને ફિક્સ નામ સ્ટ્રક્ચર સાથે)
function renderNextShorts(count = 1) {
    if (!shortsContainer) return;
    for (let i = 0; i < count && currentRenderIndex < allShorts.length; i++) {
        const short = allShorts[currentRenderIndex];
        const tempDiv = document.createElement("div");

        const displayLikes = formatLikes(short.likeCount);

        tempDiv.innerHTML = `
            <div class="short-card" data-videoid="${short.videoId}" data-index="${currentRenderIndex}">
                <div class="youtube-player" style="pointer-events: none;"></div>
                
                <div class="top-mask"></div>
                <div class="gradient"></div>
                
                <div class="channel-overlay">
                    <div class="channel-profile-row">
                        <img src="${short.channelLogo}" class="channel-logo">
                        <h4>@${short.channelName.replace(/\s+/g, '_').toLowerCase()}</h4>
                        <button class="subscribe-btn">Subscribe</button>
                    </div>
                    <p>${short.title}</p>
                </div>
                
                <div class="actions">
                    <div class="action-item" id="like-btn-${short.videoId}" data-rawlikes="${short.likeCount || 0}">
                        <svg viewBox="0 0 24 24"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
                        <span>${displayLikes}</span>
                    </div>

                    <div class="action-item">
                        <svg viewBox="0 0 24 24"><path d="M19 15h4V3h-4v12zm-4 0c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73V4c0-1.1-.9-2-2-2H9c-.83 0-1.54.5-1.84 1.22L4.14 10.27c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L12.83 23l6.58-6.59c.37-.36.59-.86.59-1.41z"/></svg>
                        <span>Dislike</span>
                    </div>

                    <div class="action-item">
                        <svg viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
                        <span>232</span>
                    </div>

                    <div class="action-item share-btn" data-videoid="${short.videoId}" data-title="${short.title}">
                        <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                        <span>Share</span>
                    </div>

                    <div class="action-item">
                        <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                        <span>Remix</span>
                    </div>

                    <img src="${short.channelLogo}" class="audio-track-icon">
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
                `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds.join(",")}&key=${API_KEY}`
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
                    if (watchedVideoIds.has(videoId)) continue; 

                    if (!channelShorts[channel.channelName]) {
                        channelShorts[channel.channelName] = [];
                    }

                    const originalLikes = videoDetails.statistics ? videoDetails.statistics.likeCount : 0;

                    channelShorts[channel.channelName].push({
                        videoId,
                        title: item.snippet.title,
                        channelName: channel.channelName,
                        channelLogo: channel.channelLogo,
                        likeCount: originalLikes
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
            const cardIndex = parseInt(card.dataset.index);

            if (!isPlayerReady) return;

            if (watchTimer) {
                clearTimeout(watchTimer);
                watchTimer = null;
            }

            globalPlayerContainer.style.display = "block";
            globalPlayerContainer.dataset.videoid = videoId;

            try {
                globalPlayer.loadVideoById(videoId);
                // પ્લેલિસ્ટમાં પણ વિડિયો એડ કરો જેથી લૂપ માટે બેકઅપ આઈડી મળે
                if (globalPlayer.setLoop) {
                    globalPlayer.setLoop(true);
                }
                preloadNextVideo(cardIndex + 1);
            } catch (err) {
                console.error("Error swapping video:", err);
            }

            renderNextShorts(2);
        }
    });
}, { 
    threshold: 0.6 
});

// બૅક એરો બટન પર ક્લિક કરવાથી હોમપેજ (index.html) પર રીડાયરેક્ટ કરવું
document.addEventListener("click", (e) => {
    const backBtn = e.target.closest(".back-arrow-btn") || e.target.closest(".fa-arrow-left") || e.target.closest(".back-btn");
    if (backBtn) {
        window.location.href = "index.html";
    }
});

// લાઈક અને સબસ્ક્રાઇબ ક્લિક ઇવેન્ટ્સ
document.addEventListener("click", (e) => {
    const likeItem = e.target.closest(".action-item");
    if (likeItem && likeItem.id && likeItem.id.startsWith("like-btn-")) {
        const svg = likeItem.querySelector("svg");
        const span = likeItem.querySelector("span");
        const rawLikes = parseInt(likeItem.dataset.rawlikes || 0);
        
        if (likeItem.classList.contains("liked")) {
            likeItem.classList.remove("liked");
            svg.style.fill = "#ffffff"; 
            span.innerText = formatLikes(rawLikes);
        } else {
            likeItem.classList.add("liked");
            svg.style.fill = "#ff0000"; 
            span.innerText = formatLikes(rawLikes + 1);
        }
    }
    
    if (e.target.classList.contains("subscribe-btn")) {
        if (e.target.innerText === "Subscribe") {
            e.target.innerText = "Subscribed";
            e.target.style.backgroundColor = "rgba(255,255,255,0.2)";
            e.target.style.color = "#ffffff";
        } else {
            e.target.innerText = "Subscribe";
            e.target.style.backgroundColor = "#ffffff";
            e.target.style.color = "#000000";
        }
    }
});

// ઓરિજિનલ નેટિવ શેર પોપઅપ લોજિક
document.addEventListener("click", async (e) => {
    const shareBtn = e.target.closest(".share-btn");
    if (shareBtn) {
        const videoId = shareBtn.dataset.videoid;
        const videoTitle = shareBtn.dataset.title || "Check out this Short!";
        const shortLink = `https://youtube.com/shorts/${videoId}`;
        const span = shareBtn.querySelector("span");
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: videoTitle,
                    text: videoTitle,
                    url: shortLink
                });
            } catch (err) {
                console.log("Share failed:", err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shortLink);
                if (span) {
                    span.innerText = "Copied!";
                    setTimeout(() => { span.innerText = "Share"; }, 1500);
                }
            } catch (err) {
                console.error(err);
            }
        }
    }
});

async function startApp() {
    if (typeof YT !== 'undefined' && YT.loaded) {
        await initPlayers();
    } else {
        window.onYouTubeIframeAPIReady = async () => {
            await initPlayers();
        };
    }
    
    renderNextShorts(4); 
    if (shortsLoader) {
        shortsLoader.style.display = "none";
    }
    
    const firstCards = document.querySelectorAll(".short-card");
    firstCards.forEach(card => observer.observe(card));
}

startApp();

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