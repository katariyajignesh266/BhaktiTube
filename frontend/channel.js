import {
db,
auth
}
from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  setDoc
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import {
watchProgressEngine
}
from "./analytics-engine.js";

import { playVideo } from "./player-core.js";

const API_KEY = "AIzaSyCZove9iRB6XnbIjHqA-fOWBR99kr3ocsE";

const watchedVideos =
new Set(
JSON.parse(
localStorage.getItem(
"watchedChannelVideos"
) || "[]"
)
);

let currentVideoId = null;
let watchedSaved = false;
let channelVideoMeta = new Map();

let nextPageToken = "";
let loading = false;
let uploadsPlaylistId = "";
let currentSourceType = "channel";
let allPlaylistItems = []; // Store all playlist items for sequential processing

// State remapped to player-core.js

const params = new URLSearchParams(window.location.search);
const channelId = params.get("id");

watchProgressEngine.init({
source:"channel"
});

// ૧. પેજ લોડ થતા જ ફાયરબેઝમાંથી ચેનલ ડેટા મેળવવો
loadChannel();

async function loadChannel() {
  const user =
auth.currentUser;

if(user){

const watchedSnapshot =
await getDocs(

collection(
db,
"users",
user.uid,
"watchedChannelVideos"
)

);

watchedSnapshot.forEach(doc=>{

watchedVideos.add(
doc.id
);

});

}
  const snapshot = await getDocs(collection(db, "channels"));
  snapshot.forEach((doc) => {
    const channel = doc.data();
    if (channel.channelId === channelId) {
      document.getElementById("channelLogo").src = channel.channelLogo;
      document.getElementById("channelName").textContent = channel.channelName;
      document.getElementById("channelSubscribers").textContent = "Subscribers : " + channel.subscribers;
      document.getElementById("channelVideos").textContent = "Videos : " + channel.totalVideos;
      
      // Store source type for pagination
      currentSourceType = channel.sourceType || "channel";
      
      // Reset playlist items array for new load
      allPlaylistItems = [];
      
      // Check if this is a playlist or channel
      if (channel.sourceType === "playlist" && channel.playlistId) {
        uploadsPlaylistId = channel.playlistId;
        // For playlists, fetch all pages sequentially first
        loadAllPlaylistPages(channel.playlistId);
      } else {
        uploadsPlaylistId = channel.uploadsPlaylistId;
        loadYouTubeVideos(channel.uploadsPlaylistId, "", "channel");
      }
    }
  });
}

// ૨. Sanitize playlist items - remove private/deleted/unavailable videos
function sanitizePlaylistItems(items) {
  const sanitized = [];
  const seenVideoIds = new Set();
  
  for (const item of items) {
    // Validate required fields
    if (!item?.snippet?.resourceId?.videoId) continue;
    if (!item?.snippet?.title) continue;
    
    const videoId = item.snippet.resourceId.videoId;
    const title = item.snippet.title.toLowerCase();
    
    // Skip duplicates
    if (seenVideoIds.has(videoId)) continue;
    
    // Filter out private/deleted/unavailable videos by title patterns
    if (title.includes('private video') || 
        title.includes('deleted video') || 
        title.includes('unavailable') ||
        title.includes('this video is unavailable') ||
        title.includes('this video is private')) {
      continue;
    }
    
    // Validate thumbnail exists
    const hasThumbnail = item.snippet.thumbnails && (
      item.snippet.thumbnails.maxres?.url ||
      item.snippet.thumbnails.high?.url ||
      item.snippet.thumbnails.standard?.url ||
      item.snippet.thumbnails.medium?.url ||
      item.snippet.thumbnails.default?.url
    );
    
    if (!hasThumbnail) continue;
    
    // Item is valid - add to sanitized list
    sanitized.push(item);
    seenVideoIds.add(videoId);
  }
  
  return sanitized;
}

