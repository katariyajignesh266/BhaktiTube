import { auth, db, storage } from "../firebase-config.js";
import {
    signOut,
    updateProfile,
    updatePassword,
    sendEmailVerification,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";
import {
    watchProgressEngine,
    formatWatchTime,
    formatRelativeTime,
    profileService,
    generateAvatarDataUrl,
    getActivePhotoURL
} from "../analytics-engine.js";

// State Management
let currentUser = null;
let userDocData = {};
let isFormDirty = false;
let userAnalytics = null;

// HTML Elements
const profileImg = document.getElementById("profileImage");
const profileAvatarDiv = document.getElementById("profileAvatarDiv");
const userNameText = document.getElementById("userName");
const userEmailText = document.getElementById("userEmail");
const accountTypeText = document.getElementById("accountType");
const joinedDateText = document.getElementById("joinedDate");

// Navigation
const tabButtons = document.querySelectorAll(".nav-tab-btn");
const panels = document.querySelectorAll(".profile-panel");

// Edit Profile Fields
const editForm = document.getElementById("editProfileForm");
const editNameInput = document.getElementById("editNameInput");
const editUsernameInput = document.getElementById("editUsernameInput");
const editBioInput = document.getElementById("editBioInput");
const editGenderSelect = document.getElementById("editGenderSelect");
const editDobInput = document.getElementById("editDobInput");
const editPhoneInput = document.getElementById("editPhoneInput");
const editCountryInput = document.getElementById("editCountryInput");
const editStateInput = document.getElementById("editStateInput");
const editCityInput = document.getElementById("editCityInput");
const editLanguageInput = document.getElementById("editLanguageInput");
const editTimezoneInput = document.getElementById("editTimezoneInput");
const editDeityInput = document.getElementById("editDeityInput");
const editCategoryInput = document.getElementById("editCategoryInput");
const editOccupationInput = document.getElementById("editOccupationInput");
const editWebsiteInput = document.getElementById("editWebsiteInput");
const editInstagramInput = document.getElementById("editInstagramInput");
const editYoutubeInput = document.getElementById("editYoutubeInput");
const editFacebookInput = document.getElementById("editFacebookInput");
const editTwitterInput = document.getElementById("editTwitterInput");

// Character Counters
const nameCharCount = document.getElementById("nameCharCount");
const usernameCharCount = document.getElementById("usernameCharCount");
const bioCharCount = document.getElementById("bioCharCount");
const usernameValidation = document.getElementById("usernameValidation");

// Preferences
const prefDarkMode = document.getElementById("prefDarkMode");
const prefQuality = document.getElementById("prefQuality");
const prefLanguage = document.getElementById("prefLanguage");
const prefAutoPlay = document.getElementById("prefAutoPlay");
const prefRememberPlayback = document.getElementById("prefRememberPlayback");
const prefEmailRecs = document.getElementById("prefEmailRecs");
const prefWeeklyDigest = document.getElementById("prefWeeklyDigest");

// Security Elements
const secProvider = document.getElementById("secProvider");
const secVerified = document.getElementById("secVerified");
const secLastLogin = document.getElementById("secLastLogin");
const secUid = document.getElementById("secUid");
const sendVerificationBtn = document.getElementById("sendVerificationBtn");
const changePasswordCard = document.getElementById("changePasswordCard");
const passwordUpdateForm = document.getElementById("passwordUpdateForm");
const currPasswordInput = document.getElementById("currPasswordInput");
const newPasswordInput = document.getElementById("newPasswordInput");
const confirmPasswordInput = document.getElementById("confirmPasswordInput");

// Avatar Crop Modal Elements
const cropModal = document.getElementById("cropModal");
const cropCanvas = document.getElementById("cropCanvas");
const zoomSlider = document.getElementById("zoomSlider");
const saveCropBtn = document.getElementById("saveCropBtn");
const restoreDefaultBtn = document.getElementById("restoreDefaultBtn");
const cancelCropBtn = document.getElementById("cancelCropBtn");
const avatarUploadInput = document.getElementById("avatarUploadInput");
const changePhotoBtn = document.getElementById("changePhotoBtn");

// Info Modal Elements
const genericModal = document.getElementById("genericModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const closeModalBtn = document.getElementById("closeModalBtn");

// Canvas Crop Drawing Variables
const ctx = cropCanvas.getContext("2d");
let cropImg = new Image();
let imgWidth = 0;
let imgHeight = 0;
let imgX = 150;
let imgY = 150;
let isDragging = false;
let startX = 0;
let startY = 0;

// Initialize skeleton loaders
applySkeletons(true);

// 1. DYNAMIC STATE PROFILE SYNCHRONIZATION
profileService.subscribe(async (profile) => {
    if (profile) {
        currentUser = auth.currentUser;
        userDocData = profile;
        console.log("Real-time profile sync triggered:", profile.uid);
        
        try {
            // Lazy-load analytics statistics only once per data refresh
            if (!userAnalytics || userAnalytics.totals.lifetimeSeconds === 0) {
                userAnalytics = await watchProgressEngine.getUserAnalytics(profile.uid);
            } else {
                // Keep the profile part updated in analytics
                userAnalytics.profile = profile;
            }
            
            // Populate all data fields in the DOM
            populateUI();
            
            // Remove skeleton loading classes
            applySkeletons(false);
            
        } catch (error) {
            console.error("Error loading user profile or analytics:", error);
            applySkeletons(false);
        }
    } else {
        // Only redirect if auth explicitly resolves as logged out
        if (auth.currentUser === null) {
            window.location.replace("login.html");
        }
    }
});

// Skeleton Loader Switch
function applySkeletons(loading) {
    const list = [
        userNameText, userEmailText, joinedDateText, accountTypeText,
        document.getElementById("statWatchTime"),
        document.getElementById("statWatchedVideos"),
        document.getElementById("statCompletedVideos"),
        document.getElementById("statCurrentStreak"),
        document.getElementById("statConsistency"),
        document.getElementById("statFavDeity"),
        document.getElementById("statFavCategory"),
        document.getElementById("statFavChannel"),
        document.getElementById("statLastWatched")
    ];
    list.forEach(el => {
        if (!el) return;
        if (loading) {
            el.classList.add("skeleton", "skeleton-text");
            if (el.tagName === "SPAN" || el.tagName === "P" || el.tagName === "H2") el.textContent = "";
        } else {
            el.classList.remove("skeleton", "skeleton-text");
        }
    });
}

// 2. POPULATE DYNAMIC HTML FIELDS
function populateUI() {
    if (!currentUser) return;
    
    // Header Avatar Priority
    const activePhoto = getActivePhotoURL(userDocData, currentUser);
    updateAvatarUI(activePhoto, userDocData.displayName || currentUser.displayName, currentUser.email, currentUser.uid);
    
    // Header User Profile metadata
    userNameText.textContent = userDocData.displayName || currentUser.displayName || "BhaktiTube User";
    userEmailText.textContent = currentUser.email;
    joinedDateText.textContent = new Date(currentUser.metadata.creationTime).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const provId = currentUser.providerData[0]?.providerId || "";
    accountTypeText.textContent = provId === "google.com" ? "Google Account" : "Email Account";
    
    // Dashboard Stats Grid
    const totals = userAnalytics?.totals || {};
    document.getElementById("statWatchTime").textContent = formatWatchTime(totals.lifetimeSeconds || 0);
    document.getElementById("statWatchedVideos").textContent = totals.videosWatched || 0;
    document.getElementById("statCompletedVideos").textContent = totals.completedVideos || 0;
    document.getElementById("statCurrentStreak").textContent = `${totals.currentStreak || 0} Days`;
    document.getElementById("statConsistency").textContent = `${totals.consistencyScore || 0}%`;
    document.getElementById("statFavDeity").textContent = userDocData.favDeity || "Krishna";
    
    // Journey Preferences
    document.getElementById("statFavCategory").textContent = userDocData.favCategory || totals.favoriteCategory || "Bhajan";
    document.getElementById("statFavChannel").textContent = totals.favoriteChannel || "BhaktiTube";
    
    if (userAnalytics?.history && userAnalytics.history.length > 0) {
        const last = userAnalytics.history[0];
        document.getElementById("statLastWatched").textContent = `${last.videoTitle || "Untitled"} (${formatRelativeTime(last.lastViewedMs)})`;
    } else {
        document.getElementById("statLastWatched").textContent = "No videos watched yet";
    }
    
    // Continue Watching rendering
    renderContinueWatching();
    
    // Recent Activity timeline rendering
    renderRecentActivity();
    
    // Pre-fill Edit Profile Form Inputs (skip if currently active editing)
    if (!isFormDirty) {
        editNameInput.value = userDocData.displayName || currentUser.displayName || "";
        editUsernameInput.value = userDocData.username || "";
        editBioInput.value = userDocData.bio || "";
        editGenderSelect.value = userDocData.gender || "";
        editDobInput.value = userDocData.dob || "";
        editPhoneInput.value = userDocData.phone || "";
        editCountryInput.value = userDocData.country || "";
        editStateInput.value = userDocData.state || "";
        editCityInput.value = userDocData.city || "";
        editLanguageInput.value = userDocData.language || "";
        editTimezoneInput.value = userDocData.timezone || "";
        editDeityInput.value = userDocData.favDeity || "";
        editCategoryInput.value = userDocData.favCategory || "";
        editOccupationInput.value = userDocData.occupation || "";
        editWebsiteInput.value = userDocData.website || "";
        editInstagramInput.value = userDocData.socialLinks?.instagram || "";
        editYoutubeInput.value = userDocData.socialLinks?.youtube || "";
        editFacebookInput.value = userDocData.socialLinks?.facebook || "";
        editTwitterInput.value = userDocData.socialLinks?.twitter || "";
        updateCounters();
    }
    
    // Pre-fill Account Preferences Toggles
    const settings = userDocData.settings || {};
    prefDarkMode.checked = settings.darkMode !== false;
    prefQuality.value = settings.videoQuality || "auto";
    prefLanguage.value = settings.language || "English";
    prefAutoPlay.checked = settings.autoplay !== false;
    prefRememberPlayback.checked = settings.rememberPlayback !== false;
    prefEmailRecs.checked = settings.emailRecs !== false;
    prefWeeklyDigest.checked = !!settings.weeklyDigest;
    
    // Apply preferences dynamically
    applyThemePreference(prefDarkMode.checked);
    
    // Pre-fill Security Details
    secProvider.textContent = provId === "google.com" ? "Google Authentication" : "Email & Password login";
    secUid.textContent = currentUser.uid;
    secLastLogin.textContent = new Date(currentUser.metadata.lastSignInTime).toLocaleString(undefined, {
        dateStyle: "medium", timeStyle: "short"
    });
    
    if (currentUser.emailVerified) {
        secVerified.textContent = "Verified";
        secVerified.className = "sec-value badge success";
        sendVerificationBtn.style.display = "none";
    } else {
        secVerified.textContent = "Unverified";
        secVerified.className = "sec-value badge danger";
        sendVerificationBtn.style.display = "inline-block";
    }
    
    // Show password update only for email-signups
    if (provId === "google.com") {
        changePasswordCard.style.display = "none";
    } else {
        changePasswordCard.style.display = "block";
    }
}

// Render Continue Watching horizontal panel list
function renderContinueWatching() {
    const listEl = document.getElementById("continueWatchingList");
    listEl.innerHTML = "";
    
    const items = userAnalytics?.continueWatching || [];
    if (items.length > 0) {
        items.forEach(item => {
            const pct = Math.min(100, Math.round(item.completionPercentage || 0));
            const card = document.createElement("a");
            card.className = "continue-video-card";
            card.href = `../index.html?play=${item.videoId}`;
            card.innerHTML = `
                <div class="continue-video-thumb">
                    <img src="${item.thumbnailUrl || 'https://img.youtube.com/vi/' + item.videoId + '/mqdefault.jpg'}" alt="Video Thumbnail">
                    <div class="play-btn-overlay"><i class="fa-solid fa-play"></i></div>
                </div>
                <div class="continue-video-details">
                    <div class="continue-video-title">${item.videoTitle || "Untitled Bhakti Video"}</div>
                    <div class="continue-video-channel">${item.channelName || "BhaktiTube"}</div>
                    <div class="continue-progress-wrapper">
                        <div class="continue-progress-bar">
                            <div class="continue-progress-fill" style="width: ${pct}%"></div>
                        </div>
                        <div class="continue-progress-text">
                            <span>${pct}% watched</span>
                            <span>${formatRelativeTime(item.lastViewedMs)}</span>
                        </div>
                    </div>
                </div>
            `;
            listEl.appendChild(card);
        });
    } else {
        listEl.innerHTML = `<p class="empty-state">No videos in progress. Start watching spiritual content to track playback!</p>`;
    }
}

// Render Activity timeline feed
function renderRecentActivity() {
    const timelineEl = document.getElementById("activityTimeline");
    timelineEl.innerHTML = "";
    
    const hist = userAnalytics?.history || [];
    if (hist.length > 0) {
        hist.slice(0, 5).forEach(item => {
            const row = document.createElement("div");
            row.className = `activity-item ${item.completed ? "completed" : "active"}`;
            row.innerHTML = `
                <div class="activity-item-title">
                    ${item.completed ? 'Finished watching' : 'Watched'} 
                    <strong>${item.videoTitle || "Untitled Video"}</strong> on <span>${item.channelName || "BhaktiTube"}</span>
                </div>
                <div class="activity-item-time">${formatRelativeTime(item.lastViewedMs)}</div>
            `;
            timelineEl.appendChild(row);
        });
    } else {
        timelineEl.innerHTML = `<p class="empty-state">No recent activity detected. Watch some videos to populate your feed!</p>`;
    }
}

// Header profile photo handler
function updateAvatarUI(photoURL, displayName, email, uid) {
    if (photoURL) {
        profileImg.src = photoURL;
        profileImg.style.display = "block";
        profileAvatarDiv.style.display = "none";
        
        profileImg.onerror = () => {
            showGradientAvatar(displayName, email, uid);
        };
    } else {
        showGradientAvatar(displayName, email, uid);
    }
}

// Deterministic premium gradient fallback using centralized generator
function showGradientAvatar(displayName, email, uid) {
    profileImg.style.display = "none";
    profileAvatarDiv.style.display = "flex";
    
    const cleanName = (displayName || "").trim();
    let letter = "B";
    if (cleanName) {
        letter = cleanName.charAt(0).toUpperCase();
    } else if (email) {
        letter = email.charAt(0).toUpperCase();
    }
    profileAvatarDiv.textContent = letter;
    
    const gradients = [
        ["#ff6b3d", "#ff3d68"], // Saffron-Crimson
        ["#ff8c00", "#ff0080"], // Orange-Pink
        ["#4776e6", "#8e54e9"], // Blue-Purple
        ["#00b4db", "#0083b0"], // Teal-Blue
        ["#11998e", "#38ef7d"], // Green-Teal
        ["#f09819", "#edde5d"], // Gold-Yellow
        ["#8e2de2", "#4a00e0"], // Violet-Indigo
        ["#f857a6", "#ff5858"], // Rose-Red
        ["#3a7bd5", "#3a6073"]  // Steel Blue
    ];
    
    const seed = email || uid || "BhaktiTube";
    let hash = 0;
    for (let index = 0; index < seed.length; index++) {
        hash = seed.charCodeAt(index) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    const colors = gradients[idx];
    
    profileAvatarDiv.style.background = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
}

// 3. NAVIGATION TAB SWITCHER
tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const targetPanel = btn.getAttribute("data-panel");
        if (targetPanel) switchTab(targetPanel);
    });
});

