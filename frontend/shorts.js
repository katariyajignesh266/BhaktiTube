import { db, auth } from "./firebase-config.js";
import { collection, getDocs, doc, setDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { YOUTUBE_API_KEY, APP_CONFIG } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

// DOM Elements
const shortsContainer = document.getElementById("shortsContainer");
const shortsLoader = document.getElementById("shortsLoader");

// Centralized Config Constants (with fallbacks)
const API_KEY = YOUTUBE_API_KEY;
const SHORTS_INITIAL_CHANNELS_TO_PROCESS = APP_CONFIG.SHORTS_INITIAL_CHANNELS_TO_PROCESS || 2;
const SHORTS_INITIAL_ITEMS_PER_CHANNEL = APP_CONFIG.SHORTS_INITIAL_ITEMS_PER_CHANNEL || 10;
const SHORTS_BACKGROUND_BATCH_SIZE = APP_CONFIG.SHORTS_BACKGROUND_BATCH_SIZE || 4;
const SHORTS_PER_CHANNEL_UNSEEN_TARGET = APP_CONFIG.SHORTS_PER_CHANNEL_UNSEEN_TARGET || 30;
const SHORTS_MAX_PAGES_PER_CHANNEL = APP_CONFIG.SHORTS_MAX_PAGES_PER_CHANNEL || 5;

// Global State
const enabledChannels = [];
const watchedVideoIds = new Set();
const watchedCache = new Set();
const allShorts = [];
const channelShorts = {};
const sessionLoadedVideoIds = new Set();
const channelFetchStates = {};

let currentRenderIndex = 0;
let activeCardIndex = 0;
let observer = null;
let watchTimer = null; 
let globalPlayer = null; 
let isPlayerReady = false;
let preloaderPlayer = null;
let appStarted = false;
let playersInitPromise = null;

// લોડિંગ વગર ઇન્સ્ટન્ટ પ્લે કરવા માટે બેકગ્રાઉન્ડ પ્રીલોડર આઇફ્રેમ (Hidden Preloader)
const preloaderContainer = document.createElement("div");
preloaderContainer.id = "hidden-preloader-container";
preloaderContainer.style.position = "fixed";
preloaderContainer.style.width = "1px";
preloaderContainer.style.height = "1px";
preloaderContainer.style.opacity = "0.01";
preloaderContainer.style.pointerEvents = "none";
document.body.appendChild(preloaderContainer);

// મેઈન સિંગલ પ્લેયર કન્ટેનર
const globalPlayerContainer = document.createElement("div");
globalPlayerContainer.id = "global-player-container";
document.body.appendChild(globalPlayerContainer);

// CSS styles addition for channel layout row
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

// Firebase authentication helper wrapping onAuthStateChanged
function getAuthUser() {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user);
        });
    });
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

// વિડિયો સેવ કરવાનું લોજિક (Firebase + LocalStorage)
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
        console.error("Error saving watched short to Firestore:", error);
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

// મેઈન પ્લેયર અને બેકગ્રાઉન્ડ પ્રીલોડર સેટઅપ
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

// શોર્ટ્સカード્સ રેન્ડર કરવા
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

// Helper to determine the target playlist ID for uploads or configured playlist
function getPlaylistIdForChannel(channel) {
    if (channel.sourceType === "playlist" && channel.playlistId) {
        return channel.playlistId;
    }
    return channel.uploadsPlaylistId;
}

