import { db, auth } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { watchProgressEngine } from "./analytics-engine.js";
import { playVideo } from "./player-core.js";

const API_KEY = "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE";
const MIN_DURATION_SECONDS = 300; // 5 minutes
const COMPLETION_THRESHOLD = 95; // 95%
const INITIAL_CHANNELS_TO_PROCESS = 3; // Process first 3 channels immediately (reduced from 5)
const INITIAL_VIDEOS_PER_CHANNEL = 5; // Fetch only 5 videos per channel initially (reduced from 10)
const PARALLEL_BATCH_SIZE = 2; // Process 2 channels in parallel (reduced from 3 for faster initial load)

// Feed State
let allChannels = [];
let channelVideoMaps = new Map(); // channelId -> array of video objects
let channelCurrentIndexes = new Map(); // channelId -> current video index
let completedVideoIds = new Set();
let feedRound = 0;
let isLoading = false;
let feedContainer = null;
let loadMoreTrigger = null;
let intersectionObserver = null;
let isInitialized = false;
let channelFetchStatus = new Map(); // channelId -> 'pending', 'fetching', 'complete'
let videoCache = new Map(); // videoId -> video object (for deduplication)

// Initialize the All Channels Feed
export async function initAllChannelsFeed() {
  // Prevent duplicate initialization
  if (isInitialized) {
    console.log("All Channels Feed already initialized");
    return;
  }

  feedContainer = document.getElementById("allChannelsFeedContent");
  loadMoreTrigger = document.getElementById("allChannelsLoadMoreTrigger");
  
  if (!feedContainer) {
    console.error("All Channels Feed container not found");
    return;
  }

  // Initialize watch progress engine
  watchProgressEngine.init({ source: "all-channels-feed" });

  // Start completed videos loading in background (don't block)
  const completedVideosPromise = watchProgressEngine.getCompletedVideoIds()
    .then(ids => { completedVideoIds = ids; })
    .catch(error => { console.error("Error loading completed video IDs:", error); });

  // Fetch all enabled channels (this is the critical path)
  await fetchAllChannels();

  // Set up infinite scroll
  setupInfiniteScroll();

  // Start progressive loading immediately without waiting for completed videos
  loadInitialProgressiveContent();

  // Complete completed videos loading in background
  await completedVideosPromise;

  isInitialized = true;
}

