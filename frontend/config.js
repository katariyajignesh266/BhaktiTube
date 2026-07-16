/* ==========================================================================
   ⚡ CENTRALIZED CONFIGURATION
   ========================================================================== */

// YouTube API Configuration
export const YOUTUBE_API_KEY = "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE";

// Application Configuration
export const APP_CONFIG = {
  MIN_DURATION_SECONDS: 300, // 5 minutes
  COMPLETION_THRESHOLD: 95, // 95%
  INITIAL_CHANNELS_TO_PROCESS: 3, // Process first 3 channels immediately
  INITIAL_VIDEOS_PER_CHANNEL: 5, // Fetch only 5 videos per channel initially
  PARALLEL_BATCH_SIZE: 2, // Process 2 channels in parallel
  DAILY_FEED_SIZE: 5000, // Number of videos in daily feed (effectively unlimited)
  COOLDOWN_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours
  EXTENDED_COOLDOWN_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  IGNORE_THRESHOLD: 10, // After 10 ignores, extend cooldown
  RECENTLY_SHOWN_DURATION_MS: 48 * 60 * 60 * 1000, // 48 hours
  FRESH_UPLOAD_DURATION_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  CHANNEL_DIVERSITY_BUFFER: 3, // Minimum videos between same channel
  QUEUE_BATCH_SIZE: 20,
  PRELOAD_AHEAD_COUNT: 10,
  SHORTS_INITIAL_CHANNELS_TO_PROCESS: 2,
  SHORTS_INITIAL_ITEMS_PER_CHANNEL: 10,
  SHORTS_BACKGROUND_BATCH_SIZE: 4,
  SHORTS_PER_CHANNEL_UNSEEN_TARGET: 30,
  SHORTS_MAX_PAGES_PER_CHANNEL: 5
};

// Export default for easier importing
export default {
  YOUTUBE_API_KEY,
  APP_CONFIG
};