function switchTab(panelId) {
    if (isFormDirty && panelId !== "edit-profile") {
        const discard = confirm("You have unsaved profile changes. Do you want to discard them?");
        if (!discard) return;
        isFormDirty = false;
        populateUI();
    }
    
    tabButtons.forEach(btn => {
        if (btn.getAttribute("data-panel") === panelId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
    
    panels.forEach(panel => {
        if (panel.id === `panel-${panelId}`) {
            panel.classList.add("active");
        } else {
            panel.classList.remove("active");
        }
    });
    
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// 4. EDIT PROFILE FORM ACTIONS & LIVE VALIDATION
function registerDirtyListeners() {
    const inputs = editForm.querySelectorAll("input, select, textarea");
    inputs.forEach(input => {
        input.addEventListener("input", () => {
            isFormDirty = true;
        });
    });
}
registerDirtyListeners();

document.getElementById("cancelEditBtn").addEventListener("click", () => {
    switchTab("dashboard");
});

function updateCounters() {
    updateCharCount(editNameInput, nameCharCount, 50);
    updateCharCount(editUsernameInput, usernameCharCount, 20);
    updateCharCount(editBioInput, bioCharCount, 150);
}

function updateCharCount(inputEl, counterEl, max) {
    if (!inputEl || !counterEl) return;
    const len = inputEl.value.length;
    counterEl.textContent = `${len}/${max}`;
}

editNameInput.addEventListener("input", () => updateCharCount(editNameInput, nameCharCount, 50));
editUsernameInput.addEventListener("input", () => {
    updateCharCount(editUsernameInput, usernameCharCount, 20);
    validateUsername();
});
editBioInput.addEventListener("input", () => updateCharCount(editBioInput, bioCharCount, 150));

function validateUsername() {
    const value = editUsernameInput.value.trim();
    const regex = /^[a-zA-Z0-9_]*$/;
    if (value && !regex.test(value)) {
        usernameValidation.style.visibility = "visible";
        return false;
    } else {
        usernameValidation.style.visibility = "hidden";
        return true;
    }
}

editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const newName = editNameInput.value.trim();
    if (!newName) {
        alert("Full Name cannot be empty.");
        return;
    }
    
    if (!validateUsername()) {
        alert("Please correct the username format first.");
        return;
    }
    
    if (editWebsiteInput.value && !isValidUrl(editWebsiteInput.value)) {
        alert("Please enter a valid website URL (including http/https).");
        return;
    }
    
    try {
        applyButtonLoading("saveProfileBtn", true, "Saving...");
        
        const payload = {
            displayName: newName,
            username: editUsernameInput.value.trim(),
            bio: editBioInput.value.trim(),
            gender: editGenderSelect.value,
            dob: editDobInput.value,
            phone: editPhoneInput.value.trim(),
            country: editCountryInput.value.trim(),
            state: editStateInput.value.trim(),
            city: editCityInput.value.trim(),
            language: editLanguageInput.value.trim(),
            timezone: editTimezoneInput.value.trim(),
            favDeity: editDeityInput.value.trim(),
            favCategory: editCategoryInput.value.trim(),
            occupation: editOccupationInput.value.trim(),
            website: editWebsiteInput.value.trim(),
            socialLinks: {
                instagram: editInstagramInput.value.trim(),
                youtube: editYoutubeInput.value.trim(),
                facebook: editFacebookInput.value.trim(),
                twitter: editTwitterInput.value.trim()
            },
            updatedAt: serverTimestamp()
        };
        
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, payload, { merge: true });
        
        if (newName !== currentUser.displayName) {
            await updateProfile(currentUser, { displayName: newName });
        }
        
        isFormDirty = false;
        alert("Profile details updated successfully!");
        switchTab("dashboard");
        
    } catch (error) {
        console.error("Error saving profile:", error);
        alert("Failed to save changes: " + error.message);
    } finally {
        applyButtonLoading("saveProfileBtn", false, '<i class="fa-solid fa-floppy-disk"></i> Save Profile');
    }
});

function isValidUrl(str) {
    try {
        new URL(str);
        return true;
    } catch (_) {
        return false;
    }
}

// 5. ACCOUNT PREFERENCES AUTO-SAVE LISTENERS
const preferenceInputs = [prefDarkMode, prefQuality, prefLanguage, prefAutoPlay, prefRememberPlayback, prefEmailRecs, prefWeeklyDigest];
preferenceInputs.forEach(input => {
    input.addEventListener("change", savePreferences);
});

async function savePreferences() {
    if (!currentUser) return;
    
    try {
        const payload = {
            settings: {
                darkMode: prefDarkMode.checked,
                videoQuality: prefQuality.value,
                language: prefLanguage.value,
                autoplay: prefAutoPlay.checked,
                rememberPlayback: prefRememberPlayback.checked,
                emailRecs: prefEmailRecs.checked,
                weeklyDigest: prefWeeklyDigest.checked
            }
        };
        
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, payload, { merge: true });
        
        applyThemePreference(prefDarkMode.checked);
        
    } catch (error) {
        console.error("Error auto-saving preferences:", error);
    }
}

