/* ============================================================
   👑 PREMIUM GLASSMORPHIC VIDEO PLAYER CONTROLS
   ============================================================ */

// Global player state
let premiumPlayer = null;
let isPlaying = false;
let isMuted = false;
let currentVolume = 100;
let playbackSpeed = 1;
let isFullscreen = false;
let isTheaterMode = false;
let isMiniPlayer = false;
let autoplayEnabled = false;
let annotationsEnabled = true;
let currentQuality = 'auto';
let overlayTimeout = null;
let isOverlayVisible = true;

// DOM Elements
const videoPopup = document.getElementById('videoPopup');
const premiumOverlay = document.getElementById('premiumOverlay');
const youtubePlayer = document.getElementById('youtubePlayer');
const centerPlayOverlay = document.getElementById('centerPlayOverlay');
const playPauseBtn = document.getElementById('playPauseBtn');
const playPauseIcon = document.getElementById('playPauseIcon');
const volumeBtn = document.getElementById('volumeBtn');
const volumeIcon = document.getElementById('volumeIcon');
const volumeSlider = document.getElementById('volumeSlider');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const progressFill = document.getElementById('progressFill');
const progressBuffer = document.getElementById('progressBuffer');
const progressBarTrack = document.getElementById('progressBarTrack');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const fullscreenIcon = document.getElementById('fullscreenIcon');
const settingsMenu = document.getElementById('settingsMenu');
const speedOptionsMenu = document.getElementById('speedOptionsMenu');
const qualityOptionsMenu = document.getElementById('qualityOptionsMenu');
const premiumBackBtn = document.getElementById('premiumBackBtn');
const premiumVideoTitle = document.getElementById('premiumVideoTitle');
const premiumChannelName = document.getElementById('premiumChannelName');

// Initialize Premium Player
function initializePremiumPlayer() {
    setupEventListeners();
    setupKeyboardShortcuts();
    setupMobileBackButton();
}

// Setup Event Listeners
function setupEventListeners() {
    // Video container click for overlay toggle
    const videoContainer = document.getElementById('videoContainer');
    if (videoContainer) {
        videoContainer.addEventListener('click', handleOverlayClick);
    }

    // Progress bar interaction
    if (progressBarTrack) {
        progressBarTrack.addEventListener('click', handleProgressClick);
        progressBarTrack.addEventListener('mousedown', handleProgressDragStart);
    }

    // Volume slider
    if (volumeSlider) {
        volumeSlider.addEventListener('input', handleVolumeChange);
    }

    // Double tap for seek (mobile)
    if (videoContainer) {
        setupDoubleTapSeek(videoContainer);
    }
}

// Handle Overlay Click
function handleOverlayClick(e) {
    if (e.target.closest('.premium-control-btn') || 
        e.target.closest('.glassic-back-btn') ||
        e.target.closest('.premium-icon-btn') ||
        e.target.closest('.premium-settings-menu') ||
        e.target.closest('.premium-options-menu') ||
        e.target.closest('.ultra-small-settings-menu') ||
        e.target.closest('.ultra-settings-item')) {
        return;
    }
    
    toggleOverlay();
}

// Toggle Overlay Visibility
function toggleOverlay() {
    isOverlayVisible = !isOverlayVisible;
    
    if (isOverlayVisible) {
        premiumOverlay.classList.remove('hidden');
        centerPlayOverlay.classList.remove('visible');
        resetOverlayTimeout();
    } else {
        premiumOverlay.classList.add('hidden');
    }
}

// Reset Overlay Timeout
function resetOverlayTimeout() {
    clearTimeout(overlayTimeout);
    
    if (isPlaying && isOverlayVisible) {
        overlayTimeout = setTimeout(() => {
            premiumOverlay.classList.add('hidden');
            isOverlayVisible = false;
        }, 3000);
    }
}

// Handle Back Action
function handleBackAction() {
    if (isFullscreen) {
        exitFullscreen();
    } else if (isTheaterMode) {
        exitTheaterMode();
    } else {
        closeVideo();
    }
}

// Close Video
function closeVideo() {
    if (premiumPlayer) {
        premiumPlayer.stopVideo();
    }
    
    videoPopup.classList.remove('active');
    document.body.classList.remove('fullscreen-mode', 'theater-mode');
    
    // Reset state
    isPlaying = false;
    isFullscreen = false;
    isTheaterMode = false;
    updatePlayPauseIcon();
}

