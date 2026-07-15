import { db } from "./firebase-config.js";

import { auth }
from "./firebase-config.js";

import {
onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  increment,
  onSnapshot
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

import {
signOut
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import {
watchProgressEngine,
formatWatchTime,
formatRelativeTime,
profileService,
generateAvatarDataUrl
}
from "./analytics-engine.js";

import { playVideo } from "./player-core.js";
import { renderDashboard } from "./dashboard-renderer.js";
import { getChannelCardMarkup } from "./channel-card-renderer.js";

/* ==========================================================================
   ⚡ THEME SYSTEM - LIGHT/DARK MODE TOGGLE
   ========================================================================== */

const THEME_KEY = "bt_theme_preference";
const THEME_ATTR = "data-theme";

// Initialize theme on page load
function initializeTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    // Set theme based on saved preference or default to dark mode
    const theme = savedTheme || "dark";
    setTheme(theme);
}

// Set theme and update UI
function setTheme(theme) {
    document.documentElement.setAttribute(THEME_ATTR, theme);
    localStorage.setItem(THEME_KEY, theme);
    
    // Update theme icon
    const themeIcon = document.getElementById("themeIcon");
    if (themeIcon) {
        themeIcon.className = theme === "dark" ? "fa-solid fa-moon" : "fa-solid fa-sun";
    }
    
    // Update channel card theme for light mode
    if (theme === "light") {
        document.body.setAttribute("data-cc-theme", "light");
    } else {
        document.body.removeAttribute("data-cc-theme");
    }
}

// Toggle between light and dark theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute(THEME_ATTR) || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
}

// Initialize theme on DOM load
document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();
    
    // Set up theme toggle button
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", toggleTheme);
    }
    
    // Initialize dashboard after DOM is ready
    initializeDashboard().catch(error => {
        console.error("Error during dashboard initialization:", error);
        // Ensure spinner is hidden even if initialization fails
        const loaders = document.querySelectorAll('.section-loader, .all-channels-feed-loader');
        loaders.forEach(loader => {
            if (loader) loader.style.display = 'none';
        });
    });
});

// Listen for system theme changes
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
        setTheme(e.matches ? "dark" : "light");
    }
});

/* ==========================================================================
   ⚡ NEW CHANNEL ANNOUNCEMENT SYSTEM - IMPROVED ARCHITECTURE
   ========================================================================== */

const ANNOUNCEMENT_SEEN_KEY = "bt_announcement_seen_channels";
const GUEST_LAST_SEEN_KEY = "bt_guest_last_seen_channel";
let currentAnnouncementChannel = null;
let currentUser = null;
let isFirstTimeLogin = false;

// Track current user for Firebase-based seen state
onAuthStateChanged(auth, async (user) => {
    const previousUser = currentUser;
    currentUser = user;
    
    // Check if this is a first-time login (user just signed up)
    if (user && !previousUser) {
        await checkAndHandleFirstTimeLogin(user);
    }
    
    // Initialize popup after user state is set
    initializeAnnouncementPopup();
});

// Check if this is a first-time login and mark all existing channels as seen
async function checkAndHandleFirstTimeLogin(user) {
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (!userDoc.exists() || !userDoc.data().announcementsSeen) {
            // First-time user - mark all existing channels as seen
            isFirstTimeLogin = true;
            await markAllExistingChannelsAsSeen();
        }
    } catch (e) {
        console.error("Error checking first-time login:", e);
    }
}

// Mark all existing enabled channels as seen for first-time users
async function markAllExistingChannelsAsSeen() {
    try {
        const q = query(collection(db, "channels"), orderBy("announcementCreatedAt", "desc"));
        const snapshot = await getDocs(q);
        
        const seenChannels = {};
        
        snapshot.forEach((docSnap) => {
            const channel = docSnap.data();
            if (channel.enabled === true && channel.announcementEnabled === true) {
                seenChannels[channel.channelId] = true;
            }
        });
        
        if (Object.keys(seenChannels).length > 0) {
            await setDoc(doc(db, "users", currentUser.uid), { 
                announcementsSeen: seenChannels 
            }, { merge: true });
            console.log(`✅ Marked ${Object.keys(seenChannels).length} existing channels as seen for new user`);
        }
    } catch (e) {
        console.error("Error marking existing channels as seen:", e);
    }
}