function applyThemePreference(dark) {
    if (dark) {
        document.body.classList.add("dark-mode");
    } else {
        document.body.classList.remove("dark-mode");
    }
}

// 6. SECURITY ACTIONS
sendVerificationBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    try {
        await sendEmailVerification(currentUser);
        alert("Verification email sent! Please check your inbox and reload this page after verifying.");
    } catch (error) {
        alert("Failed to send verification: " + error.message);
    }
});

passwordUpdateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const currPass = currPasswordInput.value;
    const newPass = newPasswordInput.value;
    const confirmPass = confirmPasswordInput.value;
    
    if (newPass !== confirmPass) {
        alert("New passwords do not match.");
        return;
    }
    
    try {
        const credential = EmailAuthProvider.credential(currentUser.email, currPass);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPass);
        
        alert("Password updated successfully!");
        passwordUpdateForm.reset();
        
    } catch (error) {
        console.error("Error changing password:", error);
        alert("Failed to update password: " + error.message);
    }
});

// 7. RESPONSIVE CROP CANVAS DRAG-AND-PAN INTERACTION
changePhotoBtn.addEventListener("click", () => {
    avatarUploadInput.click();
});

avatarUploadInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const objectUrl = URL.createObjectURL(file);
    initCropImage(objectUrl);
});