// Fetch all enabled channels from Firestore
async function fetchAllChannels() {
  try {
    const q = query(collection(db, "channels"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    allChannels = [];
    snapshot.forEach((docSnap) => {
      const channel = docSnap.data();
      if (channel.enabled === true) {
        allChannels.push({
          id: docSnap.id,
          ...channel
        });
      }
    });

    // Initialize video maps for each channel
    allChannels.forEach(channel => {
      channelVideoMaps.set(channel.channelId, []);
      channelCurrentIndexes.set(channel.channelId, 0);
      channelFetchStatus.set(channel.channelId, 'pending');
    });

  } catch (error) {
    console.error("Error fetching channels:", error);
    showEmptyState("Error loading channels");
  }
}

// Load initial content progressively for fast first render
async function loadInitialProgressiveContent() {
  showLoader();
  
  try {
    // Process first batch of channels in parallel for fast initial load
    const initialChannels = allChannels.slice(0, INITIAL_CHANNELS_TO_PROCESS);
    const firstRoundVideos = [];
    
    // Pre-fetch video data for initial channels in parallel
    const prefetchPromises = initialChannels.map(channel => 
      prefetchChannelVideos(channel, INITIAL_VIDEOS_PER_CHANNEL)
    );
    
    await Promise.all(prefetchPromises);
    
    // Now get one video from each channel in round-robin order
    for (const channel of initialChannels) {
      const video = await getNextEligibleVideo(channel);
      if (video) {
        firstRoundVideos.push(video);
        const currentIndex = channelCurrentIndexes.get(channel.channelId) || 0;
        channelCurrentIndexes.set(channel.channelId, currentIndex + 1);
      }
    }
    
    // Render first batch immediately
    if (firstRoundVideos.length > 0) {
      renderVideos(firstRoundVideos);
      feedRound++;
    }
    
    hideLoader();
    
    // Continue loading remaining channels in background
    setTimeout(() => loadRemainingChannelsInBackground(), 100);
    
  } catch (error) {
    console.error("Error loading initial progressive content:", error);
    hideLoader();
  }
}

// Pre-fetch channel videos without processing
async function prefetchChannelVideos(channel, limit) {
  const channelId = channel.channelId;
  const status = channelFetchStatus.get(channelId) || 'pending';
  
  if (status !== 'pending') return;
  
  channelFetchStatus.set(channelId, 'fetching');
  
  try {
    let playlistId = "";
    let sourceType = "channel";

    if (channel.sourceType === "playlist" && channel.playlistId) {
      playlistId = channel.playlistId;
      sourceType = "playlist";
    } else {
      playlistId = channel.uploadsPlaylistId;
      sourceType = "channel";
    }

    if (!playlistId) return;

    if (sourceType === "playlist") {
      await fetchPlaylistVideosWithLimit(channel, playlistId, limit);
    } else {
      await fetchChannelVideosFromAPIWithLimit(channel, playlistId, limit);
    }
    
    channelFetchStatus.set(channelId, 'complete');
  } catch (error) {
    console.error(`Error prefetching channel ${channelId}:`, error);
    channelFetchStatus.set(channelId, 'error');
  }
}

// Load remaining channels in background after initial render
async function loadRemainingChannelsInBackground() {
  const remainingChannels = allChannels.slice(INITIAL_CHANNELS_TO_PROCESS);
  
  // Pre-fetch all remaining channels in parallel batches
  for (let i = 0; i < remainingChannels.length; i += PARALLEL_BATCH_SIZE) {
    const batch = remainingChannels.slice(i, i + PARALLEL_BATCH_SIZE);
    
    // Pre-fetch without blocking
    Promise.all(
      batch.map(channel => prefetchChannelVideos(channel, INITIAL_VIDEOS_PER_CHANNEL))
    ).then(() => {
      // After prefetch, get one video from each channel
      const roundVideos = [];
      batch.forEach(channel => {
        const video = getNextEligibleVideoSync(channel);
        if (video) {
          roundVideos.push(video);
          const currentIndex = channelCurrentIndexes.get(channel.channelId) || 0;
          channelCurrentIndexes.set(channel.channelId, currentIndex + 1);
        }
      });
      
      if (roundVideos.length > 0) {
        renderVideos(roundVideos);
        feedRound++;
      }
    }).catch(error => {
      console.error("Error loading background channel batch:", error);
    });
  }
}

// Synchronous version of getNextEligibleVideo for background processing
function getNextEligibleVideoSync(channel) {
  const channelId = channel.channelId;
  const videos = channelVideoMaps.get(channelId) || [];
  const currentIndex = channelCurrentIndexes.get(channelId) || 0;

  // Get updated videos array
  const updatedVideos = channelVideoMaps.get(channelId) || [];
  const updatedIndex = channelCurrentIndexes.get(channelId) || 0;

  // Find next eligible video starting from current index
  for (let i = updatedIndex; i < updatedVideos.length; i++) {
    const video = updatedVideos[i];
    
    // Apply filters
    if (isVideoEligible(video)) {
      // Update index to this position
      channelCurrentIndexes.set(channelId, i);
      return video;
    }
  }

  // No eligible video found in current batch
  return null;
}

// Load next round of videos using round-robin algorithm
async function loadNextRound() {
  if (isLoading) return;
  isLoading = true;

  // Only show loader for first round
  if (feedRound === 0) {
    showLoader();
  }

  try {
    const roundVideos = [];
    
    // Round-robin: fetch one video from each channel (use optimized fetching)
    for (const channel of allChannels) {
      const video = await getNextEligibleVideo(channel);
      if (video) {
        roundVideos.push(video);
        // Increment index for this channel
        const currentIndex = channelCurrentIndexes.get(channel.channelId) || 0;
        channelCurrentIndexes.set(channel.channelId, currentIndex + 1);
      }
    }

    if (roundVideos.length === 0 && feedRound === 0) {
      showEmptyState("No videos available");
      hideLoader();
      isLoading = false;
      return;
    }

    // Render videos
    renderVideos(roundVideos);
    feedRound++;

  } catch (error) {
    console.error("Error loading next round:", error);
  } finally {
    hideLoader();
    isLoading = false;
  }
}

// Get next eligible video from a channel (with filtering)
async function getNextEligibleVideo(channel) {
  const channelId = channel.channelId;
  const videos = channelVideoMaps.get(channelId) || [];
  const currentIndex = channelCurrentIndexes.get(channelId) || 0;

  // If we don't have videos loaded for this channel yet, fetch them
  if (videos.length === 0 || currentIndex >= videos.length) {
    await fetchChannelVideos(channel);
  }

  // Get updated videos array
  const updatedVideos = channelVideoMaps.get(channelId) || [];
  const updatedIndex = channelCurrentIndexes.get(channelId) || 0;

  // Find next eligible video starting from current index
  for (let i = updatedIndex; i < updatedVideos.length; i++) {
    const video = updatedVideos[i];
    
    // Apply filters
    if (isVideoEligible(video)) {
      // Update index to this position
      channelCurrentIndexes.set(channelId, i);
      return video;
    }
  }

  // No eligible video found in current batch
  return null;
}

// Get next eligible video with initial limit for progressive loading
async function getNextEligibleVideoWithLimit(channel, limit) {
  const channelId = channel.channelId;
  const videos = channelVideoMaps.get(channelId) || [];
  const currentIndex = channelCurrentIndexes.get(channelId) || 0;
  const status = channelFetchStatus.get(channelId) || 'pending';

  // If prefetch is in progress, wait for it
  if (status === 'fetching') {
    await new Promise(resolve => setTimeout(resolve, 50));
    return getNextEligibleVideoWithLimit(channel, limit);
  }

  // If we don't have videos loaded for this channel yet, fetch limited batch
  if (videos.length === 0 || currentIndex >= videos.length) {
    if (status === 'pending') {
      channelFetchStatus.set(channelId, 'fetching');
      await fetchChannelVideosWithLimit(channel, limit);
      channelFetchStatus.set(channelId, 'complete');
    }
  }

  // Get updated videos array
  const updatedVideos = channelVideoMaps.get(channelId) || [];
  const updatedIndex = channelCurrentIndexes.get(channelId) || 0;

  // Find next eligible video starting from current index
  for (let i = updatedIndex; i < updatedVideos.length; i++) {
    const video = updatedVideos[i];
    
    // Apply filters
    if (isVideoEligible(video)) {
      // Update index to this position
      channelCurrentIndexes.set(channelId, i);
      return video;
    }
  }

  // No eligible video found in current batch
  return null;
}

// Fetch videos for a specific channel (reusing channel.js logic)
async function fetchChannelVideos(channel) {
  try {
    const channelId = channel.channelId;
    let playlistId = "";
    let sourceType = "channel";

    // Determine source type
    if (channel.sourceType === "playlist" && channel.playlistId) {
      playlistId = channel.playlistId;
      sourceType = "playlist";
    } else {
      playlistId = channel.uploadsPlaylistId;
      sourceType = "channel";
    }

    if (!playlistId) {
      console.warn(`No playlist ID for channel ${channelId}`);
      return;
    }

    // Fetch videos based on source type
    if (sourceType === "playlist") {
      await fetchPlaylistVideos(channel, playlistId);
    } else {
      await fetchChannelVideosFromAPI(channel, playlistId);
    }

  } catch (error) {
    console.error(`Error fetching videos for channel ${channel.channelId}:`, error);
  }
}

// Fetch videos for a specific channel with limit for progressive loading
async function fetchChannelVideosWithLimit(channel, limit) {
  try {
    const channelId = channel.channelId;
    let playlistId = "";
    let sourceType = "channel";

    // Determine source type
    if (channel.sourceType === "playlist" && channel.playlistId) {
      playlistId = channel.playlistId;
      sourceType = "playlist";
    } else {
      playlistId = channel.uploadsPlaylistId;
      sourceType = "channel";
    }

    if (!playlistId) {
      console.warn(`No playlist ID for channel ${channelId}`);
      return;
    }

    // Fetch videos based on source type with limit
    if (sourceType === "playlist") {
      await fetchPlaylistVideosWithLimit(channel, playlistId, limit);
    } else {
      await fetchChannelVideosFromAPIWithLimit(channel, playlistId, limit);
    }

  } catch (error) {
    console.error(`Error fetching videos for channel ${channel.channelId}:`, error);
  }
}

// Fetch playlist videos (reusing channel.js playlist logic)
async function fetchPlaylistVideos(channel, playlistId) {
  const allItems = [];
  let pageToken = "";

  try {
    // Fetch all pages
    do {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${pageToken}&key=${API_KEY}`
      );
      if (!response.ok) break;
      
      const data = await response.json();
      if (!data.items) break;

      // Sanitize items
      const sanitized = sanitizePlaylistItems(data.items);
      allItems.push(...sanitized);
      
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    // Reverse to get newest first
    const reversedItems = [...allItems].reverse();

    // Fetch video details in batches
    const videos = [];
    const batchSize = 50;
    
    for (let i = 0; i < reversedItems.length; i += batchSize) {
      const batch = reversedItems.slice(i, i + batchSize);
      const videoIds = batch.map(item => item.snippet.resourceId.videoId).join(",");
      
      const detailsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds}&key=${API_KEY}`
      );
      const detailsData = await detailsResponse.json();
      
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const details = detailsData.items?.[j];
        
        if (!details || !details.contentDetails) continue;
        
        const video = createVideoObject(item, details, channel);
        if (video) {
          videos.push(video);
        }
      }
    }

    // Store videos in map
    channelVideoMaps.set(channel.channelId, videos);

  } catch (error) {
    console.error("Error fetching playlist videos:", error);
  }
}