// Fetch a single page of items and matching video details from Youtube API
async function fetchChannelShortsPage(channel, limit = 50) {
    const channelId = channel.id;
    const state = channelFetchStates[channelId];
    if (!state) {
        console.error(`State not initialized for channel ${channel.channelName} (ID: ${channelId})`);
        return [];
    }
    if (state.isExhausted) {
        console.log(`Channel ${channel.channelName} fetch skipped: already marked exhausted.`);
        return [];
    }

    const playlistId = getPlaylistIdForChannel(channel);
    if (!playlistId) {
        console.warn(`Channel ${channel.channelName} has no valid uploadsPlaylistId or playlistId.`);
        state.isExhausted = true;
        return [];
    }

    try {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${limit}&pageToken=${state.nextPageToken}&key=${API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `HTTP ${response.status}`;
            console.error(`YouTube API playlistItems error for channel ${channel.channelName}: ${errMsg}`);
            state.isExhausted = true; 
            return [];
        }

        const data = await response.json();
        state.pagesFetched++;

        if (!data.items || data.items.length === 0) {
            console.log(`Channel ${channel.channelName}: YouTube playlistItems call returned 0 items.`);
            state.isExhausted = true;
            return [];
        }

        const videoIds = [];
        const itemsMap = {};
        let unavailableFiltered = 0;

        data.items.forEach(item => {
            if (item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId) {
                const vId = item.snippet.resourceId.videoId;
                const title = (item.snippet.title || "").toLowerCase();
                
                // Filter out private/deleted/unavailable videos early
                if (title.includes('private video') || 
                    title.includes('deleted video') || 
                    title.includes('unavailable') ||
                    title.includes('this video is unavailable') ||
                    title.includes('this video is private')) {
                    unavailableFiltered++;
                    return;
                }
                videoIds.push(vId);
                itemsMap[vId] = item;
            }
        });

        if (videoIds.length === 0) {
            console.log(`Channel ${channel.channelName}: All ${data.items.length} items on page filtered early as unavailable/private/deleted.`);
            state.nextPageToken = data.nextPageToken || "";
            if (!state.nextPageToken) state.isExhausted = true;
            return [];
        }

        // Fetch details in batch for the videos
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds.join(",")}&key=${API_KEY}`;
        const detailsResponse = await fetch(detailsUrl);
        if (!detailsResponse.ok) {
            const errData = await detailsResponse.json().catch(() => ({}));
            const errMsg = errData.error?.message || `HTTP ${detailsResponse.status}`;
            console.error(`YouTube API videos details error for channel ${channel.channelName}: ${errMsg}`);
            state.isExhausted = true;
            return [];
        }

        const detailsData = await detailsResponse.json();
        const detailsMap = {};
        if (detailsData.items) {
            detailsData.items.forEach(d => {
                detailsMap[d.id] = d;
            });
        }

        let durationFilteredCount = 0;
        let watchedFilteredCount = 0;
        let duplicateFilteredCount = 0;
        const newShorts = [];

        for (const videoId of videoIds) {
            const item = itemsMap[videoId];
            const videoDetails = detailsMap[videoId];
            if (!videoDetails || !videoDetails.contentDetails) {
                console.log(`Video details missing/unavailable for ID ${videoId} on channel ${channel.channelName}`);
                continue;
            }

            const duration = videoDetails.contentDetails.duration;
            const seconds = convertDurationToSeconds(duration);

            if (seconds > 60) {
                durationFilteredCount++;
                continue;
            }

            if (watchedVideoIds.has(videoId)) {
                watchedFilteredCount++;
                continue;
            }

            if (sessionLoadedVideoIds.has(videoId)) {
                duplicateFilteredCount++;
                continue;
            }

            sessionLoadedVideoIds.add(videoId);
            const originalLikes = videoDetails.statistics ? videoDetails.statistics.likeCount : 0;
            newShorts.push({
                videoId,
                title: item.snippet.title,
                channelName: channel.channelName,
                channelLogo: channel.channelLogo,
                likeCount: originalLikes
            });
            state.unseenFound++;
        }

        state.nextPageToken = data.nextPageToken || "";
        if (!state.nextPageToken) {
            state.isExhausted = true;
        }

        console.log(`Channel ${channel.channelName} page fetch: Found ${newShorts.length} new shorts. (Candidates: ${videoIds.length}, Unavailable: ${unavailableFiltered}, Long-form (>60s): ${durationFilteredCount}, Watched: ${watchedFilteredCount}, Session duplicate: ${duplicateFilteredCount}).`);

        return newShorts;
    } catch (error) {
        console.error(`Error in fetchChannelShortsPage for channel ${channel.channelName}:`, error);
        state.isExhausted = true; 
        return [];
    }
}

// Fetch loop for a single channel until its target unseen shorts are collected
async function fetchChannelShortsUntilTarget(channel, target = 30, maxPages = 5) {
    const channelId = channel.id;
    const state = channelFetchStates[channelId];
    if (!state) return;
    
    while (state.unseenFound < target && !state.isExhausted && state.pagesFetched < maxPages) {
        try {
            const pageShorts = await fetchChannelShortsPage(channel, 50);
            if (pageShorts.length > 0) {
                if (!channelShorts[channel.channelName]) {
                    channelShorts[channel.channelName] = [];
                }
                channelShorts[channel.channelName].push(...pageShorts);
                
                // Rebuild interleaving suffix
                rebuildAllShortsSuffix();
                
                // Keep the visible layout queue fed
                if (appStarted) {
                    topUpRenderBuffer();
                }
            } else {
                // If a page returned 0 eligible items, break to prevent spinning in vain
                break;
            }
        } catch (e) {
            console.error(`Error in fetchChannelShortsUntilTarget loop for channel ${channel.channelName}:`, e);
            break;
        }
    }
}

// Rebuilds the unrendered portion of allShorts round-robin style
function rebuildAllShortsSuffix() {
    // 1. Put unrendered shorts from allShorts back to the front of channelShorts
    const unrendered = allShorts.slice(currentRenderIndex);
    allShorts.length = currentRenderIndex;

    for (let i = unrendered.length - 1; i >= 0; i--) {
        const short = unrendered[i];
        if (!channelShorts[short.channelName]) {
            channelShorts[short.channelName] = [];
        }
        channelShorts[short.channelName].unshift(short);
    }

    // 2. Re-interleave all available shorts from channelShorts
    const channelNames = Object.keys(channelShorts);
    let shortsRemaining = true;

    while (shortsRemaining) {
        shortsRemaining = false;
        for (const name of channelNames) {
            if (channelShorts[name] && channelShorts[name].length > 0) {
                allShorts.push(channelShorts[name].shift());
                shortsRemaining = true;
            }
        }
    }
}

// Ensures we always have pre-rendered cards ready ahead of scroll
function topUpRenderBuffer() {
    const bufferAhead = currentRenderIndex - activeCardIndex;
    const targetBuffer = 4;
    if (bufferAhead < targetBuffer && allShorts.length > currentRenderIndex) {
        const countToRender = Math.min(targetBuffer - bufferAhead, allShorts.length - currentRenderIndex);
        if (countToRender > 0) {
            const prevRenderIndex = currentRenderIndex;
            renderNextShorts(countToRender);
            
            // Observe the newly rendered cards
            const cards = document.querySelectorAll(".short-card");
            cards.forEach((card, index) => {
                if (index >= prevRenderIndex && observer) {
                    observer.observe(card);
                }
            });
        }
    }
}

// Starts player rendering and listener hookups
async function startApp() {
    await playersInitPromise;
    
    // Render initial cards (up to 4, or whatever is available)
    renderNextShorts(Math.min(4, allShorts.length)); 
    
    if (shortsLoader) {
        shortsLoader.style.display = "none";
    }
    
    const firstCards = document.querySelectorAll(".short-card");
    firstCards.forEach(card => {
        if (observer) {
            observer.observe(card);
        }
    });
}

// Tier 0 — Instant priority fetching
async function runTier0Discovery() {
    const priorityChannels = enabledChannels.slice(0, SHORTS_INITIAL_CHANNELS_TO_PROCESS);
    console.log(`runTier0Discovery: Total enabledChannels is ${enabledChannels.length}. Selecting first ${priorityChannels.length} as priority.`);
    
    if (priorityChannels.length === 0) {
        console.warn("runTier0Discovery: No enabled channels found in Firestore.");
        if (shortsLoader) {
            shortsLoader.innerHTML = "No enabled channels found.";
        }
        return;
    }

    console.log(`runTier0Discovery: Starting priority fetching with:`, 
        priorityChannels.map(c => ({ name: c.channelName, playlistId: getPlaylistIdForChannel(c), id: c.id }))
    );

    // Safeguard timeout to ensure loading screen goes away if all API requests fail
    const tier0Timeout = setTimeout(() => {
        if (!appStarted) {
            console.warn("Tier 0 fetch timed out with 0 shorts.");
            if (shortsLoader) {
                shortsLoader.innerHTML = "No Shorts found or YouTube API limited.";
            }
        }
    }, 8000);

    // Initialize states for priority channels
    priorityChannels.forEach(channel => {
        channelFetchStates[channel.id] = {
            nextPageToken: "",
            unseenFound: 0,
            isExhausted: false,
            pagesFetched: 0
        };
    });

    // Fetch Tier 0 pages in parallel
    const priorityPromises = priorityChannels.map(async (channel) => {
        try {
            const pageShorts = await fetchChannelShortsPage(channel, SHORTS_INITIAL_ITEMS_PER_CHANNEL);
            if (pageShorts.length > 0) {
                if (!channelShorts[channel.channelName]) {
                    channelShorts[channel.channelName] = [];
                }
                channelShorts[channel.channelName].push(...pageShorts);
                
                // Rebuild interleaving
                rebuildAllShortsSuffix();
                
                // Start playback as soon as 1 short is resolved
                if (allShorts.length > 0 && !appStarted) {
                    appStarted = true;
                    clearTimeout(tier0Timeout);
                    console.log(`Tier 0 success: Found playable short. Starting application.`);
                    await startApp();
                }
            }
        } catch (e) {
            console.error(`Error fetching priority channel ${channel.channelName} in Tier 0:`, e);
        }
    });

    await Promise.all(priorityPromises);

    // Ensure we start app if Tier 0 completes and we haven't started yet
    if (allShorts.length > 0 && !appStarted) {
        appStarted = true;
        clearTimeout(tier0Timeout);
        console.log(`Tier 0 completed. Starting application with ${allShorts.length} initial shorts.`);
        await startApp();
    } else if (!appStarted) {
        console.log("Tier 0 completed with 0 shorts. Waiting on background discovery...");
    }

    // Run Tier 1 & Tier 2 background processes
    runBackgroundDiscovery().catch(err => console.error("Error in background discovery:", err));
}

// Tier 1 & Tier 2 — Background expansion and pool filling
async function runBackgroundDiscovery() {
    const priorityChannels = enabledChannels.slice(0, SHORTS_INITIAL_CHANNELS_TO_PROCESS);
    const remainingChannels = enabledChannels.slice(SHORTS_INITIAL_CHANNELS_TO_PROCESS);

    console.log(`runBackgroundDiscovery: starting with ${priorityChannels.length} priority and ${remainingChannels.length} remaining channels.`);

    // Tier 1: Complete priority channels up to target
    const tier1Promises = priorityChannels.map(channel => 
        fetchChannelShortsUntilTarget(channel, SHORTS_PER_CHANNEL_UNSEEN_TARGET, SHORTS_MAX_PAGES_PER_CHANNEL)
    );
    await Promise.all(tier1Promises);
    saveShortsToCache();

    // Tier 2: Prepare states and run remaining channels in batches
    remainingChannels.forEach(channel => {
        if (!channelFetchStates[channel.id]) {
            channelFetchStates[channel.id] = {
                nextPageToken: "",
                unseenFound: 0,
                isExhausted: false,
                pagesFetched: 0
            };
        }
    });

    for (let i = 0; i < remainingChannels.length; i += SHORTS_BACKGROUND_BATCH_SIZE) {
        const batch = remainingChannels.slice(i, i + SHORTS_BACKGROUND_BATCH_SIZE);
        const batchPromises = batch.map(channel => 
            fetchChannelShortsUntilTarget(channel, SHORTS_PER_CHANNEL_UNSEEN_TARGET, SHORTS_MAX_PAGES_PER_CHANNEL)
        );
        await Promise.all(batchPromises);
        saveShortsToCache();
    }

    console.log(`Background discovery fully complete. Discovered ${allShorts.length} shorts in total.`);

    // If still not started, fallbacks
    if (allShorts.length > 0 && !appStarted) {
        appStarted = true;
        console.log(`Background discovery completed with shorts. Starting application.`);
        await startApp();
    } else if (allShorts.length === 0 && !appStarted) {
        console.warn(`All discovery completed but found 0 total shorts across all ${enabledChannels.length} channels.`);
        let reason = "All channels empty or YouTube API quota exceeded.";
        if (enabledChannels.length === 0) {
            reason = "No enabled channels found in Firestore.";
        } else if (watchedVideoIds.size > 0 && sessionLoadedVideoIds.size === 0) {
            reason = "All candidate videos already watched.";
        }
        console.warn(`Reason for empty state: ${reason}`);
        if (shortsLoader) {
            shortsLoader.innerHTML = "No Shorts found.";
        }
    }
}

// Save discovered pool to session/daily cache
function saveShortsToCache() {
    try {
        const pool = [...allShorts];
        Object.keys(channelShorts).forEach(name => {
            pool.push(...channelShorts[name]);
        });

        // Deduplicate
        const uniquePool = [];
        const seenIds = new Set();
        pool.forEach(short => {
            if (!seenIds.has(short.videoId)) {
                seenIds.add(short.videoId);
                uniquePool.push(short);
            }
        });

        localStorage.setItem("shortsCachePool", JSON.stringify(uniquePool));
        localStorage.setItem("shortsCacheDate", new Date().toDateString());
    } catch (e) {
        console.error("Failed to save shorts cache:", e);
    }
}

// Load from session/daily cache
function loadShortsFromCache() {
    try {
        const cachedDate = localStorage.getItem("shortsCacheDate");
        if (cachedDate === new Date().toDateString()) {
            const cachedPool = JSON.parse(localStorage.getItem("shortsCachePool") || "[]");
            if (cachedPool.length > 0) {
                cachedPool.forEach(short => {
                    if (!watchedVideoIds.has(short.videoId) && !sessionLoadedVideoIds.has(short.videoId)) {
                        sessionLoadedVideoIds.add(short.videoId);
                        if (!channelShorts[short.channelName]) {
                            channelShorts[short.channelName] = [];
                        }
                        channelShorts[short.channelName].push(short);
                    }
                });
                
                rebuildAllShortsSuffix();
                console.log(`[Cache Load] Restored ${allShorts.length} unique shorts from cache.`);
            }
        }
    } catch (e) {
        console.error("Error loading shorts from cache:", e);
    }
}

// Parallel initialization setup for Youtube IFrame API
function loadYoutubeAPIAndInitPlayers() {
    playersInitPromise = new Promise((resolve) => {
        if (typeof YT !== 'undefined' && YT.loaded) {
            initPlayers().then(resolve);
        } else {
            window.onYouTubeIframeAPIReady = () => {
                initPlayers().then(resolve);
            };
        }
    });
}

// ઇન્ટરસેક્શન ઓબ્ઝર્વર
observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const card = entry.target;
            const videoId = card.dataset.videoid;
            const cardIndex = parseInt(card.dataset.index);

            activeCardIndex = cardIndex;

            if (!isPlayerReady) return;

            if (watchTimer) {
                clearTimeout(watchTimer);
                watchTimer = null;
            }

            globalPlayerContainer.style.display = "block";
            globalPlayerContainer.dataset.videoid = videoId;

            try {
                globalPlayer.loadVideoById(videoId);
                if (globalPlayer.setLoop) {
                    globalPlayer.setLoop(true);
                }
                preloadNextVideo(cardIndex + 1);
            } catch (err) {
                console.error("Error swapping video:", err);
            }

            // Request next cards to top up the queue
            renderNextShorts(2);
        }
    });
}, { 
    threshold: 0.6 
});

// Main App Initialization Pipeline
async function initApp() {
    // 1. Kick off player setup in background
    loadYoutubeAPIAndInitPlayers();

    try {
        // 2. Fetch active channels and user watched metadata in parallel
        const [channelsSnap, user] = await Promise.all([
            getDocs(collection(db, "channels")),
            getAuthUser()
        ]);

        // Process watched lists
        const localWatchedVideos = JSON.parse(localStorage.getItem("watchedVideos") || "[]");
        localWatchedVideos.forEach(videoId => watchedVideoIds.add(videoId));

        if (user) {
            try {
                const watchedSnapshot = await getDocs(collection(db, "users", user.uid, "watchedShorts"));
                watchedSnapshot.forEach(doc => watchedVideoIds.add(doc.id));
            } catch (error) {
                console.error("Error fetching watched shorts list from Firestore:", error);
            }
        }

        // Process channels list and sort locally by createdAt desc
        const tempChannels = [];
        channelsSnap.forEach((doc) => {
            const channel = doc.data();
            if (channel.enabled) {
                channel.id = doc.id || channel.channelId || channel.channelName;
                tempChannels.push(channel);
            }
        });

        tempChannels.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });

        enabledChannels.push(...tempChannels);
        console.log(`initApp: Loaded ${enabledChannels.length} enabled channels from Firestore.`);

        // 3. Load daily cache
        loadShortsFromCache();

        // 4. Resolve play state
        if (allShorts.length > 0) {
            // Warm cache hit - playback is immediate!
            appStarted = true;
            console.log("[Fast Load] Warm cache hit! Starting app immediately.");
            await startApp();
            
            // Still scan in background to update
            runBackgroundDiscovery().catch(err => console.error("Error in background discovery:", err));
        } else {
            // Cold start - run Tier 0 priority discovery
            console.log("[Fast Load] Cold start. Running Tier 0 discovery.");
            await runTier0Discovery();
        }
    } catch (e) {
        console.error("Failed to initialize Shorts Application:", e);
        if (shortsLoader) {
            shortsLoader.innerHTML = "Failed to load. Please refresh the page.";
        }
    }
}

// Kick off initialization
initApp();

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

// Gesture preventions and double tap prevention listeners
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