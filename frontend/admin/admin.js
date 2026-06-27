/* ==========================================================================
   ⚡ BHAKTITUBE PREMIUM JS ENGINE - PART 1 OF 4
   ========================================================================== */

// 1. CORE BACKEND FIREBASE INFRASTRUCTURE IMPORTS
import { auth } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { db } from "../firebase-config.js";
import {
    collection,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    doc,
    deleteDoc,
    updateDoc,
    serverTimestamp,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import {
    watchProgressEngine,
    formatWatchTime,
    formatRelativeTime
} from "../analytics-engine.js";
import { renderDashboard } from "../dashboard-renderer.js";
import { getChannelCardMarkup } from "../channel-card-renderer.js";

console.log("⚡ PREMIUM BHAKTITUBE CORE ENGINE ACTIVE");

// YOUTUBE API CREDENTIAL MATRIX KEY
const YOUTUBE_API_KEY = "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE";

// VARIABLE FOR API FETCH CONTAINER POINTER
let fetchedChannel = null;

/* 2. AUTOMATED PREMIUM TOAST SYSTEM */
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    
    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-brand'}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/* 3. DYNAMIC TAB-ROUTING ARCHITECTURE (ChatGPT Sidebar Switcher) */
function initSidebarNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    const pages = document.querySelectorAll(".dashboard-page");
    const sidebar = document.getElementById("sidebarPanel");
    const overlay = document.getElementById("sidebarOverlay");

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetPageId = link.getAttribute("data-target");

            // Update Active Navigation Item states
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            // Route & Render Target Viewport
            pages.forEach(page => {
                if (page.id === targetPageId) {
                    page.classList.add("active");
                } else {
                    page.classList.remove("active");
                }
            });

            // Auto Close Hamburger Drawers on touch-input environments
            if (sidebar && sidebar.classList.contains("open")) {
                sidebar.classList.remove("open");
                if (overlay) overlay.classList.remove("open");
            }
        });
    });

    // Mobile Hamburger Bindings Setup
    const menuBtn = document.getElementById("mobileMenuBtn");
    if (menuBtn && sidebar && overlay) {
        menuBtn.addEventListener("click", () => {
            sidebar.classList.toggle("open");
            overlay.classList.toggle("open");
        });
        overlay.addEventListener("click", () => {
            sidebar.classList.remove("open");
            overlay.classList.remove("open");
        });
    }
}

/* 4. SYNCED CONTROLLER THEME MATRIX MANAGER */
function initThemeEngine() {
    const htmlElement = document.documentElement;
    const desktopBtn = document.getElementById("themeToggleDesktop");
    const mobileBtn = document.getElementById("themeToggleMobile");

    // Load persisted configurations
    const savedTheme = localStorage.getItem("bt_admin_theme") || "dark";
    htmlElement.setAttribute("data-theme", savedTheme);
    updateThemeIcons(savedTheme);

    function toggleTheme() {
        const currentTheme = htmlElement.getAttribute("data-theme");
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        htmlElement.setAttribute("data-theme", nextTheme);
        localStorage.setItem("bt_admin_theme", nextTheme);
        updateThemeIcons(nextTheme);
        showToast(`Switched to ${nextTheme.toUpperCase()} layout engine`, "success");
    }

    function updateThemeIcons(theme) {
        const iconClass = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
        if (desktopBtn) desktopBtn.querySelector("i").className = iconClass;
        if (mobileBtn) mobileBtn.querySelector("i").className = iconClass;
    }

    if (desktopBtn) desktopBtn.addEventListener("click", toggleTheme);
    if (mobileBtn) mobileBtn.addEventListener("click", toggleTheme);
}

/* ==========================================================================
   ⚡ BHAKTITUBE PREMIUM JS ENGINE - PART 2 OF 4
   ========================================================================== */

/* 5. LIVE FIREBASE SECURITY AUTH MATRIX CONTROLLER */
onAuthStateChanged(auth, async (user) => {
    const loginTime = localStorage.getItem("loginTime");
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000; // Hard expiration barrier limit

    if (!user || !loginTime || (now - loginTime) > tenMinutes) {
        await auth.signOut();
        localStorage.removeItem("loginTime");
        window.location.href = "Login.html";
        return;
    }

    console.log("🔒 SESSION CONFIRMED FOR IDENTITY ID:", user.uid);
    
    // Core Platform Initialization Routines
    initSidebarNavigation();
    initThemeEngine();
    calculateGlobalAnalyticsCounters();
    
    // Render Datastream buffers onto layout grids
    loadVideos();
    loadAdvertisements();
    loadChannels();
    loadThemesPanel();
});

/* 6. REAL-TIME HARDWARE TIMER EXPIRATION TRACKER BAR */
setInterval(async () => {
    const loginTime = localStorage.getItem("loginTime");
    if (!loginTime) return;

    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    const diff = now - loginTime;

    // Dynamically update UI progression line widget inside dashboard overview
    const progressBar = document.getElementById("sessionTimerBar");
    if (progressBar) {
        const remainingPct = Math.max(0, 100 - (diff / tenMinutes) * 100);
        progressBar.style.width = `${remainingPct}%`;
    }

    if (diff > tenMinutes) {
        await auth.signOut();
        localStorage.removeItem("loginTime");
        showToast("Security Access Session Expired", "error");
        setTimeout(() => { window.location.href = "Login.html"; }, 1000);
    }
}, 1000);

/* 7. REVOLUTIONARY REAL-TIME ANALYTICS REPOSITORY COUNTERS */
async function calculateGlobalAnalyticsCounters() {
    try {
        const videosSnap = await getDocs(collection(db, "videos"));
        const adsSnap = await getDocs(collection(db, "advertisements"));
        const channelsSnap = await getDocs(collection(db, "channels"));
        const analyticsUsers = await watchProgressEngine.listAnalyticsUsers(50);

        let accumulatedViews = 0;
        videosSnap.forEach(v => {
            const rawViews = v.data().views || "0";
            const sanitized = parseInt(rawViews.replace(/[^0-9]/g, '')) || 0;
            accumulatedViews += sanitized;
        });

        // Set Values Into Dynamic UI Counter Targets
        document.getElementById("statTotalVideos").textContent = videosSnap.size.toLocaleString();
        document.getElementById("statTotalAds").textContent = adsSnap.size.toLocaleString();
        document.getElementById("statTotalChannels").textContent = channelsSnap.size.toLocaleString();
        document.getElementById("statTotalViews").textContent = accumulatedViews.toLocaleString() + " Core hits";
        renderAudienceAnalyticsPanel(analyticsUsers);
    } catch (e) {
        console.error("Telemetry Error Matrix:", e);
    }
}