// Fetch playlist videos with limit for progressive loading
async function fetchPlaylistVideosWithLimit(channel, playlistId, limit) {
  const allItems = [];
  let pageToken = "";

  try {
    // Fetch only first page or up to limit
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${Math.min(limit, 50)}&pageToken=${pageToken}&key=${API_KEY}`
    );
    if (!response.ok) return;
    
    const data = await response.json();
    if (!data.items) return;

    // Sanitize items
    const sanitized = sanitizePlaylistItems(data.items);
    allItems.push(...sanitized.slice(0, limit));

    // Reverse to get newest first
    const reversedItems = [...allItems].reverse();

    // Fetch video details in batches
    const videos = [];
    const batchSize = 50;
    
    for (let i = 0; i < reversedItems.length; i += batchSize) {
      const batch = reversedItems.slice(i, i + batchSize);
      const videoIds = batch.map(item => item.snippet.resourceId.videoId).join(",");
      
      const detailsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds}&key=${API_KEY}`
      );
      const detailsData = await detailsResponse.json();
      
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const details = detailsData.items?.[j];
        
        if (!details || !details.contentDetails) continue;
        
        const video = createVideoObject(item, details, channel);
        if (video) {
          videos.push(video);
        }
      }
    }

    // Store videos in map
    channelVideoMaps.set(channel.channelId, videos);

  } catch (error) {
    console.error("Error fetching playlist videos with limit:", error);
  }
}

