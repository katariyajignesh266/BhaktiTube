import { db, auth } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { APP_CONFIG } from "./config.js";

// Firebase Auth Ready Promise
let authReadyResolver;
const authReady = new Promise((resolve) => {
  authReadyResolver = resolve;
});

onAuthStateChanged(auth, (user) => {
  if (authReadyResolver) {
    authReadyResolver(user || null);
    authReadyResolver = null;
  } else {
    // Reload user-specific data dynamically on login/logout
    if (state.initialized) {
      reloadUserSpecificData();
    }
  }
});

async function waitForAuthReady() {
  if (auth.currentUser) return auth.currentUser;
  return authReady;
}

async function reloadUserSpecificData() {
  console.log('Smart Feed Scheduler: Reloading user-specific data...');
  await Promise.all([
    loadUserFeedQueue(),
    loadCooldownSystem(),
    loadVideoStates(),
    loadChannelHistory(),
    loadDailyFeed()
  ]);
  
  const engine = await getWatchProgressEngine();
  state.completedVideos = await engine.getCompletedVideoIds();
  console.log('Smart Feed Scheduler: User-specific data reloaded');
}

// Dynamic import to avoid circular dependency
let watchProgressEngine = null;

async function getWatchProgressEngine() {
  if (!watchProgressEngine) {
    const module = await import("./analytics-engine.js");
    watchProgressEngine = module.watchProgressEngine;
  }
  return watchProgressEngine;
}

/* ==========================================================================
   SMART FEED SCHEDULER - 7-LAYER ARCHITECTURE
   ==========================================================================

   Layer 1: Fresh Upload Priority
   Layer 2: Persistent User Feed Queue
   Layer 3: Cooldown System
   Layer 4: Video States (NEW, SHOWN, WATCHING, CONTINUE_WATCHING, COMPLETED)
   Layer 5: Feed Diversity
   Layer 6: Ignore Memory
   Layer 7: Daily Feed Generator

   Priority Engine:
   Score = Fresh Upload Score * Unseen Score * Continue Watching Score *
           Channel Diversity Score * Cooldown Expired Score * Recently Uploaded Score *
           Recently Shown Penalty * Ignore Count Penalty * Completed Penalty
   ========================================================================== */

// Configuration Constants
const CONFIG = APP_CONFIG;

// Video States
const VideoState = {
  NEW: 'new',
  SHOWN: 'shown',
  WATCHING: 'watching',
  CONTINUE_WATCHING: 'continue_watching',
  COMPLETED: 'completed'
};

// Feed Scheduler State
const state = {
  initialized: false,
  userFeedQueue: [],
  todayFeed: [],
  allAvailableVideos: [], // Store all fetched videos for regeneration
  continueWatching: [],
  ignoredVideos: new Map(), // videoId -> { count, lastIgnoredAt, cooldownUntil }
  cooldownVideos: new Map(), // videoId -> cooldownUntil
  recentlyShown: new Map(), // videoId -> { shownAt, expiresAt }
  completedVideos: new Set(),
  sessionShownVideos: new Set(), // Track videos shown in the current scroll session
  lastFeedGeneration: null,
  dailyFeedDate: null,
  feedVersion: 1,
  currentBatchIndex: 0,
  isGeneratingFeed: false,
  pendingVideos: [],
  channelHistory: [], // Track recent channels for diversity
  videoCache: new Map() // videoId -> video object
};

// Firestore Keys
const STORAGE_KEYS = {
  FEED_QUEUE: 'bt_feed_queue_v2',
  TODAY_FEED: 'bt_today_feed_v2',
  CONTINUE_WATCHING: 'bt_continue_watching_v2',
  IGNORED_VIDEOS: 'bt_ignored_videos_v2',
  COOLDOWN_VIDEOS: 'bt_cooldown_videos_v2',
  RECENTLY_SHOWN: 'bt_recently_shown_v2',
  LAST_FEED_GENERATION: 'bt_last_feed_generation_v2',
  DAILY_FEED_DATE: 'bt_daily_feed_date_v2',
  FEED_VERSION: 'bt_feed_version_v2',
  CHANNEL_HISTORY: 'bt_channel_history_v2',
  BATCH_INDEX: 'bt_current_batch_index_v2'
};