// Toggle Play/Pause
function togglePlayPause() {
    if (!premiumPlayer) return;
    
    if (isPlaying) {
        premiumPlayer.pauseVideo();
        isPlaying = false;
        centerPlayOverlay.classList.add('visible');
    } else {
        premiumPlayer.playVideo();
        isPlaying = true;
        centerPlayOverlay.classList.remove('visible');
    }
    
    updatePlayPauseIcon();
    resetOverlayTimeout();
}

// Update Play/Pause Icon
function updatePlayPauseIcon() {
    if (playPauseIcon) {
        playPauseIcon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }
    
    // Update center play icon
    const centerPlayIcon = centerPlayOverlay?.querySelector('i');
    if (centerPlayIcon) {
        centerPlayIcon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }
    
    // Update ultra settings menu play icon
    const ultraPlayIcon = document.getElementById('ultraPlayIcon');
    if (ultraPlayIcon) {
        ultraPlayIcon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }
}

// Skip Time
function skipTime(seconds) {
    if (!premiumPlayer) return;
    
    const currentTime = premiumPlayer.getCurrentTime();
    const newTime = Math.max(0, currentTime + seconds);
    premiumPlayer.seekTo(newTime, true);
    
    resetOverlayTimeout();
}

// Toggle Volume
function toggleVolume() {
    if (isMuted) {
        setVolume(currentVolume || 100);
        isMuted = false;
    } else {
        currentVolume = volumeSlider ? parseInt(volumeSlider.value) : 100;
        setVolume(0);
        isMuted = true;
    }
    
    updateVolumeIcon();
}

// Set Volume
function setVolume(value) {
    currentVolume = parseInt(value);
    
    if (premiumPlayer) {
        premiumPlayer.setVolume(currentVolume);
    }
    
    if (volumeSlider) {
        volumeSlider.value = currentVolume;
    }
    
    isMuted = currentVolume === 0;
    updateVolumeIcon();
}

// Handle Volume Change
function handleVolumeChange(e) {
    setVolume(e.target.value);
}

// Update Volume Icon
function updateVolumeIcon() {
    if (!volumeIcon) return;
    
    if (isMuted || currentVolume === 0) {
        volumeIcon.className = 'fa-solid fa-volume-xmark';
    } else if (currentVolume < 50) {
        volumeIcon.className = 'fa-solid fa-volume-low';
    } else {
        volumeIcon.className = 'fa-solid fa-volume-high';
    }
}

// Handle Progress Click
function handleProgressClick(e) {
    if (!premiumPlayer) return;
    
    const rect = progressBarTrack.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const duration = premiumPlayer.getDuration();
    const newTime = duration * percent;
    
    premiumPlayer.seekTo(newTime, true);
}

// Handle Progress Drag
let isDragging = false;
function handleProgressDragStart(e) {
    isDragging = true;
    document.addEventListener('mousemove', handleProgressDrag);
    document.addEventListener('mouseup', handleProgressDragEnd);
}

function handleProgressDrag(e) {
    if (!isDragging || !premiumPlayer) return;
    
    const rect = progressBarTrack.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const duration = premiumPlayer.getDuration();
    
    if (progressFill) {
        progressFill.style.width = (percent * 100) + '%';
    }
    
    const newTime = duration * percent;
    premiumPlayer.seekTo(newTime, true);
}

function handleProgressDragEnd() {
    isDragging = false;
    document.removeEventListener('mousemove', handleProgressDrag);
    document.removeEventListener('mouseup', handleProgressDragEnd);
}

// Toggle Fullscreen
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        enterFullscreen();
    } else {
        exitFullscreen();
    }
}

function enterFullscreen() {
    const videoWrapper = document.querySelector('.premium-video-wrapper');
    if (videoWrapper.requestFullscreen) {
        videoWrapper.requestFullscreen();
    } else if (videoWrapper.webkitRequestFullscreen) {
        videoWrapper.webkitRequestFullscreen();
    } else if (videoWrapper.msRequestFullscreen) {
        videoWrapper.msRequestFullscreen();
    }
    
    isFullscreen = true;
    document.body.classList.add('fullscreen-mode');
    updateFullscreenIcon();
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
    
    isFullscreen = false;
    document.body.classList.remove('fullscreen-mode');
    updateFullscreenIcon();
}

function updateFullscreenIcon() {
    if (fullscreenIcon) {
        fullscreenIcon.className = isFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
    }
}

// Toggle Theater Mode
function toggleTheaterMode() {
    isTheaterMode = !isTheaterMode;
    document.body.classList.toggle('theater-mode', isTheaterMode);
}

function exitTheaterMode() {
    isTheaterMode = false;
    document.body.classList.remove('theater-mode');
}

