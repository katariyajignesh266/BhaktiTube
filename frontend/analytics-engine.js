import { db, auth } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  increment,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const CACHE_KEY = "bt_watch_progress_v1";
const QUEUE_KEY = "bt_watch_write_queue_v1";
const BROWSER_SESSION_KEY = "bt_browser_session_id";
const SAVE_INTERVAL_MS = 20000;
const COMPLETION_THRESHOLD = 0.95;
const MAX_ACTIVE_TICK_SECONDS = 15;

let authReadyResolver;
const authReady = new Promise((resolve) => {
  authReadyResolver = resolve;
});

onAuthStateChanged(auth, (user) => {
  authReadyResolver(user || null);
});

const state = {
  initialized: false,
  source: "web",
  session: null,
  progress: null,
  lastRemoteSaveMs: 0,
  isSaving: false
};

export const watchProgressEngine = {
  init,
  ensureUserProfile,
  startSession,
  touchPlayback,
  setPlaybackState,
  recordSeek,
  recordEvent,
  endSession,
  flush: endSession,
  getResumeProgress,
  getContinueWatching,
  getCompletedVideoIds,
  getUserAnalytics,
  listAnalyticsUsers,
  syncQueuedWrites
};

function init(options = {}) {
  state.source = options.source || state.source;

  if (state.initialized) return;

  state.initialized = true;
  window.addEventListener("online", () => {
    syncQueuedWrites();
  });

  window.addEventListener("pagehide", () => {
    endSession("page_hidden");
  });

  window.addEventListener("beforeunload", () => {
    endSession("page_unload");
  });
}

async function waitForAuthReady() {
  if (auth.currentUser) return auth.currentUser;
  return authReady;
}

function getUid() {
  return auth.currentUser?.uid || "guest";
}

function getBrowserSessionId() {
  let sessionId = sessionStorage.getItem(BROWSER_SESSION_KEY);
  if (!sessionId) {
    sessionId = createId("browser");
    sessionStorage.setItem(BROWSER_SESSION_KEY, sessionId);
  }
  return sessionId;
}

async function ensureUserProfile(user = auth.currentUser) {
  if (!user) {
    user = await waitForAuthReady();
  }

  if (!user) return null;

  const now = Date.now();
  const profile = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "BhaktiTube User",
    photoURL: user.photoURL || "",
    joinedAtMs: getAuthCreationMs(user),
    lastActiveMs: now,
    lastDevice: getDeviceInfo(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, "users", user.uid), {
      ...profile,
      createdAt: serverTimestamp()
    }, { merge: true });
    await syncQueuedWrites(user.uid);
  } catch (error) {
    queueProfile(profile);
  }

  return profile;
}

async function startSession(rawMeta, options = {}) {
  init({ source: options.source || state.source });
  await waitForAuthReady();
  await ensureUserProfile(auth.currentUser);

  const meta = normalizeVideoMeta(rawMeta);
  const uid = getUid();
  const remoteProgress = await getResumeProgress(meta.videoId);
  const resumePosition = getValidResumePosition(remoteProgress);
  const now = Date.now();

  state.progress = remoteProgress || {};
  state.lastRemoteSaveMs = 0;
  state.session = {
    uid,
    sessionId: createId("session"),
    browserSessionId: getBrowserSessionId(),
    source: options.source || state.source,
    videoId: meta.videoId,
    channelId: meta.channelId,
    channelName: meta.channelName,
    videoTitle: meta.videoTitle,
    thumbnailUrl: meta.thumbnailUrl,
    duration: meta.duration || Number(remoteProgress?.duration || 0),
    category: meta.category,
    secondaryCategories: meta.secondaryCategories,
    language: meta.language,
    durationGroup: meta.durationGroup,
    theme: meta.theme,
    startedAtMs: now,
    endedAtMs: null,
    startPosition: resumePosition,
    currentPosition: resumePosition,
    lastPosition: Number(remoteProgress?.currentPosition || 0),
    highestPosition: Math.max(resumePosition, Number(remoteProgress?.highestPosition || 0)),
    activeWatchTime: 0,
    savedWatchSeconds: 0,
    pauseCount: 0,
    savedPauseCount: 0,
    resumeCount: resumePosition > 0 ? 1 : 0,
    savedResumeCount: 0,
    seekCount: 0,
    savedSeekCount: 0,
    playbackSpeed: 1,
    completed: Boolean(remoteProgress?.completed),
    exitReason: "active",
    playing: false,
    lastTickMs: null,
    device: getDeviceInfo()
  };

  cacheProgress(uid, buildCachedProgress());
  recordEvent("video_started", { resumePosition });

  return {
    sessionId: state.session.sessionId,
    progress: remoteProgress,
    resumePosition
  };
}