// Get seen channels from appropriate storage
async function getSeenAnnouncementChannels() {
    if (currentUser) {
        try {
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                return userData.announcementsSeen || {};
            }
        } catch (e) {
            console.error("Error fetching Firebase seen state:", e);
        }
    }
    
    // For guest users or on error, use localStorage
    try {
        const seen = localStorage.getItem(ANNOUNCEMENT_SEEN_KEY);
        return seen ? JSON.parse(seen) : {};
    } catch (e) {
        console.error("Error reading localStorage seen state:", e);
        return {};
    }
}

// Get last seen channel for guest users
function getGuestLastSeenChannel() {
    try {
        const lastSeen = localStorage.getItem(GUEST_LAST_SEEN_KEY);
        return lastSeen ? JSON.parse(lastSeen) : null;
    } catch (e) {
        console.error("Error reading guest last seen:", e);
        return null;
    }
}

// Mark channel as seen in appropriate storage
async function markAnnouncementAsSeen(channelId) {
    if (currentUser) {
        try {
            const userRef = doc(db, "users", currentUser.uid);
            const userDoc = await getDoc(userRef);
            let currentSeen = {};
            
            if (userDoc.exists()) {
                currentSeen = userDoc.data().announcementsSeen || {};
            }
            
            currentSeen[channelId] = true;
            await setDoc(userRef, { announcementsSeen: currentSeen }, { merge: true });
            return;
        } catch (e) {
            console.error("Error saving Firebase seen state:", e);
        }
    }
    
    // Fallback to localStorage for guests or on error
    try {
        const seen = localStorage.getItem(ANNOUNCEMENT_SEEN_KEY);
        const seenObj = seen ? JSON.parse(seen) : {};
        seenObj[channelId] = true;
        localStorage.setItem(ANNOUNCEMENT_SEEN_KEY, JSON.stringify(seenObj));
        
        // Also update last seen channel for guests
        localStorage.setItem(GUEST_LAST_SEEN_KEY, JSON.stringify({
            channelId: channelId,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.error("Error saving localStorage seen state:", e);
    }
}

// Initialize announcement popup - called on page load and auth changes
async function initializeAnnouncementPopup() {
    try {
        const seenChannels = await getSeenAnnouncementChannels();
        
        // Only fetch channels with announcementEnabled === true
        const q = query(collection(db, "channels"), orderBy("announcementCreatedAt", "desc"));
        const snapshot = await getDocs(q);

        let latestUnseenChannel = null;

        if (currentUser) {
            // LOGGED-IN USER: Show only the latest unseen channel
            for (const docSnap of snapshot.docs) {
                const channel = docSnap.data();
                if (channel.enabled !== true || channel.announcementEnabled !== true) continue;
                
                if (!seenChannels[channel.channelId]) {
                    latestUnseenChannel = { id: docSnap.id, ...channel };
                    break; // Only take the latest one
                }
            }
        } else {
            // GUEST USER: Show only the latest channel if it's newer than last seen
            const guestLastSeen = getGuestLastSeenChannel();
            
            for (const docSnap of snapshot.docs) {
                const channel = docSnap.data();
                if (channel.enabled !== true || channel.announcementEnabled !== true) continue;
                
                // If guest has never seen any channel, show the latest
                if (!guestLastSeen) {
                    latestUnseenChannel = { id: docSnap.id, ...channel };
                    break;
                }
                
                // Only show if this channel is different from last seen
                // Since channels are sorted by announcementCreatedAt desc, the first different channel is the newest
                if (channel.channelId !== guestLastSeen.channelId) {
                    latestUnseenChannel = { id: docSnap.id, ...channel };
                    break;
                }
                
                // If the latest channel matches last seen, don't show any popup
                break;
            }
        }

        // Show popup only if there's a latest unseen channel
        if (latestUnseenChannel) {
            showChannelAnnouncement(latestUnseenChannel);
        }
    } catch (e) {
        console.error("Error initializing announcement popup:", e);
    }
}

// Show channel announcement popup
function showChannelAnnouncement(channel) {
    currentAnnouncementChannel = channel;
    const modal = document.getElementById("channelAnnouncementModal");
    const channelCardContainer = document.getElementById("announcementChannelCard");
    const bannerContainer = document.getElementById("announcementBannerContainer");
    const bannerImage = document.getElementById("announcementBannerImage");

    if (!modal || !channelCardContainer) return;

    // Reuse existing channel card component - NO DUPLICATION
    channelCardContainer.innerHTML = getChannelCardMarkup(currentAnnouncementChannel);

    // Show preview banner if available
    if (currentAnnouncementChannel.previewBanner) {
        bannerImage.src = currentAnnouncementChannel.previewBanner;
        bannerImage.loading = "lazy";
        bannerContainer.classList.add("has-banner");
    } else {
        bannerContainer.classList.remove("has-banner");
    }

    modal.classList.add("active");

    // Handle channel card click
    const channelCard = channelCardContainer.querySelector(".channel-card");
    if (channelCard) {
        const link = channelCard.querySelector("a");
        if (link) {
            link.addEventListener("click", handleAnnouncementClick);
        }
    }
}

// Handle announcement click - mark seen and navigate
async function handleAnnouncementClick(e) {
    e.preventDefault();
    if (!currentAnnouncementChannel) return;

    // Mark as seen BEFORE navigation
    await markAnnouncementAsSeen(currentAnnouncementChannel.channelId);
    
    // Close modal
    const modal = document.getElementById("channelAnnouncementModal");
    if (modal) modal.classList.remove("active");
    
    // Navigate to channel
    window.location.href = `channel.html?id=${currentAnnouncementChannel.channelId}`;
}

// Handle close button click
const closeAnnouncementBtn = document.getElementById("closeAnnouncementBtn");
if (closeAnnouncementBtn) {
    closeAnnouncementBtn.addEventListener("click", async () => {
        if (!currentAnnouncementChannel) return;

        // Mark as seen BEFORE any action
        await markAnnouncementAsSeen(currentAnnouncementChannel.channelId);
        
        const modal = document.getElementById("channelAnnouncementModal");
        if (modal) modal.classList.remove("active");
        
        // Navigate to channel immediately
        window.location.href = `channel.html?id=${currentAnnouncementChannel.channelId}`;
    });
}

// Handle backdrop click
const announcementModal = document.getElementById("channelAnnouncementModal");
if (announcementModal) {
    announcementModal.addEventListener("click", async (e) => {
        if (e.target === announcementModal || e.target.classList.contains("announcement-backdrop")) {
            if (!currentAnnouncementChannel) return;

            // Mark as seen BEFORE any action
            await markAnnouncementAsSeen(currentAnnouncementChannel.channelId);
            
            announcementModal.classList.remove("active");
            
            // Navigate to channel immediately
            window.location.href = `channel.html?id=${currentAnnouncementChannel.channelId}`;
        }
    });
}

// Handle Escape key to close
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        const modal = document.getElementById("channelAnnouncementModal");
        if (modal && modal.classList.contains("active") && currentAnnouncementChannel) {
            markAnnouncementAsSeen(currentAnnouncementChannel.channelId).then(() => {
                modal.classList.remove("active");
                window.location.href = `channel.html?id=${currentAnnouncementChannel.channelId}`;
            });
        }
    }
});