/* ==========================================================================
   LAYER 1: FRESH UPLOAD PRIORITY
   ========================================================================== */

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function parseViewCount(viewCountStr) {
  if (!viewCountStr || typeof viewCountStr !== 'string') return 0;
  const cleaned = viewCountStr.replace(/ views/gi, '').replace(/,/g, '').trim();
  const lastChar = cleaned.charAt(cleaned.length - 1).toUpperCase();
  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;
  if (lastChar === 'B') {
    return value * 1000000000;
  } else if (lastChar === 'M') {
    return value * 1000000;
  } else if (lastChar === 'K') {
    return value * 1000;
  }
  return value;
}

function calculateFreshUploadScore(video) {
  if (!video.publishedAt) return 1.0;
  
  const publishDate = new Date(video.publishedAt);
  const now = new Date();
  const ageMs = now - publishDate;
  
  if (ageMs < CONFIG.FRESH_UPLOAD_DURATION_MS) {
    // Fresh upload: higher score for newer videos
    const freshness = 1 - (ageMs / CONFIG.FRESH_UPLOAD_DURATION_MS);
    return 1.0 + (freshness * 2.0); // Score between 1.0 and 3.0
  }
  
  return 1.0; // Base score for older videos
}

/* ==========================================================================
   LAYER 2: PERSISTENT USER FEED QUEUE
   ========================================================================== */

async function loadUserFeedQueue() {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    const queueData = localStorage.getItem(`${STORAGE_KEYS.FEED_QUEUE}_${uid}`);
    
    if (queueData) {
      state.userFeedQueue = JSON.parse(queueData);
      console.log(`Loaded ${state.userFeedQueue.length} videos from persistent queue`);
    } else {
      state.userFeedQueue = [];
    }
  } catch (error) {
    console.error('Error loading user feed queue:', error);
    state.userFeedQueue = [];
  }
}

async function saveUserFeedQueue() {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    localStorage.setItem(`${STORAGE_KEYS.FEED_QUEUE}_${uid}`, JSON.stringify(state.userFeedQueue));
  } catch (error) {
    console.error('Error saving user feed queue:', error);
  }
}

async function addToFeedQueue(video) {
  if (!video || !video.videoId) return;
  
  // Check if already in queue
  const exists = state.userFeedQueue.some(v => v.videoId === video.videoId);
  if (exists) return;
  
  state.userFeedQueue.push({
    videoId: video.videoId,
    addedAt: Date.now(),
    ...video
  });
  
  await saveUserFeedQueue();
}

async function removeFromFeedQueue(videoId) {
  state.userFeedQueue = state.userFeedQueue.filter(v => v.videoId !== videoId);
  await saveUserFeedQueue();
}

async function updateVideoInQueue(videoId, updates) {
  const index = state.userFeedQueue.findIndex(v => v.videoId === videoId);
  if (index !== -1) {
    state.userFeedQueue[index] = { ...state.userFeedQueue[index], ...updates };
    await saveUserFeedQueue();
  }
}

/* ==========================================================================
   LAYER 3: COOLDOWN SYSTEM
   ========================================================================== */

async function loadCooldownSystem() {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    
    // Load cooldown videos
    const cooldownData = localStorage.getItem(`${STORAGE_KEYS.COOLDOWN_VIDEOS}_${uid}`);
    if (cooldownData) {
      const parsed = JSON.parse(cooldownData);
      state.cooldownVideos = new Map(Object.entries(parsed));
    }
    
    // Load ignored videos
    const ignoredData = localStorage.getItem(`${STORAGE_KEYS.IGNORED_VIDEOS}_${uid}`);
    if (ignoredData) {
      const parsed = JSON.parse(ignoredData);
      state.ignoredVideos = new Map(Object.entries(parsed));
    }
    
    // Clean up expired cooldowns
    await cleanupExpiredCooldowns();
  } catch (error) {
    console.error('Error loading cooldown system:', error);
  }
}