function touchPlayback(currentPosition, duration, options = {}) {
  const session = state.session;
  if (!session) return null;

  const now = Date.now();
  const safeCurrent = clampNumber(currentPosition, 0, 60 * 60 * 12);
  const safeDuration = clampNumber(duration || session.duration, 0, 60 * 60 * 12);

  if (session.playing && session.lastTickMs) {
    const delta = Math.min((now - session.lastTickMs) / 1000, MAX_ACTIVE_TICK_SECONDS);
    if (delta > 0 && !document.hidden) {
      session.activeWatchTime += delta;
    }
  }

  session.lastTickMs = session.playing ? now : null;
  session.duration = safeDuration;
  session.lastPosition = session.currentPosition;
  session.currentPosition = safeCurrent;
  session.highestPosition = Math.max(session.highestPosition || 0, safeCurrent);
  session.playbackSpeed = clampNumber(options.playbackSpeed || session.playbackSpeed || 1, 0.25, 4);

  const completionPercentage = getCompletionPercentage(session);
  if (options.ended || completionPercentage >= 95) {
    session.completed = true;
    session.exitReason = options.ended ? "completed" : session.exitReason;
  }

  cacheProgress(session.uid, buildCachedProgress());

  const shouldSave =
    options.force ||
    session.completed ||
    now - state.lastRemoteSaveMs >= SAVE_INTERVAL_MS;

  if (shouldSave) {
    persistSession(options.reason || "heartbeat");
  }

  return buildCachedProgress();
}

function setPlaybackState(playbackState, details = {}) {
  const session = state.session;
  if (!session) return;

  const normalizedState = String(playbackState || "").toLowerCase();

  if (normalizedState === "playing") {
    if (!session.playing) {
      session.resumeCount += 1;
      session.playing = true;
      session.lastTickMs = Date.now();
      recordEvent("video_resumed", details);
    }
    return;
  }

  if (session.playing && typeof details.currentPosition === "number") {
    touchPlayback(details.currentPosition, details.duration, { reason: normalizedState });
  }

  session.playing = false;
  session.lastTickMs = null;

  if (normalizedState === "paused") {
    session.pauseCount += 1;
    recordEvent("video_paused", details);
    persistSession("paused");
  }

  if (normalizedState === "buffering") {
    recordEvent("video_buffering", details);
  }

  if (normalizedState === "ended") {
    session.completed = true;
    session.exitReason = "completed";
    touchPlayback(details.currentPosition || session.duration, details.duration || session.duration, {
      force: true,
      ended: true,
      reason: "completed"
    });
    recordEvent("video_completed", details);
  }
}

function recordSeek(deltaSeconds = 0) {
  const session = state.session;
  if (!session) return;
  session.seekCount += 1;
  recordEvent(deltaSeconds >= 0 ? "seek_forward" : "seek_backward", {
    deltaSeconds: Math.round(deltaSeconds)
  });
}

async function recordEvent(eventType, details = {}) {
  const session = state.session;
  const user = auth.currentUser;
  if (!session || !user) return;

  const event = {
    eventType,
    uid: user.uid,
    sessionId: session.sessionId,
    browserSessionId: session.browserSessionId,
    source: session.source,
    videoId: session.videoId,
    videoTitle: session.videoTitle,
    thumbnailUrl: session.thumbnailUrl,
    channelId: session.channelId,
    channelName: session.channelName,
    category: session.category,
    currentPosition: Math.round(session.currentPosition || details.currentPosition || 0),
    duration: Math.round(session.duration || details.duration || 0),
    completionPercentage: getCompletionPercentage(session),
    device: session.device,
    dateKey: getDateKey(Date.now()),
    weekKey: getWeekKey(Date.now()),
    monthKey: getMonthKey(Date.now()),
    yearKey: getYearKey(Date.now()),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    createdAtMs: Date.now(),
    createdAt: serverTimestamp()
  };

  try {
    await setDoc(doc(collection(db, "users", user.uid, "watchEvents")), {
      ...event,
      ...sanitizeEventDetails(details)
    });
  } catch (error) {
    queueWrite({
      type: "event",
      uid: user.uid,
      event: stripServerTimestamp({
        ...event,
        ...sanitizeEventDetails(details)
      })
    });
  }
}

function endSession(reason = "closed") {
  const session = state.session;
  if (!session) return;

  const current = session.currentPosition || 0;
  const duration = session.duration || 0;
  touchPlayback(current, duration, {
    force: true,
    reason
  });

  session.playing = false;
  session.lastTickMs = null;
  session.endedAtMs = Date.now();
  session.exitReason = session.completed ? "completed" : reason;
  persistSession(reason, true);
}