// Fetch channel videos from API (reusing channel.js logic)
async function fetchChannelVideosFromAPI(channel, playlistId) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${API_KEY}`
    );
    if (!response.ok) return;

    const data = await response.json();
    if (!data.items) return;

    const items = data.items;
    const videoIds = items.map(item => item.snippet.resourceId.videoId).join(",");

    const detailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds}&key=${API_KEY}`
    );
    const detailsData = await detailsResponse.json();

    const videos = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const details = detailsData.items?.[i];

      if (!details || !details.contentDetails) continue;

      const video = createVideoObject(item, details, channel);
      if (video) {
        videos.push(video);
      }
    }

    // Store videos in map
    channelVideoMaps.set(channel.channelId, videos);

  } catch (error) {
    console.error("Error fetching channel videos:", error);
  }
}

// Fetch channel videos from API with limit for progressive loading
async function fetchChannelVideosFromAPIWithLimit(channel, playlistId, limit) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${Math.min(limit, 50)}&key=${API_KEY}`
    );
    if (!response.ok) return;

    const data = await response.json();
    if (!data.items) return;

    const items = data.items.slice(0, limit);
    const videoIds = items.map(item => item.snippet.resourceId.videoId).join(",");

    const detailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds}&key=${API_KEY}`
    );
    const detailsData = await detailsResponse.json();

    const videos = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const details = detailsData.items?.[i];

      if (!details || !details.contentDetails) continue;

      const video = createVideoObject(item, details, channel);
      if (video) {
        videos.push(video);
      }
    }

    // Store videos in map
    channelVideoMaps.set(channel.channelId, videos);

  } catch (error) {
    console.error("Error fetching channel videos with limit:", error);
  }
}

