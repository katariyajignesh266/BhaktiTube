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
        progressBarTrack.addEventListener('touchstart', handleProgressDragStart, { passive: false });
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
    const player = window.premiumPlayer || window.ytPlayer;
    if (player) {
        player.stopVideo();
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
    const player = window.premiumPlayer || window.ytPlayer;
    if (!player) return;
    
    if (isPlaying) {
        player.pauseVideo();
        isPlaying = false;
        centerPlayOverlay.classList.add('visible');
    } else {
        player.playVideo();
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
    const player = window.premiumPlayer || window.ytPlayer;
    if (!player) return;
    
    const currentTime = player.getCurrentTime();
    const newTime = Math.max(0, currentTime + seconds);
    player.seekTo(newTime, true);
    
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
    
    const player = window.premiumPlayer || window.ytPlayer;
    if (player) {
        player.setVolume(currentVolume);
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
    const player = window.premiumPlayer || window.ytPlayer;
    if (!player) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = progressBarTrack.getBoundingClientRect();
    const percent = (clientX - rect.left) / rect.width;
    const duration = player.getDuration();
    const newTime = duration * percent;
    
    player.seekTo(newTime, true);
}

// Handle Progress Drag
let isDragging = false;
function handleProgressDragStart(e) {
    e.preventDefault();
    isDragging = true;
    document.addEventListener('mousemove', handleProgressDrag);
    document.addEventListener('mouseup', handleProgressDragEnd);
    document.addEventListener('touchmove', handleProgressDrag, { passive: false });
    document.addEventListener('touchend', handleProgressDragEnd);
}

function handleProgressDrag(e) {
    const player = window.premiumPlayer || window.ytPlayer;
    if (!isDragging || !player) return;
    e.preventDefault();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = progressBarTrack.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const duration = player.getDuration();
    
    if (progressFill) {
        progressFill.style.width = (percent * 100) + '%';
    }
    
    // Update progress thumb position during drag
    const progressThumb = document.getElementById('progressThumb');
    if (progressThumb) {
        progressThumb.style.left = (percent * 100) + '%';
    }
    
    const newTime = duration * percent;
    player.seekTo(newTime, true);
}

function handleProgressDragEnd() {
    isDragging = false;
    document.removeEventListener('mousemove', handleProgressDrag);
    document.removeEventListener('mouseup', handleProgressDragEnd);
    document.removeEventListener('touchmove', handleProgressDrag);
    document.removeEventListener('touchend', handleProgressDragEnd);
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
        // Create mini player with state preservation
        createMiniPlayer();
    } else {
        // Remove mini player and restore main player
        removeMiniPlayer();
    }
}

function createMiniPlayer() {
    const player = window.premiumPlayer || window.ytPlayer;
    if (!player) return;
    
    // Get current playback state
    const currentTime = player.getCurrentTime() || 0;
    const duration = player.getDuration() || 0;
    const playerState = player.getPlayerState ? player.getPlayerState() : 1;
    const wasPlaying = playerState === 1 || isPlaying;
    
    // Get current video ID from iframe src
    const currentSrc = youtubePlayer.src;
    const videoIdMatch = currentSrc.match(/embed\/([a-zA-Z0-9_-]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : '';
    
    // Store state for restoration
    window.miniPlayerState = {
        videoId: videoId,
        currentTime: currentTime,
        wasPlaying: wasPlaying,
        volume: currentVolume,
        isMuted: isMuted
    };
    
    // Stop main player to prevent audio mixing
    if (player) {
        player.pauseVideo();
        isPlaying = false;
    }
    
    // Create enhanced mini player
    const miniPlayer = document.createElement('div');
    miniPlayer.className = 'mini-player active';
    miniPlayer.innerHTML = `
        <div class="mini-player-video-container" id="miniPlayerVideoContainer">
            <iframe id="miniPlayerIframe" 
                    src="https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&fs=0&enablejsapi=1&start=${Math.floor(currentTime)}&playsinline=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&cc_load_policy=3" 
                    allow="autoplay; fullscreen" 
                    allowfullscreen></iframe>
            <button class="mini-player-premium-close" onclick="closeMiniPlayerCompletely()">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="mini-player-controls">
            <button class="mini-player-btn" id="miniPlayPauseBtn" onclick="toggleMiniPlayPause()">
                <i class="fa-solid fa-${wasPlaying ? 'pause' : 'play'}" id="miniPlayPauseIcon"></i>
            </button>
            <div class="mini-player-volume">
                <button class="mini-player-btn" id="miniVolumeBtn" onclick="toggleMiniVolume()">
                    <i class="fa-solid fa-volume-${isMuted ? 'xmark' : 'high'}" id="miniVolumeIcon"></i>
                </button>
                <input type="range" class="mini-player-volume-slider" id="miniVolumeSlider" 
                       min="0" max="100" value="${currentVolume}" oninput="setMiniVolume(this.value)">
            </div>
            <button class="mini-player-btn" id="miniExpandBtn" onclick="expandMiniPlayer()">
                <i class="fa-solid fa-expand"></i>
            </button>
        </div>
    `;
    document.body.appendChild(miniPlayer);
    
    // Hide main player popup but keep it in DOM
    videoPopup.classList.remove('active');
    videoPopup.style.display = 'none';
    
    // Enable body scrolling for mini-player mode
    document.body.classList.add('mini-player-active');
    
    // Clear main iframe src to completely stop audio
    if (youtubePlayer) {
        youtubePlayer.src = '';
    }
    
    // Fetch video aspect ratio and adjust container
    fetchVideoAspectRatio(videoId).then(aspectRatio => {
        const container = document.getElementById('miniPlayerVideoContainer');
        if (container) {
            // Convert aspect ratio to padding-top percentage
            const paddingTop = (1 / aspectRatio) * 100;
            container.style.paddingTop = `${paddingTop}%`;
        }
    }).catch(error => {
        console.error('Error fetching video aspect ratio:', error);
        // Fallback to 16:9
        const container = document.getElementById('miniPlayerVideoContainer');
        if (container) {
            container.style.paddingTop = '56.25%';
        }
    });
    
    // Initialize mini player YouTube API
    initializeMiniPlayerAPI();
}

async function fetchVideoAspectRatio(videoId) {
    try {
        const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        const data = await response.json();
        
        if (data.width && data.height) {
            const aspectRatio = data.width / data.height;
            return aspectRatio;
        }
        
        // Default to 16:9 if dimensions not available
        return 16 / 9;
    } catch (error) {
        console.error('Error fetching video aspect ratio from oEmbed:', error);
        // Default to 16:9 on error
        return 16 / 9;
    }
}

let miniPlayerInstance = null;
let miniIsPlaying = true;

function initializeMiniPlayerAPI() {
    if (window.YT && window.YT.Player) {
        miniPlayerInstance = new YT.Player('miniPlayerIframe', {
            playerVars: {
                cc_load_policy: 3     // Disable captions
            },
            events: {
                onReady: (event) => {
                    // Force disable captions programmatically
                    try {
                        event.target.setOption('captions', 'track', { languageCode: 'off' });
                        event.target.setOption('captions', 'reload', false);
                    } catch (e) {
                        console.log('Caption disable attempt:', e);
                    }
                    // Set initial volume
                    event.target.setVolume(window.miniPlayerState.volume);
                    if (window.miniPlayerState.isMuted) {
                        event.target.mute();
                    }
                    miniIsPlaying = window.miniPlayerState.wasPlaying;
                    updateMiniPlayPauseIcon();
                },
                onStateChange: handleMiniPlayerStateChange
            }
        });
    }
}

function handleMiniPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        miniIsPlaying = true;
        updateMiniPlayPauseIcon();
    } else if (event.data === YT.PlayerState.PAUSED) {
        miniIsPlaying = false;
        updateMiniPlayPauseIcon();
    }
}

function toggleMiniPlayPause() {
    if (!miniPlayerInstance) return;
    
    if (miniIsPlaying) {
        miniPlayerInstance.pauseVideo();
        miniIsPlaying = false;
    } else {
        miniPlayerInstance.playVideo();
        miniIsPlaying = true;
    }
    updateMiniPlayPauseIcon();
}

function updateMiniPlayPauseIcon() {
    const icon = document.getElementById('miniPlayPauseIcon');
    if (icon) {
        icon.className = `fa-solid fa-${miniIsPlaying ? 'pause' : 'play'}`;
    }
}

function toggleMiniVolume() {
    if (!miniPlayerInstance) return;
    
    if (window.miniPlayerState.isMuted) {
        miniPlayerInstance.unMute();
        window.miniPlayerState.isMuted = false;
    } else {
        miniPlayerInstance.mute();
        window.miniPlayerState.isMuted = true;
    }
    updateMiniVolumeIcon();
}

function setMiniVolume(value) {
    if (!miniPlayerInstance) return;
    
    window.miniPlayerState.volume = parseInt(value);
    miniPlayerInstance.setVolume(parseInt(value));
    window.miniPlayerState.isMuted = parseInt(value) === 0;
    updateMiniVolumeIcon();
}

function updateMiniVolumeIcon() {
    const icon = document.getElementById('miniVolumeIcon');
    const slider = document.getElementById('miniVolumeSlider');
    if (icon) {
        if (window.miniPlayerState.isMuted || window.miniPlayerState.volume === 0) {
            icon.className = 'fa-solid fa-volume-xmark';
        } else if (window.miniPlayerState.volume < 50) {
            icon.className = 'fa-solid fa-volume-low';
        } else {
            icon.className = 'fa-solid fa-volume-high';
        }
    }
    if (slider) {
        slider.value = window.miniPlayerState.volume;
    }
}

function expandMiniPlayer() {
    // Restore main player with current state
    if (!miniPlayerInstance) return;
    
    const currentTime = miniPlayerInstance.getCurrentTime() || 0;
    window.miniPlayerState.currentTime = currentTime;
    
    // Remove mini player
    removeMiniPlayer();
    
    // Show main player and seek to current position
    videoPopup.style.display = 'flex';
    videoPopup.classList.add('active');
    
    const mainPlayer = window.premiumPlayer || window.ytPlayer;
    if (mainPlayer) {
        mainPlayer.seekTo(currentTime, true);
        if (window.miniPlayerState.wasPlaying) {
            mainPlayer.playVideo();
        }
        isPlaying = window.miniPlayerState.wasPlaying;
        updatePlayPauseIcon();
    }
}

function closeMiniPlayerCompletely() {
    const miniPlayer = document.querySelector('.mini-player');
    if (miniPlayer) {
        miniPlayer.remove();
    }
    
    // Disable body scrolling for normal mode
    document.body.classList.remove('mini-player-active');
    
    // Destroy mini player instance and stop audio
    if (miniPlayerInstance) {
        if (typeof miniPlayerInstance.stopVideo === 'function') {
            miniPlayerInstance.stopVideo();
        }
        if (typeof miniPlayerInstance.destroy === 'function') {
            miniPlayerInstance.destroy();
        }
    }
    miniPlayerInstance = null;
    
    // Reset mini player state
    isMiniPlayer = false;
    window.miniPlayerState = null;
    
    // Keep main player hidden - return to background view
    videoPopup.style.display = 'none';
    videoPopup.classList.remove('active');
    
    // Reset playing state
    isPlaying = false;
}

function removeMiniPlayer() {
    const miniPlayer = document.querySelector('.mini-player');
    if (miniPlayer) {
        miniPlayer.remove();
    }
    
    // Disable body scrolling for normal player mode
    document.body.classList.remove('mini-player-active');
    
    // Destroy mini player instance and stop audio
    if (miniPlayerInstance) {
        if (typeof miniPlayerInstance.stopVideo === 'function') {
            miniPlayerInstance.stopVideo();
        }
        if (typeof miniPlayerInstance.destroy === 'function') {
            miniPlayerInstance.destroy();
        }
    }
    miniPlayerInstance = null;
    
    // Show main player
    videoPopup.style.display = 'flex';
    videoPopup.classList.add('active');
    isMiniPlayer = false;
    
    // Restore main player state
    if (window.miniPlayerState) {
        const mainPlayer = window.premiumPlayer || window.ytPlayer;
        if (mainPlayer) {
            // Reconstruct iframe src with proper parameters to hide YouTube UI
            const videoId = window.miniPlayerState.videoId;
            const currentTime = window.miniPlayerState.currentTime;
            youtubePlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=0&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&enablejsapi=1&playsinline=1&iv_load_policy=3&cc_load_policy=3&origin=${window.location.origin}&showinfo=0&start=${Math.floor(currentTime)}`;
            
            // Wait for iframe to load then restore state
            setTimeout(() => {
                if (mainPlayer && typeof mainPlayer.seekTo === 'function') {
                    mainPlayer.seekTo(window.miniPlayerState.currentTime, true);
                    mainPlayer.setVolume(window.miniPlayerState.volume);
                    if (window.miniPlayerState.isMuted) {
                        mainPlayer.mute();
                    } else {
                        mainPlayer.unMute();
                    }
                    if (window.miniPlayerState.wasPlaying) {
                        mainPlayer.playVideo();
                        isPlaying = true;
                    } else {
                        mainPlayer.pauseVideo();
                        isPlaying = false;
                    }
                    updatePlayPauseIcon();
                    updateVolumeIcon();
                }
            }, 500);
        }
    }
}

// Toggle Picture in Picture
async function togglePictureInPicture() {
    const player = window.premiumPlayer || window.ytPlayer;
    const iframe = document.getElementById('youtubePlayer');
    
    if (!iframe) {
        console.error('YouTube iframe not found');
        return;
    }
    
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
            // Try to request Picture-in-Picture on the iframe
            await iframe.requestPictureInPicture();
        } else {
            // Fallback: Use YouTube's built-in theater mode or mini player
            console.log('Picture-in-Picture not supported, using mini player instead');
            toggleMiniPlayer();
        }
    } catch (error) {
        console.error('Picture-in-Picture error:', error);
        // Fallback to mini player if PiP fails
        console.log('Falling back to mini player');
        toggleMiniPlayer();
    }
}

// Toggle Cast
function toggleCast() {
    alert('Cast feature coming soon!');
}

// Toggle Captions - Disabled (no activity)
function toggleCaptions() {
    // Captions are disabled via cc_load_policy=3 parameter
    // This button has no activity
}

// Toggle Theme
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update theme icon and text in ultra settings menu
    const themeIconUltra = document.getElementById('themeIconUltra');
    const themeTextUltra = document.getElementById('themeTextUltra');
    
    if (themeIconUltra && themeTextUltra) {
        if (newTheme === 'light') {
            themeIconUltra.className = 'fa-solid fa-sun';
            themeTextUltra.textContent = 'Light Mode';
        } else {
            themeIconUltra.className = 'fa-solid fa-moon';
            themeTextUltra.textContent = 'Dark Mode';
        }
    }
    
    // Update main theme toggle if it exists
    const mainThemeIcon = document.getElementById('themeIcon');
    if (mainThemeIcon) {
        mainThemeIcon.className = newTheme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

// Decrease Playback Speed
function decreaseSpeed() {
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    
    if (currentIndex > 0) {
        const newSpeed = speeds[currentIndex - 1];
        setPlaybackSpeed(newSpeed);
    }
}

// Increase Playback Speed
function increaseSpeed() {
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    
    if (currentIndex < speeds.length - 1) {
        const newSpeed = speeds[currentIndex + 1];
        setPlaybackSpeed(newSpeed);
    }
}

// Reset Speed to Normal
function resetSpeed() {
    setPlaybackSpeed(1);
}

// Quality levels array
const qualityLevels = ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'];

// Decrease Quality
function decreaseQuality() {
    const currentIndex = qualityLevels.indexOf(currentQuality);
    
    if (currentQuality === 'auto') {
        setQuality('720p'); // Default to 720p when decreasing from auto
    } else if (currentIndex > 0) {
        const newQuality = qualityLevels[currentIndex - 1];
        setQuality(newQuality);
    }
}

// Increase Quality
function increaseQuality() {
    const currentIndex = qualityLevels.indexOf(currentQuality);
    
    if (currentQuality === 'auto') {
        setQuality('1080p'); // Default to 1080p when increasing from auto
    } else if (currentIndex < qualityLevels.length - 1) {
        const newQuality = qualityLevels[currentIndex + 1];
        setQuality(newQuality);
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
    
    // Update theme icon and text when menu opens
    if (!isActive) {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme') || 'dark';
        const themeIconUltra = document.getElementById('themeIconUltra');
        const themeTextUltra = document.getElementById('themeTextUltra');
        
        if (themeIconUltra && themeTextUltra) {
            if (currentTheme === 'light') {
                themeIconUltra.className = 'fa-solid fa-sun';
                themeTextUltra.textContent = 'Light Mode';
            } else {
                themeIconUltra.className = 'fa-solid fa-moon';
                themeTextUltra.textContent = 'Dark Mode';
            }
        }
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

// Add global click listener to close menu when clicking outside
document.addEventListener('click', function(e) {
    const ultraSettingsMenu = document.getElementById('ultraSettingsMenu');
    if (ultraSettingsMenu && ultraSettingsMenu.classList.contains('active')) {
        const settingsBtn = document.getElementById('settingsBtn');
        if (!ultraSettingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
            ultraSettingsMenu.classList.remove('active');
        }
    }
});

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
    
    const player = window.premiumPlayer || window.ytPlayer;
    if (player) {
        player.setPlaybackSpeed(speed);
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
    
    // Update progress thumb position
    const progressThumb = document.getElementById('progressThumb');
    if (progressThumb && duration > 0) {
        const percent = (currentTime / duration) * 100;
        progressThumb.style.left = percent + '%';
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

// Global event delegation for settings button - REMOVED to avoid conflicts with direct onclick

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
window.toggleMiniPlayPause = toggleMiniPlayPause;
window.toggleMiniVolume = toggleMiniVolume;
window.setMiniVolume = setMiniVolume;
window.expandMiniPlayer = expandMiniPlayer;
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
window.toggleTheme = toggleTheme;
window.decreaseSpeed = decreaseSpeed;
window.increaseSpeed = increaseSpeed;
window.resetSpeed = resetSpeed;
window.decreaseQuality = decreaseQuality;
window.increaseQuality = increaseQuality;