async function persistSession(reason = "heartbeat", ending = false) {
  const session = state.session;
  const user = auth.currentUser;
  if (!session) return;

  cacheProgress(session.uid, buildCachedProgress());

  if (!user || session.uid === "guest") return;
  if (state.isSaving && !ending) return;

  const now = Date.now();
  const watchDelta = Math.max(0, Math.floor(session.activeWatchTime - session.savedWatchSeconds));
  const pauseDelta = Math.max(0, session.pauseCount - session.savedPauseCount);
  const resumeDelta = Math.max(0, session.resumeCount - session.savedResumeCount);
  const seekDelta = Math.max(0, session.seekCount - session.savedSeekCount);
  const completedForFirstTime = session.completed && !state.progress?.completed;
  const payload = buildWritePayload(user.uid, watchDelta, pauseDelta, resumeDelta, seekDelta, completedForFirstTime, reason, ending);

  state.isSaving = true;
  try {
    await writePayload(payload);
    session.savedWatchSeconds += watchDelta;
    session.savedPauseCount += pauseDelta;
    session.savedResumeCount += resumeDelta;
    session.savedSeekCount += seekDelta;
    state.lastRemoteSaveMs = now;
    state.progress = {
      ...state.progress,
      ...buildCachedProgress(),
      totalWatchTime: Number(state.progress?.totalWatchTime || 0) + watchDelta,
      pauseCount: Number(state.progress?.pauseCount || 0) + pauseDelta,
      resumeCount: Number(state.progress?.resumeCount || 0) + resumeDelta,
      seekCount: Number(state.progress?.seekCount || 0) + seekDelta,
      completed: session.completed || Boolean(state.progress?.completed)
    };
  } catch (error) {
    queueWrite(payload);
  } finally {
    state.isSaving = false;
  }
}

function buildWritePayload(uid, watchDelta, pauseDelta, resumeDelta, seekDelta, completedForFirstTime, reason, ending) {
  const session = state.session;
  const progress = buildCachedProgress();
  const aggregate = {
    watchDelta,
    completedDelta: completedForFirstTime ? 1 : 0,
    dateKey: getDateKey(Date.now()),
    weekKey: getWeekKey(Date.now()),
    monthKey: getMonthKey(Date.now()),
    yearKey: getYearKey(Date.now())
  };

  return {
    type: "session",
    uid,
    progress,
    session: {
      uid,
      sessionId: session.sessionId,
      browserSessionId: session.browserSessionId,
      source: session.source,
      videoId: session.videoId,
      videoTitle: session.videoTitle,
      thumbnailUrl: session.thumbnailUrl,
      channelId: session.channelId,
      channelName: session.channelName,
      category: session.category,
      secondaryCategories: session.secondaryCategories,
      language: session.language,
      durationGroup: session.durationGroup,
      theme: session.theme,
      startedAtMs: session.startedAtMs,
      endedAtMs: ending ? Date.now() : session.endedAtMs,
      startPosition: Math.round(session.startPosition || 0),
      currentPosition: Math.round(session.currentPosition || 0),
      finalPosition: Math.round(session.currentPosition || 0),
      highestPosition: Math.round(session.highestPosition || 0),
      duration: Math.round(session.duration || 0),
      activeWatchTime: Math.round(session.activeWatchTime || 0),
      pauseCount: session.pauseCount,
      resumeCount: session.resumeCount,
      seekCount: session.seekCount,
      completionPercentage: getCompletionPercentage(session),
      completed: session.completed,
      abandoned: !session.completed && getCompletionPercentage(session) < 95,
      exitReason: session.completed ? "completed" : reason,
      lastDevice: session.device,
      updatedAtMs: Date.now()
    },
    deltas: {
      watchDelta,
      pauseDelta,
      resumeDelta,
      seekDelta,
      completedDelta: completedForFirstTime ? 1 : 0
    },
    aggregate
  };
}

async function writePayload(payload) {
  const uid = payload.uid;
  const batch = writeBatch(db);
  const progress = payload.progress;
  const session = payload.session;
  const deltas = payload.deltas || {};
  const aggregate = payload.aggregate || {};

  batch.set(doc(db, "users", uid, "watchProgress", progress.videoId), {
    ...progress,
    totalWatchTime: increment(deltas.watchDelta || 0),
    pauseCount: increment(deltas.pauseDelta || 0),
    resumeCount: increment(deltas.resumeDelta || 0),
    seekCount: increment(deltas.seekDelta || 0),
    completionCount: increment(deltas.completedDelta || 0),
    updatedAt: serverTimestamp()
  }, { merge: true });

  batch.set(doc(db, "users", uid, "watchSessions", session.sessionId), {
    ...session,
    updatedAt: serverTimestamp()
  }, { merge: true });

  batch.set(doc(db, "users", uid), {
    uid,
    lastActiveMs: Date.now(),
    lastVideoId: progress.videoId,
    lastVideoTitle: progress.videoTitle,
    lastCategory: progress.category,
    lastDevice: progress.lastDevice,
    totalWatchTime: increment(deltas.watchDelta || 0),
    completedVideos: increment(deltas.completedDelta || 0),
    updatedAt: serverTimestamp()
  }, { merge: true });

  if ((aggregate.watchDelta || 0) > 0) {
    const aggregateData = {
      watchSeconds: increment(aggregate.watchDelta),
      sessionTouches: increment(1),
      completedVideos: increment(aggregate.completedDelta || 0),
      updatedAtMs: Date.now(),
      updatedAt: serverTimestamp()
    };
    batch.set(doc(db, "users", uid, "analyticsDaily", aggregate.dateKey), {
      ...aggregateData,
      dateKey: aggregate.dateKey
    }, { merge: true });
    batch.set(doc(db, "users", uid, "analyticsWeekly", aggregate.weekKey), {
      ...aggregateData,
      weekKey: aggregate.weekKey
    }, { merge: true });
    batch.set(doc(db, "users", uid, "analyticsMonthly", aggregate.monthKey), {
      ...aggregateData,
      monthKey: aggregate.monthKey
    }, { merge: true });
    batch.set(doc(db, "users", uid, "analyticsYearly", aggregate.yearKey), {
      ...aggregateData,
      yearKey: aggregate.yearKey
    }, { merge: true });
  }

  await batch.commit();
}

