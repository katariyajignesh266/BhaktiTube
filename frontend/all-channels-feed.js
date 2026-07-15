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
import { smartFeedScheduler } from "./smart-feed-scheduler.js";
import { YOUTUBE_API_KEY, APP_CONFIG } from "./config.js";

const API_KEY = YOUTUBE_API_KEY;
const MIN_DURATION_SECONDS = APP_CONFIG.MIN_DURATION_SECONDS;
const COMPLETION_THRESHOLD = APP_CONFIG.COMPLETION_THRESHOLD;
const INITIAL_CHANNELS_TO_PROCESS = APP_CONFIG.INITIAL_CHANNELS_TO_PROCESS;
const INITIAL_VIDEOS_PER_CHANNEL = APP_CONFIG.INITIAL_VIDEOS_PER_CHANNEL;
const PARALLEL_BATCH_SIZE = APP_CONFIG.PARALLEL_BATCH_SIZE;

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
async function initAllChannelsFeed() {
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

  // Initialize smart feed scheduler
  await smartFeedScheduler.init();

  // Set up global integration function
  window.handleFeedVideoProgress = handleVideoProgress;
  window.handleFeedVideoCompletion = handleVideoCompletion;

  // Start completed videos loading in background (don't block)
  const completedVideosPromise = watchProgressEngine.getCompletedVideoIds()
    .then(ids => { completedVideoIds = ids; })
    .catch(error => { console.error("Error loading completed video IDs:", error); });

  // Fetch all enabled channels (this is the critical path)
  await fetchAllChannels();

  // Set up infinite scroll
  setupInfiniteScroll();

  // Start smart feed loading
  loadSmartFeed();

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

// Load smart feed using the new scheduler
async function loadSmartFeed() {
  showLoader();
  
  try {
    // Check if we need to generate a new daily feed (checks day changes)
    const hasExistingFeed = await smartFeedScheduler.loadDailyFeed();
    
    if (hasExistingFeed && smartFeedScheduler.todayFeed.length > 0) {
      console.log(`[Fast Load] Regenerating feed from cached videos (${smartFeedScheduler.todayFeed.length} videos) to vary order...`);
      
      // Populate allAvailableVideos with cached feed so scheduler can regenerate from it
      smartFeedScheduler.setAvailableVideos(smartFeedScheduler.todayFeed);
      
      // Regenerate the feed using the cached videos (this filters completed/cooldown and re-ranks/re-shuffles)
      await smartFeedScheduler.regenerateFeed();
      
      // Render first batch immediately from the newly regenerated cache
      smartFeedScheduler.resetBatchIndex();
      const firstBatch = smartFeedScheduler.getNextBatch();
      
      if (firstBatch.length > 0) {
        renderVideos(firstBatch);
        
        // Mark videos as shown
        firstBatch.forEach(video => {
          smartFeedScheduler.setVideoState(video.videoId, smartFeedScheduler.VideoState.SHOWN);
          smartFeedScheduler.addToChannelHistory(video.channelId);
        });
      }
      hideLoader();
      
      // Fetch all channels in background to update available pool in scheduler
      fetchAndRefreshFeedInBackground();
      return;
    }
    
    console.log("[Fast Load] No existing feed, performing progressive load...");
    
    // Fetch only priority channels first for rapid initial render (takes ~500ms)
    const priorityChannels = allChannels.slice(0, INITIAL_CHANNELS_TO_PROCESS);
    const backgroundChannels = allChannels.slice(INITIAL_CHANNELS_TO_PROCESS);
    
    // Fetch priority channels in parallel (limit = 20 for faster startup)
    const priorityPromises = priorityChannels.map(channel => 
      prefetchChannelVideos(channel, 20)
    );
    await Promise.all(priorityPromises);
    
    // Collect videos from priority channels
    const priorityVideos = [];
    priorityChannels.forEach(channel => {
      const videos = channelVideoMaps.get(channel.channelId) || [];
      priorityVideos.push(...videos);
    });
    
    const eligiblePriorityVideos = priorityVideos.filter(isVideoEligible);
    console.log(`[Fast Load] Priority channels loaded: ${eligiblePriorityVideos.length} videos`);
    
    if (eligiblePriorityVideos.length > 0) {
      // Set in scheduler and generate initial feed
      smartFeedScheduler.setAvailableVideos(eligiblePriorityVideos);
      await smartFeedScheduler.generateDailyFeed(eligiblePriorityVideos);
      
      // Render first batch immediately
      smartFeedScheduler.resetBatchIndex();
      const firstBatch = smartFeedScheduler.getNextBatch();
      
      if (firstBatch.length > 0) {
        renderVideos(firstBatch);
        
        // Mark videos as shown
        firstBatch.forEach(video => {
          smartFeedScheduler.setVideoState(video.videoId, smartFeedScheduler.VideoState.SHOWN);
          smartFeedScheduler.addToChannelHistory(video.channelId);
        });
      }
      hideLoader();
    } else {
      // Fallback if priority channels returned nothing (e.g. empty or offline)
      console.log("[Fast Load] Priority channels empty, fallback to full loader");
    }
    
    // Fetch all channels (including background ones) in background to build complete feed
    fetchRemainingChannelsInBackground(backgroundChannels);
    
  } catch (error) {
    console.error("Error loading smart feed:", error);
    showEmptyState("Error loading feed");
    hideLoader();
  }
}

// Background fetch helper to restore available pool for cached feeds
async function fetchAndRefreshFeedInBackground() {
  try {
    console.log("[Fast Load] Fetching all channels in the background...");
    const allVideos = await fetchAllVideosFromChannels();
    console.log(`[Fast Load] Background fetch completed: ${allVideos.length} videos`);
    
    const eligibleVideos = allVideos.filter(isVideoEligible);
    smartFeedScheduler.setAvailableVideos(eligibleVideos);
    
    // Always regenerate feed with fresh API videos in the background
    console.log("[Fast Load] Regenerating feed in background with fresh API videos...");
    await smartFeedScheduler.generateDailyFeed(eligibleVideos);
    smartFeedScheduler.resetBatchIndex();
  } catch (error) {
    console.error("[Fast Load] Error in background feed refresh:", error);
  }
}

// Background fetch helper to finish progressive loading
async function fetchRemainingChannelsInBackground(backgroundChannels) {
  try {
    console.log(`[Fast Load] Fetching remaining ${backgroundChannels.length} channels in the background...`);
    
    // Fetch background channels in parallel batches
    const PARALLEL_BATCH_SIZE_BG = 4;
    for (let i = 0; i < backgroundChannels.length; i += PARALLEL_BATCH_SIZE_BG) {
      const batch = backgroundChannels.slice(i, i + PARALLEL_BATCH_SIZE_BG);
      const prefetchPromises = batch.map(channel => 
        prefetchChannelVideos(channel, 50)
      );
      await Promise.all(prefetchPromises);
    }
    
    // Collect all videos from all channels
    const allVideos = [];
    allChannels.forEach(channel => {
      const videos = channelVideoMaps.get(channel.channelId) || [];
      allVideos.push(...videos);
    });
    
    const eligibleVideos = allVideos.filter(isVideoEligible);
    console.log(`[Fast Load] Background loading completed. Total eligible videos: ${eligibleVideos.length}`);
    
    // Update available pool in scheduler
    smartFeedScheduler.setAvailableVideos(eligibleVideos);
    
    // Regenerate daily feed using all eligible videos
    await smartFeedScheduler.generateDailyFeed(eligibleVideos);
    
    // Reset the batch index so that new scrolling batches skip session-shown videos and pull from the full feed
    smartFeedScheduler.resetBatchIndex();
    
    console.log(`[Fast Load] Smart Feed fully loaded and balanced with ${eligibleVideos.length} videos`);
  } catch (error) {
    console.error("[Fast Load] Error fetching background channels:", error);
  }
}

// Fetch all videos from all channels
async function fetchAllVideosFromChannels() {
  const allVideos = [];
  
  // Pre-fetch all channels in parallel batches
  for (let i = 0; i < allChannels.length; i += PARALLEL_BATCH_SIZE) {
    const batch = allChannels.slice(i, i + PARALLEL_BATCH_SIZE);
    
    const prefetchPromises = batch.map(channel => 
      prefetchChannelVideos(channel, 50) // Fetch more videos for better feed generation
    );
    
    await Promise.all(prefetchPromises);
    
    // Collect videos from these channels
    batch.forEach(channel => {
      const videos = channelVideoMaps.get(channel.channelId) || [];
      allVideos.push(...videos);
    });
  }
  
  return allVideos;
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


// Load next batch using smart feed scheduler
async function loadNextBatch() {
  if (isLoading) return;
  isLoading = true;

  try {
    // Get next batch from smart feed scheduler
    const nextBatch = smartFeedScheduler.getNextBatch();
    
    if (nextBatch.length === 0) {
      // No more videos in current feed
      if (!smartFeedScheduler.hasMoreBatches()) {
        console.log('Feed exhausted, regenerating with remaining videos...');
        
        // Use scheduler's built-in regeneration
        const regeneratedFeed = await smartFeedScheduler.regenerateFeed();
        
        if (regeneratedFeed.length > 0) {
          smartFeedScheduler.resetBatchIndex();
          
          // Try to get the first batch from regenerated feed
          const regeneratedBatch = smartFeedScheduler.getNextBatch();
          if (regeneratedBatch.length > 0) {
            renderVideos(regeneratedBatch);
            
            // Mark videos as shown
            regeneratedBatch.forEach(video => {
              smartFeedScheduler.setVideoState(video.videoId, smartFeedScheduler.VideoState.SHOWN);
              smartFeedScheduler.addToChannelHistory(video.channelId);
            });
            
            hideLoader();
            isLoading = false;
            return;
          }
        }
        
        console.log('No more videos available');
        if (intersectionObserver) {
          intersectionObserver.disconnect();
        }
        showEmptyState("No more videos in feed");
      }
      hideLoader();
      isLoading = false;
      return;
    }

    // Render videos
    renderVideos(nextBatch);
    
    // Mark videos as shown
    nextBatch.forEach(video => {
      smartFeedScheduler.setVideoState(video.videoId, smartFeedScheduler.VideoState.SHOWN);
      smartFeedScheduler.addToChannelHistory(video.channelId);
    });

    // Preload next batch in background
    smartFeedScheduler.preloadNextBatch();

  } catch (error) {
    console.error("Error loading next batch:", error);
  } finally {
    hideLoader();
    isLoading = false;
  }
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
      
      const detailsMap = new Map();
      if (detailsData.items) {
        detailsData.items.forEach(d => detailsMap.set(d.id, d));
      }
      
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const videoId = item.snippet?.resourceId?.videoId;
        if (!videoId) continue;
        const details = detailsMap.get(videoId);
        
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
      
      const detailsMap = new Map();
      if (detailsData.items) {
        detailsData.items.forEach(d => detailsMap.set(d.id, d));
      }
      
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const videoId = item.snippet?.resourceId?.videoId;
        if (!videoId) continue;
        const details = detailsMap.get(videoId);
        
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

    const detailsMap = new Map();
    if (detailsData.items) {
      detailsData.items.forEach(d => detailsMap.set(d.id, d));
    }

    const videos = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      const details = detailsMap.get(videoId);

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

    const detailsMap = new Map();
    if (detailsData.items) {
      detailsData.items.forEach(d => detailsMap.set(d.id, d));
    }

    const videos = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      const details = detailsMap.get(videoId);

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

  // Get video state for badges
  const videoState = smartFeedScheduler.getVideoState(video.videoId);
  const badges = generateVideoBadges(video, videoState);

  const card = document.createElement('div');
  card.className = 'video-card';
  card.setAttribute('data-video-id', videoId);
  card.onclick = () => openVideoFromFeed(video);

  card.innerHTML = `
    <div class="video-thumbnail-wrapper">
      <img src="${thumbnailUrl}" class="video-thumbnail" loading="lazy" alt="${title}">
      ${badges}
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

// Generate video badges based on state and metadata
function generateVideoBadges(video, videoState) {
  const badges = [];
  
  // Fresh upload badge (7 days)
  if (video.publishedAt) {
    const publishDate = new Date(video.publishedAt);
    const ageMs = Date.now() - publishDate.getTime();
    const FRESH_UPLOAD_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    if (ageMs < FRESH_UPLOAD_DURATION_MS) {
      badges.push('<span class="video-badge badge-fresh">FRESH TODAY</span>');
    }
  }
  
  // Continue watching badge
  if (videoState === smartFeedScheduler.VideoState.CONTINUE_WATCHING) {
    const progress = video.progress || 0;
    const progressPercent = Math.round(progress * 100);
    badges.push(`<span class="video-badge badge-continue">CONTINUE WATCHING ${progressPercent}%</span>`);
  }
  
  // New badge
  if (videoState === smartFeedScheduler.VideoState.NEW) {
    badges.push('<span class="video-badge badge-new">NEW</span>');
  }
  
  return badges.length > 0 ? `<div class="video-badges">${badges.join('')}</div>` : '';
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

  // Mark video as watching
  smartFeedScheduler.setVideoState(video.videoId, smartFeedScheduler.VideoState.WATCHING, videoMeta);

  playVideo(video.videoId, videoMeta, false);
}

// Handle video completion
async function handleVideoCompletion(videoId) {
  // Mark video as completed in smart feed scheduler
  await smartFeedScheduler.setVideoState(videoId, smartFeedScheduler.VideoState.COMPLETED);
  
  // Remove from feed if visible
  const videoCard = document.querySelector(`[data-video-id="${videoId}"]`);
  if (videoCard) {
    videoCard.style.opacity = '0.5';
    videoCard.style.pointerEvents = 'none';
  }
  
  console.log(`Video ${videoId} marked as completed`);
}

// Handle video progress for continue watching (called from analytics engine)
async function handleVideoProgress(videoId, currentPosition, duration) {
  const progress = currentPosition / duration;
  
  if (progress >= 0.1 && progress < 0.95) {
    // Video is in continue watching state
    await smartFeedScheduler.setVideoState(videoId, smartFeedScheduler.VideoState.CONTINUE_WATCHING, {
      videoId,
      currentPosition,
      duration,
      progress: progress
    });
  } else if (progress >= 0.95) {
    // Video is completed
    await smartFeedScheduler.setVideoState(videoId, smartFeedScheduler.VideoState.COMPLETED);
  }
}


// Setup infinite scroll using IntersectionObserver
function setupInfiniteScroll() {
  if (!loadMoreTrigger) return;

  intersectionObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading) {
      loadNextBatch();
    }
  }, { threshold: 0.1, rootMargin: '500px' }); // Increased margin for earlier preloading

  intersectionObserver.observe(loadMoreTrigger);
}

// Helper functions (reusing from channel.js)
function convertDurationToSeconds(duration) {
  if (!duration || typeof duration !== 'string') return 0;
  
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
export { openVideoFromFeed, handleVideoCompletion, handleVideoProgress, initAllChannelsFeed };