// Toggle Mini Player
function toggleMiniPlayer() {
    isMiniPlayer = !isMiniPlayer;
    
    if (isMiniPlayer) {
        // Create mini player
        createMiniPlayer();
    } else {
        // Remove mini player
        removeMiniPlayer();
    }
}

function createMiniPlayer() {
    // Implementation for mini player
    const miniPlayer = document.createElement('div');
    miniPlayer.className = 'mini-player active';
    miniPlayer.innerHTML = `
        <iframe src="${youtubePlayer.src}" allow="autoplay; fullscreen"></iframe>
        <button class="mini-player-close" onclick="toggleMiniPlayer()">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    document.body.appendChild(miniPlayer);
    videoPopup.classList.remove('active');
}

function removeMiniPlayer() {
    const miniPlayer = document.querySelector('.mini-player');
    if (miniPlayer) {
        miniPlayer.remove();
    }
    videoPopup.classList.add('active');
    isMiniPlayer = false;
}

// Toggle Picture in Picture
function togglePictureInPicture() {
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
        // Note: This requires the video element, not iframe
        // For YouTube iframe, this is limited
        alert('Picture-in-Picture is not available for YouTube embeds');
    }
}

// Toggle Cast
function toggleCast() {
    alert('Cast feature coming soon!');
}

// Toggle Captions
function toggleCaptions() {
    if (premiumPlayer) {
        const module = premiumPlayer.getOptions('captions');
        if (module) {
            // Toggle captions
            alert('Captions toggled');
        }
    }
}

// Toggle Ultra-Small Settings Menu
function toggleUltraSettingsMenu() {
    console.log('toggleUltraSettingsMenu called');
    const ultraSettingsMenu = document.getElementById('ultraSettingsMenu');
    if (!ultraSettingsMenu) {
        console.log('Ultra settings menu not found');
        return;
    }
    
    const isActive = ultraSettingsMenu.classList.contains('active');
    ultraSettingsMenu.classList.toggle('active', !isActive);
    
    console.log('Ultra settings menu toggled:', !isActive);
    
    // Update play icon in menu
    const ultraPlayIcon = document.getElementById('ultraPlayIcon');
    if (ultraPlayIcon) {
        ultraPlayIcon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }
    
    // Close menu when clicking outside
    if (!isActive) {
        setTimeout(() => {
            document.addEventListener('click', closeUltraSettingsMenuOutside);
        }, 0);
    } else {
        document.removeEventListener('click', closeUltraSettingsMenuOutside);
    }
}

// Make function globally accessible
window.toggleUltraSettingsMenu = toggleUltraSettingsMenu;

// Close ultra settings menu when clicking outside
function closeUltraSettingsMenuOutside(e) {
    const ultraSettingsMenu = document.getElementById('ultraSettingsMenu');
    const settingsBtn = document.getElementById('settingsBtn');
    
    if (ultraSettingsMenu && !ultraSettingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
        ultraSettingsMenu.classList.remove('active');
        document.removeEventListener('click', closeUltraSettingsMenuOutside);
    }
}

// Settings Menu
function toggleSettingsMenu() {
    const isActive = settingsMenu.classList.contains('active');
    
    // Close other menus
    speedOptionsMenu.classList.remove('active');
    qualityOptionsMenu.classList.remove('active');
    
    settingsMenu.classList.toggle('active', !isActive);
}

function closeSettingsMenu() {
    settingsMenu.classList.remove('active');
}

// Speed Options
function toggleSpeedOptions() {
    closeSettingsMenu();
    speedOptionsMenu.classList.toggle('active');
}

function closeSpeedOptions() {
    speedOptionsMenu.classList.remove('active');
}

function setPlaybackSpeed(speed) {
    playbackSpeed = speed;
    
    if (premiumPlayer) {
        premiumPlayer.setPlaybackSpeed(speed);
    }
    
    // Update UI
    const speedText = speed === 1 ? 'Normal' : speed + 'x';
    const currentSpeedEl = document.getElementById('currentSpeed');
    if (currentSpeedEl) {
        currentSpeedEl.textContent = speedText;
    }
    
    // Update active state in menu
    const options = speedOptionsMenu.querySelectorAll('.option-item');
    options.forEach(opt => {
        opt.classList.remove('active');
        if (opt.textContent === speedText || opt.textContent === speed + 'x') {
            opt.classList.add('active');
        }
    });
    
    closeSpeedOptions();
}

// Quality Options
function toggleQualityOptions() {
    closeSettingsMenu();
    qualityOptionsMenu.classList.toggle('active');
}

function closeQualityOptions() {
    qualityOptionsMenu.classList.remove('active');
}

function setQuality(quality) {
    currentQuality = quality;
    
    // Update UI
    const currentQualityEl = document.getElementById('currentQuality');
    if (currentQualityEl) {
        currentQualityEl.textContent = quality === 'auto' ? 'Auto' : quality;
    }
    
    // Update active state in menu
    const options = qualityOptionsMenu.querySelectorAll('.option-item');
    options.forEach(opt => {
        opt.classList.remove('active');
        if (opt.textContent.includes(quality) || opt.textContent === 'Auto') {
            opt.classList.add('active');
        }
    });
    
    // Note: YouTube iframe API doesn't support quality control directly
    // This is a placeholder for future implementation
    closeQualityOptions();
}

// Toggle Autoplay
function toggleAutoplay() {
    autoplayEnabled = !autoplayEnabled;
    
    const toggle = document.getElementById('autoplayToggle');
    if (toggle) {
        toggle.classList.toggle('active', autoplayEnabled);
    }
}

// Toggle Annotations
function toggleAnnotations() {
    annotationsEnabled = !annotationsEnabled;
    
    const toggle = document.getElementById('annotationsToggle');
    if (toggle) {
        toggle.classList.toggle('active', annotationsEnabled);
    }
}

// Play Previous Video
function playPreviousVideo() {
    // Try to get previous video from current playlist
    if (window.currentVideoIndex > 0 && window.videoPlaylist) {
        window.currentVideoIndex--;
        const prevVideo = window.videoPlaylist[window.currentVideoIndex];
        if (prevVideo && prevVideo.videoId) {
            playVideo(prevVideo.videoId, prevVideo, false);
        }
    } else {
        // Show toast or feedback
        console.log('No previous video available');
        const toast = document.createElement('div');
        toast.textContent = 'No previous video';
        toast.style.cssText = 'position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 8px 16px; border-radius: 4px; z-index: 10001;';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
}

// Play Next Video
function playNextVideo() {
    // Try to get next video from current playlist
    if (window.videoPlaylist && window.currentVideoIndex < window.videoPlaylist.length - 1) {
        window.currentVideoIndex++;
        const nextVideo = window.videoPlaylist[window.currentVideoIndex];
        if (nextVideo && nextVideo.videoId) {
            playVideo(nextVideo.videoId, nextVideo, false);
        }
    } else if (autoplayEnabled) {
        // Try to find next video from feed
        console.log('Autoplay: Looking for next video...');
        const toast = document.createElement('div');
        toast.textContent = 'Autoplay enabled';
        toast.style.cssText = 'position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 8px 16px; border-radius: 4px; z-index: 10001;';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    } else {
        // Show feedback
        console.log('No next video available');
        const toast = document.createElement('div');
        toast.textContent = 'No next video';
        toast.style.cssText = 'position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 8px 16px; border-radius: 4px; z-index: 10001;';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (!videoPopup.classList.contains('active')) return;
        
        switch(e.key) {
            case ' ':
            case 'k':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowLeft':
                skipTime(-5);
                break;
            case 'ArrowRight':
                skipTime(5);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setVolume(Math.min(100, currentVolume + 10));
                break;
            case 'ArrowDown':
                e.preventDefault();
                setVolume(Math.max(0, currentVolume - 10));
                break;
            case 'f':
                toggleFullScreen();
                break;
            case 'm':
                toggleVolume();
                break;
            case 't':
                toggleTheaterMode();
                break;
            case 'Escape':
                if (settingsMenu.classList.contains('active')) {
                    closeSettingsMenu();
                } else if (speedOptionsMenu.classList.contains('active')) {
                    closeSpeedOptions();
                } else if (qualityOptionsMenu.classList.contains('active')) {
                    closeQualityOptions();
                } else {
                    handleBackAction();
                }
                break;
        }
    });
}

// Mobile Back Button
function setupMobileBackButton() {
    window.addEventListener('popstate', (e) => {
        if (videoPopup.classList.contains('active')) {
            e.preventDefault();
            handleBackAction();
        }
    });
}

// Double Tap Seek (Mobile)
function setupDoubleTapSeek(container) {
    let lastTap = 0;
    let tapTimeout = null;
    
    container.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        
        clearTimeout(tapTimeout);
        
        if (tapLength < 300 && tapLength > 0) {
            // Double tap detected
            const rect = container.getBoundingClientRect();
            const x = e.changedTouches[0].clientX;
            const centerX = rect.left + rect.width / 2;
            
            if (x < centerX) {
                skipTime(-10);
            } else {
                skipTime(10);
            }
            
            e.preventDefault();
        } else {
            tapTimeout = setTimeout(() => {
                // Single tap - handled by overlay toggle
            }, 300);
        }
        
        lastTap = currentTime;
    });
}

// Update Video Info
function updateVideoInfo(title, channel) {
    if (premiumVideoTitle) {
        premiumVideoTitle.textContent = title || 'Video Title';
    }
    if (premiumChannelName) {
        premiumChannelName.textContent = channel || 'Channel Name';
    }
}

// Update Progress
function updateProgress(currentTime, duration) {
    if (currentTimeEl && totalTimeEl) {
        currentTimeEl.textContent = formatTime(currentTime);
        totalTimeEl.textContent = formatTime(duration);
    }
    
    if (progressFill && duration > 0) {
        const percent = (currentTime / duration) * 100;
        progressFill.style.width = percent + '%';
    }
}

// Format Time
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// YouTube Player Ready Callback
function onYouTubeIframeAPIReady() {
    // This will be called when YouTube API is ready
    console.log('YouTube API Ready');
    
    // Set global reference for player-core.js
    window.premiumPlayer = {
        getCurrentTime: () => window.ytPlayer ? window.ytPlayer.getCurrentTime() : 0,
        getDuration: () => window.ytPlayer ? window.ytPlayer.getDuration() : 0,
        playVideo: () => window.ytPlayer ? window.ytPlayer.playVideo() : null,
        pauseVideo: () => window.ytPlayer ? window.ytPlayer.pauseVideo() : null,
        stopVideo: () => window.ytPlayer ? window.ytPlayer.stopVideo() : null,
        seekTo: (time, allowSeekAhead) => window.ytPlayer ? window.ytPlayer.seekTo(time, allowSeekAhead) : null,
        setVolume: (volume) => window.ytPlayer ? window.ytPlayer.setVolume(volume) : null,
        setPlaybackSpeed: (speed) => window.ytPlayer ? window.ytPlayer.setPlaybackSpeed(speed) : null
    };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePremiumPlayer);
} else {
    initializePremiumPlayer();
}

// Global event delegation for settings button
document.addEventListener('click', function(e) {
    const settingsBtn = e.target.closest('#settingsBtn');
    if (settingsBtn) {
        e.stopPropagation();
        e.preventDefault();
        console.log('Settings button clicked via delegation');
        const ultraSettingsMenu = document.getElementById('ultraSettingsMenu');
        if (ultraSettingsMenu) {
            ultraSettingsMenu.classList.toggle('active');
            console.log('Menu toggled:', ultraSettingsMenu.classList.contains('active'));
        }
    }
    
    // Close ultra settings menu when clicking outside
    const ultraSettingsMenu = document.getElementById('ultraSettingsMenu');
    if (ultraSettingsMenu && ultraSettingsMenu.classList.contains('active')) {
        if (!e.target.closest('#settingsBtn') && !e.target.closest('.ultra-small-settings-menu')) {
            ultraSettingsMenu.classList.remove('active');
        }
    }
}, true);

// Export functions for global access
window.premiumPlayerFunctions = {
    togglePlayPause,
    skipTime,
    toggleVolume,
    setVolume,
    toggleFullScreen,
    toggleTheaterMode,
    toggleMiniPlayer,
    togglePictureInPicture,
    toggleSettingsMenu,
    toggleUltraSettingsMenu,
    toggleSpeedOptions,
    toggleQualityOptions,
    setPlaybackSpeed,
    setQuality,
    toggleAutoplay,
    toggleAnnotations,
    playPreviousVideo,
    playNextVideo,
    handleBackAction,
    closeVideo,
    updateVideoInfo,
    updateProgress
};

// Also export individual functions for direct HTML onclick access
window.togglePlayPause = togglePlayPause;
window.skipTime = skipTime;
window.toggleVolume = toggleVolume;
window.setVolume = setVolume;
window.toggleFullScreen = toggleFullScreen;
window.toggleTheaterMode = toggleTheaterMode;
window.toggleMiniPlayer = toggleMiniPlayer;
window.togglePictureInPicture = togglePictureInPicture;
window.toggleSettingsMenu = toggleSettingsMenu;
window.toggleSpeedOptions = toggleSpeedOptions;
window.toggleQualityOptions = toggleQualityOptions;
window.setPlaybackSpeed = setPlaybackSpeed;
window.setQuality = setQuality;
window.toggleAutoplay = toggleAutoplay;
window.toggleAnnotations = toggleAnnotations;
window.playPreviousVideo = playPreviousVideo;
window.playNextVideo = playNextVideo;
window.handleBackAction = handleBackAction;
window.toggleCaptions = toggleCaptions;