async function getResumeProgress(videoId) {
  const uid = getUid();
  const localProgress = readCachedProgress(uid, videoId);

  if (!auth.currentUser) return localProgress;

  try {
    const snap = await getDoc(doc(db, "users", auth.currentUser.uid, "watchProgress", videoId));
    const remoteProgress = snap.exists() ? snap.data() : null;
    const chosen = chooseNewestProgress(localProgress, remoteProgress);
    if (chosen) cacheProgress(auth.currentUser.uid, chosen);
    return chosen;
  } catch (error) {
    return localProgress;
  }
}

async function getContinueWatching(limitCount = 12) {
  const analytics = await getUserAnalytics(getUid());
  return analytics.continueWatching.slice(0, limitCount);
}

async function getCompletedVideoIds() {
  const ids = new Set(readCompletedIdsFromCache(getUid()));

  if (!auth.currentUser) return ids;

  try {
    const snapshot = await getDocs(query(
      collection(db, "users", auth.currentUser.uid, "watchProgress"),
      orderBy("lastViewedMs", "desc"),
      limit(250)
    ));
    snapshot.forEach((item) => {
      const progress = item.data();
      if (progress.completed || Number(progress.completionPercentage || 0) >= 95) {
        ids.add(item.id);
      }
    });
  } catch (error) {}

  return ids;
}

async function getUserAnalytics(uid = getUid(), limitCount = 250) {
  if (!uid) {
    return emptyAnalytics();
  }

  const [profile, progressItems, sessions] = await Promise.all([
    readUserProfile(uid),
    readProgressItems(uid, limitCount),
    readSessions(uid, limitCount * 2)
  ]);

  const analytics = buildAnalytics(profile, progressItems, sessions);

  // Auto-healing: If the root-level totalWatchTime counter is out of sync with actual progress,
  // reconcile it in Firestore so the admin list and global statistics remain accurate.
  const recalculatedWatchTime = analytics.totals.lifetimeSeconds || 0;
  if (auth.currentUser && profile && Number(profile.totalWatchTime || 0) !== recalculatedWatchTime) {
    try {
      await setDoc(doc(db, "users", uid), {
        totalWatchTime: recalculatedWatchTime,
        updatedAt: serverTimestamp()
      }, { merge: true });
      console.log(`[Auto-Healing] Reconciled totalWatchTime for user ${uid}: ${recalculatedWatchTime}s`);
    } catch (e) {
      console.error("[Auto-Healing] Failed to sync totalWatchTime:", e);
    }
  }

  return analytics;
}

async function listAnalyticsUsers(limitCount = 50) {
  try {
    const snapshot = await getDocs(query(
      collection(db, "users"),
      orderBy("lastActiveMs", "desc"),
      limit(limitCount)
    ));

    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));
  } catch (error) {
    const snapshot = await getDocs(collection(db, "users"));
    const all = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    all.sort((a, b) => Number(b.lastActiveMs || b.createdAt?.seconds * 1000 || 0) - Number(a.lastActiveMs || a.createdAt?.seconds * 1000 || 0));
    return all.slice(0, limitCount);
  }
}