async function saveCooldownSystem() {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    
    localStorage.setItem(
      `${STORAGE_KEYS.COOLDOWN_VIDEOS}_${uid}`,
      JSON.stringify(Object.fromEntries(state.cooldownVideos))
    );
    
    localStorage.setItem(
      `${STORAGE_KEYS.IGNORED_VIDEOS}_${uid}`,
      JSON.stringify(Object.fromEntries(state.ignoredVideos))
    );
  } catch (error) {
    console.error('Error saving cooldown system:', error);
  }
}

async function cleanupExpiredCooldowns() {
  const now = Date.now();
  const expired = [];
  
  for (const [videoId, cooldownUntil] of state.cooldownVideos) {
    if (cooldownUntil < now) {
      expired.push(videoId);
    }
  }
  
  expired.forEach(videoId => {
    state.cooldownVideos.delete(videoId);
  });
  
  if (expired.length > 0) {
    await saveCooldownSystem();
    console.log(`Cleaned up ${expired.length} expired cooldowns`);
  }
}

async function markVideoAsIgnored(videoId) {
  const now = Date.now();
  const existing = state.ignoredVideos.get(videoId) || { count: 0, lastIgnoredAt: 0 };
  
  existing.count++;
  existing.lastIgnoredAt = now;
  
  // Calculate cooldown duration based on ignore count
  let cooldownDuration = CONFIG.COOLDOWN_DURATION_MS;
  if (existing.count >= CONFIG.IGNORE_THRESHOLD) {
    cooldownDuration = CONFIG.EXTENDED_COOLDOWN_MS;
  }
  
  existing.cooldownUntil = now + cooldownDuration;
  
  state.ignoredVideos.set(videoId, existing);
  state.cooldownVideos.set(videoId, existing.cooldownUntil);
  
  await saveCooldownSystem();
  console.log(`Video ${videoId} ignored ${existing.count} times, cooldown until ${new Date(existing.cooldownUntil).toISOString()}`);
}

function isVideoInCooldown(videoId) {
  const cooldownUntil = state.cooldownVideos.get(videoId);
  if (!cooldownUntil) return false;
  
  return cooldownUntil > Date.now();
}

/* ==========================================================================
   LAYER 4: VIDEO STATES
   ========================================================================== */

async function loadVideoStates() {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    
    // Load continue watching
    const continueWatchingData = localStorage.getItem(`${STORAGE_KEYS.CONTINUE_WATCHING}_${uid}`);
    if (continueWatchingData) {
      state.continueWatching = JSON.parse(continueWatchingData);
    }
    
    // Load recently shown
    const recentlyShownData = localStorage.getItem(`${STORAGE_KEYS.RECENTLY_SHOWN}_${uid}`);
    if (recentlyShownData) {
      const parsed = JSON.parse(recentlyShownData);
      state.recentlyShown = new Map(Object.entries(parsed));
    }
    
    // Load completed videos from analytics engine
    state.completedVideos = await getCompletedVideos();
    
    // Clean up expired recently shown
    await cleanupExpiredRecentlyShown();
  } catch (error) {
    console.error('Error loading video states:', error);
  }
}

async function saveVideoStates() {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    
    localStorage.setItem(
      `${STORAGE_KEYS.CONTINUE_WATCHING}_${uid}`,
      JSON.stringify(state.continueWatching)
    );
    
    localStorage.setItem(
      `${STORAGE_KEYS.RECENTLY_SHOWN}_${uid}`,
      JSON.stringify(Object.fromEntries(state.recentlyShown))
    );
  } catch (error) {
    console.error('Error saving video states:', error);
  }
}

async function cleanupExpiredRecentlyShown() {
  const now = Date.now();
  const expired = [];
  
  for (const [videoId, data] of state.recentlyShown) {
    if (data.expiresAt < now) {
      expired.push(videoId);
    }
  }
  
  expired.forEach(videoId => {
    state.recentlyShown.delete(videoId);
  });
  
  if (expired.length > 0) {
    await saveVideoStates();
  }
}