// Global shareVideo function (reused from channel.js)
// Must be defined here to be available for inline onclick handlers
window.shareVideo = async function(videoId) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'BhaktiTube Video',
        text: 'Check out this devotional video on BhaktiTube',
        url: videoUrl
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error sharing:', err);
        fallbackShare(videoUrl);
      }
    }
  } else {
    fallbackShare(videoUrl);
  }
};

function fallbackShare(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert('Video URL copied to clipboard!');
  }).catch(() => {
    prompt('Copy this video URL:', url);
  });
}

// Dynamic import for all-channels-feed module
let allChannelsFeedModule = null;

async function loadAllChannelsFeedModule() {
  if (!allChannelsFeedModule) {
    allChannelsFeedModule = await import("./all-channels-feed.js");
  }
  return allChannelsFeedModule;
}

async function initAllChannelsFeedDynamic() {
  const module = await loadAllChannelsFeedModule();
  return module.initAllChannelsFeed();
}

const logoutBtn =
document.getElementById("logoutBtn");

logoutBtn.addEventListener("click",async()=>{

await signOut(auth);

window.location.href =
"./user/signup.html";

});



console.log("BhaktiTube Loaded");

const videoPopup =
document.getElementById("videoPopup");

const youtubePlayer =
document.getElementById("youtubePlayer");

const adPopup =
document.getElementById("adPopup");

const adVideo =
document.getElementById("adVideo");

const skipAdBtn =
document.getElementById("skipAdBtn");

const visitAdBtn =
document.getElementById("visitAdBtn");

const bellBtn =
document.querySelector(".fa-bell");

const notificationPopup =
document.getElementById("notificationPopup");

const notificationList =
document.getElementById("notificationList");

const journeySection =
document.getElementById("journeySection");