async function syncQueuedWrites(forcedUid = auth.currentUser?.uid) {
  const queue = readQueue();
  if (!queue.length || !forcedUid || navigator.onLine === false) return;

  const remaining = [];

  for (const payload of queue) {
    try {
      if (payload.type === "profile") {
        await setDoc(doc(db, "users", payload.uid || forcedUid), {
          ...payload.profile,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else if (payload.type === "event") {
        await setDoc(doc(collection(db, "users", payload.uid || forcedUid, "watchEvents")), {
          ...payload.event,
          createdAt: serverTimestamp()
        });
      } else {
        await writePayload({
          ...payload,
          uid: payload.uid || forcedUid
        });
      }
    } catch (error) {
      remaining.push(payload);
    }
  }

  writeQueue(remaining);
}

async function readUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? { uid, ...snap.data() } : { uid };
  } catch (error) {
    return { uid };
  }
}

async function readProgressItems(uid, limitCount = 250) {
  const cached = Object.values(readCache()[uid]?.progress || {});

  if (!auth.currentUser && uid === "guest") return cached;

  try {
    const snapshot = await getDocs(query(
      collection(db, "users", uid, "watchProgress"),
      orderBy("lastViewedMs", "desc"),
      limit(limitCount)
    ));
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    items.forEach((item) => cacheProgress(uid, item));
    return mergeProgressLists(items, cached);
  } catch (error) {
    return cached;
  }
}

async function readSessions(uid, limitCount = 500) {
  try {
    const snapshot = await getDocs(query(
      collection(db, "users", uid, "watchSessions"),
      orderBy("startedAtMs", "desc"),
      limit(limitCount)
    ));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    return [];
  }
}

function buildAnalytics(profile, progressItems, sessions) {
  const now = new Date();
  const todayStart = startOfDay(now).getTime();
  const weekStart = startOfWeek(now).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  const lastSevenKeys = getRecentDateKeys(7);

  const timeSeries = lastSevenKeys.map((dateKey) => ({
    label: shortDateLabel(dateKey),
    dateKey,
    seconds: 0
  }));

  const categories = new Map();
  const channels = new Map();
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, seconds: 0 }));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => ({ day, seconds: 0 }));
  const activeDates = new Set();

  let todaySeconds = 0;
  let weeklySeconds = 0;
  let monthlySeconds = 0;
  let yearlySeconds = 0;
  let longestSession = 0;

  sessions.forEach((session) => {
    const seconds = Math.round(Number(session.activeWatchTime || session.watchSeconds || 0));
    if (seconds > 0) {
      longestSession = Math.max(longestSession, seconds);
    }
  });

  progressItems.forEach((progress) => {
    const fallbackSeconds = Math.max(
      Number(progress.totalWatchTime || 0),
      Math.min(Number(progress.currentPosition || 0), Number(progress.duration || 0))
    );
    if (fallbackSeconds > 0) {
      addMapSeconds(categories, progress.category || "Other", fallbackSeconds);
      addMapSeconds(channels, progress.channelName || "Unknown Channel", fallbackSeconds);
    }
    if (progress.lastViewedMs) {
      const lastViewed = Number(progress.lastViewedMs);
      activeDates.add(getDateKey(lastViewed));

      if (lastViewed >= todayStart) todaySeconds += fallbackSeconds;
      if (lastViewed >= weekStart) weeklySeconds += fallbackSeconds;
      if (lastViewed >= monthStart) monthlySeconds += fallbackSeconds;
      if (lastViewed >= yearStart) yearlySeconds += fallbackSeconds;

      // Rebuild the 7-day Watch Time Trend so it always matches Recent History
      if (fallbackSeconds > 0) {
        const dateKey = getDateKey(lastViewed);
        const seriesItem = timeSeries.find((item) => item.dateKey === dateKey);
        if (seriesItem) seriesItem.seconds += fallbackSeconds;
      }

      // Add to hourly and weekdays
      if (fallbackSeconds > 0) {
        const d = new Date(lastViewed);
        hourly[d.getHours()].seconds += fallbackSeconds;
        weekdays[d.getDay()].seconds += fallbackSeconds;
      }
    }
  });

  const progressTotal = progressItems.reduce((sum, item) => {
    const fallbackSeconds = Math.max(
      Number(item.totalWatchTime || 0),
      Math.min(Number(item.currentPosition || 0), Number(item.duration || 0))
    );
    return sum + fallbackSeconds;
  }, 0);
  const lifetimeSeconds = progressTotal;
  const completedVideos = progressItems.filter((item) => item.completed || Number(item.completionPercentage || 0) >= 95);
  const startedVideos = progressItems.filter((item) => Number(item.currentPosition || 0) > 0 || Number(item.totalWatchTime || 0) > 0);
  const continueWatching = progressItems
    .filter((item) => {
      const completion = Number(item.completionPercentage || 0);
      const duration = Number(item.duration || 0);
      const current = Number(item.currentPosition || 0);
      if (item.hidden || item.completed || completion >= 95) return false;
      if (duration > 0) return current / duration >= 0.01 && current / duration < COMPLETION_THRESHOLD;
      return current > 10;
    })
    .sort((a, b) => Number(b.lastViewedMs || 0) - Number(a.lastViewedMs || 0));

  const categoryStats = mapToSortedStats(categories);
  const channelStats = mapToSortedStats(channels);

  // Consistency audit verification logging
  const channelSum = channelStats.reduce((sum, item) => sum + item.seconds, 0);
  const categorySum = categoryStats.reduce((sum, item) => sum + item.seconds, 0);
  console.log(`[Consistency Audit] User Profile UID: ${profile?.uid || "guest"}`);
  console.log(`  - Lifetime Watch Time: ${lifetimeSeconds}s (${formatWatchTime(lifetimeSeconds)})`);
  console.log(`  - Sum of Channel Breakdowns: ${channelSum}s (${formatWatchTime(channelSum)})`);
  console.log(`  - Sum of Category Breakdowns: ${categorySum}s (${formatWatchTime(categorySum)})`);
  console.log(`  - Status: ${lifetimeSeconds === channelSum && lifetimeSeconds === categorySum ? "PASSED" : "FAILED"}`);

  return {
    profile: profile || {},
    totals: {
      todaySeconds,
      weeklySeconds,
      monthlySeconds,
      yearlySeconds,
      lifetimeSeconds,
      videosWatched: startedVideos.length,
      completedVideos: completedVideos.length,
      incompleteVideos: Math.max(0, startedVideos.length - completedVideos.length),
      completionRate: startedVideos.length ? Math.round((completedVideos.length / startedVideos.length) * 100) : 0,
      averageDailySeconds: Math.round(lifetimeSeconds / Math.max(1, activeDates.size || 1)),
      longestSession,
      currentStreak: getCurrentStreak(activeDates),
      consistencyScore: getConsistencyScore(activeDates),
      favoriteCategory: categoryStats[0]?.label || "No category yet",
      favoriteChannel: channelStats[0]?.label || "No channel yet",
      mostActiveHour: getTopHour(hourly),
      mostActiveDay: weekdays.slice().sort((a, b) => b.seconds - a.seconds)[0]?.day || "--"
    },
    progressItems,
    sessions,
    continueWatching,
    history: progressItems.slice().sort((a, b) => Number(b.lastViewedMs || 0) - Number(a.lastViewedMs || 0)),
    categoryStats,
    channelStats,
    timeSeries,
    hourly,
    weekdays
  };
}

