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