// ૩. Fetch all playlist pages sequentially (for playlists only)
async function loadAllPlaylistPages(playlistId, pageToken = "") {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "block";
  
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${pageToken}&key=${API_KEY}`
    );
    if (!response.ok) return;
    const data = await response.json();
    if (!data.items) return;

    // Append items in the correct sequence (YouTube's order)
    allPlaylistItems.push(...data.items);

    // If there are more pages, fetch them recursively
    if (data.nextPageToken) {
      await loadAllPlaylistPages(playlistId, data.nextPageToken);
    } else {
      // All pages collected - sanitize, reverse, and render
      const sanitizedItems = sanitizePlaylistItems(allPlaylistItems);
      renderPlaylistVideos(sanitizedItems);
    }
  } catch (error) {
    console.error("Error fetching playlist pages:", error);
  } finally {
    if (loader && pageToken === "") loader.style.display = "none";
  }
}

// ૪. Render playlist videos after all pages are collected, sanitized, and reversed
async function renderPlaylistVideos(sanitizedItems) {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "block";
  
  try {
    // Reverse the entire collection once (newest first)
    const reversedItems = [...sanitizedItems].reverse();
    
    const container = document.getElementById("channelVideosContainer");
    if (container) container.innerHTML = "";

    if (reversedItems.length === 0) {
      container.innerHTML = "<p style='color:#aaa; text-align:center; padding:20px;'>No videos available in this playlist.</p>";
      return;
    }

    // Process all items in batches for video details
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
        
        const duration = details.contentDetails.duration;
        const seconds = convertDurationToSeconds(duration);
        const videoId = item.snippet.resourceId.videoId;
        
        // Get thumbnail with comprehensive fallback chain (items already validated in sanitization)
        const thumbnailUrl = item.snippet.thumbnails?.maxres?.url ||
                            item.snippet.thumbnails?.high?.url || 
                            item.snippet.thumbnails?.standard?.url ||
                            item.snippet.thumbnails?.medium?.url || 
                            item.snippet.thumbnails?.default?.url;
        
        const viewCount = details.statistics?.viewCount ? formatViewCount(details.statistics.viewCount) : "0 views";
        const publishedAt = details.snippet?.publishedAt ? formatTimeAgo(details.snippet.publishedAt) : "";
        
        channelVideoMeta.set(videoId, {
          videoId,
          videoTitle: item.snippet.title,
          title: item.snippet.title,
          channelId: item.snippet.channelId || channelId,
          channelName: item.snippet.videoOwnerChannelTitle || document.getElementById("channelName").textContent || "BhaktiTube",
          thumbnailUrl: thumbnailUrl,
          duration: seconds,
          viewCount: viewCount,
          publishedAt: publishedAt
        });
        
        if (seconds < 300) continue;
        if (watchedVideos.has(videoId)) continue;
        
        const channelLogoUrl = document.getElementById("channelLogo")?.src || "";
        const channelNameText = item.snippet.videoOwnerChannelTitle || document.getElementById("channelName").textContent || "BhaktiTube";
        
        container.innerHTML += `
          <div class="video-card" onclick="openVideo('${videoId}')">
            <div class="video-thumbnail-wrapper">
              <img src="${thumbnailUrl}" class="video-thumbnail" loading="lazy" alt="${escapeHtml(item.snippet.title)}">
            </div>
            <div class="video-metadata-row">
              <div class="channel-avatar">
                ${channelLogoUrl ? `<img src="${channelLogoUrl}" alt="${escapeHtml(channelNameText)}">` : `<span>${escapeHtml(channelNameText.charAt(0).toUpperCase())}</span>`}
              </div>
              <div class="video-info-section">
                <h3 class="video-title">${escapeHtml(item.snippet.title)}</h3>
                <div class="video-meta-line">
                  <span class="channel-name">${escapeHtml(channelNameText)}</span>
                  <span class="separator">•</span>
                  <span class="view-count">${viewCount}</span>
                  <span class="separator">•</span>
                  <span class="publish-time">${publishedAt}</span>
                </div>
              </div>
              <div class="video-menu-btn" onclick="event.stopPropagation(); shareVideo('${videoId}')">
                <i class="fa-solid fa-ellipsis-vertical"></i>
              </div>
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error("Error rendering playlist videos:", error);
  } finally {
    if (loader) loader.style.display = "none";
  }
}