function renderAudienceAnalyticsPanel(users = []) {
    const dashboardPage = document.getElementById("dashboardPage");
    if (!dashboardPage) return;

    let panel = document.getElementById("audienceAnalyticsPanel");
    if (!panel) {
        panel = document.createElement("div");
        panel.id = "audienceAnalyticsPanel";
        panel.className = "premium-panel audience-analytics-panel";
        dashboardPage.appendChild(panel);
    }

    const activeUsers = users.filter(user => Number(user.lastActiveMs || 0) > 0);
    const totalWatchSeconds = users.reduce((sum, user) => sum + Number(user.totalWatchTime || 0), 0);
    const completedVideos = users.reduce((sum, user) => sum + Number(user.completedVideos || 0), 0);
    const topUsers = activeUsers
        .slice()
        .sort((a, b) => Number(b.totalWatchTime || 0) - Number(a.totalWatchTime || 0))
        .slice(0, 5);

    panel.innerHTML = `
        <div class="panel-header">
            <h2><i class="fa-solid fa-chart-line text-brand"></i> Audience Bhakti Analytics</h2>
        </div>
        <div class="audience-summary-grid">
            <div><span>Tracked Users</span><strong>${activeUsers.length.toLocaleString()}</strong></div>
            <div><span>Total Watch Time</span><strong>${formatWatchTime(totalWatchSeconds)}</strong></div>
            <div><span>Completed Videos</span><strong>${completedVideos.toLocaleString()}</strong></div>
        </div>
        <div class="audience-user-list">
            ${
                topUsers.length
                ? topUsers.map(user => `
                    <div class="audience-user-row" onclick="viewUserHistory('${user.uid}', '${escapeAdminHtml(user.displayName || user.email || "BhaktiTube User")}')" style="cursor: pointer;">
                        <span>${escapeAdminHtml(user.displayName || user.email || "BhaktiTube User")}</span>
                        <strong>${formatWatchTime(user.totalWatchTime)}</strong>
                    </div>
                `).join("")
                : `<div class="empty-state-card"><i class="fa-solid fa-chart-simple"></i><p>No user watch analytics recorded yet</p></div>`
            }
        </div>
    `;
}

function escapeAdminHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getProgressPercent(item) {
    const percent = Number(item.completionPercentage || 0);
    if (percent > 0) {
        return Math.min(100, Math.max(0, percent));
    }
    const duration = Number(item.duration || 0);
    const current = Number(item.currentPosition || 0);
    return duration > 0 ? Math.min(100, Math.round((current / duration) * 100)) : 0;
}

function formatTimeSeconds(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

window.viewUserHistory = async function (uid, displayName) {
    const modal = document.getElementById("adminUserHistoryModal");
    const titleEl = document.getElementById("adminUserHistoryTitle");
    const bodyEl = document.getElementById("adminUserHistoryBody");

    if (!modal || !titleEl || !bodyEl) return;

    titleEl.textContent = displayName || "Bhakti Progress";
    bodyEl.innerHTML = `<div class="skeleton-loader-bar">Fetching user analytics...</div>`;
    modal.classList.add("active");
    modal.classList.add("fullscreen");

    try {
        const analytics = await watchProgressEngine.getUserAnalytics(uid);
        const profile = analytics.profile || {};
        const totals = analytics.totals || {};

        // Populate header metadata details (email, join date, total watch time)
        const emailStr = profile.email ? `<span><i class="fa-solid fa-envelope"></i> ${escapeAdminHtml(profile.email)}</span>` : "";
        
        let joinDate = "--";
        if (profile.joinedAtMs) {
            joinDate = new Date(profile.joinedAtMs).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        }
        
        const watchTimeStr = formatWatchTime(totals.lifetimeSeconds || 0);

        const metaContainer = document.getElementById("adminUserHeaderMetadata");
        if (metaContainer) {
            metaContainer.innerHTML = `
                ${emailStr}
                <span><i class="fa-solid fa-calendar-days"></i> Joined: ${joinDate}</span>
                <span><i class="fa-solid fa-clock"></i> Watch Time: ${watchTimeStr}</span>
            `;
        }

        // Render the complete analytics dashboard
        renderDashboard(bodyEl, analytics);
    } catch (error) {
        console.error("Error loading user analytics dashboard:", error);
        bodyEl.innerHTML = `<div class="admin-history-empty text-brand"><i class="fa-solid fa-triangle-exclamation"></i> Error loading analytics dashboard. Please try again.</div>`;
    }
};

// Wire up history modal close listeners
const userHistoryModal = document.getElementById("adminUserHistoryModal");
const closeAdminHistoryBtn = document.getElementById("closeAdminHistoryBtn");
if (closeAdminHistoryBtn && userHistoryModal) {
    closeAdminHistoryBtn.addEventListener("click", () => {
        userHistoryModal.classList.remove("active");
        userHistoryModal.classList.remove("fullscreen");
    });
    userHistoryModal.addEventListener("click", (e) => {
        if (e.target === userHistoryModal) {
            userHistoryModal.classList.remove("active");
            userHistoryModal.classList.remove("fullscreen");
        }
    });
}

/* 8. PRECISE DATA FILTER BAR ENGINES */
document.getElementById("globalSearchInput").addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    const searchableItems = document.querySelectorAll(".premium-data-card, .ad-item, .channel-item");
    
    searchableItems.forEach(item => {
        const textContext = item.textContent.toLowerCase();
        item.style.display = textContext.includes(term) ? "flex" : "none";
    });
});

document.getElementById("videoLocalSearch").addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    const videoCards = document.querySelectorAll("#videosList .premium-data-card");
    
    videoCards.forEach(card => {
        const titleText = card.querySelector(".card-main-title").textContent.toLowerCase();
        card.style.display = titleText.includes(term) ? "flex" : "none";
    });
});


/* ==========================================================================
   ⚡ BHAKTITUBE PREMIUM JS ENGINE - PART 3 OF 4
   ========================================================================== */

/* 9. YOUTUBE API EXTRACTOR AND TIME-AGO FORM CONTROLLER */
document.getElementById("fetchBtn").addEventListener("click", async () => {
    const url = document.getElementById("youtubeUrl").value.trim();
    if (!url) {
        showToast("Please paste a valid YouTube resource address", "error");
        return;
    }

    let videoId = "";
    if (url.includes("youtube.com/watch")) {
        videoId = new URL(url).searchParams.get("v");
    } else if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1].split("?")[0];
    }

    if (!videoId) {
        showToast("Invalid URL pattern matching schema detected", "error");
        return;
    }

    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();

        if (data.error) {
            showToast(data.error.message, "error");
            return;
        }
        if (!data.items || !data.items.length) {
            showToast("No metadata found matching video index signature", "error");
            return;
        }

        const video = data.items[0];
        document.getElementById("videoId").value = videoId;
        document.getElementById("title").value = video.snippet.title;
        document.getElementById("channel").value = video.snippet.channelTitle;
        document.getElementById("views").value = Number(video.statistics.viewCount).toLocaleString() + " views";
        document.getElementById("logo").value = video.snippet.channelTitle.charAt(0);
        document.getElementById("date").value = getTimeAgo(video.snippet.publishedAt);
        
        showToast("Populated values successfully via Google API", "success");
    } catch (err) {
        showToast(err.message, "error");
    }
});

function getTimeAgo(dateString) {
    const published = new Date(dateString);
    const now = new Date();
    const diff = now - published;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
}