function emptyAnalytics() {
  return buildAnalytics({}, [], []);
}

function normalizeVideoMeta(rawMeta = {}) {
  const title = sanitizeText(rawMeta.videoTitle || rawMeta.title || "Untitled Video", 180);
  const duration = clampNumber(rawMeta.duration || 0, 0, 60 * 60 * 12);
  const classification = classifyBhaktiContent(title, duration);

  return {
    videoId: sanitizeId(rawMeta.videoId),
    videoTitle: title,
    thumbnailUrl: sanitizeUrl(rawMeta.thumbnailUrl || rawMeta.thumbnail || ""),
    channelId: sanitizeText(rawMeta.channelId || "", 120),
    channelName: sanitizeText(rawMeta.channelName || rawMeta.channel || "BhaktiTube", 120),
    duration,
    ...classification
  };
}

function classifyBhaktiContent(title = "", duration = 0) {
  const cleanTitle = title.toLowerCase();
  const groups = [
    ["Bhajan", ["bhajan", "chalisa", "stuti", "kirtan", "aarti", "arti", "song"]],
    ["Katha", ["katha", "kathaamrut", "pravachan", "satsang", "vachanamrut"]],
    ["Mantra", ["mantra", "jaap", "jap", "chant", "dhun"]],
    ["Meditation", ["meditation", "dhyan", "relax", "peace"]],
    ["Live Darshan", ["live", "darshan", "mandir live"]],
    ["Temple Tour", ["temple", "mandir", "tour", "yatra"]],
    ["Festival", ["janmashtami", "diwali", "holi", "utsav", "festival"]],
    ["Motivational", ["motivation", "inspiration", "success", "life"]],
    ["Spiritual Story", ["story", "kahani", "charitra"]],
    ["Short Clip", ["shorts", "#shorts", "short"]]
  ];
  const themes = [
    ["Krishna", ["krishna", "shyam", "govind", "gopal", "radha"]],
    ["Hanuman", ["hanuman", "bajrang", "maruti"]],
    ["Shiv", ["shiv", "shiva", "mahadev", "rudra"]],
    ["Ramayan", ["ramayan", "ram", "sita"]],
    ["Mahabharat", ["mahabharat", "arjun", "geeta", "gita"]],
    ["Swaminarayan", ["swaminarayan", "baps", "sahajanand"]],
    ["Jain", ["jain", "mahavir", "parshwanath"]],
    ["ISKCON", ["iskcon", "hare krishna"]]
  ];

  const primary = findKeywordLabel(cleanTitle, groups) || "Other";
  const theme = findKeywordLabel(cleanTitle, themes) || "Devotional";
  const secondary = [...new Set([
    theme,
    ...groups
      .filter(([label, words]) => label !== primary && words.some((word) => cleanTitle.includes(word)))
      .map(([label]) => label)
  ])].filter(Boolean);

  return {
    category: primary,
    secondaryCategories: secondary,
    language: detectLanguage(cleanTitle),
    durationGroup: getDurationGroup(duration),
    theme
  };
}

function findKeywordLabel(title, groups) {
  const match = groups.find(([, words]) => words.some((word) => title.includes(word)));
  return match ? match[0] : "";
}

function detectLanguage(title) {
  if (/[અ-હ]/.test(title)) return "Gujarati";
  if (/[अ-ह]/.test(title)) return "Hindi";
  if (/\b(gujarati|garba|katha)\b/.test(title)) return "Gujarati";
  if (/\b(hindi|bhajan|chalisa|aarti)\b/.test(title)) return "Hindi";
  return "Unknown";
}

function getDurationGroup(duration) {
  if (!duration) return "Unknown";
  if (duration < 60) return "Short";
  if (duration < 600) return "Quick";
  if (duration < 1800) return "Medium";
  return "Long";
}