const continueWatchingSection =
document.getElementById("continueWatchingSection");

const allChannelsFeed =
document.getElementById("allChannelsFeed");

const channelsSection =
document.getElementById("channelsSection");

const videosSection =
document.getElementById("videosContainer");

let homePlayer = null;
let homeTrackInterval = null;
let currentHomeVideoId = null;
let currentHomeView = "dashboard";
let youtubeApiReadyPromise = null;
let historyVideoMeta = new Map();

watchProgressEngine.init({
source:"home"
});

// Apply cached theme immediately to prevent FOUC (flash of unthemed card style)
const cachedCardTheme = localStorage.getItem("bt_channel_card_theme") || "dark-glass";
document.body.setAttribute("data-cc-theme", cachedCardTheme);

// Asynchronously sync the card theme from Firestore
async function syncGlobalChannelCardTheme() {
    try {
        const themeDoc = await getDoc(doc(db, "settings", "channelCardTheme"));
        if (themeDoc.exists()) {
            const savedTheme = themeDoc.data().themeId;
            const currentTheme = localStorage.getItem("bt_channel_card_theme");
            if (savedTheme !== currentTheme) {
                localStorage.setItem("bt_channel_card_theme", savedTheme);
                document.body.setAttribute("data-cc-theme", savedTheme);
            }
        }
    } catch (e) {
        console.error("Error syncing global card theme:", e);
    }
}
syncGlobalChannelCardTheme();

/* ==========================================================================
   ⚡ DASHBOARD LAYOUT MODE CONTROLLER
   ========================================================================== */

let dashboardLayoutMode = "classic"; // Default to classic layout

function setPremiumDashboardMode(isActive) {
    document.body.classList.toggle("premium-dashboard-mode", isActive);
}

function setAllChannelsDashboardMode(isActive) {
    document.body.classList.toggle("all-channels-dashboard-mode", isActive);
}

// Check dashboard layout setting from Firestore
async function checkDashboardLayoutMode() {
    try {
        const layoutDoc = await getDoc(doc(db, "settings", "dashboardLayout"));
        if (layoutDoc.exists()) {
            dashboardLayoutMode = layoutDoc.data().layoutMode || "classic";
        }
    } catch (e) {
        console.error("Error checking dashboard layout mode:", e);
        dashboardLayoutMode = "classic"; // Fallback to classic
    }
    return dashboardLayoutMode;
}

// Apply dashboard layout mode
async function applyDashboardLayoutMode(mode) {
    const videosLoader = document.getElementById("videosLoader");
    const premiumChannelFeed = document.getElementById("premiumChannelFeed");
    const premiumScrollIndicator = document.getElementById("premiumScrollIndicator");

    if (mode === "all-channels") {
        // All Channels Feed Mode - YouTube Home style
        setAllChannelsDashboardMode(true);
        setPremiumDashboardMode(false);
        if (channelsSection) channelsSection.style.display = "none";
        if (videosSection) videosSection.style.display = "none";
        if (videosLoader) videosLoader.style.display = "none";
        if (premiumChannelFeed) premiumChannelFeed.style.display = "none";
        if (premiumScrollIndicator) premiumScrollIndicator.style.display = "none";
        if (allChannelsFeed) allChannelsFeed.style.display = "block";
        if (categorySection) categorySection.style.display = "flex"; // Keep category visible
        if (continueWatchingSection) continueWatchingSection.style.display = "none";
    } else if (mode === "premium") {
        // Premium Channel Feed Mode - Content area only
        setPremiumDashboardMode(true);
        setAllChannelsDashboardMode(false);
        if (channelsSection) channelsSection.style.display = "none";
        if (videosSection) videosSection.style.display = "none";
        if (videosLoader) videosLoader.style.display = "none";
        if (premiumChannelFeed) premiumChannelFeed.style.display = "block";
        if (premiumScrollIndicator) premiumScrollIndicator.style.display = "flex";
        if (allChannelsFeed) allChannelsFeed.style.display = "none";
        if (categorySection) categorySection.style.display = "flex"; // Keep category visible
        if (continueWatchingSection) continueWatchingSection.style.display = "none";
    } else {
        // Classic Layout Mode (default behavior)
        setPremiumDashboardMode(false);
        setAllChannelsDashboardMode(false);
        if (channelsSection) channelsSection.style.display = "block";
        if (videosSection) videosSection.style.display = "grid";
        if (premiumChannelFeed) premiumChannelFeed.style.display = "none";
        if (premiumScrollIndicator) premiumScrollIndicator.style.display = "none";
        if (allChannelsFeed) allChannelsFeed.style.display = "none";
        if (categorySection) categorySection.style.display = "flex";
        if (continueWatchingSection) continueWatchingSection.style.display = "";
    }
}