async function setVideoState(videoId, videoState, metadata = {}) {
  const now = Date.now();
  
  switch (videoState) {
    case VideoState.NEW:
      // New video - no special handling needed
      break;
      
    case VideoState.SHOWN:
      state.recentlyShown.set(videoId, {
        shownAt: now,
        expiresAt: now + CONFIG.RECENTLY_SHOWN_DURATION_MS
      });
      if (!state.sessionShownVideos) {
        state.sessionShownVideos = new Set();
      }
      state.sessionShownVideos.add(videoId);
      break;
      
    case VideoState.WATCHING:
      // Video is currently being watched
      break;
      
    case VideoState.CONTINUE_WATCHING:
      const existingIndex = state.continueWatching.findIndex(v => v.videoId === videoId);
      const continueWatchingItem = {
        videoId,
        addedAt: now,
        ...metadata
      };
      
      if (existingIndex !== -1) {
        state.continueWatching[existingIndex] = continueWatchingItem;
      } else {
        state.continueWatching.unshift(continueWatchingItem);
      }
      break;
      
    case VideoState.COMPLETED:
      // Remove from continue watching
      state.continueWatching = state.continueWatching.filter(v => v.videoId !== videoId);
      // Remove from queue
      await removeFromFeedQueue(videoId);
      break;
  }
  
  await saveVideoStates();
}

function getVideoState(videoId) {
  if (state.completedVideos.has(videoId)) {
    return VideoState.COMPLETED;
  }
  
  const continueWatchingItem = state.continueWatching.find(v => v.videoId === videoId);
  if (continueWatchingItem) {
    return VideoState.CONTINUE_WATCHING;
  }
  
  if (state.recentlyShown.has(videoId)) {
    return VideoState.SHOWN;
  }
  
  return VideoState.NEW;
}

/* ==========================================================================
   LAYER 5: FEED DIVERSITY
   ========================================================================== */

async function loadChannelHistory() {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    const historyData = localStorage.getItem(`${STORAGE_KEYS.CHANNEL_HISTORY}_${uid}`);
    
    if (historyData) {
      state.channelHistory = JSON.parse(historyData);
    } else {
      state.channelHistory = [];
    }
  } catch (error) {
    console.error('Error loading channel history:', error);
    state.channelHistory = [];
  }
}

async function saveChannelHistory() {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    localStorage.setItem(`${STORAGE_KEYS.CHANNEL_HISTORY}_${uid}`, JSON.stringify(state.channelHistory));
  } catch (error) {
    console.error('Error saving channel history:', error);
  }
}

function calculateChannelDiversityScore(channelId) {
  if (!channelId) return 1.0;
  
  // Check if this channel appears in recent history
  const recentChannelCount = state.channelHistory.filter(id => id === channelId).length;
  
  if (recentChannelCount === 0) {
    return 1.5; // Bonus for new channel
  }
  
  // Penalty for repeated channels
  const penalty = Math.min(recentChannelCount * 0.2, 0.8);
  return 1.0 - penalty;
}

async function addToChannelHistory(channelId) {
  if (!channelId) return;
  
  state.channelHistory.unshift(channelId);
  
  // Keep only recent history (last 20 videos)
  if (state.channelHistory.length > 20) {
    state.channelHistory = state.channelHistory.slice(0, 20);
  }
  
  await saveChannelHistory();
}

/* ==========================================================================
   LAYER 6: IGNORE MEMORY
   ========================================================================== */

function calculateIgnorePenalty(videoId) {
  const ignoredData = state.ignoredVideos.get(videoId);
  if (!ignoredData) return 1.0;
  
  // Penalty based on ignore count
  const penalty = Math.min(ignoredData.count * 0.1, 0.9);
  return 1.0 - penalty;
}

/* ==========================================================================
   LAYER 7: DAILY FEED GENERATOR
   ========================================================================== */

