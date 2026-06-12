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

// મેઈન સિંગલ પ્લેયર કન્ટેનર - પ્રોફેશનલ લુક અને ઇન્સ્ટન્ટ હાઇડ માટે CSS સ્કેલિંગ ટ્રીક
const globalPlayerContainer = document.createElement("div");
globalPlayerContainer.id = "global-player-container";
globalPlayerContainer.style.position = "fixed";
globalPlayerContainer.style.top = "0";
globalPlayerContainer.style.left = "0";
globalPlayerContainer.style.width = "100%";
globalPlayerContainer.style.height = "100%";
globalPlayerContainer.style.zIndex = "1"; 
globalPlayerContainer.style.pointerEvents = "none"; // યુટ્યુબના ઓવરલે UI ને નડતું અટકાવવા માટે 'none' જ શ્રેષ્ઠ છે
globalPlayerContainer.style.display = "none";
globalPlayerContainer.style.overflow = "hidden"; // આઇફ્રેમના કંટ્રોલ્સ બહાર કાઢીને છુપાવવા માટે
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
        
        // YouTube ની ડિફોલ્ટ આઇફ્રેમ ફ્રેમના કંટ્રોલ્સ (પ્લે/પોઝ) ને સ્ક્રીન બહાર ધકેલવા માટે CSS સ્ટાઇલિંગ
        dummyMain.style.width = "100%";
        dummyMain.style.height = "100%";
        dummyMain.style.transform = "scale(1.3)"; // વિડિયો સહેજ ઝૂમ થશે જેથી કંટ્રોલ્સ બોર્ડરની બહાર જતા રહે
        globalPlayerContainer.appendChild(dummyMain);

        // A. મેઈન પ્લેયર લોડ કરવો
        globalPlayer = new YT.Player("yt-main-element", {
            height: '100%',
            width: '100%',
            playerVars: {
                controls: 0,            // કંટ્રોલ્સ બંધ કરવા
                modestbranding: 1,      // યુટ્યુબ લોગો ઓછો કરવો
                rel: 0,
                playsinline: 1,
                autoplay: 1,
                iv_load_policy: 3,
                disablekb: 1,
                fs: 0,
                showinfo: 0,            // વધારાની માહિતી છુપાવવા
                autohide: 1,            // આઇફ્રેમ ઓટોમેટિક ઇન્સ્ટન્ટ હાઇડ કરવા માટે
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
                        globalPlayer.playVideo(); 
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

// બેકગ્રાઉન્ડ પ્રીલોડર પ્લેયર શરૂ કરવાનું ફંક્શન
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
                console.log("મેઈન પ્લેયર અને પ્રીલોડર બંને રેડી થઈ ગયા છે.");
                resolve();
            }
        }
    });
}

// આગામી વિડિયોને બેકગ્રાઉન્ડમાં પ્રી-લોડ (Preload) કરવાનું ફંક્શન
function preloadNextVideo(index) {
    if (preloaderPlayer && allShorts[index]) {
        const nextVideoId = allShorts[index].videoId;
        try {
            preloaderPlayer.cueVideoById(nextVideoId);
            console.log("બેકગ્રાઉન્ડમાં પ્રી-લોડ થયો વિડિયો ID:", nextVideoId);
        } catch (e) {}
    }
}

// 5. શોર્ટ્સ કાર્ડ્સ રેન્ડર કરવા (તમારો ઓરિજિનલ પ્રોફેશનલ લુક લાઇટ અને સેમ રહેશે)
function renderNextShorts(count = 1) {
    for (let i = 0; i < count && currentRenderIndex < allShorts.length; i++) {
        const short = allShorts[currentRenderIndex];
        const tempDiv = document.createElement("div");

        tempDiv.innerHTML = `
            <div class="short-card" data-videoid="${short.videoId}" data-index="${currentRenderIndex}">
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
                    if (watchedVideoIds.has(videoId)) continue; 

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

// 7. ઇન્ટરસેક્શન ઓબ્ઝર્વર (મેઈન સ્વિચિંગ અને પ્રીલોડિંગ કંટ્રોલ)
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
                // કરંટ વિડિયોને ઇન્સ્ટન્ટ લોડ કરી પ્લે કરો
                globalPlayer.loadVideoById(videoId);
                
                // આના પછીના (Next) વિડિયોને અત્યારથી જ છુપી રીતે પ્રી-લોડ કરો
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

async function startApp() {
    if (typeof YT !== 'undefined' && YT.loaded) {
        await initPlayers();
    } else {
        window.onYouTubeIframeAPIReady = async () => {
            await initPlayers();
        };
    }
    
    renderNextShorts(4); 
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