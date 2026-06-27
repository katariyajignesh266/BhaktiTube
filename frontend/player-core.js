import { db, auth } from "./firebase-config.js";
import {
  doc,
  updateDoc,
  increment,
  collection,
  getDocs,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { watchProgressEngine } from "./analytics-engine.js";

// Module variables for state management
let ytPlayer = null;
let isMuted = false;
let controlsTimeout = null;
let timeUpdateInterval = null;
let playbackSessionStarted = false;
let currentVideoId = null;
let watchedSaved = false;
let currentVideoMeta = null;
let isChannelVideoSource = false;
let youtubeApiReadyPromise = null;

const watchedVideos = new Set(
  JSON.parse(localStorage.getItem("watchedChannelVideos") || "[]")
);

// Load the YouTube API Promise
function getYouTubeApiReady() {
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }
  if (!youtubeApiReadyPromise) {
    youtubeApiReadyPromise = new Promise((resolve) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousReady === "function") {
          previousReady();
        }
        resolve();
      };
    });
  }
  return youtubeApiReadyPromise;
}

// Get active advertisements from Firestore
async function getActiveAdvertisement() {
  try {
    const snapshot = await getDocs(collection(db, "advertisements"));
    const ads = [];
    snapshot.forEach((docSnap) => {
      const ad = docSnap.data();
      if (ad.active) {
        ads.push({
          id: docSnap.id,
          ...ad
        });
      }
    });
    if (ads.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * ads.length);
    return ads[randomIndex];
  } catch (err) {
    console.error("Error loading ad:", err);
    return null;
  }
}

// Unified Video Play Router Pipeline
export async function playVideo(videoId, videoMeta, isChannelVideo) {
  console.log("Pipeline Routing Playback for:", videoId, "ChannelSource:", isChannelVideo);
  currentVideoId = videoId;
  currentVideoMeta = videoMeta;
  isChannelVideoSource = isChannelVideo;
  watchedSaved = false;
  playbackSessionStarted = false;

  // 1. Check for advertisements
  const ad = await getActiveAdvertisement();

  if (ad && ad.videoUrl) {
    // Increment ad views
    try {
      await updateDoc(doc(db, "advertisements", ad.id), {
        views: increment(1)
      });
    } catch (err) {
      console.error("Error incrementing ad views:", err);
    }

    // Launch advertisement overlay
    startAdOverlay(ad, () => {
      startPremiumVideoPlayer(videoId, videoMeta, isChannelVideo);
    });
  } else {
    // Proceed directly to premium player
    startPremiumVideoPlayer(videoId, videoMeta, isChannelVideo);
  }
}