function initCropImage(src) {
    // Show the modal first so getBoundingClientRect() returns correct non-zero size
    cropModal.style.display = "flex";
    
    cropImg = new Image();
    cropImg.onload = () => {
        const rect = cropCanvas.getBoundingClientRect();
        cropCanvas.width = rect.width || 300;
        cropCanvas.height = rect.height || 300;
        
        zoomSlider.value = "1";
        
        // Define radius relative to canvas size (33% of canvas width)
        const radius = cropCanvas.width * 0.33;
        const diameter = radius * 2;
        
        if (cropImg.width < cropImg.height) {
            imgWidth = diameter;
            imgHeight = cropImg.height * (diameter / cropImg.width);
        } else {
            imgHeight = diameter;
            imgWidth = cropImg.width * (diameter / cropImg.height);
        }
        
        // Center position
        imgX = cropCanvas.width / 2;
        imgY = cropCanvas.height / 2;
        
        drawCanvas();
        
        // Revoke the blob URL to prevent memory leaks
        if (src.startsWith("blob:")) {
            URL.revokeObjectURL(src);
        }
    };
    cropImg.src = src;
}

function drawCanvas() {
    ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    
    // Draw image applying zoom and pans
    ctx.save();
    ctx.translate(imgX, imgY);
    const zoom = parseFloat(zoomSlider.value);
    ctx.scale(zoom, zoom);
    ctx.drawImage(cropImg, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
    ctx.restore();
    
    const radius = cropCanvas.width * 0.33;
    
    // Circular matte background mask
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.beginPath();
    ctx.rect(0, 0, cropCanvas.width, cropCanvas.height);
    ctx.arc(cropCanvas.width / 2, cropCanvas.height / 2, radius, 0, Math.PI * 2, true);
    ctx.fill();
    
    // Circle guideline stroke
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cropCanvas.width / 2, cropCanvas.height / 2, radius, 0, Math.PI * 2);
    ctx.stroke();
}