function buildCachedProgress() {
  const session = state.session;
  const progress = state.progress || {};
  const completionPercentage = getCompletionPercentage(session);
  const now = Date.now();

  return {
    uid: session.uid,
    videoId: session.videoId,
    channelId: session.channelId,
    channelName: session.channelName,
    videoTitle: session.videoTitle,
    thumbnailUrl: session.thumbnailUrl,
    duration: Math.round(session.duration || 0),
    currentPosition: Math.round(session.currentPosition || 0),
    lastPosition: Math.round(session.lastPosition || 0),
    highestPosition: Math.round(session.highestPosition || 0),
    completionPercentage,
    totalWatchTime: Number(progress.totalWatchTime || 0) + Math.max(0, Math.floor(session.activeWatchTime - session.savedWatchSeconds)),
    firstViewedMs: Number(progress.firstViewedMs || session.startedAtMs),
    lastViewedMs: now,
    completedAtMs: session.completed ? Number(progress.completedAtMs || now) : Number(progress.completedAtMs || 0),
    completed: session.completed || completionPercentage >= 95,
    hidden: session.completed || completionPercentage >= 95,
    category: session.category,
    secondaryCategories: session.secondaryCategories,
    language: session.language,
    durationGroup: session.durationGroup,
    theme: session.theme,
    pauseCount: Number(progress.pauseCount || 0) + Math.max(0, session.pauseCount - session.savedPauseCount),
    resumeCount: Number(progress.resumeCount || 0) + Math.max(0, session.resumeCount - session.savedResumeCount),
    seekCount: Number(progress.seekCount || 0) + Math.max(0, session.seekCount - session.savedSeekCount),
    playbackSpeed: session.playbackSpeed,
    lastDevice: session.device,
    lastBrowser: session.device.browser,
    sessionId: session.sessionId,
    updatedAtMs: now
  };
}

function getCompletionPercentage(sessionOrProgress) {
  const duration = Number(sessionOrProgress?.duration || 0);
  const current = Math.max(
    Number(sessionOrProgress?.currentPosition || 0),
    Number(sessionOrProgress?.highestPosition || 0)
  );
  if (!duration) return 0;
  return Math.min(100, Math.round((current / duration) * 100));
}

function getValidResumePosition(progress) {
  if (!progress || progress.completed || Number(progress.completionPercentage || 0) >= 95) return 0;
  const duration = Number(progress.duration || 0);
  const position = Math.max(Number(progress.currentPosition || 0), Number(progress.highestPosition || 0));
  if (position < 10) return 0;
  if (duration && position >= duration * COMPLETION_THRESHOLD) return 0;
  return Math.floor(position);
}

function chooseNewestProgress(localProgress, remoteProgress) {
  if (!localProgress) return remoteProgress || null;
  if (!remoteProgress) return localProgress;

  const localUpdated = Number(localProgress.updatedAtMs || localProgress.lastViewedMs || 0);
  const remoteUpdated = Number(remoteProgress.updatedAtMs || remoteProgress.lastViewedMs || 0);

  if (localUpdated > remoteUpdated) return localProgress;
  if (remoteUpdated > localUpdated) return remoteProgress;

  return Number(localProgress.currentPosition || 0) > Number(remoteProgress.currentPosition || 0)
    ? localProgress
    : remoteProgress;
}

function cacheProgress(uid, progress) {
  const cache = readCache();
  const scopedUid = uid || "guest";
  if (!cache[scopedUid]) cache[scopedUid] = { progress: {} };
  cache[scopedUid].progress[progress.videoId] = {
    ...cache[scopedUid].progress[progress.videoId],
    ...progress
  };
  writeCache(cache);
}

function readCachedProgress(uid, videoId) {
  return readCache()[uid || "guest"]?.progress?.[videoId] || null;
}

