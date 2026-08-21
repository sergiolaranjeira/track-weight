// Data loading and calculation logic shared between the tracker (script.js)
// and the stats page (stats.js), so both stay in sync from one source of truth.

// Profile — derived from ?profile= URL param. 'default' keeps original key names
// so existing data is never broken. Named profiles get their own namespaced keys.
const PROFILE_NAME = new URLSearchParams(window.location.search).get('profile') || 'default';
const STORAGE_KEY = PROFILE_NAME === 'default'
  ? "weightLossTracker_10weeks_v8"
  : `weightLossTracker_${PROFILE_NAME}_v8`;
const CONFIG_KEY = PROFILE_NAME === 'default'
  ? "weightLossTrackerConfig"
  : `weightLossTrackerConfig_${PROFILE_NAME}`;
const PHOTO_DB_NAME_KEY = PROFILE_NAME === 'default'
  ? "trackWeightPhotos"
  : `trackWeightPhotos_${PROFILE_NAME}`;
let TOTAL_WEEKS = 10;

// Builds a same-site URL with the current profile param preserved.
function profileUrl(page) {
  const url = new URL(page, location.href);
  if (PROFILE_NAME !== 'default') url.searchParams.set('profile', PROFILE_NAME);
  return url.toString();
}

// Rewrites all internal <a href> links on the page to include ?profile= so
// navigation never drops the active profile.
function rewriteInternalLinks() {
  if (PROFILE_NAME === 'default') return;
  document.querySelectorAll('a[href]').forEach(a => {
    try {
      const url = new URL(a.href, location.href);
      if (url.hostname === location.hostname && !url.searchParams.has('profile')) {
        url.searchParams.set('profile', PROFILE_NAME);
        a.href = url.toString();
      }
    } catch (_) {}
  });
}

// Returns all profile names found in localStorage (including 'default').
function getStoredProfiles() {
  const profiles = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === 'weightLossTrackerConfig') {
      profiles.add('default');
    } else {
      const m = key.match(/^weightLossTrackerConfig_(.+)$/);
      if (m) profiles.add(m[1]);
    }
  }
  return [...profiles];
}
const TASKS = ['m1', 'm2', 'm3', 'm4', 'm5', 'steps', 'exercise'];
const mondayDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DEFAULT_CONFIG = {
  planStartDate: "2026-08-26",
  totalWeeks: 10,
  profile: {
    name: "",
    heightM: 1.93, startWeightKg: 94, goalWeightKg: 85,
    initialWaist: null, initialChest: null, initialQuads: null
  },
  defaultBreakfast: { name: "2 Boiled Eggs", cal: 140 },
  defaultSnack1: { name: "Protein Shake OR 40g Jerky", cal: 150 },
  defaultSnack2: { name: "Cottage Cheese OR Edamame", cal: 150 },
  scoring: { cheatPerfectCal: 2100, cheatPartialCal: 2400, highThreshold: 8.5, midThreshold: 6.0 }
};

let APP_CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

function loadConfig() {
  const saved = localStorage.getItem(CONFIG_KEY);
  if (saved) {
    try {
      const p = JSON.parse(saved);
      APP_CONFIG = {
        ...DEFAULT_CONFIG, ...p,
        profile: { ...DEFAULT_CONFIG.profile, ...(p.profile || {}) },
        defaultBreakfast: { ...DEFAULT_CONFIG.defaultBreakfast, ...(p.defaultBreakfast || {}) },
        defaultSnack1: { ...DEFAULT_CONFIG.defaultSnack1, ...(p.defaultSnack1 || {}) },
        defaultSnack2: { ...DEFAULT_CONFIG.defaultSnack2, ...(p.defaultSnack2 || {}) },
        scoring: { ...DEFAULT_CONFIG.scoring, ...(p.scoring || {}) }
      };
    } catch (e) {
      APP_CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  }
  TOTAL_WEEKS = APP_CONFIG.totalWeeks;
  MEAL_CONFIG.profile = APP_CONFIG.profile;
  MEAL_CONFIG.defaultBreakfast = APP_CONFIG.defaultBreakfast;
  MEAL_CONFIG.defaultSnack1 = APP_CONFIG.defaultSnack1;
  MEAL_CONFIG.defaultSnack2 = APP_CONFIG.defaultSnack2;
}

function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  APP_CONFIG = cfg;
  TOTAL_WEEKS = cfg.totalWeeks;
}

function getStartDate() {
  try {
    const [y, m, d] = APP_CONFIG.planStartDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  } catch (e) {
    return new Date(2026, 7, 26);
  }
}

// Returns the Mon-Sun day index (Mon=0..Sun=6) that week 1 starts on.
function getWeek1StartDayIndex() {
  return (getStartDate().getDay() + 6) % 7;
}