// Render premium channel feed
async function renderPremiumChannelFeed() {
    const premiumFeedContent = document.getElementById("premiumFeedContent");
    if (!premiumFeedContent) return;

    try {
        const q = query(collection(db, "channels"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            premiumFeedContent.innerHTML = `
                <div class="premium-feed-empty">
                    <i class="fa-solid fa-tv"></i>
                    <h3>No Channels Available</h3>
                    <p>Check back later for new devotional content</p>
                </div>
            `;
            return;
        }

        let channels = [];
        snapshot.forEach((docSnap) => {
            const channel = docSnap.data();
            if (channel.enabled === true) {
                channels.push(channel);
            }
        });

        if (channels.length === 0) {
            premiumFeedContent.innerHTML = `
                <div class="premium-feed-empty">
                    <i class="fa-solid fa-tv"></i>
                    <h3>No Active Channels</h3>
                    <p>Channels will appear here when enabled</p>
                </div>
            `;
            return;
        }

        premiumFeedContent.innerHTML = channels.map(channel => `
            <div class="premium-channel-slide">
                ${getChannelCardMarkup(channel, { applyChannelTheme: true })}
            </div>
        `).join("");
    } catch (e) {
        console.error("Error rendering premium channel feed:", e);
        premiumFeedContent.innerHTML = `
            <div class="premium-feed-empty">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <h3>Error Loading Channels</h3>
                <p>Please try refreshing the page</p>
            </div>
        `;
    }
}



async function getAdvertisement(){

console.log("Loading Random Advertisement...");

const snapshot =
await getDocs(
collection(db,"advertisements")
);

const ads = [];

snapshot.forEach((doc)=>{

const ad = doc.data();

if(ad.active){

ads.push({
id: doc.id,
...ad
});

}

});

if(ads.length === 0){

return null;

}

const randomIndex =
Math.floor(
Math.random() * ads.length
);

return ads[randomIndex];

}

function getVideoMetadata(videoId){

const video =
allVideos.find(item => item.videoId === videoId) || historyVideoMeta.get(videoId) || {};

return {
videoId,
videoTitle: video.title || video.videoTitle || "BhaktiTube Video",
channelName: video.channel || video.channelName || "BhaktiTube",
thumbnailUrl: video.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
duration: Number(video.duration || 0)
};

}

function getYouTubeApiReady(){

if(window.YT && window.YT.Player){
return Promise.resolve();
}

if(!youtubeApiReadyPromise){

youtubeApiReadyPromise =
new Promise((resolve)=>{

const previousReady =
window.onYouTubeIframeAPIReady;

window.onYouTubeIframeAPIReady = ()=>{

if(typeof previousReady === "function"){
previousReady();
}

resolve();

};

});

}

return youtubeApiReadyPromise;

}

// Player logic remapped to player-core.js



const videosContainer =
document.getElementById("videosContainer");

function escapeHtml(value){

return String(value || "")
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;");

}

function getVideoCardMarkup(video){

const videoId =
escapeHtml(video.videoId);

return `

    <div
      class="video-card"
      onclick="openVideo('${videoId}')"
    >

      <div class="thumbnail">

        <img
          src="https://img.youtube.com/vi/${videoId}/maxresdefault.jpg"
          alt="${escapeHtml(video.title || "Video thumbnail")}"
          loading="lazy"
        >

        <span class="video-time">
          Video
        </span>

      </div>

      <div class="video-info">

        <div class="channel-logo">
          ${escapeHtml(video.logo || "B")}
        </div>

        <div class="video-details">

          <h3>
            ${escapeHtml(video.title)}
          </h3>

          <p class="channel-name">
            ${escapeHtml(video.channel)}
          </p>

          <p class="video-stats">
            ${escapeHtml(video.views)} • ${escapeHtml(video.date)}
          </p>

        </div>

      </div>

    </div>

    `;

}

async function setHomeView(viewName){

currentHomeView =
viewName;

const showDashboard =
viewName === "dashboard";

const showVideos =
viewName === "videos";

const showChannels =
viewName === "channels";

const showJourney =
viewName === "journey";

categorySection.style.display =
showDashboard ? "flex" : "none";

// Check dashboard layout mode when showing dashboard
if (showDashboard) {
    const layoutMode = await checkDashboardLayoutMode();
    await applyDashboardLayoutMode(layoutMode);
} else {
    // Non-dashboard views
    setPremiumDashboardMode(false);
    setAllChannelsDashboardMode(false);
    channelsSection.style.display =
    showChannels ? "block" : "none";
    
    videosSection.style.display =
    showVideos ? "grid" : "none";
    
    const premiumChannelFeed = document.getElementById("premiumChannelFeed");
    const premiumScrollIndicator = document.getElementById("premiumScrollIndicator");
    const allChannelsFeed = document.getElementById("allChannelsFeed");
    
    if (premiumChannelFeed) premiumChannelFeed.style.display = "none";
    if (premiumScrollIndicator) premiumScrollIndicator.style.display = "none";
    if (allChannelsFeed) allChannelsFeed.style.display = "none";
    continueWatchingSection.style.display = "none";
    categorySection.style.display = "none"; // Hide category in non-dashboard views
    
    // Load data when switching to videos or channels view
    if (showVideos) {
        await loadVideos();
    }
    if (showChannels) {
        await loadChannels(false); // Load channels without re-applying dashboard mode
    }
}

journeySection.classList.toggle(
"active",
showJourney
);

if(showJourney){
refreshPersonalSections();
}

sidebar.classList.remove("active");
sidebarOverlay.classList.remove("active");

}

function getThumbnailUrl(item){

return item.thumbnailUrl ||
`https://img.youtube.com/vi/${escapeHtml(item.videoId)}/maxresdefault.jpg`;

}

function getProgressPercent(item){

const percent =
Number(item.completionPercentage || 0);

if(percent > 0){
return Math.min(100, Math.max(0, percent));
}

const duration =
Number(item.duration || 0);

const current =
Number(item.currentPosition || 0);

return duration > 0
? Math.min(100, Math.round((current / duration) * 100))
: 0;

}

async function refreshPersonalSections(){

try{

const analytics =
await watchProgressEngine.getUserAnalytics();

if (analytics && analytics.history) {
  analytics.history.forEach(item => {
    if (item && item.videoId) {
      historyVideoMeta.set(item.videoId, item);
    }
  });
}
if (analytics && analytics.continueWatching) {
  analytics.continueWatching.forEach(item => {
    if (item && item.videoId) {
      historyVideoMeta.set(item.videoId, item);
    }
  });
}

renderContinueWatching(
analytics.continueWatching || []
);

renderDashboard(journeySection, analytics, window.openVideo);

}
catch(error){

if(continueWatchingSection){
continueWatchingSection.style.display = "none";
}

}

}

function renderContinueWatching(items){

const list =
document.getElementById("continueWatchingList");

if(!list) return;

if(!items.length || currentHomeView !== "dashboard"){

list.innerHTML = "";
continueWatchingSection.style.display = "none";
return;

}

continueWatchingSection.style.display = "";

list.innerHTML =
items.slice(0,8).map((item)=>{

const videoId =
escapeHtml(item.videoId);

const progress =
getProgressPercent(item);

return `
<div class="continue-card" onclick="openVideo('${videoId}')">
  <div class="continue-thumb">
    <img src="${escapeHtml(getThumbnailUrl(item))}" alt="${escapeHtml(item.videoTitle || "Continue watching")}" loading="lazy">
    <div class="continue-progress"><span style="width:${progress}%"></span></div>
  </div>
  <div class="continue-body">
    <h3>${escapeHtml(item.videoTitle)}</h3>
    <div class="continue-meta">
      <span>${escapeHtml(item.channelName || "BhaktiTube")}</span>
      <span>${formatRelativeTime(item.lastViewedMs)}</span>
    </div>
  </div>
</div>
`;

}).join("");

}



async function loadVideos(){

  videosContainer.innerHTML = "";

  const completedVideos =
  await watchProgressEngine.getCompletedVideoIds();

  const q = query(
    collection(db,"videos"),
    orderBy("createdAt","desc")
  );

  const snapshot = await getDocs(q);

  allVideos = [];

  snapshot.forEach((doc)=>{

    const video = doc.data();

    if(
      completedVideos.has(
        video.videoId
      )
    ){
      return;
    }

    allVideos.push(video);

    videosContainer.innerHTML +=
    getVideoCardMarkup(video);

  });

  refreshPersonalSections();

}

async function loadChannels(shouldRender = true) {

  const channelsContainer =
    document.getElementById(
      "channelsContainer"
    );

  channelsContainer.innerHTML = "";

  const q = query(
    collection(db, "channels"),
    orderBy("createdAt", "desc")
  );

  const snapshot =
    await getDocs(q);

  snapshot.forEach((docSnap) => {

    const channel =
      docSnap.data();

    if (channel.enabled !== true) {
      return;
    }

    channelsContainer.innerHTML += getChannelCardMarkup(channel);

  });

  // Only check dashboard layout mode if we're rendering
  // Otherwise, this is called just to fetch data
  if (shouldRender) {
    const layoutMode = await checkDashboardLayoutMode();
    await applyDashboardLayoutMode(layoutMode);

    // If premium mode, render premium channel feed
    if (layoutMode === "premium") {
      await renderPremiumChannelFeed();
    }
  }
}



function renderVideos(videos){

    videosContainer.innerHTML = "";

    videos.forEach((video)=>{

        videosContainer.innerHTML +=
        getVideoCardMarkup(video);

    });

}

let allVideos = [];


const savedTheme =
localStorage.getItem("theme");

if(savedTheme === "light"){

document.body.classList.add(
"light-mode"
);

}

// Initialize dashboard based on Firebase setting BEFORE any rendering
async function initializeDashboard() {
    try {
        // First, check dashboard layout mode from Firebase
        const layoutMode = await checkDashboardLayoutMode();
        
        // Apply the layout mode immediately to hide/show correct sections
        await applyDashboardLayoutMode(layoutMode);
        
        // Now load only the data needed for the selected dashboard
        if (layoutMode === "all-channels") {
            // All Channels Feed mode - only initialize the feed
            await initAllChannelsFeedDynamic();
        } else if (layoutMode === "premium") {
            // Premium mode - render premium channel feed
            await renderPremiumChannelFeed();
        } else {
            // Classic mode - load videos and channels
            await loadVideos();
            await loadChannels(false); // Load data but don't re-apply dashboard mode
        }
        
        // Load notifications regardless of dashboard mode
        await loadNotifications();
        
    } catch (error) {
        console.error("Error initializing dashboard:", error);
        // Fallback to classic mode on error
        try {
            await loadVideos();
            await loadChannels(false);
            await loadNotifications();
        } catch (fallbackError) {
            console.error("Error in fallback initialization:", fallbackError);
            // Hide all loaders as a last resort
            const loaders = document.querySelectorAll('.section-loader, .all-channels-feed-loader');
            loaders.forEach(loader => {
                if (loader) loader.style.display = 'none';
            });
        }
    }
}

// Announcement queue is initialized by onAuthStateChanged handler

const menuBtn =
document.querySelector(".fa-bars");

const sidebar =
document.getElementById("sidebar");

const sidebarOverlay =
document.getElementById("sidebarOverlay");

menuBtn.addEventListener("click",()=>{

sidebar.classList.add("active");

sidebarOverlay.classList.add("active");

});

sidebarOverlay.addEventListener("click",()=>{

sidebar.classList.remove("active");

sidebarOverlay.classList.remove("active");

});

const dashboardBtn =
document.getElementById("dashboardBtn");

const videosBtn =
document.getElementById("videosBtn");

const channelsBtn =
document.getElementById("channelsBtn");

const journeyBtn =
document.getElementById("journeyBtn");

const categorySection =
document.getElementById("categorySection");

dashboardBtn.addEventListener("click",async (e)=>{

e.preventDefault();

await setHomeView("dashboard");

});

videosBtn.addEventListener("click",(e)=>{

e.preventDefault();

setHomeView("videos");

});

channelsBtn.addEventListener("click",(e)=>{

e.preventDefault();

setHomeView("channels");

});

journeyBtn.addEventListener("click",(e)=>{

e.preventDefault();

setHomeView("journey");


});


const settingsBtn =
document.getElementById("settingsBtn");

const settingsModal =
document.getElementById("settingsModal");

const closeSettings =
document.getElementById("closeSettings");

settingsBtn.addEventListener("click",(e)=>{

e.preventDefault();

settingsModal.style.display =
"flex";

});

closeSettings.addEventListener("click",()=>{

settingsModal.style.display =
"none";

});


const darkModeBtn =
document.getElementById("darkModeBtn");

darkModeBtn.addEventListener("click",()=>{

setTheme("dark");

});

const lightModeBtn =
document.getElementById("lightModeBtn");

lightModeBtn.addEventListener("click",()=>{

setTheme("light");

});


const searchBtn =
document.getElementById("searchBtn");

const searchOverlay =
document.getElementById("searchOverlay");

searchBtn.addEventListener("click",()=>{

    searchOverlay.classList.toggle("active");

});

const searchInput =
document.getElementById("searchInput");

searchInput.addEventListener("input",()=>{

    const value =
    searchInput.value.toLowerCase();

    const filtered =
    allVideos.filter((video)=>{

        return (

            video.title.toLowerCase().includes(value)

            ||

            video.channel.toLowerCase().includes(value)

        );

    });

    renderVideos(filtered);

});

const closeSearch =
document.getElementById("closeSearch");

closeSearch.addEventListener("click",()=>{

    searchOverlay.classList.remove("active");

});

const voiceBtn =
document.getElementById("voiceBtn");

const SpeechRecognition =
window.SpeechRecognition ||
window.webkitSpeechRecognition;

if(SpeechRecognition){

    const recognition =
    new SpeechRecognition();

    recognition.lang = "gu-IN";

    recognition.continuous = false;

    recognition.interimResults = false;

    const voicePopup =
document.getElementById("voicePopup");

voiceBtn.addEventListener("click",()=>{

    voicePopup.style.display = "flex";

    recognition.start();

});

    recognition.addEventListener("result",(e)=>{

      voicePopup.style.display = "none";

        const text =
        e.results[0][0].transcript;

        searchInput.value = text;

        const filtered =
        allVideos.filter((video)=>{

            return (

                video.title
                .toLowerCase()
                .includes(text.toLowerCase())

                ||

                video.channel
                .toLowerCase()
                .includes(text.toLowerCase())

            );

        });

        renderVideos(filtered);

    });

}else{

    alert(
      "Voice Search not supported"
    );

}

const profileBtn =
document.getElementById("profileBtn");

profileBtn.addEventListener("click",()=>{

const currentUser = auth.currentUser;

if(currentUser){

window.location.href =
"./user/profile.html";

}else{

window.location.href =
"./user/signup.html";

}

});



window.openVideo = (videoId) => playVideo(videoId, getVideoMetadata(videoId), false);
window.onPlayerClosed = refreshPersonalSections;


const profilePhoto =
document.getElementById("profilePhoto");

profileService.subscribe((profile) => {
  if (profile) {
    const activePhoto = profile.customPhotoURL || profile.photoURL || "";
    if (activePhoto) {
      profilePhoto.src = activePhoto;
    } else {
      profilePhoto.src = generateAvatarDataUrl(profile.displayName, profile.email, profile.uid);
    }
    
    const journeyUserName = document.getElementById("journeyUserName");
    if (journeyUserName) {
      journeyUserName.textContent = profile.displayName || "Bhakti Progress";
    }
  }
});

bellBtn.addEventListener("click", () => {

  notificationPopup.style.display =
  notificationPopup.style.display === "block"
  ? "none"
  : "block";

});

async function loadNotifications(){

  let notificationCount = 0;

  notificationList.innerHTML = "";

  const videosRef =
collection(db,"videos");

  onSnapshot(videosRef, (snapshot) => {


  const now = Date.now();

  snapshot.forEach(docSnap => {

    const video = docSnap.data();

    if(!video.createdAt) return;

    let createdTime;

if(video.createdAt?.seconds){

    createdTime =
    video.createdAt.seconds * 1000;

}else{

    createdTime =
    Number(video.createdAt);

}
    const hours24 =
    24 * 60 * 60 * 1000;

    if(now - createdTime <= hours24){

    notificationCount++;

   notificationList.innerHTML += `

<div
class="notification-item"
onclick="openVideo('${video.videoId}')"
>

    <img
    src="https://img.youtube.com/vi/${video.videoId}/maxresdefault.jpg">

    <div class="notification-details">

        <h4>${video.title}</h4>

        <p>${video.channel}</p>

        <span>🆕 New Video</span>

    </div>

</div>

`;

}

  });

  document.getElementById(
"notificationCount"
).innerText = notificationCount;

});

}


document.getElementById(
"channelsLoader"
).style.display = "none";

document.getElementById(
"videosLoader"
).style.display = "none";


document.querySelectorAll('.logo,.sidebar-logo')
.forEach(el => {

    el.addEventListener('click',()=>{

        window.location.href = "index.html";

    });

});

const openShortsBtn =
document.getElementById(
"openShortsBtn"
);

if(openShortsBtn){

openShortsBtn.addEventListener(
"click",
()=>{

window.location.href =
"shorts.html";

});

}

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