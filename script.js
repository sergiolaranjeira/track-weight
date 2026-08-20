let MEAL_CONFIG = {
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

const TOTAL_WEEKS = 10;
const TASKS = ['m1', 'm2', 'm3', 'm4', 'm5', 'steps', 'exercise'];
const mondayDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

let currentWeek = 1;
let userState = {};

document.addEventListener("DOMContentLoaded", async () => {
  await fetchMealsJSON();
  loadState();
  renderWeekSelector();
  renderCurrentWeek();
  updateOverallProgress();
});

async function fetchMealsJSON() {
  try {
    const res = await fetch('meals.json');
    if (res.ok) {
      MEAL_CONFIG = await res.json();
    }
  } catch (e) {
    console.log("Loaded default meal config fallback.");
  }
}

function loadState() {
  const saved = localStorage.getItem("weightLossTracker_10weeks_v8");
  if (saved) {
    try { userState = JSON.parse(saved); } catch (e) { userState = {}; }
  }
}

function saveState() {
  localStorage.setItem("weightLossTracker_10weeks_v8", JSON.stringify(userState));
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

function getFormattedDate(weekIndex, dayIndex) {
  const startDate = new Date(2026, 7, 26);
  
  let daysToAdd = 0;
  if (weekIndex === 1) {
    daysToAdd = dayIndex - 2;
  } else {
    daysToAdd = 5 + ((weekIndex - 2) * 7) + dayIndex;
  }
  
  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + daysToAdd);
  return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// AUTOMATED DAILY QUALITY SCORE (0-10 SCALE)
function calculateDayScore(dayData, dayConsumedCal, isCheat) {
  let score = 0;

  // 1. Calorie Target (4.0 Points Max / 40%)
  if (dayConsumedCal > 0) {
    if (isCheat) {
      if (dayConsumedCal <= 2100) score += 4.0;
      else if (dayConsumedCal <= 2400) score += 2.0;
    } else {
      if (dayConsumedCal >= 1400 && dayConsumedCal <= 1650) {
        score += 4.0;
      } else if ((dayConsumedCal >= 1200 && dayConsumedCal < 1400) || (dayConsumedCal > 1650 && dayConsumedCal <= 1850)) {
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

function renderCurrentWeek() {
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
    const dayKey = `w${currentWeek}_d${d}`;
    const dayData = userState[dayKey] || {};

    const isMenuWeek1 = (currentWeek % 2 !== 0);
    const lunchObj = isMenuWeek1 ? MEAL_CONFIG.lunchesWeek1[d] : MEAL_CONFIG.lunchesWeek2[d];
    const dinnerObj = isMenuWeek1 ? MEAL_CONFIG.dinnersWeek1[d] : MEAL_CONFIG.dinnersWeek2[d];

    const isSunday = (d === 6);
    const isWorkoutDay = (d === 0 || d === 2 || d === 4 || d === 5);
    const exerciseText = isWorkoutDay 
      ? `<span class="workout-tag">30-Min Workout</span>` 
      : `<span class="rest-tag">Active Recovery Walk / Rest</span>`;

    let dayConsumedCal = 0;
    if (dayData.m1) dayConsumedCal += MEAL_CONFIG.defaultBreakfast.cal;
    if (dayData.m2) dayConsumedCal += MEAL_CONFIG.defaultSnack1.cal;
    if (dayData.m3) dayConsumedCal += lunchObj.cal;
    if (dayData.m4) dayConsumedCal += MEAL_CONFIG.defaultSnack2.cal;
    if (dayData.m5) dayConsumedCal += dinnerObj.cal;

    const totalPlannedCal = MEAL_CONFIG.defaultBreakfast.cal + MEAL_CONFIG.defaultSnack1.cal + lunchObj.cal + MEAL_CONFIG.defaultSnack2.cal + dinnerObj.cal;
    const completedCount = TASKS.filter(k => dayData[k]).length;
    const isFullyDone = completedCount === TASKS.length;
    const dateStr = getFormattedDate(currentWeek, d);

    const dayScore = calculateDayScore(dayData, dayConsumedCal, dinnerObj.isCheat);
    let scoreClass = "score-low";
    if (dayScore >= 8.5) scoreClass = "score-high";
    else if (dayScore >= 6.0) scoreClass = "score-mid";

    const card = document.createElement("div");
    card.className = `day-card ${isFullyDone ? "completed-day" : ""}`;

    let sundayExtrasHTML = "";
    if (isSunday) {
      const photoHTML = dayData.photo 
        ? `<img src="${dayData.photo}" class="photo-preview" alt="Progress Photo">
           <button class="btn-remove-photo" onclick="removePhoto('${dayKey}')">Remove Photo</button>`
        : `<button class="btn-photo" onclick="document.getElementById('${dayKey}_file').click()">
             📷 Upload Progress Photo
           </button>
           <input type="file" id="${dayKey}_file" accept="image/*" style="display:none" onchange="handlePhotoUpload('${dayKey}', this)">`;

      sundayExtrasHTML = `
        <div class="section-divider"></div>
        <div class="sunday-box">
          <div class="box-title">Sunday Body Measurements (cm)</div>
          <div class="measure-grid">
            <div class="measure-field">
              <label for="${dayKey}_waist">Belly/Waist</label>
              <input type="number" step="0.1" id="${dayKey}_waist" placeholder="cm" value="${dayData.waist || ''}" onchange="saveInputField('${dayKey}', 'waist', this.value)">
            </div>
            <div class="measure-field">
              <label for="${dayKey}_chest">Chest</label>
              <input type="number" step="0.1" id="${dayKey}_chest" placeholder="cm" value="${dayData.chest || ''}" onchange="saveInputField('${dayKey}', 'chest', this.value)">
            </div>
            <div class="measure-field">
              <label for="${dayKey}_quads">Quads</label>
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
            <span class="calorie-pill ${dinnerObj.isCheat ? 'cheat' : ''}">${dayConsumedCal} / ${totalPlannedCal} kcal</span>
          </div>
        </div>
        
        <div class="checklist">
          ${renderCheckItem(dayKey, 'm1', dayData.m1, 'Breakfast', MEAL_CONFIG.defaultBreakfast.name, MEAL_CONFIG.defaultBreakfast.cal)}
          ${renderCheckItem(dayKey, 'm2', dayData.m2, 'Morning Snack', MEAL_CONFIG.defaultSnack1.name, MEAL_CONFIG.defaultSnack1.cal)}
          ${renderCheckItem(dayKey, 'm3', dayData.m3, 'Lunch (Full Meal)', lunchObj.name, lunchObj.cal)}
          ${renderCheckItem(dayKey, 'm4', dayData.m4, 'Afternoon Snack', MEAL_CONFIG.defaultSnack2.name, MEAL_CONFIG.defaultSnack2.cal)}
          ${renderCheckItem(dayKey, 'm5', dayData.m5, dinnerObj.isCheat ? 'Dinner (Cheat Meal 🎉)' : 'Dinner (½ Meal + Yogurt)', dinnerObj.name, dinnerObj.cal, dinnerObj.isCheat)}
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
}

function renderCheckItem(dayKey, taskId, isChecked, title, desc, cal, isCheat = false) {
  const calLabel = cal > 0 ? `<span class="item-cal ${isCheat ? 'cheat-tag' : ''}">${isCheat ? '~' + cal : '+' + cal} kcal</span>` : '';
  return `
    <label class="check-item" onclick="event.stopPropagation();">
      <input type="checkbox" id="${dayKey}_${taskId}" ${isChecked ? "checked" : ""} onchange="toggleTask('${dayKey}', '${taskId}')">
      <span class="checkbox-custom"></span>
      <span class="item-content">
        <span class="item-title">
          <span>${title}</span>
          ${calLabel}
        </span>
        <span class="item-desc">${desc}</span>
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

      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
      saveInputField(dayKey, 'photo', compressedBase64);
    };
  };
  reader.readAsDataURL(file);
}

function removePhoto(dayKey) {
  if (confirm("Delete this progress photo?")) {
    delete userState[dayKey].photo;
    saveState();
    renderCurrentWeek();
  }
}

function updateOverallProgress() {
  let totalTasks = 0;
  let completedTasks = 0;

  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const startDay = (w === 1) ? 2 : 0;
    for (let d = startDay; d < 7; d++) {
      const dayKey = `w${w}_d${d}`;
      const dayData = userState[dayKey] || {};
      TASKS.forEach(k => {
        totalTasks++;
        if (dayData[k]) completedTasks++;
      });
    }
  }

  const percent = Math.round((completedTasks / totalTasks) * 100);
  document.getElementById("overall-percentage").textContent = `${percent}%`;
  document.getElementById("overall-bar").style.width = `${percent}%`;
}

function resetAllData() {
  if (confirm("Reset all tracked progress, photos, notes, and body measurements?")) {
    userState = {};
    saveState();
    renderCurrentWeek();
  }
}