async function loadDailyFeed() {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    
    // Load last feed generation date
    const lastFeedDate = localStorage.getItem(`${STORAGE_KEYS.DAILY_FEED_DATE}_${uid}`);
    state.dailyFeedDate = lastFeedDate ? new Date(lastFeedDate) : null;
    
    // Load today's feed
    const todayFeedData = localStorage.getItem(`${STORAGE_KEYS.TODAY_FEED}_${uid}`);
    if (todayFeedData) {
      state.todayFeed = JSON.parse(todayFeedData);
    }
    
    // Load batch index
    const batchIndexData = localStorage.getItem(`${STORAGE_KEYS.BATCH_INDEX}_${uid}`);
    state.currentBatchIndex = batchIndexData ? parseInt(batchIndexData) : 0;
    
    // Load feed version
    const feedVersion = localStorage.getItem(`${STORAGE_KEYS.FEED_VERSION}_${uid}`);
    state.feedVersion = feedVersion ? parseInt(feedVersion) : 1;
    
    // Check if we need to regenerate feed (new day)
    const today = new Date().toDateString();
    if (state.dailyFeedDate?.toDateString() !== today) {
      console.log('New day detected, feed will be regenerated');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error loading daily feed:', error);
    return false;
  }
}

async function saveDailyFeed() {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    
    localStorage.setItem(`${STORAGE_KEYS.TODAY_FEED}_${uid}`, JSON.stringify(state.todayFeed));
    localStorage.setItem(`${STORAGE_KEYS.DAILY_FEED_DATE}_${uid}`, new Date().toDateString());
    localStorage.setItem(`${STORAGE_KEYS.FEED_VERSION}_${uid}`, state.feedVersion.toString());
    
    // Save batch index
    localStorage.setItem(`${STORAGE_KEYS.BATCH_INDEX}_${uid}`, state.currentBatchIndex.toString());
  } catch (error) {
    console.error('Error saving daily feed:', error);
  }
}

async function saveBatchIndex() {
  try {
    const uid = auth.currentUser?.uid || 'guest';
    localStorage.setItem(`${STORAGE_KEYS.BATCH_INDEX}_${uid}`, state.currentBatchIndex.toString());
  } catch (error) {
    console.error('Error saving batch index:', error);
  }
}

/* ==========================================================================
   PRIORITY ENGINE
   ========================================================================== */

function calculatePriorityScore(video) {
  let score = 1.0;
  
  // Layer 1: Fresh Upload Priority
  const freshUploadScore = calculateFreshUploadScore(video);
  score *= freshUploadScore;
  
  // Popularity Score (Log-scaled view count multiplier)
  const views = parseViewCount(video.viewCount);
  const popularityMultiplier = 1.0 + Math.log10(views + 1) * 0.15;
  score *= popularityMultiplier;
  
  // Layer 4: Video States
  const videoState = getVideoState(video.videoId);
  let stateScore = 1.0;
  
  switch (videoState) {
    case VideoState.NEW:
      stateScore = 2.0; // Highest priority for new videos
      break;
    case VideoState.CONTINUE_WATCHING:
      stateScore = 1.8; // High priority for continue watching
      break;
    case VideoState.SHOWN:
      stateScore = 0.8; // Lower priority for already shown
      break;
    case VideoState.COMPLETED:
      stateScore = 0.0; // Exclude completed
      break;
  }
  
  score *= stateScore;
  
  // Layer 3: Cooldown System
  if (isVideoInCooldown(video.videoId)) {
    score *= 0.0; // Exclude videos in cooldown
  }
  
  // Layer 5: Feed Diversity
  const diversityScore = calculateChannelDiversityScore(video.channelId);
  score *= diversityScore;
  
  // Layer 6: Ignore Memory
  const ignorePenalty = calculateIgnorePenalty(video.videoId);
  score *= ignorePenalty;
  
  // Recently shown penalty
  if (state.recentlyShown.has(video.videoId)) {
    score *= 0.5;
  }
  
  return score;
}

/* ==========================================================================
   FEED GENERATION
   ========================================================================== */