/* 10. PREMIUM GRID RENDER ENGINE FOR VIDEOS */
async function loadVideos() {
    const videosList = document.getElementById("videosList");
    if (!videosList) return;
    videosList.innerHTML = `<div class="skeleton-loader-bar">Connecting Cloud Buffer Layer...</div>`;

    try {
        const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        videosList.innerHTML = "";

        if (snapshot.empty) {
            videosList.innerHTML = `<div class="empty-state-card"><i class="fa-solid fa-folder-open"></i><p>No active videos mapped onto repository</p></div>`;
            return;
        }

        snapshot.forEach((videoDoc) => {
            const video = videoDoc.data();
            const thumbnail = `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;

            videosList.innerHTML += `
            <div class="premium-data-card animate-card">
                <div class="card-media-wrapper">
                    <img src="${thumbnail}" alt="Video Thumbnail Frame" loading="lazy">
                    <span class="card-badge-top"><i class="fa-brands fa-youtube"></i> HD</span>
                </div>
                <div class="card-content-body">
                    <div class="card-meta-attribution">
                        <span class="chan-avatar-letter">${video.logo || 'B'}</span>
                        <span class="chan-name-txt">${video.channel}</span>
                    </div>
                    <h3 class="card-main-title" title="${video.title}">${video.title}</h3>
                    <div class="card-analytics-row">
                        <span><i class="fa-solid fa-eye"></i> ${video.views}</span>
                        <span><i class="fa-solid fa-calendar-day"></i> ${video.date}</span>
                    </div>
                </div>
                <div class="card-actions-footer">
                    <button class="btn-card-edit" onclick="showToast('Edit utility locked inside current user tier','error')"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="btn-card-delete" onclick="deleteVideo('${videoDoc.id}')"><i class="fa-solid fa-trash-can"></i> Delete</button>
                </div>
            </div>`;
        });
    } catch (e) {
        showToast("Error processing grid loop context", "error");
    }
}

window.deleteVideo = async function (id) {
    if (!confirm("Are you absolute sure you want to permanently delete this video database reference?")) return;
    try {
        await deleteDoc(doc(db, "videos", id));
        showToast("Video entry purged from cluster index", "success");
        loadVideos();
        calculateGlobalAnalyticsCounters();
    } catch (err) {
        showToast(err.message, "error");
    }
};

/* 11. MONETIZATION REPOSITORY PLATFORM FOR ADVERTISEMENTS */
document.getElementById("adForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("adTitle").value.trim();
    const videoUrl = document.getElementById("adVideoUrl").value.trim();
    const redirectLink = document.getElementById("adRedirectLink").value.trim();
    const skipAfter = Number(document.getElementById("adSkipAfter").value);

    try {
        await addDoc(collection(db, "advertisements"), {
            title, videoUrl, redirectLink, skipAfter,
            active: true, views: 0, clicks: 0,
            createdAt: serverTimestamp()
        });
        showToast("New advertisement container compiled live", "success");
        document.getElementById("adForm").reset();
        loadAdvertisements();
        calculateGlobalAnalyticsCounters();
    } catch (err) {
        showToast(err.message, "error");
    }
});

async function loadAdvertisements() {
    const adsList = document.getElementById("adsList");
    if (!adsList) return;
    adsList.innerHTML = "";

    try {
        const q = query(collection(db, "advertisements"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        snapshot.forEach((ad) => {
            const data = ad.data();
            adsList.innerHTML += `
            <div class="ad-item premium-panel" style="border-left: 4px solid var(--accent-orange); margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="font-size:1.1rem; font-weight:700;"><i class="fa-solid fa-rectangle-ad text-brand"></i> ${data.title}</h3>
                        <p class="text-muted" style="font-size:0.82rem; margin-top:6px; word-break:break-all;"><i class="fa-solid fa-link"></i> Target: ${data.redirectLink}</p>
                        <div style="display:flex; gap:15px; margin-top:10px; font-size:0.85rem; font-weight:600;">
                            <span><i class="fa-solid fa-play"></i> Views: ${data.views || 0}</span>
                            <span><i class="fa-solid fa-arrow-pointer"></i> Clicks: ${data.clicks || 0}</span>
                            <span><i class="fa-solid fa-hourglass-start"></i> Skip Delay: ${data.skipAfter}s</span>
                        </div>
                    </div>
                    <button class="btn-card-delete" style="padding:10px 14px;" onclick="deleteAd('${ad.id}')"><i class="fa-solid fa-trash"></i> Purge Campaign</button>
                </div>
            </div>`;
        });
    } catch (e) { console.error(e); }
}

window.deleteAd = async function (id) {
    if (!confirm("Remove this configuration campaign layer?")) return;
    await deleteDoc(doc(db, "advertisements", id));
    showToast("Ad config deleted", "success");
    loadAdvertisements();
    calculateGlobalAnalyticsCounters();
};


/* ==========================================================================
   ⚡ BHAKTITUBE PREMIUM JS ENGINE - PART 4 OF 4
   ========================================================================== */

/* 12. ADVANCED INTERACTIVE AUTOMATED CHANNEL REGISTRATION SYNC ENGINE */
document.getElementById("fetchChannelBtn").addEventListener("click", async () => {
    const url = document.getElementById("channelUrl").value.trim();
    const preview = document.getElementById("channelPreview");
    if (!url) {
        showToast("Paste a clean YouTube Handle Link structure", "error");
        return;
    }

    const match = url.match(/@([^/?]+)/);
    if (!match) {
        showToast("Malformed URL handle signature configuration pattern", "error");
        return;
    }
    const handle = match[1];

    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${handle}&maxResults=1&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();

        if (!data.items || !data.items.length) {
            showToast("No channel index bound to parameters", "error");
            return;
        }

        const channelId = data.items[0].snippet.channelId;
        const channelResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`);
        const channelData = await channelResponse.json();
        const channel = channelData.items[0];

        const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;
        const channelName = channel.snippet.title;
        const subscribers = Number(channel.statistics.subscriberCount).toLocaleString();
        const totalVideos = Number(channel.statistics.videoCount).toLocaleString();
        const logo = channel.snippet.thumbnails.high.url;

        fetchedChannel = { channelId, uploadsPlaylistId, channelName, channelLogo: logo, subscribers, totalVideos, channelUrl: url };

        // Transition UI elements out inside preview card overlay framework
        preview.style.display = "block";
        document.getElementById("previewLogo").src = logo;
        document.getElementById("previewName").textContent = channelName;
        document.getElementById("previewSubscribers").innerHTML = `<i class="fa-solid fa-users"></i> Followers: ${subscribers}`;
        document.getElementById("previewVideos").innerHTML = `<i class="fa-solid fa-video"></i> Indexed Blocks: ${totalVideos}`;

        showToast("Channel profile signature extracted", "success");
    } catch (err) {
        showToast(err.message, "error");
    }
});

// Save Auto Synced Item To Firestore Database Tier Matrix
document.getElementById("channelForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fetchedChannel) return;

    try {
        const snapshot = await getDocs(collection(db, "channels"));
        const exists = snapshot.docs.some(doc => doc.data().channelId === fetchedChannel.channelId);

        if (exists) {
            showToast("Channel matrix already validated on system parameters", "error");
            return;
        }

        await addDoc(collection(db, "channels"), { ...fetchedChannel, enabled: true, createdAt: serverTimestamp() });
        showToast("Channel assigned successfully onto core instance", "success");
        document.getElementById("channelForm").reset();
        document.getElementById("channelPreview").style.display = "none";
        fetchedChannel = null;
        loadChannels();
        calculateGlobalAnalyticsCounters();
    } catch (err) { showToast(err.message, "error"); }
});

/* 13. REGISTRATION ROUTINE MANUAL ADD COMPONENT PROTOTYPE */
document.getElementById("manualAddChannelBtn").addEventListener("click", async () => {
    const channelId = document.getElementById("manualChannelId").value.trim();
    const uploadsPlaylistId = document.getElementById("manualUploadsPlaylistId").value.trim();
    const channelName = document.getElementById("manualChannelName").value.trim();
    const channelLogo = document.getElementById("manualChannelLogo").value.trim() || "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e";
    const subscribers = document.getElementById("manualSubscribers").value.trim() || "0";
    const totalVideos = document.getElementById("manualTotalVideos").value.trim() || "0";
    const channelUrl = document.getElementById("channelUrl").value.trim() || "#";

    if (!channelId || !uploadsPlaylistId || !channelName) {
        showToast("Fill missing parameter structures inside explicit grid", "error");
        return;
    }

    try {
        await addDoc(collection(db, "channels"), { channelId, uploadsPlaylistId, channelName, channelLogo, subscribers, totalVideos, channelUrl, active: true, enabled: true, createdAt: serverTimestamp() });
        showToast("Manual allocation entry built successfully", "success");
        loadChannels();
        calculateGlobalAnalyticsCounters();
    } catch (e) { showToast(e.message, "error"); }
});

