let currentWeek = 1;
let activeObjectUrls = [];

document.addEventListener("DOMContentLoaded", async () => {
  rewriteInternalLinks();
  await fetchMealsJSON();
  loadConfig();
  renderProfileSubtitle();
  loadState();
  try {
    await migrateLegacyPhotos();
  } catch (err) {
    console.error("Photo migration failed, continuing without it:", err);
  }
  renderWeekSelector();
  renderCurrentWeek();
  updateOverallProgress();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// --- Modal system (used for confirmations and the quick-entry form) ---

function showModal(innerHTML) {
  document.getElementById("modal-box").innerHTML = innerHTML;
  document.getElementById("modal-overlay").hidden = false;
}

function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  if (overlay.hidden) return;
  overlay.hidden = true;
  document.getElementById("modal-box").innerHTML = "";
}

function showConfirmModal(title, message, onConfirm, confirmLabel = "Confirm", danger = true) {
  showModal(`
    <div class="modal-title">${title}</div>
    <div class="modal-message">${message}</div>
    <div class="modal-actions">
      <button class="btn-modal-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-modal-confirm ${danger ? 'btn-modal-danger' : ''}" id="modal-confirm-btn">${confirmLabel}</button>
    </div>
  `);
  document.getElementById("modal-confirm-btn").onclick = () => {
    closeModal();
    onConfirm();
  };
}

async function savePhoto(dayKey, blob) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).put(blob, dayKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deletePhoto(dayKey) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).delete(dayKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAllPhotos() {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// One-time migration for photos saved by older versions as base64 in userState.
async function migrateLegacyPhotos() {
  let migrated = false;
  for (const dayKey of Object.keys(userState)) {
    const dayData = userState[dayKey];
    if (dayData && dayData.photo) {
      const blob = await (await fetch(dayData.photo)).blob();
      await savePhoto(dayKey, blob);
      dayData.hasPhoto = true;
      delete dayData.photo;
      migrated = true;
    }
  }
  if (migrated) saveState();
}

async function hydratePhotos() {
  const imgs = document.querySelectorAll(".photo-lazy");
  for (const img of imgs) {
    const blob = await getPhoto(img.dataset.daykey);
    if (blob) {
      const url = URL.createObjectURL(blob);
      activeObjectUrls.push(url);
      img.src = url;
    }
  }
}

function updateMealOverride(dayKey, taskId, field, value) {
  if (!userState[dayKey]) userState[dayKey] = {};
  const key = field === 'cal' ? `${taskId}_cal` : `${taskId}_name`;

  if (field === 'cal') {
    const num = parseFloat(value);
    if (value === '' || isNaN(num)) {
      delete userState[dayKey][key];
    } else {
      userState[dayKey][key] = Math.max(0, num);
    }
  } else {
    if (value.trim() === '') {
      delete userState[dayKey][key];
    } else {
      userState[dayKey][key] = value;
    }
  }

  saveState();
  renderCurrentWeek();
}

function renderProfileSubtitle() {
  const { name, heightM, startWeightKg, goalWeightKg } = MEAL_CONFIG.profile;
  document.getElementById("app-subtitle").textContent =
    `Personalized tracker for a ${heightM}m height profile, going from ${startWeightKg}kg to ${goalWeightKg}kg. Features Mon-Sun weekly views, exercise logs, Sunday progress photos, and weighted 0-10 daily quality scores.`;
  const badge = document.querySelector(".brand-badge");
  if (badge) {
    const startDate = getStartDate();
    const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const profileLabel = PROFILE_NAME !== 'default' ? ` • ${PROFILE_NAME}` : '';
    badge.textContent = `Start Date: ${dateStr} • Mon-Sun Calendar${profileLabel}`;
  }
  const welcomeLine = document.getElementById("welcome-line");
  if (welcomeLine) {
    if (name) {
      welcomeLine.textContent = `Welcome, ${name} 👋`;
      welcomeLine.hidden = false;
    } else {
      welcomeLine.hidden = true;
    }
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
  updateOverallProgress();
}

function renderWeekSelector() {
  const container = document.getElementById("week-buttons-container");
  container.innerHTML = "";

  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const btn = document.createElement("button");
    btn.className = `btn-week ${w === currentWeek ? "active" : ""}`;
    btn.textContent = `Week ${w}`;
    btn.onclick = () => {
      currentWeek = w;
      renderWeekSelector();
      renderCurrentWeek();
    };
    container.appendChild(btn);
  }
}

function renderCurrentWeek() {
  activeObjectUrls.forEach(url => URL.revokeObjectURL(url));
  activeObjectUrls = [];

  const infoTag = document.getElementById("week-info-title");
  let phaseText = "";
  if (currentWeek <= 2) {
    phaseText = "Phase 1: Rapid Loss Phase";
  } else if (currentWeek <= 8) {
    phaseText = "Phase 2: Core Fat Loss Phase (~1kg/wk)";
  } else {
    phaseText = "Phase 3: Final Push & Maintenance";
  }

  infoTag.innerHTML = `Week ${currentWeek} <span>${phaseText}</span>`;

  const grid = document.getElementById("days-grid-container");
  grid.innerHTML = "";

  const startDayIndex = (currentWeek === 1) ? getWeek1StartDayIndex() : 0;

  for (let d = startDayIndex; d < 7; d++) {
    const stats = computeDayStats(currentWeek, d);
    const { dayKey, dayData, breakfast, snack1, lunch, snack2, dinner, dayConsumedCal, totalPlannedCal, isFullyDone, dateStr, score: dayScore, isCheat } = stats;

    const isSunday = (d === 6);
    const isWorkoutDay = (d === 0 || d === 2 || d === 4 || d === 5);
    const exerciseText = isWorkoutDay
      ? `<span class="workout-tag">30-Min Workout</span>`
      : `<span class="rest-tag">Active Recovery Walk / Rest</span>`;

    let scoreClass = "score-low";
    if (dayScore >= APP_CONFIG.scoring.highThreshold) scoreClass = "score-high";
    else if (dayScore >= APP_CONFIG.scoring.midThreshold) scoreClass = "score-mid";

    const card = document.createElement("div");
    card.className = `day-card ${isFullyDone ? "completed-day" : ""}`;

    let sundayExtrasHTML = "";
    if (isSunday) {
      const photoHTML = dayData.hasPhoto
        ? `<img data-daykey="${dayKey}" class="photo-preview photo-lazy" alt="Progress Photo">
           <button class="btn-remove-photo" onclick="removePhoto('${dayKey}')">Remove Photo</button>`
        : `<button class="btn-photo" onclick="document.getElementById('${dayKey}_file').click()">
             📷 Upload Progress Photo
           </button>
           <input type="file" id="${dayKey}_file" accept="image/*" style="display:none" onchange="handlePhotoUpload('${dayKey}', this)">`;

      sundayExtrasHTML = `
        <div class="section-divider"></div>
        <div class="sunday-box">
          <div class="box-title">Sunday Check-In</div>
          <div class="measure-grid">
            <div class="measure-field">
              <label for="${dayKey}_weight">Weight (kg)</label>
              <input type="number" step="0.1" id="${dayKey}_weight" placeholder="kg" value="${dayData.weight || ''}" onchange="saveInputField('${dayKey}', 'weight', this.value)">
            </div>
            <div class="measure-field">
              <label for="${dayKey}_waist">Belly/Waist (cm)</label>
              <input type="number" step="0.1" id="${dayKey}_waist" placeholder="cm" value="${dayData.waist || ''}" onchange="saveInputField('${dayKey}', 'waist', this.value)">
            </div>
            <div class="measure-field">
              <label for="${dayKey}_chest">Chest (cm)</label>
              <input type="number" step="0.1" id="${dayKey}_chest" placeholder="cm" value="${dayData.chest || ''}" onchange="saveInputField('${dayKey}', 'chest', this.value)">
            </div>
            <div class="measure-field">
              <label for="${dayKey}_quads">Quads (cm)</label>
              <input type="number" step="0.1" id="${dayKey}_quads" placeholder="cm" value="${dayData.quads || ''}" onchange="saveInputField('${dayKey}', 'quads', this.value)">
            </div>
          </div>

          <div class="section-divider" style="margin: 0.2rem 0;"></div>

          <div class="photo-upload-zone">
            ${photoHTML}
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div>
        <div class="day-header">
          <div>
            <div class="day-title">${mondayDays[d]}</div>
            <div class="day-date">${dateStr}</div>
          </div>
          <div class="header-badges">
            <span class="score-pill ${scoreClass}">★ ${dayScore} / 10</span>
            <span class="calorie-pill ${isCheat ? 'cheat' : ''}">${dayConsumedCal} / ${totalPlannedCal} kcal</span>
          </div>
        </div>

        <div class="checklist">
          ${renderCheckItem(dayKey, 'm1', dayData.m1, 'Breakfast', breakfast.name, breakfast.cal, false, true)}
          ${renderCheckItem(dayKey, 'm2', dayData.m2, 'Morning Snack', snack1.name, snack1.cal, false, true)}
          ${renderCheckItem(dayKey, 'm3', dayData.m3, 'Lunch (Full Meal)', lunch.name, lunch.cal, false, true)}
          ${renderCheckItem(dayKey, 'm4', dayData.m4, 'Afternoon Snack', snack2.name, snack2.cal, false, true)}
          ${renderCheckItem(dayKey, 'm5', dayData.m5, isCheat ? 'Dinner (Cheat Meal 🎉)' : 'Dinner (½ Meal + Yogurt)', dinner.name, dinner.cal, isCheat, true)}
          ${renderCheckItem(dayKey, 'steps', dayData.steps, '10,000 Steps', 'Daily movement goal', 0)}

          ${renderCheckItem(dayKey, 'exercise', dayData.exercise, 'Exercise Routine', exerciseText, 0)}
          <div class="exercise-comment-box">
            <input type="text" id="${dayKey}_ex_notes" placeholder="Exercise Log (e.g. 30 Pushups, 5km walk...)" value="${dayData.ex_notes || ''}" onchange="saveInputField('${dayKey}', 'ex_notes', this.value)">
          </div>
        </div>

        ${sundayExtrasHTML}

        <div class="notes-box">
          <label for="${dayKey}_notes">Daily Notes & Log</label>
          <textarea id="${dayKey}_notes" placeholder="Energy, cravings, weight notes..." onchange="saveInputField('${dayKey}', 'notes', this.value)">${dayData.notes || ''}</textarea>
        </div>
      </div>
    `;

    grid.appendChild(card);
  }

  hydratePhotos();
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function renderCheckItem(dayKey, taskId, isChecked, title, desc, cal, isCheat = false, editable = false) {
  const calField = editable
    ? `<input type="number" class="item-cal-input ${isCheat ? 'cheat-tag' : ''}" value="${cal}" min="0" step="5"
         onclick="event.stopPropagation()" onchange="updateMealOverride('${dayKey}', '${taskId}', 'cal', this.value)" aria-label="${escapeAttr(title)} calories">`
    : (cal > 0 ? `<span class="item-cal ${isCheat ? 'cheat-tag' : ''}">${isCheat ? '~' + cal : '+' + cal} kcal</span>` : '');

  const descField = editable
    ? `<input type="text" class="item-desc-input" value="${escapeAttr(desc)}"
         onclick="event.stopPropagation()" onchange="updateMealOverride('${dayKey}', '${taskId}', 'name', this.value)" aria-label="${escapeAttr(title)} description">`
    : `<span class="item-desc">${desc}</span>`;

  return `
    <label class="check-item" onclick="event.stopPropagation();">
      <input type="checkbox" id="${dayKey}_${taskId}" ${isChecked ? "checked" : ""} onchange="toggleTask('${dayKey}', '${taskId}')">
      <span class="checkbox-custom"></span>
      <span class="item-content">
        <span class="item-title">
          <span>${title}</span>
          ${calField}
        </span>
        ${descField}
      </span>
    </label>
  `;
}

function toggleTask(dayKey, taskId) {
  if (!userState[dayKey]) userState[dayKey] = {};
  userState[dayKey][taskId] = !userState[dayKey][taskId];
  saveState();
  renderCurrentWeek();
}

function saveInputField(dayKey, field, value) {
  if (!userState[dayKey]) userState[dayKey] = {};
  userState[dayKey][field] = value;
  saveState();
  renderCurrentWeek();
}

function handlePhotoUpload(dayKey, input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    const img = new Image();
    img.src = e.target.result;
    img.onload = function() {
      const canvas = document.createElement("canvas");
      const maxDim = 500;
      let width = img.width;
      let height = img.height;

      if (width > height && width > maxDim) {
        height *= maxDim / width;
        width = maxDim;
      } else if (height > maxDim) {
        width *= maxDim / height;
        height = maxDim;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(async (blob) => {
        try {
          await savePhoto(dayKey, blob);
          saveInputField(dayKey, 'hasPhoto', true);
        } catch (err) {
          console.error("Failed to save photo:", err);
          alert("Couldn't save this photo (storage may be full or unavailable). Please try again.");
        }
      }, "image/jpeg", 0.7);
    };
  };
  reader.readAsDataURL(file);
}

function removePhoto(dayKey) {
  showConfirmModal(
    "Delete Photo",
    "This progress photo will be permanently deleted.",
    async () => {
      await deletePhoto(dayKey);
      delete userState[dayKey].hasPhoto;
      saveState();
      renderCurrentWeek();
    },
    "Delete Photo"
  );
}

function updateOverallProgress() {
  const { percent } = computeOverallProgress();
  document.getElementById("overall-percentage").textContent = `${percent}%`;
  document.getElementById("overall-bar").style.width = `${percent}%`;
}

function resetAllData() {
  showConfirmModal(
    "Reset All Data",
    "This will permanently delete all tracked progress, photos, notes, and body measurements. This cannot be undone.",
    async () => {
      userState = {};
      await clearAllPhotos();
      saveState();
      renderCurrentWeek();
    },
    "Reset Everything"
  );
}

// --- Quick-entry: log weight/measurements for any day, not just Sundays ---

function openLogEntryModal() {
  const todayPlanDay = findPlanDayForDate(new Date());
  const defaultWeek = todayPlanDay ? todayPlanDay.week : currentWeek;
  const defaultDay = todayPlanDay ? todayPlanDay.day : (currentWeek === 1 ? 2 : 0);

  const weekOptions = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1)
    .map(w => `<option value="${w}" ${w === defaultWeek ? 'selected' : ''}>Week ${w}</option>`)
    .join('');

  showModal(`
    <div class="modal-title">Log Weight & Measurements</div>
    <div class="modal-message">Record an entry for any day in your plan — not just Sundays.</div>
    <div class="modal-field-row">
      <div class="modal-field">
        <label for="log-week-select">Week</label>
        <select id="log-week-select" onchange="populateLogDaySelect()">${weekOptions}</select>
      </div>
      <div class="modal-field">
        <label for="log-day-select">Day</label>
        <select id="log-day-select" onchange="prefillLogEntryFields()"></select>
      </div>
    </div>
    <div class="modal-field-row">
      <div class="modal-field">
        <label for="log-weight-input">Weight (kg)</label>
        <input type="number" step="0.1" id="log-weight-input" placeholder="kg">
      </div>
      <div class="modal-field">
        <label for="log-waist-input">Waist (cm)</label>
        <input type="number" step="0.1" id="log-waist-input" placeholder="cm">
      </div>
    </div>
    <div class="modal-field-row">
      <div class="modal-field">
        <label for="log-chest-input">Chest (cm)</label>
        <input type="number" step="0.1" id="log-chest-input" placeholder="cm">
      </div>
      <div class="modal-field">
        <label for="log-quads-input">Quads (cm)</label>
        <input type="number" step="0.1" id="log-quads-input" placeholder="cm">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-modal-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-modal-confirm" onclick="saveLogEntry()">Save Entry</button>
    </div>
  `);

  populateLogDaySelect(defaultDay);
}

function populateLogDaySelect(preselectDay) {
  const week = parseInt(document.getElementById('log-week-select').value, 10);
  const daySelect = document.getElementById('log-day-select');
  const startDay = week === 1 ? 2 : 0;

  const options = [];
  for (let d = startDay; d < 7; d++) {
    options.push(`<option value="${d}">${mondayDays[d]} · ${getFormattedDate(week, d)}</option>`);
  }
  daySelect.innerHTML = options.join('');

  if (preselectDay !== undefined && preselectDay >= startDay) {
    daySelect.value = preselectDay;
  }

  prefillLogEntryFields();
}

function prefillLogEntryFields() {
  const week = parseInt(document.getElementById('log-week-select').value, 10);
  const day = parseInt(document.getElementById('log-day-select').value, 10);
  const dayData = userState[`w${week}_d${day}`] || {};

  document.getElementById('log-weight-input').value = dayData.weight || '';
  document.getElementById('log-waist-input').value = dayData.waist || '';
  document.getElementById('log-chest-input').value = dayData.chest || '';
  document.getElementById('log-quads-input').value = dayData.quads || '';
}

function saveLogEntry() {
  const week = parseInt(document.getElementById('log-week-select').value, 10);
  const day = parseInt(document.getElementById('log-day-select').value, 10);
  const dayKey = `w${week}_d${day}`;

  if (!userState[dayKey]) userState[dayKey] = {};
  ['weight', 'waist', 'chest', 'quads'].forEach(field => {
    userState[dayKey][field] = document.getElementById(`log-${field}-input`).value;
  });

  saveState();
  if (week === currentWeek) renderCurrentWeek();
  closeModal();
}

// --- Export / Import backup ---

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function exportData() {
  const photos = {};
  for (const { dayKey } of getAllPlanDays()) {
    const blob = await getPhoto(dayKey);
    if (blob) photos[dayKey] = await blobToBase64(blob);
  }

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    userState,
    photos
  };

  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `track-weight-backup-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- CSV export (daily scores, calories, and measurements) ---

function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function exportCSV() {
  const headers = [
    'Date', 'Week', 'Day', 'Score (0-10)', 'Calories Consumed', 'Calories Planned',
    'Meals Completed', 'Steps Hit', 'Exercise Done',
    'Weight (kg)', 'Waist (cm)', 'Chest (cm)', 'Quads (cm)',
    'Exercise Notes', 'Daily Notes'
  ];

  const rows = getAllPlanDays().map(({ week, day }) => {
    const stats = computeDayStats(week, day);
    const d = stats.dayData;
    const date = getActualDate(week, day);
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    return [
      isoDate,
      week,
      stats.dayName,
      stats.score,
      stats.dayConsumedCal,
      stats.totalPlannedCal,
      `${stats.completedCount}/${TASKS.length}`,
      d.steps ? 'Yes' : 'No',
      d.exercise ? 'Yes' : 'No',
      d.weight || '',
      d.waist || '',
      d.chest || '',
      d.quads || '',
      d.ex_notes || '',
      d.notes || ''
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(escapeCsvField).join(','))
    .join('\r\n');

  // Leading BOM so Excel opens the UTF-8 file correctly instead of mangling accents.
  const blob = new Blob([`﻿${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `track-weight-data-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function triggerImport() {
  document.getElementById('import-file-input').click();
}

function onImportFileSelected(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  showConfirmModal(
    "Import Backup",
    `This will overwrite your current tracker data (progress, notes, measurements, and photos) with the contents of "${escapeAttr(file.name)}". This cannot be undone.`,
    async () => {
      try {
        await importDataFromFile(file);
      } finally {
        input.value = '';
      }
    },
    "Import & Overwrite"
  );
}

async function importDataFromFile(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);

    if (!payload || typeof payload.userState !== 'object') {
      throw new Error("Backup file is missing userState");
    }

    userState = payload.userState;
    await clearAllPhotos();
    saveState();

    if (payload.photos) {
      for (const [dayKey, dataUrl] of Object.entries(payload.photos)) {
        const blob = await (await fetch(dataUrl)).blob();
        await savePhoto(dayKey, blob);
      }
    }

    renderCurrentWeek();
    alert("Backup imported successfully.");
  } catch (err) {
    console.error("Import failed:", err);
    alert("Couldn't import this file — it doesn't look like a valid track-weight backup.");
  }
}

// --- Profile switcher ---

function openProfileSwitcher() {
  const existing = getStoredProfiles();

  const profileItems = existing.map(p => {
    const label = p === 'default' ? 'Default' : p;
    const isCurrent = p === PROFILE_NAME;
    const url = p === 'default' ? 'index.html' : `index.html?profile=${encodeURIComponent(p)}`;
    return `
      <a class="profile-item ${isCurrent ? 'profile-item-active' : ''}" href="${url}">
        <span class="profile-item-name">${label}</span>
        ${isCurrent ? '<span class="profile-item-badge">Active</span>' : ''}
      </a>`;
  }).join('');

  showModal(`
    <div class="modal-title">Switch Profile</div>
    <div class="modal-message">Each profile has its own plan, data, and settings stored separately in this browser.</div>
    <div class="profile-list">${profileItems}</div>
    <div class="modal-field" style="margin-top:1rem;">
      <label for="new-profile-input" style="font-size:0.7rem;font-weight:600;color:var(--text-muted);">New profile name</label>
      <div style="display:flex;gap:0.5rem;margin-top:0.3rem;">
        <input type="text" id="new-profile-input" placeholder="e.g. Antonia" style="flex:1;background:rgba(15,23,42,0.8);border:1px solid var(--card-border);border-radius:8px;padding:0.5rem 0.6rem;color:var(--text-main);font-size:0.85rem;font-family:var(--font);outline:none;">
        <button class="btn-modal-confirm" onclick="createProfile()" style="flex-shrink:0;">Create</button>
      </div>
    </div>
    <div class="modal-actions" style="margin-top:0.75rem;">
      <button class="btn-modal-cancel" onclick="closeModal()">Close</button>
    </div>
  `);
}

function createProfile() {
  const input = document.getElementById('new-profile-input');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  window.location.href = `index.html?profile=${encodeURIComponent(safeName)}`;
}