let MEAL_CONFIG = {
  profile: {
    name: "",
    heightM: 1.93, startWeightKg: 94, goalWeightKg: 85,
    initialWaist: null, initialChest: null, initialQuads: null
  },
  defaultBreakfast: { name: "2 Boiled Eggs", cal: 140 },
  defaultSnack1: { name: "Protein Shake OR 40g Jerky", cal: 150 },
  defaultSnack2: { name: "Cottage Cheese OR Edamame", cal: 150 },
  lunchesWeek1: [
    { name: "Tikka Masala", cal: 490 }, { name: "Chili sin Carne", cal: 445 },
    { name: "Coco Curry Pasta", cal: 540 }, { name: "Umami Rice", cal: 425 },
    { name: "Brilliant Bolognese", cal: 520 }, { name: "Naked Taco", cal: 495 },
    { name: "Smoky Lentil Stew", cal: 525 }
  ],
  lunchesWeek2: [
    { name: "Peas & Love", cal: 545 }, { name: "Creamy Fricassée", cal: 450 },
    { name: "Garden Gnocchi", cal: 470 }, { name: "Red Curry", cal: 470 },
    { name: "Sesame Quinoa Salad", cal: 525 }, { name: "Bami Goreng", cal: 470 },
    { name: "Potato Panorama", cal: 440 }
  ],
  dinnersWeek1: [
    { name: "½ Green Forest Bowl + Greek Yogurt", cal: 365 }, { name: "½ Nasi Goreng + Greek Yogurt", cal: 365 },
    { name: "½ Golden Glow Bowl + Greek Yogurt", cal: 395 }, { name: "½ Red Pesto Gnocchi + Greek Yogurt", cal: 400 },
    { name: "½ Tikka Masala + Greek Yogurt", cal: 345 }, { name: "½ Chili sin Carne + Greek Yogurt", cal: 320 },
    { name: "SUNDAY CHEAT MEAL (Enjoy with Wife!)", cal: 850, isCheat: true }
  ],
  dinnersWeek2: [
    { name: "½ Nasi Goreng + Greek Yogurt", cal: 365 }, { name: "½ Golden Glow Bowl + Greek Yogurt", cal: 395 },
    { name: "½ Red Pesto Gnocchi + Greek Yogurt", cal: 400 }, { name: "½ Tikka Masala + Greek Yogurt", cal: 345 },
    { name: "½ Chili sin Carne + Greek Yogurt", cal: 320 }, { name: "½ Green Forest Bowl + Greek Yogurt", cal: 365 },
    { name: "SUNDAY CHEAT MEAL (Enjoy with Wife!)", cal: 850, isCheat: true }
  ]
};

let userState = {};

async function fetchMealsJSON() {
  try {
    const res = await fetch('files/meals.json');
    if (res.ok) {
      MEAL_CONFIG = await res.json();
    }
  } catch (e) {
    console.log("Loaded default meal config fallback.");
  }
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { userState = JSON.parse(saved); } catch (e) { userState = {}; }
  }
}

function getActualDate(weekIndex, dayIndex) {
  const startDate = getStartDate();
  const s = getWeek1StartDayIndex();
  const daysToAdd = weekIndex === 1
    ? dayIndex - s
    : (7 - s) + ((weekIndex - 2) * 7) + dayIndex;
  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + daysToAdd);
  return targetDate;
}

function getFormattedDate(weekIndex, dayIndex) {
  return getActualDate(weekIndex, dayIndex).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Finds the {week, day, dayKey} plan slot matching a given calendar date, or null
// if the date falls outside the 10-week plan. Used to default quick-entry forms to "today".
function findPlanDayForDate(date) {
  const targetTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return getAllPlanDays().find(({ week, day }) => {
    const d = getActualDate(week, day);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === targetTime;
  }) || null;
}

// Resolves a meal's effective name/calories for one day, preferring a per-day
// override (set via the editable fields) over the meals.json plan default.
function getEffectiveMeal(dayData, taskId, defaultName, defaultCal, isCheat = false) {
  const nameOverride = dayData[`${taskId}_name`];
  const calOverride = dayData[`${taskId}_cal`];
  const name = (nameOverride !== undefined && nameOverride !== '') ? nameOverride : defaultName;
  const cal = (calOverride !== undefined && calOverride !== '') ? Number(calOverride) : defaultCal;
  return { name, cal: isNaN(cal) ? 0 : cal, isCheat };
}

// AUTOMATED DAILY QUALITY SCORE (0-10 SCALE)
function calculateDayScore(dayData, dayConsumedCal, totalPlannedCal, isCheat) {
  let score = 0;

  // 1. Calorie Target (4.0 Points Max / 40%)
  // Scored relative to that day's own planned total (rather than a fixed kcal band) so that
  // checking every meal always earns full marks, even after the meal plan is edited in meals.json.
  if (dayConsumedCal > 0) {
    if (isCheat) {
      if (dayConsumedCal <= APP_CONFIG.scoring.cheatPerfectCal) score += 4.0;
      else if (dayConsumedCal <= APP_CONFIG.scoring.cheatPartialCal) score += 2.0;
    } else {
      const planRatio = dayConsumedCal / totalPlannedCal;
      if (planRatio >= 0.95) {
        score += 4.0;
      } else if (planRatio >= 0.75) {
        score += 2.0;
      }
    }
  }

  // 2. Meal Routine (3.0 Points Max / 30%)
  const mealsChecked = ['m1', 'm2', 'm3', 'm4', 'm5'].filter(k => dayData[k]).length;
  score += (mealsChecked * 0.6);

  // 3. Exercise Routine (2.0 Points Max / 20%)
  if (dayData.exercise) {
    score += 2.0;
  }

  // 4. 10k Steps Target (1.0 Point Max / 10%)
  if (dayData.steps) {
    score += 1.0;
  }

  return Math.min(10, Math.round(score * 10) / 10);
}

// Every {week, day} slot in the plan, in chronological order.
function getAllPlanDays() {
  const days = [];
  const week1Start = getWeek1StartDayIndex();
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const startDay = (w === 1) ? week1Start : 0;
    for (let d = startDay; d < 7; d++) {
      days.push({ week: w, day: d, dayKey: `w${w}_d${d}` });
    }
  }
  return days;
}