// Sanitize playlist items (reusing channel.js logic)
function sanitizePlaylistItems(items) {
  const sanitized = [];
  const seenVideoIds = new Set();
  
  for (const item of items) {
    if (!item?.snippet?.resourceId?.videoId) continue;
    if (!item?.snippet?.title) continue;
    
    const videoId = item.snippet.resourceId.videoId;
    const title = item.snippet.title.toLowerCase();
    
    if (seenVideoIds.has(videoId)) continue;
    
    // Filter out private/deleted videos
    if (title.includes('private video') || 
        title.includes('deleted video') || 
        title.includes('unavailable') ||
        title.includes('this video is unavailable') ||
        title.includes('this video is private')) {
      continue;
    }
    
    const hasThumbnail = item.snippet.thumbnails && (
      item.snippet.thumbnails.maxres?.url ||
      item.snippet.thumbnails.high?.url ||
      item.snippet.thumbnails.standard?.url ||
      item.snippet.thumbnails.medium?.url ||
      item.snippet.thumbnails.default?.url
    );
    
    if (!hasThumbnail) continue;
    
    sanitized.push(item);
    seenVideoIds.add(videoId);
  }
  
  return sanitized;
}

// Create video object from API data
function createVideoObject(item, details, channel) {
  const videoId = item.snippet.resourceId.videoId;
  const duration = details.contentDetails.duration;
  const seconds = convertDurationToSeconds(duration);

  // Get thumbnail with fallback
  const thumbnailUrl = item.snippet.thumbnails?.maxres?.url ||
                      item.snippet.thumbnails?.high?.url || 
                      item.snippet.thumbnails?.standard?.url ||
                      item.snippet.thumbnails?.medium?.url || 
                      item.snippet.thumbnails?.default?.url;

  const viewCount = details.statistics?.viewCount ? formatViewCount(details.statistics.viewCount) : "0 views";
  const publishedAt = details.snippet?.publishedAt ? formatTimeAgo(details.snippet.publishedAt) : "";

  return {
    videoId,
    videoTitle: item.snippet.title,
    title: item.snippet.title,
    channelId: channel.channelId,
    channelName: channel.channelName,
    channelLogo: channel.channelLogo,
    thumbnailUrl: thumbnailUrl,
    duration: seconds,
    viewCount: viewCount,
    publishedAt: publishedAt
  };
}

// Check if video is eligible for feed (applies all filters)
function isVideoEligible(video) {
  // Filter 1: Video exists and has valid data
  if (!video || !video.videoId) return false;

  // Filter 2: Duration >= 5 minutes
  if (video.duration < MIN_DURATION_SECONDS) return false;

  // Filter 3: Not already completed
  if (completedVideoIds.has(video.videoId)) return false;

  // Filter 4: Valid thumbnail
  if (!video.thumbnailUrl) return false;

  return true;
}