// Canvas Panning Constraints
function boundaryRestrict() {
    const zoom = parseFloat(zoomSlider.value);
    const radius = cropCanvas.width * 0.33;
    const boundX = (imgWidth * zoom) / 2 - radius;
    const boundY = (imgHeight * zoom) / 2 - radius;
    
    const cx = cropCanvas.width / 2;
    const cy = cropCanvas.height / 2;
    
    imgX = Math.min(cx + boundX, Math.max(cx - boundX, imgX));
    imgY = Math.min(cy + boundY, Math.max(cy - boundY, imgY));
}

// Mouse/Desktop panning
cropCanvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX - imgX;
    startY = e.clientY - imgY;
});

window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    imgX = e.clientX - startX;
    imgY = e.clientY - startY;
    boundaryRestrict();
    drawCanvas();
});

window.addEventListener("mouseup", () => {
    isDragging = false;
});

// Touch/Mobile panning
cropCanvas.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    isDragging = true;
    startX = e.touches[0].clientX - imgX;
    startY = e.touches[0].clientY - imgY;
    e.preventDefault();
}, { passive: false });

cropCanvas.addEventListener("touchmove", (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    imgX = e.touches[0].clientX - startX;
    imgY = e.touches[0].clientY - startY;
    boundaryRestrict();
    drawCanvas();
    e.preventDefault();
}, { passive: false });