// True if the user has actually interacted with this day (vs. an untouched default {}).
function hasAnyData(dayData) {
  if (!dayData) return false;
  return Object.keys(dayData).some(k => {
    const v = dayData[k];
    return v === true || typeof v === 'number' || (typeof v === 'string' && v.trim() !== '');
  });
}

// Full computed stats for one day: effective meals, calories, completion, and score.
// Single source of truth so the tracker view and the stats page can't drift apart.
function computeDayStats(weekIndex, dayIndex) {
  const dayKey = `w${weekIndex}_d${dayIndex}`;
  const dayData = userState[dayKey] || {};

  const isMenuWeek1 = (weekIndex % 2 !== 0);
  const lunchObj = isMenuWeek1 ? MEAL_CONFIG.lunchesWeek1[dayIndex] : MEAL_CONFIG.lunchesWeek2[dayIndex];
  const dinnerObj = isMenuWeek1 ? MEAL_CONFIG.dinnersWeek1[dayIndex] : MEAL_CONFIG.dinnersWeek2[dayIndex];

  const breakfast = getEffectiveMeal(dayData, 'm1', MEAL_CONFIG.defaultBreakfast.name, MEAL_CONFIG.defaultBreakfast.cal);
  const snack1 = getEffectiveMeal(dayData, 'm2', MEAL_CONFIG.defaultSnack1.name, MEAL_CONFIG.defaultSnack1.cal);
  const lunch = getEffectiveMeal(dayData, 'm3', lunchObj.name, lunchObj.cal);
  const snack2 = getEffectiveMeal(dayData, 'm4', MEAL_CONFIG.defaultSnack2.name, MEAL_CONFIG.defaultSnack2.cal);
  const dinner = getEffectiveMeal(dayData, 'm5', dinnerObj.name, dinnerObj.cal, dinnerObj.isCheat);

  let dayConsumedCal = 0;
  if (dayData.m1) dayConsumedCal += breakfast.cal;
  if (dayData.m2) dayConsumedCal += snack1.cal;
  if (dayData.m3) dayConsumedCal += lunch.cal;
  if (dayData.m4) dayConsumedCal += snack2.cal;
  if (dayData.m5) dayConsumedCal += dinner.cal;

  const totalPlannedCal = breakfast.cal + snack1.cal + lunch.cal + snack2.cal + dinner.cal;
  const completedCount = TASKS.filter(k => dayData[k]).length;
  const score = calculateDayScore(dayData, dayConsumedCal, totalPlannedCal, dinnerObj.isCheat);

  return {
    dayKey, weekIndex, dayIndex, dayData,
    dayName: mondayDays[dayIndex],
    dateStr: getFormattedDate(weekIndex, dayIndex),
    breakfast, snack1, lunch, snack2, dinner,
    dayConsumedCal, totalPlannedCal, completedCount,
    isFullyDone: completedCount === TASKS.length,
    isCheat: !!dinnerObj.isCheat,
    score
  };
}

function computeOverallProgress() {
  let totalTasks = 0;
  let completedTasks = 0;

  getAllPlanDays().forEach(({ week, day }) => {
    const dayData = userState[`w${week}_d${day}`] || {};
    TASKS.forEach(k => {
      totalTasks++;
      if (dayData[k]) completedTasks++;
    });
  });

  const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  return { percent, completedTasks, totalTasks };
}

// Photos are stored as Blobs in IndexedDB instead of base64 in localStorage,
// since localStorage quotas (~5-10MB) fill up fast with 10 weeks of images.
const PHOTO_STORE = "photos";

function openPhotoDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB_NAME_KEY, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(PHOTO_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getPhoto(dayKey) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(PHOTO_STORE, "readonly").objectStore(PHOTO_STORE).get(dayKey);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