// Render videos to feed (reusing channel.js video card markup)
function renderVideos(videos) {
  if (!feedContainer) return;

  // Create container if it doesn't exist
  if (!feedContainer.querySelector('.all-channels-videos-container')) {
    const container = document.createElement('div');
    container.className = 'all-channels-videos-container';
    feedContainer.appendChild(container);
  }

  const container = feedContainer.querySelector('.all-channels-videos-container');

  // Use document fragment for better performance
  const fragment = document.createDocumentFragment();
  
  videos.forEach(video => {
    // Skip duplicates using cache
    if (videoCache.has(video.videoId)) return;
    videoCache.set(video.videoId, video);
    
    const videoCard = createVideoCard(video);
    fragment.appendChild(videoCard);
  });
  
  container.appendChild(fragment);
}

// Create video card element (reusing channel.js exact markup)
function createVideoCard(video) {
  const videoId = escapeHtml(video.videoId);
  const thumbnailUrl = escapeHtml(video.thumbnailUrl);
  const title = escapeHtml(video.videoTitle);
  const channelName = escapeHtml(video.channelName);
  const channelLogo = escapeHtml(video.channelLogo || "");
  const viewCount = escapeHtml(video.viewCount);
  const publishedAt = escapeHtml(video.publishedAt);

  const card = document.createElement('div');
  card.className = 'video-card';
  card.onclick = () => openVideoFromFeed(video);

  card.innerHTML = `
    <div class="video-thumbnail-wrapper">
      <img src="${thumbnailUrl}" class="video-thumbnail" loading="lazy" alt="${title}">
    </div>
    <div class="video-metadata-row">
      <div class="channel-avatar">
        ${channelLogo ? `<img src="${channelLogo}" alt="${channelName}">` : `<span>${channelName.charAt(0).toUpperCase()}</span>`}
      </div>
      <div class="video-info-section">
        <h3 class="video-title">${title}</h3>
        <div class="video-meta-line">
          <span class="channel-name">${channelName}</span>
          <span class="separator">•</span>
          <span class="view-count">${viewCount}</span>
          <span class="separator">•</span>
          <span class="publish-time">${publishedAt}</span>
        </div>
      </div>
      <div class="video-menu-btn" onclick="event.stopPropagation(); window.shareVideo('${videoId}')">
        <i class="fa-solid fa-ellipsis-vertical"></i>
      </div>
    </div>
  `;

  return card;
}

// Open video from feed (reusing player-core.js)
function openVideoFromFeed(video) {
  const videoMeta = {
    videoId: video.videoId,
    videoTitle: video.videoTitle,
    title: video.videoTitle,
    channelId: video.channelId,
    channelName: video.channelName,
    thumbnailUrl: video.thumbnailUrl,
    duration: video.duration
  };

  playVideo(video.videoId, videoMeta, false);
}

// Setup infinite scroll using IntersectionObserver
function setupInfiniteScroll() {
  if (!loadMoreTrigger) return;

  intersectionObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading) {
      loadNextRound();
    }
  }, { threshold: 0.1, rootMargin: '500px' }); // Increased margin for earlier preloading

  intersectionObserver.observe(loadMoreTrigger);
}

// Helper functions (reusing from channel.js)
function convertDurationToSeconds(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function formatViewCount(count) {
  const num = parseInt(count);
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B views';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M views';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K views';
  }
  return num + ' views';
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }

  return 'Just now';
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Share video function is now defined in script.js for global availability

// UI Helpers
function showLoader() {
  const loader = document.querySelector('.all-channels-feed-loader');
  if (loader) loader.style.display = 'flex';
}

function hideLoader() {
  const loader = document.querySelector('.all-channels-feed-loader');
  if (loader) loader.style.display = 'none';
}

function showEmptyState(message) {
  if (!feedContainer) return;
  feedContainer.innerHTML = `
    <div class="all-channels-feed-empty">
      <i class="fa-solid fa-video-slash"></i>
      <h3>${message}</h3>
      <p>Check back later for new content</p>
    </div>
  `;
}

// Export for use in script.js
export { openVideoFromFeed };