/* 14. CHANNELS LOADER GRID FACTORY WRAPPER */
async function loadChannels() {
    const channelsList = document.getElementById("channelsList");
    if (!channelsList) return;
    channelsList.innerHTML = "";

    try {
        const q = query(collection(db, "channels"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        snapshot.forEach((channel) => {
            const data = channel.data();
            channelsList.innerHTML += `
            <div class="channel-item premium-panel" style="text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px;">
                <img src="${data.channelLogo}" style="width:70px; height:70px; border-radius:50%; object-fit:cover; border:2px solid var(--brand-primary);">
                <h3 style="font-size:1rem; font-weight:700; margin:4px 0;">${data.channelName}</h3>
                <p class="text-muted" style="font-size:0.8rem; margin: -5px 0 5px 0;"><i class="fa-solid fa-users"></i> ${data.subscribers} Subs | <i class="fa-solid fa-video"></i> ${data.totalVideos} clips</p>
                <div style="display:grid; grid-template-columns:1fr; gap:8px; width:100%; margin-top:auto;">
                    <a href="${data.channelUrl}" target="_blank" class="action-btn-p" style="font-size:0.8rem; text-decoration:none;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Visit</a>
                    <button class="${data.enabled ? 'btn-success' : 'btn-dark-premium'}" style="padding:6px; border-radius:6px; font-size:0.8rem; font-weight:600; cursor:pointer;" onclick="toggleChannelState('${channel.id}', ${data.enabled})">
                        <i class="fa-solid ${data.enabled ? 'fa-eye' : 'fa-eye-slash'}"></i> ${data.enabled ? 'Active / Visible' : 'Disabled / Hidden'}
                    </button>
                    <button class="btn-card-delete" style="padding:6px; border-radius:6px; font-size:0.8rem;" onclick="deleteChannel('${channel.id}')"><i class="fa-solid fa-trash"></i> Delete Reference</button>
                </div>
            </div>`;
        });
    } catch (err) { console.error(err); }
}

window.toggleChannelState = async function(id, currentState) {
    try {
        await updateDoc(doc(db, "channels", id), { enabled: !currentState });
        showToast("Visibility validation toggled inside database state clusters", "success");
        loadChannels();
    } catch (e) { showToast(e.message, "error"); }
};

window.deleteChannel = async function (id) {
    if (!confirm("Are you sure you want to delete this channel instance?")) return;
    await deleteDoc(doc(db, "channels", id));
    showToast("Channel reference dropped", "success");
    loadChannels();
    calculateGlobalAnalyticsCounters();
};

/* 15. COMPOSTED MOUNT ENGINE VIDEO FORM HANDLING */
document.getElementById("videoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const videoId = document.getElementById("videoId").value.trim();
    const title = document.getElementById("title").value.trim();
    const channel = document.getElementById("channel").value.trim();
    const logo = document.getElementById("logo").value.trim();
    const views = document.getElementById("views").value.trim();
    const date = document.getElementById("date").value.trim();

    try {
        await addDoc(collection(db, "videos"), { videoId, title, channel, logo, views, date, createdAt: serverTimestamp() });
        showToast("New video entity successfully pushed to Firebase FireStore", "success");
        document.getElementById("videoForm").reset();
        loadVideos();
        calculateGlobalAnalyticsCounters();
    } catch (err) { showToast(err.message, "error"); }
});

/* ==========================================================================
   ⚡ GLOBAL CHANNEL CARD THEME MANAGER JS CONTROLLER
   ========================================================================== */

const THEMES = [
    { id: "dark-glass", name: "Dark Glass", desc: "Translucent backdrop with frosted borders" },
    { id: "youtube-premium", name: "YouTube Premium", desc: "Deep cinematic black and red accents" },
    { id: "netflix-style", name: "Netflix Style", desc: "Bold crimson buttons on dark charcoal" },
    { id: "spotify-green", name: "Spotify Green", desc: "Neon green details on solid obsidian background" },
    { id: "royal-purple", name: "Royal Purple", desc: "Deep violet gradient with rich gold hints" },
    { id: "ocean-blue", name: "Ocean Blue", desc: "Marine gradient with sparkling cyan highlights" },
    { id: "sky-gradient", name: "Sky Gradient", desc: "Vibrant sky blue to pink gradient" },
    { id: "cyber-neon", name: "Cyber Neon", desc: "Retro synthwave cyberpunk dash styled neon glow" },
    { id: "emerald", name: "Emerald", desc: "Rich deep forest green with emerald accents" },
    { id: "minimal-white", name: "Minimal White", desc: "Clean slate borderless white card with dark text" },
    { id: "luxury-gold", name: "Luxury Gold", desc: "Deep black background styled with gold borders" },
    { id: "midnight-black", name: "Midnight Black", desc: "Absolute solid black card with dark accents" },
    { id: "material-blue", name: "Material Blue", desc: "Material design layout with clean blue buttons" },
    { id: "sunset-orange", name: "Sunset Orange", desc: "Warm orange to rose pink gradient" },
    { id: "rose-pink", name: "Rose Pink", desc: "Stunning rose pink gradient with white buttons" },
    { id: "forest-green", name: "Forest Green", desc: "Deep rich pine green styled with gold text" },
    { id: "steel-gray", name: "Steel Gray", desc: "Industrial textured gray card with metallic borders" },
    { id: "apple-style", name: "Apple Style", desc: "Frosted translucent glass layout with rounded elements" },
    { id: "carbon", name: "Carbon", desc: "Dark carbon textured background and yellow details" },
    { id: "purple-neon", name: "Purple Neon", desc: "Amethyst midnight card with neon purple glow" },
    { id: "blue-neon", name: "Blue Neon", desc: "Electric deep-sea blue card with cyan neon glow" },
    { id: "orange-gradient", name: "Orange Gradient", desc: "Clean bright coral gradient with white text" },
    { id: "royal-navy", name: "Royal Navy", desc: "Sleek navy blue card decorated with gold borders" },
    { id: "crimson", name: "Crimson", desc: "Intense crimson velvet background with silver highlights" },
    { id: "pastel", name: "Pastel", desc: "Soft pastel pink to light blue gradient layout" },
    { id: "soft-light", name: "Soft Light", desc: "Warm creamy background with charcoal details" },
    { id: "modern-dark", name: "Modern Dark", desc: "Slate charcoal background with indigo button highlights" },
    { id: "glass-morphism", name: "Glass Morphism", desc: "Frosted glass card with maximum backdrop filter blur" },
    { id: "matte-black", name: "Matte Black", desc: "Smooth matte black card layout with muted details" },
    { id: "electric-blue", name: "Electric Blue", desc: "Deep cobalt background with high energy blue glow" },
    { id: "aurora", name: "Aurora", desc: "Teal to indigo gradient styled after northern lights" },
    { id: "galaxy", name: "Galaxy", desc: "Amethyst violet to space black gradient with glows" },
    { id: "elegant-white", name: "Elegant White", desc: "Pure white surface with soft gold border details" },
    { id: "silver", name: "Silver", desc: "Metallic platinum silver gradient and dark buttons" },
    { id: "golden-premium", name: "Golden Premium", desc: "Premium amber gradient and solid dark details" },
    { id: "midnight-purple", name: "Midnight Purple", desc: "Dark grape background with bright fuchsia accents" },
    { id: "cherry", name: "Cherry", desc: "Rich cherry red gradient with clean white borders" },
    { id: "ice-blue", name: "Ice Blue", desc: "Frosty polar blue gradient card and deep blue details" },
    { id: "mint", name: "Mint", desc: "Teal and mint green gradient card with fresh aesthetics" },
    { id: "coffee", name: "Coffee", desc: "Espresso brown gradient with warm cream details" },
    { id: "sand", name: "Sand", desc: "Desert beige gradient styled with warm brown buttons" },
    { id: "luxury-black", name: "Luxury Black", desc: "Ultimate deep black card with premium gold details" },
    { id: "gradient-red", name: "Gradient Red", desc: "Fiery red to dark crimson gradient layout" },
    { id: "dark-emerald", name: "Dark Emerald", desc: "Teal-green forest card with neon emerald details" },
    { id: "violet", name: "Violet", desc: "Deep amethyst to pink gradient card with white buttons" },
    { id: "royal-gold", name: "Royal Gold", desc: "Shiny double gold border on absolute black core" },
    { id: "deep-blue", name: "Deep Blue", desc: "Ocean deep blue gradient with cobalt button" },
    { id: "soft-purple", name: "Soft Purple", desc: "Lavender pastel gradient with grape button text" },
    { id: "modern-gray", name: "Modern Gray", desc: "Clean slate gray background with clean outline borders" },
    { id: "premium-dark", name: "Premium Dark", desc: "Ultimate dark slate background with amber glowing borders" },
    
    // Luxury Materials & Metals
    { id: "diamond-white", name: "Diamond White", desc: "Pristine white diamond facets with brilliant silver accents" },
    { id: "ruby-crystal", name: "Ruby Crystal", desc: "Deep crimson crystal background with ruby reflections" },
    { id: "sapphire-elite", name: "Sapphire Elite", desc: "Deep cobalt sapphire matrix with luminous blue borders" },
    { id: "midnight-chrome", name: "Midnight Chrome", desc: "Polished dark chrome mirror reflection" },
    { id: "titanium-metal", name: "Titanium Metal", desc: "Brushed industrial titanium slate with tungsten accents" },
    { id: "liquid-glass", name: "Liquid Glass", desc: "Fluid refractive glass with dynamic specular lighting" },
    { id: "liquid-metal", name: "Liquid Metal", desc: "Smooth molten mercury silver with metallic sheen" },
    { id: "black-marble", name: "Black Marble", desc: "Dark Nero Marquina marble texture with gold vein accents" },
    { id: "white-marble", name: "White Marble", desc: "Carrara white marble with gray veining and charcoal buttons" },
    { id: "onyx-dark", name: "Onyx Dark", desc: "Translucent deep onyx stone with amber backlighting" },
    { id: "obsidian-gloss", name: "Obsidian Gloss", desc: "Mirror-finish volcanic obsidian glass" },
    { id: "rose-gold", name: "Rose Gold", desc: "Elegant brushed rose gold metallic alloy" },
    { id: "champagne-gold", name: "Champagne Gold", desc: "Subtle luxury champagne gold and warm ivory details" },
    { id: "bronze-heritage", name: "Bronze Heritage", desc: "Aged antique bronze metal with copper highlights" },
    { id: "copper-metallic", name: "Copper Metallic", desc: "Polished reddish copper sheen and dark slate core" },
    { id: "platinum-card", name: "Platinum Card", desc: "Executive platinum metal finish with metallic borders" },
    { id: "frozen-crystal", name: "Frozen Crystal", desc: "Glacial ice crystals with frost highlights" },
    { id: "luxury-leather", name: "Luxury Leather", desc: "Handcrafted dark espresso leather stitching theme" },
    { id: "velvet-night", name: "Velvet Night", desc: "Deep royal navy velvet texture with soft sheen" },
    { id: "silk-emerald", name: "Silk Emerald", desc: "Luminous green silk fabric weave gradient" },
    { id: "pearl-luster", name: "Pearl Luster", desc: "Iridescent mother-of-pearl shifting pastel sheen" },
    { id: "terrazzo", name: "Terrazzo", desc: "Modern terrazzo stone fleck composite layout" },
    { id: "volcanic-basalt", name: "Volcanic Basalt", desc: "Rough porous volcanic rock charcoal texture" },
    { id: "gold-leaf", name: "Gold Leaf", desc: "Hand-applied gold leaf foil over matte black" },
    { id: "amber-resin", name: "Amber Resin", desc: "Fossilized golden amber resin translucency" },
    { id: "raw-concrete", name: "Raw Concrete", desc: "Brutalist architectural concrete with industrial typography" },
    { id: "carbon-matrix", name: "Carbon Matrix", desc: "Woven 3D carbon fiber weave with red trim" },
    { id: "damascus-steel", name: "Damascus Steel", desc: "Folded Damascus steel wave metal patterns" },
    { id: "jade-imperial", name: "Jade Imperial", desc: "Imperial Chinese green jade stone glow" },
    { id: "tungsten-heavy", name: "Tungsten Heavy", desc: "Heavy dark tungsten metal with neon blue edges" },

    // Tech, Cyberpunk & Futuristic OS
    { id: "neon-city", name: "Neon City", desc: "Tokyo synthwave neon city pink and violet glow" },
    { id: "tesla-inspired", name: "Tesla Inspired", desc: "Ultra-minimal stark futuristic electric vehicle console UI" },
    { id: "spacex-dark", name: "SpaceX Dark", desc: "Starship telemetry dashboard deep space black and white" },
    { id: "vision-os", name: "Vision OS", desc: "Spatial computing frosted glass blur and ambient lighting" },
    { id: "future-os", name: "Future OS", desc: "Next-gen holographic OS operating system interface" },
    { id: "ai-interface", name: "AI Interface", desc: "Luminous neural network node connections and cyan glow" },
    { id: "quantum-core", name: "Quantum Core", desc: "Quantum computer qubit processor violet energy glow" },
    { id: "high-tech-console", name: "High-Tech Console", desc: "Tactical military radar and heads-up display green" },
    { id: "cyber-glass", name: "Cyber Glass", desc: "Translucent HUD cybernetic glass with grid overlays" },
    { id: "synthwave-80s", name: "Synthwave 80s", desc: "Retro 1980s sunset magenta and orange grid" },
    { id: "holographic-prism", name: "Holographic Prism", desc: "Shifting chromatic holographic rainbow reflection" },
    { id: "gradient-mesh", name: "Gradient Mesh", desc: "Fluid multi-color gradient mesh blend" },
    { id: "infinity-loop", name: "Infinity Loop", desc: "Endless deep space void with ambient edge glow" },
    { id: "terminal-green", name: "Terminal Green", desc: "Retro computer terminal phosphor green glow" },
    { id: "glitch-cyber", name: "Glitch Cyber", desc: "Digital glitch art aesthetics with magenta neon" },
    { id: "biomimetic", name: "Biomimetic", desc: "Organic bioluminescent bio-interface green-blue glow" },
    { id: "solar-flare", name: "Solar Flare", desc: "Solar radiation orange and intense plasma yellow" },
    { id: "deep-matrix", name: "Deep Matrix", desc: "Digital rain matrix dark green code stream" },
    { id: "orbital-station", name: "Orbital Station", desc: "Space station viewport looking over Earth blue" },
    { id: "hyperdrive", name: "Hyperdrive", desc: "Warp speed starfield streak speed lighting" },
    { id: "stealth-bomber", name: "Stealth Bomber", desc: "Radar-evading stealth aircraft angular matte black" },
    { id: "laser-grid", name: "Laser Grid", desc: "High intensity red laser grid lines on dark chrome" },
    { id: "nano-tech", name: "Nano Tech", desc: "Microscopic molecular carbon nanotube lattice" },
    { id: "plasma-arc", name: "Plasma Arc", desc: "Electric high-voltage plasma arc violet energy" },
    { id: "circuit-board", name: "Circuit Board", desc: "Dark green printed circuit board gold trace pathways" },
    { id: "crypto-vault", name: "Crypto Vault", desc: "Blockchain decentralized cold storage vault steel" },
    { id: "deep-core", name: "Deep Core", desc: "Nuclear reactor core deep blue Cherenkov radiation" },
    { id: "starfleet", name: "Starfleet", desc: "Sci-fi bridge LCARS interface dark orange and tan" },
    { id: "hyper-light", name: "Hyper Light", desc: "Ultra high speed optic fiber light transmission" },
    { id: "mecha-armor", name: "Mecha Armor", desc: "Industrial robot anime mecha armor white and yellow" },
    { id: "vector-wireframe", name: "Vector Wireframe", desc: "Retro 3D vector graphics wireframe outline" },
    { id: "monochrome-matrix", name: "Monochrome Matrix", desc: "Binary digital zero-and-one stark monochrome" },
    { id: "cyber-samurai", name: "Cyber Samurai", desc: "Traditional Japanese lacquer meets cyberpunk neon red" },
    { id: "bio-hazard", name: "Bio Hazard", desc: "High-containment toxic neon yellow warning style" },
    { id: "fusion-reactor", name: "Fusion Reactor", desc: "Tokamak magnetic fusion plasma doughnut glow" },
    { id: "signal-tracer", name: "Signal Tracer", desc: "Oscilloscope wave audio frequency waveform green" },
    { id: "event-horizon", name: "Event Horizon", desc: "Black hole event horizon gravitational lensing ring" },
    { id: "cyber-noir", name: "Cyber Noir", desc: "Rain-slicked dystopian detective noir street reflection" },
    { id: "zero-gravity", name: "Zero Gravity", desc: "Weightless floating translucent orbital UI" },
    { id: "dark-matter", name: "Dark Matter", desc: "Invisible exotic physics particle interaction purple" },

    // Executive, VIP & Banking
    { id: "modern-banking", name: "Modern Banking", desc: "Clean high-end swiss private banking blue and silver" },
    { id: "private-jet", name: "Private Jet", desc: "Walnut wood and cream leather luxury jet interior" },
    { id: "luxury-yacht", name: "Luxury Yacht", desc: "Teak wood deck and navy blue maritime elegance" },
    { id: "luxury-hotel", name: "Luxury Hotel", desc: "7-star Dubai hotel lobby bronze and warm amber" },
    { id: "apple-minimal", name: "Apple Minimal", desc: "Pure iOS stark white card with refined micro shadows" },
    { id: "google-material", name: "Google Material", desc: "Material You adaptive elevation and tonal surface" },
    { id: "executive-black", name: "Executive Black", desc: "C-suite executive matte black with gold pin-striping" },
    { id: "ceo-edition", name: "CEO Edition", desc: "High executive burgundy leather and gold crest" },
    { id: "diamond-club", name: "Diamond Club", desc: "Exclusive invite-only black diamond membership card" },
    { id: "vip-lounge", name: "VIP Lounge", desc: "Velvet rope private lounge dim ambient lighting" },
    { id: "first-class", name: "First Class", desc: "Transatlantic airline first-class cabin champagne gold" },
    { id: "private-member", name: "Private Member", desc: "Secret club dark emerald and brass fittings" },
    { id: "wall-street", name: "Wall Street", desc: "Financial stock exchange ticker blue and gold numbers" },
    { id: "swiss-chronometer", name: "Swiss Chronometer", desc: "Luxury chronograph watch dial guilloché pattern" },
    { id: "monaco-casino", name: "Monaco Casino", desc: "High-roller casino velvet felt green and gold chips" },
    { id: "supercar-cockpit", name: "Supercar Cockpit", desc: "Alcantara suede and Italian red stitching supercar" },
    { id: "penthouse-suite", name: "Penthouse Suite", desc: "High-rise city skyline reflection at dusk" },
    { id: "savile-row", name: "Savile Row", desc: "Tailored pinstripe suit charcoal fabric texture" },
    { id: "royalty-crown", name: "Royalty Crown", desc: "Imperial crown jewel deep purple and ermine white" },
    { id: "diplomatic-suite", name: "Diplomatic Suite", desc: "International embassy gold seal and deep navy" },
    { id: "vintage-cognac", name: "Vintage Cognac", desc: "Oak barrel aged cognac warm amber crystal glass" },
    { id: "haute-couture", name: "Haute Couture", desc: "French fashion house monochrome minimalist elegance" },
    { id: "chateau-wine", name: "Chateau Wine", desc: "Bordeaux vineyard deep wine red and gold foil" },
    { id: "black-card", name: "Black Card", desc: "Obsidian metal black credit card with metallic foil" },
    { id: "soho-house", name: "Soho House", desc: "Exposed brick and warm filament bulb retro luxury" },
    { id: "yacht-club", name: "Yacht Club", desc: "Crisp nautical white, royal navy, and bright gold" },
    { id: "mayfair-club", name: "Mayfair Club", desc: "British gentlemen's club dark mahogany and leather" },
    { id: "baccarat-crystal", name: "Baccarat Crystal", desc: "Fine cut crystal chandeliers refracting warm light" },
    { id: "gilded-age", name: "Gilded Age", desc: "Ornate Victorian gold leaf embellishments on black" },
    { id: "palace-imperial", name: "Palace Imperial", desc: "Palace gates ornate gold scrollwork on deep blue" },

    // Nature, Cosmos & Earth Elements
    { id: "northern-lights", name: "Northern Lights", desc: "Flickering green and violet polar sky aurora" },
    { id: "tropical-lagoon", name: "Tropical Lagoon", desc: "Turquoise clear ocean water over white coral sand" },
    { id: "autumn-premium", name: "Autumn Premium", desc: "Deep maple red, burnt orange, and gold leaves" },
    { id: "sunset-glow", name: "Sunset Glow", desc: "Warm Mediterranean dusk horizon gradient" },
    { id: "fire-ember", name: "Fire Ember", desc: "Smoldering volcanic embers and hot charcoal glow" },
    { id: "cosmos-dark", name: "Cosmos Dark", desc: "Deep space galaxy starfield with magenta nebula" },
    { id: "nebula-cloud", name: "Nebula Cloud", desc: "Interstellar dust cloud glowing in violet and cyan" },
    { id: "supernova", name: "Supernova", desc: "Stellar explosion blinding white and gold energy burst" },
    { id: "moonlight-shadow", name: "Moonlight Shadow", desc: "Cool silver moonlight casting deep night shadows" },
    { id: "starlight-night", name: "Starlight Night", desc: "Midnight blue sky sparkling with millions of stars" },
    { id: "ocean-depth", name: "Ocean Depth", desc: "Abyssal ocean trench bioluminescent creature blue" },
    { id: "crystal-frost", name: "Crystal Frost", desc: "Delicate ice frost patterns creeping across dark glass" },
    { id: "coral-reef", name: "Coral Reef", desc: "Vibrant living coral pink and warm ocean turquoise" },
    { id: "desert-dune", name: "Desert Dune", desc: "Saharan sand dunes golden hour wind-blown ripples" },
    { id: "glacier-blue", name: "Glacier Blue", desc: "Ancient glacial ice blue pressure compaction" },
    { id: "cherry-blossom", name: "Cherry Blossom", desc: "Japanese sakura pink petals floating on dark water" },
    { id: "rainforest", name: "Rainforest", desc: "Lush Amazonian canopy deep greens and humid mist" },
    { id: "volcanic-ash", name: "Volcanic Ash", desc: "Dark grey volcanic ash cloud with lightning arcs" },
    { id: "midnight-sun", name: "Midnight Sun", desc: "Icelandic summer midnight sun golden glow" },
    { id: "deep-canyon", name: "Deep Canyon", desc: "Red rock Sedona canyon layers at sunset" },
    { id: "thunderstorm", name: "Thunderstorm", desc: "Dark storm clouds illuminated by purple lightning" },
    { id: "bioluminescence", name: "Bioluminescence", desc: "Maldives glowing blue plankton wave beach" },
    { id: "bamboo-forest", name: "Bamboo Forest", desc: "Kyoto bamboo grove filtering emerald green sunlight" },
    { id: "milky-way", name: "Milky Way", desc: "Dense starry core of the galaxy stretching across space" },
    { id: "eclipse-solar", name: "Eclipse Solar", desc: "Total solar eclipse glowing corona diamond ring" },
    { id: "everest-peak", name: "Everest Peak", desc: "Himalayan snow peak bathed in pink alpenglow" },
    { id: "deep-cave", name: "Deep Cave", desc: "Underground cavern glowing with natural amethyst crystals" },
    { id: "wildfire", name: "Wildfire", desc: "Intense forest wildfire orange and crimson smoke" },
    { id: "frostbite", name: "Frostbite", desc: "Sub-zero blizzards and ice needle crystals" },
    { id: "savanna-sunset", name: "Savanna Sunset", desc: "African savanna silhouette against crimson sunset" },
    { id: "oasis-emerald", name: "Oasis Emerald", desc: "Desert oasis lush green palm reflection in water" },
    { id: "meteor-shower", name: "Meteor Shower", desc: "Shooting star meteor streaks raining across night" },
    { id: "sunburst", name: "Sunburst", desc: "Radiating rays of blinding golden afternoon sun" },
    { id: "deep-trench", name: "Deep Trench", desc: "Abyssal Mariana trench pitch black with bioluminescence" },
    { id: "autumn-mist", name: "Autumn Mist", desc: "Foggy morning pine forest with golden amber light" },

    // Architecture, Art & Modern Design
    { id: "minimal-line", name: "Minimal Zen", desc: "Japanese ryokan minimalist cedar wood and rice paper" },
    { id: "nordic-luxury", name: "Nordic Luxury", desc: "Scandinavian hygge warm neutral beige and matte black" },
    { id: "modern-architecture", name: "Modern Architecture", desc: "Cantilevered glass and steel luxury mansion" },
    { id: "museum-style", name: "Museum Style", desc: "Gallery spotlight illuminating artwork on dark slate" },
    { id: "art-deco", name: "Art Deco Modern", desc: "1920s Chrysler building geometric gold and black patterns" },
    { id: "bauhaus-modern", name: "Bauhaus Modern", desc: "Primary geometric shapes and clean functionalism" },
    { id: "memphis-design", name: "Memphis Design", desc: "Playful 80s geometric patterns and pastel accents" },
    { id: "pop-art", name: "Pop Art", desc: "Bold high-contrast comic book pop art pop colors" },
    { id: "mid-century", name: "Mid-Century", desc: "Teak wood, mustard yellow, and olive green mid-century" },
    { id: "industrial-loft", name: "Industrial Loft", desc: "Exposed iron beams, brick, and Edison bulbs" },
    { id: "gothic-dark", name: "Gothic Dark", desc: "Cathedral stained glass filtering dim light through stone" },
    { id: "baroque-gold", name: "Baroque Gold", desc: "Italian baroque heavy gold gilding and red velvet" },
    { id: "cubism", name: "Cubism", desc: "Fragmented geometric planes of bronze and charcoal" },
    { id: "surrealism", name: "Surrealism", desc: "Dreamlike melting gradients and impossible lighting" },
    { id: "brutalism-clean", name: "Brutalism Clean", desc: "Unfinished raw grey concrete with bold typography" },
    { id: "boho-chic", name: "Boho Chic", desc: "Earthy terracotta, pampas grass, and warm rattan" },
    { id: "wabi-sabi", name: "Wabi Sabi", desc: "Imperfect weathered ceramic texture with gold kintsugi repairs" },
    { id: "japandi", name: "Japandi", desc: "Fusion of Japanese minimalism and Scandinavian warmth" },
    { id: "neo-classic", name: "Neo-Classic", desc: "Roman marble columns and classical symmetry" },
    { id: "high-contrast-mono", name: "High-Contrast Mono", desc: "Pure stark black and white zero-grayscale contrast" },
    { id: "constructivism", name: "Constructivism", desc: "Avant-garde red, black, and white diagonal geometry" },
    { id: "impressionist", name: "Impressionist", desc: "Soft dappled oil paint stroke textures" },
    { id: "stained-glass", name: "Stained Glass", desc: "Illuminated church window ruby and sapphire glass" },
    { id: "california-modern", name: "California Modern", desc: "Indoor-outdoor living pool water blue and palm green" },
    { id: "vaporwave", name: "Vaporwave", desc: "Aesthetic 90s digital pastel pink, teal, and Roman busts" },
    { id: "kinetic-art", name: "Kinetic Art", desc: "Optical illusion moiré patterns and dynamic motion" },
    { id: "minimal-line-art", name: "Minimal Line Art", desc: "Ultra-fine 1px gold line art on midnight black" },
    { id: "deconstructivism", name: "Deconstructivism", desc: "Fragmented titanium plates and sharp angles" },
    { id: "origami-paper", name: "Origami Paper", desc: "Folded Japanese white paper shadows and clean lines" },
    { id: "graffiti-urban", name: "Graffiti Urban", desc: "Street art spray paint splatters on brick texture" },

    // Fantasy, Sci-Fi & Mythological
    { id: "dragon-fire", name: "Dragon Fire", desc: "Mythological dragon scales glowing with internal magma" },
    { id: "phoenix-rising", name: "Phoenix Rising", desc: "Reborn from ashes glowing golden-red feathers" },
    { id: "valhalla-gold", name: "Valhalla Gold", desc: "Norse mythology hall of the slain golden shields" },
    { id: "atlantis-sunken", name: "Atlantis Sunken", desc: "Ancient sunken city bioluminescent turquoise ruins" },
    { id: "elven-light", name: "Elven Light", desc: "Enchanted forest silver leaves and starlight glow" },
    { id: "alchemy-transmute", name: "Alchemy Transmute", desc: "Occult symbols and glowing mercury lead-to-gold" },
    { id: "cyber-ghost", name: "Cyber Ghost", desc: "Transparent digital ghost code in the shell cyan" },
    { id: "stargate", name: "Stargate", desc: "Ring of chevrons glowing blue wormhole vortex" },
    { id: "time-traveler", name: "Time Traveler", desc: "Steampunk gears, clockwork, and vacuum tubes" },
    { id: "dark-elf", name: "Dark Elf", desc: "Obsidian cavern underdark glowing with purple fungi" },
    { id: "celestial-angel", name: "Celestial Angel", desc: "Divine golden halos and blinding white feathers" },
    { id: "demon-realm", name: "Demon Realm", desc: "Obsidian underworld jagged rocks and red lava veins" },
    { id: "cyber-ninja", name: "Cyber Ninja", desc: "Stealth black armor with glowing red katana blade edge" },
    { id: "excalibur", name: "Excalibur", desc: "King Arthur's sword glowing in stone with royal blue" },
    { id: "valkyrie", name: "Valkyrie", desc: "Nordic winged helmet polished silver and icy sky blue" },
    { id: "space-marine", name: "Space Marine", desc: "Heavy power armor dark olive green and yellow" },
    { id: "alien-hive", name: "Alien Hive", desc: "Organic xenomorph bioluminescent green acid glow" },
    { id: "void-walker", name: "Void Walker", desc: "Teleporting through purple dimensional rift energy" },
    { id: "titan-colossus", name: "Titan Colossus", desc: "Ancient stone giant glowing with blue magic runes" },
    { id: "astral-projection", name: "Astral Projection", desc: "Ethereal spirit floating in silver starlight" },
    { id: "necro-lance", name: "Necro Lance", desc: "Dark sorcery glowing green skull energy" },
    { id: "samurai-ronin", name: "Samurai Ronin", desc: "Weathered bamboo hat and blood-stained steel blade" },
    { id: "cyber-punk-2099", name: "Cyberpunk 2099", desc: "Ultra futuristic flying car neon skyline rain" },
    { id: "galaxy-defender", name: "Galaxy Defender", desc: "Sci-fi retro space patrol badge red blue white" },
    { id: "magic-academy", name: "Magic Academy", desc: "Ancient library leather books and glowing spell runes" },
    { id: "solar-knight", name: "Solar Knight", desc: "Golden armor gleaming with captive sun energy" },
    { id: "shadow-assassin", name: "Shadow Assassin", desc: "Smoke and shadow tendrils wrapping black daggers" },
    { id: "mecha-god", name: "Mecha God", desc: "Giant mech divine golden armor and plasma wings" },
    { id: "star-sailor", name: "Star Sailor", desc: "Solar sail catching solar wind silver reflections" },
    { id: "cyber-oracle", name: "Cyber Oracle", desc: "AI priestess in liquid chrome pool with glowing cables" },
    { id: "vampire-gothic", name: "Vampire Gothic", desc: "Transylvanian castle velvet cape and ruby blood drop" },
    { id: "deep-sea-kraken", name: "Deep-Sea Kraken", desc: "Bioluminescent giant squid tentacles in black ocean" },
    { id: "thunder-thor", name: "Thunder Thor", desc: "Asgardian hammer lightning arcs across dark sky" },
    { id: "cyber-gladiator", name: "Cyber Gladiator", desc: "Neon arena plasma shield and glowing broadsword" },
    { id: "omega-prime", name: "Omega Prime", desc: "The ultimate final theme - deep black hole core with brilliant rainbow singularity corona rings" }
];

let selectedThemeId = "dark-glass";
let activeThemeId = "dark-glass";

async function loadThemesPanel() {
    const grid = document.getElementById("themePreviewGrid");
    if (!grid) return;
    grid.innerHTML = `<div class="skeleton-loader-bar">Loading themes catalog database...</div>`;

    // 1. Fetch current active theme from Firestore
    try {
        const themeDoc = await getDoc(doc(db, "settings", "channelCardTheme"));
        if (themeDoc.exists()) {
            activeThemeId = themeDoc.data().themeId;
            selectedThemeId = activeThemeId;
            localStorage.setItem("bt_channel_card_theme", activeThemeId);
        } else {
            const cached = localStorage.getItem("bt_channel_card_theme") || "dark-glass";
            activeThemeId = cached;
            selectedThemeId = cached;
        }
    } catch (e) {
        console.error("Error fetching active card theme:", e);
        const cached = localStorage.getItem("bt_channel_card_theme") || "dark-glass";
        activeThemeId = cached;
        selectedThemeId = cached;
    }

    // 2. Render all 50 preview items using the shared component template
    const sampleChannel = {
        channelLogo: "https://res.cloudinary.com/dastne5qy/image/upload/q_auto/f_auto/v1780742623/My_Bhaktitude_website_logo_gxf2b1.png",
        channelName: "Bhole Bhandari Leela",
        subscribers: "162,000 Subscribers",
        totalVideos: "848",
        channelId: "#"
    };
    const cardMarkup = getChannelCardMarkup(sampleChannel);

    grid.innerHTML = THEMES.map(theme => {
        const isActive = theme.id === activeThemeId;
        const isSelected = theme.id === selectedThemeId;
        const cardClass = `theme-selector-card${isSelected ? ' active' : ''}`;
        
        let badgeText = "Select Theme";
        let badgeClass = "theme-badge";
        if (isActive) {
            badgeText = "✔ Active Theme";
            badgeClass = "theme-badge saved-active";
        } else if (isSelected) {
            badgeText = "Selected Theme";
            badgeClass = "theme-badge selected-highlight";
        }

        return `
        <div class="${cardClass}" data-theme-id="${theme.id}" id="theme-card-${theme.id}">
            <div class="${badgeClass}"><i class="fa-solid fa-circle-check"></i> <span class="badge-text">${badgeText}</span></div>
            <div class="channel-card-theme-wrapper" data-cc-theme="${theme.id}">
                ${cardMarkup}
            </div>
            <div class="theme-meta-label">
                <h4>${theme.name}</h4>
                <p>${theme.desc}</p>
            </div>
        </div>
        `;
    }).join("");

    // 3. Attach click event listeners to each theme card selector
    THEMES.forEach(theme => {
        const el = document.getElementById(`theme-card-${theme.id}`);
        if (el) {
            el.addEventListener("click", () => {
                // Remove active selection state from all card containers
                document.querySelectorAll(".theme-selector-card").forEach(card => {
                    card.classList.remove("active");
                    const cId = card.getAttribute("data-theme-id");
                    const bBadge = card.querySelector(".theme-badge");
                    if (bBadge) {
                        if (cId === activeThemeId) {
                            bBadge.className = "theme-badge saved-active";
                            bBadge.querySelector(".badge-text").textContent = "✔ Active Theme";
                        } else {
                            bBadge.className = "theme-badge";
                            bBadge.querySelector(".badge-text").textContent = "Select Theme";
                        }
                    }
                });

                // Add active state to clicked card
                el.classList.add("active");
                selectedThemeId = theme.id;

                // Update badge text of clicked card
                const badge = el.querySelector(".theme-badge");
                if (badge) {
                    if (selectedThemeId === activeThemeId) {
                        badge.className = "theme-badge saved-active";
                        badge.querySelector(".badge-text").textContent = "✔ Active Theme";
                    } else {
                        badge.className = "theme-badge selected-highlight";
                        badge.querySelector(".badge-text").textContent = "Selected Theme";
                    }
                }
            });
        }
    });
}

// Wire up Save Theme button
const saveThemeBtn = document.getElementById("saveThemeBtn");
if (saveThemeBtn) {
    saveThemeBtn.addEventListener("click", async () => {
        saveThemeBtn.disabled = true;
        const originalText = saveThemeBtn.innerHTML;
        saveThemeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Committing changes...`;

        try {
            // Save to Firestore settings collection, channelCardTheme document
            await setDoc(doc(db, "settings", "channelCardTheme"), {
                themeId: selectedThemeId,
                updatedAt: serverTimestamp()
            });

            // Update local storage cache
            localStorage.setItem("bt_channel_card_theme", selectedThemeId);
            activeThemeId = selectedThemeId;

            // Apply theme change locally to admin page
            document.body.setAttribute("data-cc-theme", selectedThemeId);

            showToast("Global channel card theme saved successfully!", "success");

            // Re-render panels to update badge states to Active Theme
            await loadThemesPanel();
        } catch (e) {
            console.error("Error saving card theme:", e);
            showToast("Failed to save theme setting. Check Firestore rules.", "error");
        } finally {
            saveThemeBtn.disabled = false;
            saveThemeBtn.innerHTML = originalText;
        }
    });
}