cropCanvas.addEventListener("touchend", () => {
    isDragging = false;
});

zoomSlider.addEventListener("input", () => {
    boundaryRestrict();
    drawCanvas();
});

// Cancel cropping dialog
cancelCropBtn.addEventListener("click", () => {
    cropModal.style.display = "none";
    avatarUploadInput.value = "";
});

// Helper to convert dataURL base64 format to Blob
function dataURLtoBlob(dataUrl) {
    const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

// Crop, Compress and Upload to Storage
saveCropBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    
    try {
        applyButtonLoading("saveCropBtn", true, "Compressing...");
        
        // Output compressed JPEG at 180x180 resolution to save bandwidth
        const offscreen = document.createElement("canvas");
        offscreen.width = 180;
        offscreen.height = 180;
        const oCtx = offscreen.getContext("2d");
        
        oCtx.save();
        oCtx.translate(90, 90);
        const zoom = parseFloat(zoomSlider.value);
        const radius = cropCanvas.width * 0.33;
        
        // Map current drawing crop center coordinates onto offscreen context
        const finalZoom = zoom * (90 / radius);
        oCtx.scale(finalZoom, finalZoom);
        
        const relX = (imgX - cropCanvas.width / 2) / zoom;
        const relY = (imgY - cropCanvas.height / 2) / zoom;
        oCtx.drawImage(cropImg, relX - imgWidth / 2, relY - imgHeight / 2, imgWidth, imgHeight);
        oCtx.restore();
        
        // JPEG compression level 0.65 yields a ~5KB file
        const dataUrl = offscreen.toDataURL("image/jpeg", 0.65);
        
        applyButtonLoading("saveCropBtn", true, "Uploading photo...");
        
        let downloadURL = "";
        
        try {
            const blob = dataURLtoBlob(dataUrl);
            
            // Try uploading to Firebase Storage with a short 4-second timeout
            const storageRef = ref(storage, `users/${currentUser.uid}/profile.jpg`);
            const uploadPromise = uploadBytes(storageRef, blob);
            const uploadTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout")), 4000)
            );
            const uploadResult = await Promise.race([uploadPromise, uploadTimeout]);
            
            const downloadPromise = getDownloadURL(uploadResult.ref);
            const downloadTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout")), 3000)
            );
            downloadURL = await Promise.race([downloadPromise, downloadTimeout]);
            console.log("Image uploaded to Firebase Storage:", downloadURL);
        } catch (storageErr) {
            // Fallback to storing Base64 directly in Firestore if Storage fails/times out
            console.warn("Storage upload failed or timed out. Falling back to storing Base64 in Firestore.", storageErr);
            downloadURL = dataUrl;
        }
        
        applyButtonLoading("saveCropBtn", true, "Saving profile url...");
        
        // Save cropped photo in Firestore user profile
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, {
            customPhotoURL: downloadURL,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        // Update Auth profile photoURL representation
        // ONLY update auth.currentUser.photoURL if downloadURL is a standard HTTPS URL (not Base64) to prevent "URL too long" auth error
        if (downloadURL && !downloadURL.startsWith("data:")) {
            await updateProfile(currentUser, { photoURL: downloadURL });
        } else {
            // Revert auth.currentUser.photoURL representation to empty string if base64 fallback is used
            await updateProfile(currentUser, { photoURL: "" });
        }
        
        cropModal.style.display = "none";
        avatarUploadInput.value = "";
        alert("Profile photo updated successfully!");
        
    } catch (error) {
        console.error("Error cropping avatar:", error);
        alert("Failed to save image: " + error.message);
    } finally {
        applyButtonLoading("saveCropBtn", false, '<i class="fa-solid fa-check"></i> Crop & Save');
    }
});