function readCompletedIdsFromCache(uid) {
  const progress = readCache()[uid || "guest"]?.progress || {};
  return Object.values(progress)
    .filter((item) => item.completed || Number(item.completionPercentage || 0) >= 95)
    .map((item) => item.videoId);
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function writeCache(cache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function queueWrite(payload) {
  const queue = readQueue();
  queue.push(stripServerTimestamp(payload));
  writeQueue(queue.slice(-100));
}

function queueProfile(profile) {
  queueWrite({
    type: "profile",
    uid: profile.uid,
    profile
  });
}

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function writeQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function stripServerTimestamp(value) {
  return JSON.parse(JSON.stringify(value, (key, nestedValue) => {
    if (key === "updatedAt" || key === "createdAt") return undefined;
    return nestedValue;
  }));
}

function mergeProgressLists(primary, fallback) {
  const map = new Map();
  fallback.forEach((item) => map.set(item.videoId, item));
  primary.forEach((item) => map.set(item.videoId, chooseNewestProgress(map.get(item.videoId), item)));
  return Array.from(map.values()).sort((a, b) => Number(b.lastViewedMs || 0) - Number(a.lastViewedMs || 0));
}

function addMapSeconds(map, key, seconds) {
  const safeKey = key || "Other";
  map.set(safeKey, (map.get(safeKey) || 0) + seconds);
}

function mapToSortedStats(map) {
  return Array.from(map.entries())
    .map(([label, seconds]) => ({ label, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}

function getCurrentStreak(activeDates) {
  let streak = 0;
  const cursor = startOfDay(new Date());

  while (activeDates.has(getDateKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getConsistencyScore(activeDates) {
  const recentDates = getRecentDateKeys(30);
  const activeCount = recentDates.filter((dateKey) => activeDates.has(dateKey)).length;
  return Math.min(100, Math.round((activeCount / 30) * 100));
}

function getTopHour(hourly) {
  const top = hourly.slice().sort((a, b) => b.seconds - a.seconds)[0];
  if (!top || top.seconds <= 0) return "--";
  const suffix = top.hour >= 12 ? "PM" : "AM";
  const hour = top.hour % 12 || 12;
  return `${hour} ${suffix}`;
}

function getRecentDateKeys(days) {
  const dates = [];
  const cursor = startOfDay(new Date());
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let index = 0; index < days; index += 1) {
    dates.push(getDateKey(cursor.getTime()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function shortDateLabel(dateKey) {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}

function getDateKey(value) {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function getMonthKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getYearKey(value) {
  return String(new Date(value).getFullYear());
}

function getWeekKey(value) {
  const date = startOfDay(new Date(value));
  const dayNumber = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayNumber + 3);
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const firstDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNumber + 3);
  const week = 1 + Math.round((date - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function getDeviceInfo() {
  const ua = navigator.userAgent || "";
  return {
    platform: navigator.platform || "",
    browser: getBrowserName(ua),
    userAgent: sanitizeText(ua, 240),
    language: navigator.language || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`
  };
}

function getBrowserName(ua) {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Browser";
}

function getAuthCreationMs(user) {
  const creationTime = user?.metadata?.creationTime;
  const created = creationTime ? new Date(creationTime).getTime() : 0;
  return Number.isFinite(created) && created > 0 ? created : Date.now();
}

function sanitizeId(value) {
  const clean = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(clean)) {
    throw new Error("Invalid video id");
  }
  return clean;
}

function sanitizeText(value, maxLength = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeUrl(value) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  try {
    const url = new URL(clean, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
}

function sanitizeEventDetails(details) {
  return Object.fromEntries(
    Object.entries(details || {})
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .map(([key, value]) => [key, typeof value === "string" ? sanitizeText(value, 160) : value])
  );
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function formatWatchTime(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return safeSeconds > 0 ? "<1m" : "0m";
}

export function formatRelativeTime(timestampMs) {
  const value = Number(timestampMs || 0);
  if (!value) return "Not watched";

  const diff = Date.now() - value;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

// CENTRALIZED PROFILE SERVICE
let profileListeners = [];
let currentProfileData = null;
let unsubscribeDoc = null;

// Observe Auth state and attach real-time doc snapshot listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    if (unsubscribeDoc) unsubscribeDoc();
    
    const docRef = doc(db, "users", user.uid);
    unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        currentProfileData = { uid: user.uid, ...docSnap.data() };
        if (!docSnap.data().lastActiveMs) {
          ensureUserProfile(user); // backfill legacy/incomplete profile
        }
      } else {
        currentProfileData = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "BhaktiTube User",
          photoURL: user.photoURL || ""
        };
        ensureUserProfile(user); // create it now
      }
      
      // Save to fast-load cache
      localStorage.setItem("bt_user_profile_cache", JSON.stringify(currentProfileData));
      
      // Propagate update in real-time to all page subscribers
      profileListeners.forEach(callback => {
        try { callback(currentProfileData); } catch (e) { console.error(e); }
      });
    }, (error) => {
      console.error("Profile snapshot listener error:", error);
    });
  } else {
    if (unsubscribeDoc) {
      unsubscribeDoc();
      unsubscribeDoc = null;
    }
    currentProfileData = null;
    localStorage.removeItem("bt_user_profile_cache");
    profileListeners.forEach(callback => {
      try { callback(null); } catch (e) { console.error(e); }
    });
  }
});

export const profileService = {
  subscribe(callback) {
    profileListeners.push(callback);
    
    // Deliver cache instantly to avoid FOUC
    const cached = localStorage.getItem("bt_user_profile_cache");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        callback(parsed);
      } catch(e) {}
    } else if (currentProfileData) {
      callback(currentProfileData);
    }
    
    return () => {
      profileListeners = profileListeners.filter(cb => cb !== callback);
    };
  },
  getProfile() {
    if (currentProfileData) return currentProfileData;
    const cached = localStorage.getItem("bt_user_profile_cache");
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }
    return null;
  }
};

// DETERMINISTIC PREMIUM SVG AVATAR DATA URL GENERATOR
export function generateAvatarDataUrl(displayName, email, uid) {
  const cleanName = (displayName || "").trim();
  let letter = "B";
  if (cleanName) {
    letter = cleanName.charAt(0).toUpperCase();
  } else if (email) {
    letter = email.charAt(0).toUpperCase();
  }
  
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
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${colors[1]};stop-opacity:1" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(%23grad)" />
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="'Plus Jakarta Sans', 'Inter', sans-serif" font-size="44" font-weight="800" fill="%23ffffff">${letter}</text>
  </svg>`;
  
  return `data:image/svg+xml;utf8,${svg.replace(/#/g, '%23')}`;
}

// RESOLVE ACTIVE PHOTO URL PRIORITY
export function getActivePhotoURL(profile, user) {
  if (profile?.customPhotoURL) {
    return profile.customPhotoURL;
  }
  if (user?.providerData) {
    for (const prov of user.providerData) {
      if (prov.providerId === "google.com" && prov.photoURL) {
        return prov.photoURL;
      }
    }
  }
  if (user?.photoURL && !user.photoURL.startsWith("data:")) {
    return user.photoURL;
  }
  return "";
}