async function generateDailyFeed(allVideos) {
  if (state.isGeneratingFeed) {
    console.log('Feed generation already in progress');
    return state.todayFeed;
  }
  
  state.isGeneratingFeed = true;
  
  try {
    console.log(`Generating daily feed from ${allVideos.length} videos`);
    
    // Store all available videos for regeneration
    state.allAvailableVideos = allVideos;
    
    // Calculate priority scores for all videos
    const scoredVideos = allVideos.map(video => ({
      ...video,
      priorityScore: calculatePriorityScore(video)
    }));
    
    // Filter out videos with zero score (completed, in cooldown, etc.)
    const eligibleVideos = scoredVideos.filter(v => v.priorityScore > 0);
    console.log(`Eligible videos after filtering: ${eligibleVideos.length}`);
    
    // Sort by priority score (descending) within each channel group
    const channelGroups = new Map();
    for (const video of eligibleVideos) {
      const channelId = video.channelId;
      if (!channelGroups.has(channelId)) {
        channelGroups.set(channelId, []);
      }
      channelGroups.get(channelId).push(video);
    }
    
    // Sort each channel's videos by priority score
    for (const [channelId, videos] of channelGroups) {
      videos.sort((a, b) => b.priorityScore - a.priorityScore);
    }
    
    // Flatten sorted videos back to array
    const sortedVideos = [];
    for (const videos of channelGroups.values()) {
      sortedVideos.push(...videos);
    }
    
    // Apply channel diversity to final selection (no artificial limit)
    const diverseFeed = applyChannelDiversity(sortedVideos);
    
    state.todayFeed = diverseFeed;
    state.dailyFeedDate = new Date();
    state.feedVersion++;
    state.currentBatchIndex = 0;
    
    await saveDailyFeed();
    
    console.log(`Generated daily feed with ${diverseFeed.length} videos`);
    return diverseFeed;
  } catch (error) {
    console.error('Error generating daily feed:', error);
    return [];
  } finally {
    state.isGeneratingFeed = false;
  }
}

function applyChannelDiversity(videos) {
  if (videos.length === 0) return [];
  
  // Group videos by channel
  const channelGroups = new Map();
  for (const video of videos) {
    const channelId = video.channelId;
    if (!channelGroups.has(channelId)) {
      channelGroups.set(channelId, []);
    }
    channelGroups.get(channelId).push(video);
  }
  
  const diverseFeed = [];
  const channelIds = Array.from(channelGroups.keys());
  
  // Shuffle processing order of channels to vary feed structure
  shuffleArray(channelIds);
  
  const channelIndexes = new Map();
  
  // Initialize indexes for each channel
  channelIds.forEach(channelId => {
    channelIndexes.set(channelId, 0);
  });
  
  // Distribute videos in round-robin fashion ensuring channel diversity
  let round = 0;
  let totalVideosProcessed = 0;
  const totalVideosAvailable = videos.length;
  const maxRounds = 1000; // Safety limit to prevent infinite loops
  let lastChannelId = null;
  
  while (totalVideosProcessed < totalVideosAvailable && round < maxRounds) {
    let anyChannelAdded = false;
    
    for (const channelId of channelIds) {
      const channelVideos = channelGroups.get(channelId);
      const currentIndex = channelIndexes.get(channelId);
      
      if (currentIndex < channelVideos.length) {
        // Hard rule: No two consecutive videos in the final feed share the same channelId
        if (lastChannelId === channelId) {
          continue;
        }
        
        diverseFeed.push(channelVideos[currentIndex]);
        channelIndexes.set(channelId, currentIndex + 1);
        lastChannelId = channelId;
        totalVideosProcessed++;
        anyChannelAdded = true;
      }
    }
    
    // If no videos were added in this round, we are exhausted or only consecutive-violating options remain
    if (!anyChannelAdded) {
      break;
    }
    
    round++;
  }
  
  const contributedChannels = new Set(diverseFeed.map(v => v.channelId));
  console.log(`Applied channel diversity: ${diverseFeed.length} videos from ${channelIds.length} channels in ${round} rounds. Coverage: ${contributedChannels.size}/${channelIds.length} channels contributed.`);
  
  return diverseFeed;
}

/* ==========================================================================
   FEED BATCHING AND INFINITE SCROLL
   ========================================================================== */

