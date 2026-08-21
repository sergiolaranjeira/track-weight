let currentWeek = 1;
let activeObjectUrls = [];

document.addEventListener("DOMContentLoaded", async () => {
  await fetchMealsJSON();
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
  const { heightM, startWeightKg, goalWeightKg } = MEAL_CONFIG.profile;
  document.getElementById("app-subtitle").textContent =
    `Personalized tracker for a ${heightM}m height profile, going from ${startWeightKg}kg to ${goalWeightKg}kg. Features Mon-Sun weekly views, exercise logs, Sunday progress photos, and weighted 0-10 daily quality scores.`;
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

  const startDayIndex = (currentWeek === 1) ? 2 : 0;

  for (let d = startDayIndex; d < 7; d++) {
    const stats = computeDayStats(currentWeek, d);
    const { dayKey, dayData, breakfast, snack1, lunch, snack2, dinner, dayConsumedCal, totalPlannedCal, isFullyDone, dateStr, score: dayScore, isCheat } = stats;

    const isSunday = (d === 6);
    const isWorkoutDay = (d === 0 || d === 2 || d === 4 || d === 5);
    const exerciseText = isWorkoutDay
      ? `<span class="workout-tag">30-Min Workout</span>`
      : `<span class="rest-tag">Active Recovery Walk / Rest</span>`;

    let scoreClass = "score-low";
    if (dayScore >= 8.5) scoreClass = "score-high";
    else if (dayScore >= 6.0) scoreClass = "score-mid";

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

async function removePhoto(dayKey) {
  if (confirm("Delete this progress photo?")) {
    await deletePhoto(dayKey);
    delete userState[dayKey].hasPhoto;
    saveState();
    renderCurrentWeek();
  }
}

function updateOverallProgress() {
  const { percent } = computeOverallProgress();
  document.getElementById("overall-percentage").textContent = `${percent}%`;
  document.getElementById("overall-bar").style.width = `${percent}%`;
}

async function resetAllData() {
  if (confirm("Reset all tracked progress, photos, notes, and body measurements?")) {
    userState = {};
    await clearAllPhotos();
    saveState();
    renderCurrentWeek();
  }
}