// Advertisement Manager
function startAdOverlay(ad, onAdFinished) {
  const adPopup = document.getElementById("adPopup");
  const adVideo = document.getElementById("adVideo");
  const visitAdBtn = document.getElementById("visitAdBtn");
  const skipAdBtn = document.getElementById("skipAdBtn");
  const adTitleText = document.getElementById("adTitleText");
  const adDescText = document.getElementById("adDescText");
  const adProgressBar = document.getElementById("adProgressBar");

  if (!adPopup || !adVideo) {
    console.error("DOM reference elements for Ad missing. Bypassing ad pipeline.");
    onAdFinished();
    return;
  }

  // Set ad details
  if (adTitleText) {
    adTitleText.textContent = ad.title || "Sponsored Advertisement";
  }
  if (adDescText) {
    if (ad.description) {
      adDescText.textContent = ad.description;
      adDescText.style.display = "block";
    } else {
      adDescText.style.display = "none";
    }
  }

  // Initialize progress bar
  if (adProgressBar) {
    adProgressBar.style.width = "0%";
  }

  // Show popup & start video
  adPopup.style.display = "flex";
  adVideo.src = ad.videoUrl;
  adVideo.load();
  
  const playPromise = adVideo.play();
  if (playPromise !== undefined) {
    playPromise.catch((e) => {
      console.log("Autoplay was prevented by browser, waiting for user interaction.", e);
    });
  }

  // Visual progress updater
  adVideo.ontimeupdate = () => {
    if (adVideo.duration && adProgressBar) {
      const pct = (adVideo.currentTime / adVideo.duration) * 100;
      adProgressBar.style.width = pct + "%";
    }
  };

  // Redirect and click count tracker
  visitAdBtn.onclick = async () => {
    try {
      await updateDoc(doc(db, "advertisements", ad.id), {
        clicks: increment(1)
      });
    } catch (err) {
      console.error("Error registering ad click:", err);
    }
    window.open(ad.redirectLink, "_blank");
  };

  // Skip countdown logic
  let seconds = ad.skipAfter || 5;
  skipAdBtn.disabled = true;
  skipAdBtn.textContent = `Skip Ad (${seconds})`;

  const timer = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(timer);
      skipAdBtn.disabled = false;
      skipAdBtn.textContent = "Skip Ad";
    } else {
      skipAdBtn.textContent = `Skip Ad (${seconds})`;
    }
  }, 1000);

  function stopAdAndLaunchPlayer() {
    clearInterval(timer);
    adVideo.ontimeupdate = null;
    adVideo.onended = null;
    adVideo.pause();
    adVideo.src = "";
    adPopup.style.display = "none";
    onAdFinished();
  }

  skipAdBtn.onclick = () => {
    stopAdAndLaunchPlayer();
  };

  adVideo.onended = () => {
    stopAdAndLaunchPlayer();
  };
}