function getNextBatch(batchSize = CONFIG.QUEUE_BATCH_SIZE) {
  const batch = [];
  let index = state.currentBatchIndex;
  
  if (!state.sessionShownVideos) {
    state.sessionShownVideos = new Set();
  }
  
  while (batch.length < batchSize && index < state.todayFeed.length) {
    const video = state.todayFeed[index];
    index++;
    
    const videoState = getVideoState(video.videoId);
    const inCooldown = isVideoInCooldown(video.videoId);
    const isCompleted = videoState === VideoState.COMPLETED;
    const isSessionShown = state.sessionShownVideos.has(video.videoId);
    
    if (!isCompleted && !inCooldown && !isSessionShown) {
      batch.push(video);
    }
  }
  
  state.currentBatchIndex = index;
  saveBatchIndex();
  
  return batch;
}

function hasMoreBatches() {
  if (!state.todayFeed || state.todayFeed.length === 0) return false;
  
  if (!state.sessionShownVideos) {
    state.sessionShownVideos = new Set();
  }
  
  for (let i = state.currentBatchIndex; i < state.todayFeed.length; i++) {
    const video = state.todayFeed[i];
    const videoState = getVideoState(video.videoId);
    const inCooldown = isVideoInCooldown(video.videoId);
    const isCompleted = videoState === VideoState.COMPLETED;
    const isSessionShown = state.sessionShownVideos.has(video.videoId);
    
    if (!isCompleted && !inCooldown && !isSessionShown) {
      return true;
    }
  }
  
  return false;
}

function resetBatchIndex() {
  state.currentBatchIndex = 0;
  saveBatchIndex();
}

async function preloadNextBatch() {
  if (!hasMoreBatches()) {
    console.log('No more batches available, may need feed regeneration');
    return [];
  }
  
  const nextBatch = getNextBatch(CONFIG.PRELOAD_AHEAD_COUNT);
  return nextBatch;
}

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

async function init() {
  if (state.initialized) {
    console.log('Smart Feed Scheduler already initialized');
    return;
  }
  
  console.log('Initializing Smart Feed Scheduler...');
  
  // Wait for Firebase Auth to resolve
  await waitForAuthReady();
  
  // Load all persistent data
  await Promise.all([
    loadUserFeedQueue(),
    loadCooldownSystem(),
    loadVideoStates(),
    loadChannelHistory(),
    loadDailyFeed()
  ]);
  
  // Load completed videos from analytics
  const engine = await getWatchProgressEngine();
  state.completedVideos = await engine.getCompletedVideoIds();
  
  state.initialized = true;
  console.log('Smart Feed Scheduler initialized successfully');
}

// Helper function to get completed videos
async function getCompletedVideos() {
  try {
    const engine = await getWatchProgressEngine();
    return await engine.getCompletedVideoIds();
  } catch (error) {
    console.error('Error getting completed videos:', error);
    return new Set(); // Return empty set on error
  }
}

async function regenerateFeed() {
  if (state.allAvailableVideos.length === 0) {
    console.log('No available videos to regenerate feed');
    return [];
  }
  
  console.log(`Regenerating feed from ${state.allAvailableVideos.length} stored videos`);
  
  if (state.sessionShownVideos) {
    state.sessionShownVideos.clear();
  }
  
  return await generateDailyFeed(state.allAvailableVideos);
}

/* ==========================================================================
   PUBLIC API
   ========================================================================== */

function setAvailableVideos(videos) {
  state.allAvailableVideos = videos;
}

export const smartFeedScheduler = {
  init,
  
  // Feed Generation
  generateDailyFeed,
  loadDailyFeed,
  regenerateFeed,
  getNextBatch,
  hasMoreBatches,
  resetBatchIndex,
  preloadNextBatch,
  setAvailableVideos,
  
  // Video States
  setVideoState,
  getVideoState,
  
  // Cooldown System
  markVideoAsIgnored,
  isVideoInCooldown,
  
  // Queue Management
  addToFeedQueue,
  removeFromFeedQueue,
  updateVideoInQueue,
  
  // Channel Diversity
  addToChannelHistory,
  
  // State Access
  get todayFeed() { return state.todayFeed; },
  get continueWatching() { return state.continueWatching; },
  get userFeedQueue() { return state.userFeedQueue; },
  get isInitialized() { return state.initialized; },
  
  // Configuration
  CONFIG,
  VideoState
};