// ૪. યુટ્યુબ API માંથી વીડિયો લીસ્ટ લોડ કરવું (channels only - no changes)
async function loadYouTubeVideos(playlistId, pageToken = "", sourceType = "channel") {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "block";
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${pageToken}&key=${API_KEY}`
    );
    if (!response.ok) return;
    const data = await response.json();
    if (!data.items) return;

    // No reversal for channels - use original order
    const items = data.items;

    nextPageToken = data.nextPageToken || "";
    const container = document.getElementById("channelVideosContainer");
    if (pageToken === "" && container) container.innerHTML = "";

    const videoIds =
items
.map(item =>
item.snippet.resourceId.videoId
)
.join(",");

const detailsResponse =
await fetch(
`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds}&key=${API_KEY}`
);

const detailsData =
await detailsResponse.json();

for(
let i = 0;
i < items.length;
i++
){

const item =
items[i];

const details =
detailsData.items[i];

if(
!details ||
!details.contentDetails
){
continue;
}

const duration =
details.contentDetails.duration;

const seconds =
convertDurationToSeconds(
duration
);

const videoId =
item.snippet.resourceId.videoId;

const viewCount = details.statistics?.viewCount ? formatViewCount(details.statistics.viewCount) : "0 views";
const publishedAt = details.snippet?.publishedAt ? formatTimeAgo(details.snippet.publishedAt) : "";

channelVideoMeta.set(
videoId,
{
videoId,
videoTitle:item.snippet.title,
title:item.snippet.title,
channelId:item.snippet.channelId || channelId,
channelName:item.snippet.videoOwnerChannelTitle || document.getElementById("channelName").textContent || "BhaktiTube",
thumbnailUrl:item.snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
duration:seconds,
viewCount: viewCount,
publishedAt: publishedAt
}
);

if(seconds < 300){
continue;
}

if(
watchedVideos.has(
videoId
)
){
continue;
}

const channelLogoUrl = document.getElementById("channelLogo")?.src || "";
const channelNameText = item.snippet.videoOwnerChannelTitle || document.getElementById("channelName").textContent || "BhaktiTube";

container.innerHTML += `
<div class="video-card" onclick="openVideo('${videoId}')">
  <div class="video-thumbnail-wrapper">
    <img src="${item.snippet.thumbnails.high.url}" class="video-thumbnail" loading="lazy" alt="${escapeHtml(item.snippet.title)}">
  </div>
  <div class="video-metadata-row">
    <div class="channel-avatar">
      ${channelLogoUrl ? `<img src="${channelLogoUrl}" alt="${escapeHtml(channelNameText)}">` : `<span>${escapeHtml(channelNameText.charAt(0).toUpperCase())}</span>`}
    </div>
    <div class="video-info-section">
      <h3 class="video-title">${escapeHtml(item.snippet.title)}</h3>
      <div class="video-meta-line">
        <span class="channel-name">${escapeHtml(channelNameText)}</span>
        <span class="separator">•</span>
        <span class="view-count">${viewCount}</span>
        <span class="separator">•</span>
        <span class="publish-time">${publishedAt}</span>
      </div>
    </div>
    <div class="video-menu-btn" onclick="event.stopPropagation(); shareVideo('${videoId}')">
      <i class="fa-solid fa-ellipsis-vertical"></i>
    </div>
  </div>
</div>
`;

}
  } catch (error) {
    console.error(error);
  } finally {
    if (loader) loader.style.display = "none";
  }
}

// ૩. કસ્ટમ વીડિયો પ્લેયર પોપઅપ ઓપન કરવું
// Video opening remapped to player-core.js
window.openVideo = (videoId) => playVideo(videoId, getChannelVideoMeta(videoId), true);

// ૧૨. ઈન્ફિનાઈટ સ્ક્રોલ (Load More Videos) લોજિક - channels only
const trigger = document.getElementById("loadMoreTrigger");
if (trigger) {
  const observer = new IntersectionObserver(async (entries) => {
    // Only enable infinite scroll for channels, not playlists
    if (entries[0].isIntersecting && !loading && nextPageToken && currentSourceType === "channel") {
      loading = true;
      await loadYouTubeVideos(uploadsPlaylistId, nextPageToken, "channel");
      loading = false;
    }
  }, { threshold: 0.1 });
  observer.observe(trigger);
}

window.goHome = function() { window.location.href = "index.html"; }

// જો યુઝર એપ મિનિમાઇઝ કરે કે ટેબ બદલે તો વીડિયો ઓટોમેટિક બંધ કરવો
// Visibility remapped to player-core.js


function convertDurationToSeconds(duration){

  const match =
  duration.match(
  /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
  );

  if(!match){
    return 0;
  }

  const hours =
  parseInt(match[1] || 0);

  const minutes =
  parseInt(match[2] || 0);

  const seconds =
  parseInt(match[3] || 0);

  return (
    hours * 3600 +
    minutes * 60 +
    seconds
  );

}


// watched save remapped to player-core.js

function getChannelVideoMeta(videoId){

  return channelVideoMeta.get(videoId) || {
    videoId,
    videoTitle:"BhaktiTube Channel Video",
    title:"BhaktiTube Channel Video",
    channelId,
    channelName:document.getElementById("channelName").textContent || "BhaktiTube",
    thumbnailUrl:`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration:0
  };

}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }
  
  return 'Just now';
}

async function shareVideo(videoId) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'BhaktiTube Video',
        text: 'Check out this devotional video on BhaktiTube',
        url: videoUrl
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error sharing:', err);
        fallbackShare(videoUrl);
      }
    }
  } else {
    fallbackShare(videoUrl);
  }
}

function fallbackShare(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert('Video URL copied to clipboard!');
  }).catch(() => {
    prompt('Copy this video URL:', url);
  });
}

// Embed building and completion remapped to player-core.js

document.addEventListener("gesturestart", function(e){
    e.preventDefault();
});

document.addEventListener("gesturechange", function(e){
    e.preventDefault();
});

document.addEventListener("gestureend", function(e){
    e.preventDefault();
});

let lastTouchEnd = 0;

document.addEventListener("touchend", function(event){

    const now = Date.now();

    if(now - lastTouchEnd <= 300){
        event.preventDefault();
    }

    lastTouchEnd = now;

}, { passive:false });