// Player Manager
async function startPremiumVideoPlayer(videoId, videoMeta, isChannelVideo) {
  const videoPopup = document.getElementById("videoPopup");
  const playerIframe = document.getElementById("youtubePlayer");
  const titleEl = document.querySelector(".video-title-mini");

  if (videoPopup) videoPopup.style.display = "flex";
  document.body.style.overflow = "hidden";

  let resumePosition = 0;
  try {
    const session = await watchProgressEngine.startSession(videoMeta, {
      source: isChannelVideo ? "channel" : "home"
    });
    resumePosition = session.resumePosition || 0;
    playbackSessionStarted = true;
  } catch (error) {
    console.error("Error setting up watch analytics tracking:", error);
    resumePosition = 0;
  }

  // Embed parameters to hide native player controls and enable iframe API
  const startParam = resumePosition > 0 ? `&start=${Math.floor(resumePosition)}` : "";
  if (playerIframe) {
    playerIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&enablejsapi=1&playsinline=1&iv_load_policy=3&origin=${window.location.origin}${startParam}`;
  }

  if (titleEl) {
    titleEl.textContent = videoMeta.videoTitle || videoMeta.title || "Playing Video...";
  }

  try {
    await getYouTubeApiReady();

    if (ytPlayer && typeof ytPlayer.loadVideoById === "function") {
      ytPlayer.loadVideoById({
        videoId: videoId,
        startSeconds: resumePosition
      });
      ytPlayer.playVideo();
      isMuted = false;
      updateMuteButtons();
      startTimeTracking();
      startControlsTimer();
      return;
    }

    ytPlayer = new YT.Player("youtubePlayer", {
      events: {
        onReady: (event) => {
          if (resumePosition > 0) {
            event.target.seekTo(resumePosition, true);
          }
          event.target.playVideo();
          isMuted = false;
          updateMuteButtons();
          startTimeTracking();
          startControlsTimer();
        },
        onStateChange: handlePlayerStateChange,
        onError: (event) => {
          console.error("Player Error encountered:", event.data);
          watchProgressEngine.recordEvent("playback_error", { videoId });
        }
      }
    });
  } catch (error) {
    console.error("Error loading YouTube Iframe Player API:", error);
    startTimeTracking();
  }
}

// Handle player playback state changes
function handlePlayerStateChange(event) {
  const current = getPlayerCurrentTime();
  const duration = getPlayerDuration();

  if (event.data === YT.PlayerState.PLAYING) {
    watchProgressEngine.setPlaybackState("playing", {
      currentPosition: current,
      duration: duration
    });
    startTimeTracking();
    startControlsTimer();
  } else {
    if (event.data === YT.PlayerState.PAUSED) {
      watchProgressEngine.setPlaybackState("paused", {
        currentPosition: current,
        duration: duration
      });
    }

    if (event.data === YT.PlayerState.BUFFERING) {
      watchProgressEngine.setPlaybackState("buffering", {
        currentPosition: current,
        duration: duration
      });
    }

    if (event.data === YT.PlayerState.ENDED) {
      handleVideoCompleted();
    }

    clearInterval(timeUpdateInterval);
  }
}

// Visual progress sliders and tracking interval
function startTimeTracking() {
  clearInterval(timeUpdateInterval);
  timeUpdateInterval = setInterval(() => {
    const current = getPlayerCurrentTime();
    const total = getPlayerDuration();

    if (total > 0) {
      watchProgressEngine.touchPlayback(current, total);

      // Update progress bar
      const pct = (current / total) * 100;
      const pBar = document.getElementById("progressBar");
      if (pBar) pBar.style.width = pct + "%";

      // Update elapsed and total times
      const curTimeEl = document.getElementById("currentTime");
      const totTimeEl = document.getElementById("totalTime");
      if (curTimeEl) curTimeEl.textContent = formatTime(current);
      if (totTimeEl) totTimeEl.textContent = formatTime(total);

      // Mark channel videos completed
      if (!watchedSaved && (current / total) >= 0.95) {
        watchedSaved = true;
        saveWatchedChannelVideo(currentVideoId);
      }
    }
  }, 500);
}

// Convert seconds to format MM:SS
function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Get player elapsed time
function getPlayerCurrentTime() {
  try {
    return ytPlayer && typeof ytPlayer.getCurrentTime === "function"
      ? ytPlayer.getCurrentTime()
      : 0;
  } catch (error) {
    return 0;
  }
}

// Get player duration
function getPlayerDuration() {
  try {
    return ytPlayer && typeof ytPlayer.getDuration === "function"
      ? ytPlayer.getDuration()
      : 0;
  } catch (error) {
    return 0;
  }
}

// Handle completed video sessions
function handleVideoCompleted() {
  const total = getPlayerDuration();
  watchProgressEngine.setPlaybackState("ended", {
    currentPosition: total,
    duration: total
  });

  if (!watchedSaved) {
    watchedSaved = true;
    saveWatchedChannelVideo(currentVideoId);
  }

  // Refresh homepage watch dashboard continue-watching block if defined
  if (typeof window.onPlayerClosed === "function") {
    window.onPlayerClosed();
  }
}

// Save dynamic channel fetched video details in watch Firestore records
async function saveWatchedChannelVideo(videoId) {
  if (!videoId) return;
  watchedVideos.add(videoId);
  localStorage.setItem("watchedChannelVideos", JSON.stringify([...watchedVideos]));

  const user = auth.currentUser;
  if (!user) return;

  try {
    await setDoc(doc(db, "users", user.uid, "watchedChannelVideos", videoId), {
      videoId,
      watchedAt: Date.now()
    });
    console.log("WATCHED SAVED:", videoId);
  } catch (err) {
    console.error("Error marking channel video watched:", err);
  }
}

// controls overlay countdown timer
function startControlsTimer() {
  clearTimeout(controlsTimeout);
  controlsTimeout = setTimeout(() => {
    const overlay = document.getElementById("customOverlay");
    if (overlay) {
      overlay.classList.add("hide-controls");
    }
  }, 2500);
}

// Update local icon mute displays
function updateMuteButtons() {
  const muteBtn = document.getElementById("muteBtn");
  if (muteBtn) {
    muteBtn.innerHTML = isMuted
      ? '<i class="fa-solid fa-volume-xmark"></i>'
      : '<i class="fa-solid fa-volume-high"></i>';
  }
}

// Global functions registered on the window object for HTML elements
window.skipTime = function (seconds) {
  if (ytPlayer && typeof ytPlayer.getCurrentTime === "function" && typeof ytPlayer.seekTo === "function") {
    const currentTime = ytPlayer.getCurrentTime();
    watchProgressEngine.recordSeek(seconds);
    ytPlayer.seekTo(currentTime + seconds, true);

    if (document.activeElement) {
      document.activeElement.blur();
    }
    startControlsTimer();
  }
};

window.toggleMute = function () {
  if (ytPlayer && typeof ytPlayer.mute === "function") {
    if (isMuted) {
      ytPlayer.unMute();
      isMuted = false;
    } else {
      ytPlayer.mute();
      isMuted = true;
    }
    updateMuteButtons();
  }
};

window.toggleSpeedMenu = function () {
  const menu = document.getElementById("speedMenu");
  if (menu) menu.classList.toggle("show");
};

window.changeSpeed = function (speed) {
  if (ytPlayer && typeof ytPlayer.setPlaybackRate === "function") {
    ytPlayer.setPlaybackRate(speed);
    const txt = document.getElementById("speedTxt");
    if (txt) txt.textContent = speed === 1 ? "Normal" : speed + "x";
    const menu = document.getElementById("speedMenu");
    if (menu) menu.classList.remove("show");
  }
};

window.toggleFullScreen = function () {
  const container = document.getElementById("videoContainer");
  if (!container) return;

  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (container.requestFullscreen) {
      container.requestFullscreen().catch((e) => console.log(e));
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
};

window.handleOverlayTouch = function () {
  const overlay = document.getElementById("customOverlay");
  if (!overlay) return;

  if (overlay.classList.contains("hide-controls")) {
    overlay.classList.remove("hide-controls");
    startControlsTimer();
  } else {
    overlay.classList.add("hide-controls");
    clearTimeout(controlsTimeout);
  }
};

window.closeVideo = function () {
  const current = getPlayerCurrentTime();
  const total = getPlayerDuration();

  if (playbackSessionStarted && total > 0) {
    watchProgressEngine.touchPlayback(current, total, {
      force: true,
      reason: "closed"
    });
  }

  watchProgressEngine.endSession("closed");
  clearInterval(timeUpdateInterval);

  const popup = document.getElementById("videoPopup");
  const playerIframe = document.getElementById("youtubePlayer");
  if (popup) popup.style.display = "none";
  if (playerIframe) playerIframe.src = "";
  document.body.style.overflow = "auto";

  if (ytPlayer && typeof ytPlayer.stopVideo === "function") {
    ytPlayer.stopVideo();
  }

  currentVideoId = null;
  playbackSessionStarted = false;

  if (typeof window.onPlayerClosed === "function") {
    window.onPlayerClosed();
  }

  if (screen.orientation && screen.orientation.unlock) {
    screen.orientation.unlock();
  }
};

// Fullscreen rotate screen listeners
const handleFullscreenChange = async () => {
  const playerIframe = document.getElementById("youtubePlayer");
  const fsBtn = document.getElementById("fsBtn");
  const isFS = document.fullscreenElement || document.webkitFullscreenElement;

  if (isFS) {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape").catch((e) => console.log(e));
      }
      if (playerIframe) playerIframe.classList.add("fullscreen");
      if (fsBtn) fsBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
      startControlsTimer();
    } catch (err) {
      console.log("Fullscreen Entry Orientation lock error:", err);
    }
  } else {
    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
      if (playerIframe) playerIframe.classList.remove("fullscreen");
      if (fsBtn) fsBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
      startControlsTimer();
    } catch (err) {
      console.log(err);
    }
  }
};

document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

// Visibility monitoring window events
document.addEventListener("visibilitychange", () => {
  if (document.hidden && typeof window.closeVideo === "function" && currentVideoId !== null) {
    window.closeVideo();
  }
});

// Click outside videoPopup to close the player
document.addEventListener("click", (e) => {
  const videoPopup = document.getElementById("videoPopup");
  if (e.target === videoPopup) {
    window.closeVideo();
  }
});