// Remove Custom Profile photo and restore default
restoreDefaultBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    
    const confirmRemove = confirm("Are you sure you want to remove your custom profile photo?");
    if (!confirmRemove) return;
    
    try {
        applyButtonLoading("restoreDefaultBtn", true, "Removing...");
        
        // Revert Firestore custom photo reference
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, {
            customPhotoURL: null,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        // Clear Auth profile representation
        await updateProfile(currentUser, { photoURL: "" });
        
        // Check if there was an original Google Profile image URL
        let googlePhoto = "";
        for (const profile of currentUser.providerData) {
            if (profile.providerId === "google.com" && profile.photoURL) {
                googlePhoto = profile.photoURL;
                break;
            }
        }
        
        if (googlePhoto) {
            await updateProfile(currentUser, { photoURL: googlePhoto });
        }
        
        cropModal.style.display = "none";
        avatarUploadInput.value = "";
        alert("Custom profile photo removed.");
        
    } catch (error) {
        console.error("Error restoring default photo:", error);
        alert("Failed to remove: " + error.message);
    } finally {
        applyButtonLoading("restoreDefaultBtn", false, '<i class="fa-solid fa-rotate-left"></i> Remove Custom');
    }
});

function applyButtonLoading(btnId, loading, defaultHtml) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (loading) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
    } else {
        btn.disabled = false;
        btn.innerHTML = defaultHtml;
    }
}

