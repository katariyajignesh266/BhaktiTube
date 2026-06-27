import {
  formatWatchTime,
  formatRelativeTime
} from "./analytics-engine.js";

// Helper: Escape HTML string to prevent injection
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Helper: Get thumbnail URL for watch history items
function getThumbnailUrl(item) {
  return item.thumbnailUrl || `https://img.youtube.com/vi/${escapeHtml(item.videoId)}/maxresdefault.jpg`;
}

// Helper: Calculate progress percentage for video
function getProgressPercent(item) {
  const percent = Number(item.completionPercentage || 0);
  if (percent > 0) {
    return Math.min(100, Math.max(0, percent));
  }
  const duration = Number(item.duration || 0);
  const current = Number(item.currentPosition || 0);
  return duration > 0 ? Math.min(100, Math.round((current / duration) * 100)) : 0;
}

// Reusable Dashboard Rendering Component
export function renderDashboard(container, analytics, onVideoClick = null) {
  if (!container || !analytics) return;

  // If container is empty or does not have the dashboard template, populate it first
  if (!container.querySelector(".journey-header")) {
    container.innerHTML = `
      <div class="journey-header">
        <div>
          <span id="journeyGreeting">My Bhakti Journey</span>
          <h1 id="journeyUserName">Bhakti Progress</h1>
          <p id="journeyQuickSummary">Loading your devotional activity...</p>
        </div>
        <div class="journey-streak-card">
          <span>Current Streak</span>
          <strong id="journeyStreak">0 days</strong>
        </div>
      </div>

      <div class="journey-stats-grid" id="journeyStatsGrid"></div>

      <div class="journey-insight-layout">
        <div class="journey-panel progress-hero-panel">
          <div class="panel-title-row">
            <h2>Bhakti Progress</h2>
            <span id="journeyConsistencyBadge">0%</span>
          </div>
          <div class="progress-ring-wrap">
            <div class="progress-ring" id="journeyCompletionRing">
              <span id="journeyCompletionText">0%</span>
            </div>
            <div>
              <p>Completion Rate</p>
              <strong id="journeyCompletionLabel">0 completed videos</strong>
            </div>
          </div>
          <div class="goal-row">
            <span>Weekly Bhakti Time</span>
            <div class="goal-bar"><div id="journeyWeeklyBar"></div></div>
            <strong id="journeyWeeklyLabel">0m</strong>
          </div>
          <div class="goal-row">
            <span>Monthly Bhakti Time</span>
            <div class="goal-bar"><div id="journeyMonthlyBar"></div></div>
            <strong id="journeyMonthlyLabel">0m</strong>
          </div>
        </div>

        <div class="journey-panel">
          <div class="panel-title-row">
            <h2>Watch Time Trend</h2>
            <span>7 days</span>
          </div>
          <div id="watchTimeChart" class="bar-chart"></div>
        </div>
      </div>

      <div class="journey-chart-grid">
        <div class="journey-panel">
          <div class="panel-title-row">
            <h2>Top Categories</h2>
            <span id="favoriteCategoryLabel">--</span>
          </div>
          <div id="categoryBreakdown" class="breakdown-list"></div>
        </div>
        <div class="journey-panel">
          <div class="panel-title-row">
            <h2>Top Channels</h2>
            <span id="favoriteChannelLabel">--</span>
          </div>
          <div id="channelBreakdown" class="breakdown-list"></div>
        </div>
      </div>

      <div class="journey-panel">
        <div class="panel-title-row">
          <h2>Recent History</h2>
          <span id="historyCountLabel">0 videos</span>
        </div>
        <div id="journeyHistoryList" class="history-list"></div>
      </div>
    `;
  }

  const totals = analytics.totals || {};
  const profile = analytics.profile || {};

  // Define DOM setter helpers relative to current container
  const setText = (id, val) => {
    const el = container.querySelector(`#${id}`);
    if (el) el.textContent = val;
  };

  const setWidth = (id, percent) => {
    const el = container.querySelector(`#${id}`);
    if (el) el.style.width = `${percent}%`;
  };

  const getGoalPercent = (value, goal) => {
    return Math.min(100, Math.round((Number(value || 0) / goal) * 100));
  };

  // Populate basic text metrics
  setText("journeyUserName", profile.displayName || "Bhakti Progress");
  setText(
    "journeyQuickSummary",
    `${formatWatchTime(totals.lifetimeSeconds)} watched across ${totals.videosWatched || 0} videos`
  );
  setText("journeyStreak", `${totals.currentStreak || 0} days`);
  setText("journeyConsistencyBadge", `${totals.consistencyScore || 0}% consistency`);
  setText("journeyCompletionText", `${totals.completionRate || 0}%`);
  setText("journeyCompletionLabel", `${totals.completedVideos || 0} completed videos`);
  setText("journeyWeeklyLabel", formatWatchTime(totals.weeklySeconds));
  setText("journeyMonthlyLabel", formatWatchTime(totals.monthlySeconds));
  setText("favoriteCategoryLabel", totals.favoriteCategory || "--");
  setText("favoriteChannelLabel", totals.favoriteChannel || "--");
  setText("historyCountLabel", `${(analytics.history || []).length} videos`);

  // Progress goals bars
  setWidth("journeyWeeklyBar", getGoalPercent(totals.weeklySeconds, 3600));
  setWidth("journeyMonthlyBar", getGoalPercent(totals.monthlySeconds, 14400));

  // Completion Ring progress calculation
  const ring = container.querySelector("#journeyCompletionRing");
  if (ring) {
    ring.style.setProperty("--progress", `${(totals.completionRate || 0) * 3.6}deg`);
  }

  // Render Stats Grid Cards
  renderJourneyStats(totals);

  // Render Watch Time Chart
  renderTimeSeries(analytics.timeSeries || []);

  // Render Breakdown Lists
  renderBreakdown("categoryBreakdown", analytics.categoryStats || []);
  renderBreakdown("channelBreakdown", analytics.channelStats || []);

  // Render History Items
  renderHistory(analytics.history || []);

  // Sub-render: Stats Grid Cards
  function renderJourneyStats(statsTotals) {
    const grid = container.querySelector("#journeyStatsGrid");
    if (!grid) return;

    const cards = [
      ["fa-clock", "Lifetime Watch Time", formatWatchTime(statsTotals.lifetimeSeconds)],
      ["fa-calendar-day", "Today", formatWatchTime(statsTotals.todaySeconds)],
      ["fa-circle-check", "Completed", `${statsTotals.completedVideos || 0}`],
      ["fa-fire", "Best Session", formatWatchTime(statsTotals.longestSession)],
      ["fa-star", "Favorite Category", statsTotals.favoriteCategory || "--"],
      ["fa-sun", "Active Time", statsTotals.mostActiveHour || "--"]
    ];

    grid.innerHTML = cards.map(([icon, label, value]) => `
      <div class="journey-stat-card">
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join("");
  }

  // Sub-render: Watch Time Trend Line Chart
  function renderTimeSeries(series) {
    const chart = container.querySelector("#watchTimeChart");
    if (!chart) return;

    const maxSeconds = Math.max(...series.map(item => Number(item.seconds || 0)), 60);

    chart.innerHTML = series.map((item) => {
      const height = Math.max(3, Math.round((Number(item.seconds || 0) / maxSeconds) * 100));
      return `
        <div class="bar-item" title="${escapeHtml(formatWatchTime(item.seconds))}">
          <div class="bar-track"><div class="bar-fill" style="height:${height}%"></div></div>
          <span>${escapeHtml(item.label)}</span>
        </div>
      `;
    }).join("");
  }

  // Sub-render: Breakdown Progress Items list (Top Category / Channel)
  function renderBreakdown(elementId, statsList) {
    const breakdownContainer = container.querySelector(`#${elementId}`);
    if (!breakdownContainer) return;

    if (!statsList.length) {
      breakdownContainer.innerHTML = `<div class="journey-empty">No activity yet</div>`;
      return;
    }

    const maxSeconds = Math.max(...statsList.map(item => Number(item.seconds || 0)), 1);

    breakdownContainer.innerHTML = statsList.slice(0, 5).map((item) => `
      <div class="breakdown-item">
        <span>${escapeHtml(item.label)}</span>
        <div class="breakdown-track"><div class="breakdown-fill" style="width:${Math.round((Number(item.seconds || 0) / maxSeconds) * 100)}%"></div></div>
        <strong>${formatWatchTime(item.seconds)}</strong>
      </div>
    `).join("");
  }

  // Sub-render: Recent History list
  function renderHistory(historyItems) {
    const list = container.querySelector("#journeyHistoryList");
    if (!list) return;

    if (!historyItems.length) {
      list.innerHTML = `<div class="journey-empty">Start watching videos to build your journey.</div>`;
      return;
    }

    // Set callback if defined
    if (onVideoClick) {
      window.dashboardVideoClick = onVideoClick;
    }

    list.innerHTML = historyItems.slice(0, 10).map((item) => {
      const videoId = escapeHtml(item.videoId);
      const progress = getProgressPercent(item);
      const onClickAttr = onVideoClick ? `onclick="window.dashboardVideoClick('${videoId}')"` : "";

      return `
        <div class="history-item" ${onClickAttr} style="${onVideoClick ? 'cursor:pointer;' : ''}">
          <img src="${escapeHtml(getThumbnailUrl(item))}" alt="${escapeHtml(item.videoTitle || "History item")}" loading="lazy">
          <div>
            <h3>${escapeHtml(item.videoTitle)}</h3>
            <p>${escapeHtml(item.channelName || "BhaktiTube")} • ${formatRelativeTime(item.lastViewedMs)}</p>
          </div>
          <span class="history-status">${item.completed ? "Completed" : `${progress}%`}</span>
        </div>
      `;
    }).join("");
  }
}