// 8. QUICK ACTIONS MODAL DIALOGS
document.getElementById("qaEditProfile").addEventListener("click", () => switchTab("edit-profile"));
document.getElementById("qaChangePhoto").addEventListener("click", () => avatarUploadInput.click());
document.getElementById("qaHistory").addEventListener("click", openHistoryModal);
document.getElementById("qaDownloads").addEventListener("click", () => openPremiumMockupModal("Downloads", '<p><strong>Offline Video Caching is coming soon!</strong></p><p>You will be able to download and sync your favorite Bhajans, Kathas, and spiritual discourses directly to your local device for offline listening on the BhaktiTube mobile application. Stay tuned!</p>'));
document.getElementById("qaBookmarks").addEventListener("click", () => openPremiumMockupModal("Bookmarks", '<p><strong>My Bookmarks is coming soon!</strong></p><p>Bookmark your favorite spiritual videos and create custom playlists of aartis, chalisa, and discourses to access them instantly.</p>'));
document.getElementById("qaHelp").addEventListener("click", () => openPremiumMockupModal("Help & Support", '<p>Need help with BhaktiTube?</p><ul><li><strong>Email Support:</strong> support@bhaktitube.org</li><li><strong>FAQ:</strong> How do I save progress? Your playback position is automatically synced to the cloud every 20 seconds.</li><li><strong>Feedback:</strong> We are continuously improving. Send your feature suggestions to our support team!</li></ul>'));

// Watch History Modal display
function openHistoryModal() {
    modalTitle.textContent = "Complete Watch History";
    modalBody.innerHTML = "";
    
    const items = userAnalytics?.history || [];
    if (items.length > 0) {
        const div = document.createElement("div");
        div.className = "modal-history-list";
        
        items.forEach(item => {
            const timeStr = formatRelativeTime(item.lastViewedMs);
            const durationStr = formatWatchTime(item.duration);
            const row = document.createElement("a");
            row.className = "history-item-row";
            row.href = `../index.html?play=${item.videoId}`;
            row.innerHTML = `
                <img src="${item.thumbnailUrl || 'https://img.youtube.com/vi/' + item.videoId + '/mqdefault.jpg'}" alt="Thumbnail" class="history-item-thumb">
                <div class="history-item-info">
                    <div class="history-item-title">${item.videoTitle || "Untitled Video"}</div>
                    <div class="history-item-channel">${item.channelName || "BhaktiTube"}</div>
                    <div class="history-item-meta">${durationStr} length • Viewed ${timeStr}</div>
                </div>
            `;
            div.appendChild(row);
        });
        
        modalBody.appendChild(div);
    } else {
        modalBody.innerHTML = "<p>No watch history detected yet.</p>";
    }
    
    genericModal.style.display = "flex";
}

function openPremiumMockupModal(title, htmlContent) {
    modalTitle.textContent = title;
    modalBody.innerHTML = htmlContent;
    genericModal.style.display = "flex";
}

// Info Modal Cancel
closeModalBtn.addEventListener("click", () => {
    genericModal.style.display = "none";
});

// Close modals when clicking outside contents
window.addEventListener("click", (e) => {
    if (e.target === genericModal) {
        genericModal.style.display = "none";
    }
    if (e.target === cropModal) {
        cropModal.style.display = "none";
    }
});

// LOGOUT TRIGGER
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", async () => {
    const conf = confirm("Are you sure you want to sign out?");
    if (!conf) return;
    
    try {
        await signOut(auth);
        history.replaceState(null, null, "login.html");
        window.location.href = "signup.html";
    } catch (e) {
        console.error("Sign out failed:", e);
    }
});
