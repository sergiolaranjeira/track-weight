const COLORS = {
  accent: '#38bdf8',
  success: '#10b981',
  warning: '#f59e0b',
  purple: '#a855f7',
  danger: '#f87171',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  grid: 'rgba(255, 255, 255, 0.08)'
};

Chart.defaults.color = COLORS.textMuted;
Chart.defaults.borderColor = COLORS.grid;
Chart.defaults.font.family = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif";

document.addEventListener("DOMContentLoaded", async () => {
  await fetchMealsJSON();
  loadState();

  const allDays = getAllPlanDays().map(({ week, day }) => computeDayStats(week, day));
  const loggedDays = allDays.filter(d => hasAnyData(d.dayData));

  renderStatCards(allDays, loggedDays);
  renderWeightChart(loggedDays);
  renderMeasurementsChart(loggedDays);
  renderHabitChart(loggedDays);
  renderScoreChart(loggedDays);
  renderCaloriesChart(loggedDays);
  renderWeeklyChart(allDays);
  await renderPhotoTimeline(loggedDays);
});

function emptyState(wrapId, message) {
  document.getElementById(wrapId).innerHTML = `<div class="empty-state">${message}</div>`;
}

function statCardHTML(label, value, sub, colorClass = '') {
  return `
    <div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value ${colorClass}">${value}</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
    </div>
  `;
}

function renderStatCards(allDays, loggedDays) {
  const { profile } = MEAL_CONFIG;
  const totalPlanDays = allDays.length;
  const daysLogged = loggedDays.length;
  const daysRemaining = Math.max(0, totalPlanDays - daysLogged);

  const weightEntries = loggedDays
    .map(d => ({ ...d, weightNum: parseFloat(d.dayData.weight) }))
    .filter(d => !isNaN(d.weightNum));
  const currentWeight = weightEntries.length ? weightEntries[weightEntries.length - 1].weightNum : null;
  const totalToLose = profile.startWeightKg - profile.goalWeightKg;
  const kgLost = currentWeight !== null ? (profile.startWeightKg - currentWeight) : 0;
  const progressPct = (currentWeight !== null && totalToLose > 0)
    ? Math.max(0, Math.min(100, Math.round((kgLost / totalToLose) * 100)))
    : 0;

  const avgScore = daysLogged ? (loggedDays.reduce((s, d) => s + d.score, 0) / daysLogged) : 0;
  const bestDay = daysLogged ? loggedDays.reduce((a, b) => (b.score > a.score ? b : a)) : null;

  let lastLoggedIdx = -1;
  for (let i = allDays.length - 1; i >= 0; i--) {
    if (hasAnyData(allDays[i].dayData)) { lastLoggedIdx = i; break; }
  }
  let streak = 0;
  for (let i = lastLoggedIdx; i >= 0; i--) {
    if (allDays[i].isFullyDone) streak++; else break;
  }

  const totalWorkouts = loggedDays.filter(d => d.dayData.exercise).length;
  const totalStepDays = loggedDays.filter(d => d.dayData.steps).length;
  const cheatMeals = loggedDays.filter(d => d.isCheat && d.dayData.m5).length;
  const photosLogged = loggedDays.filter(d => d.dayData.hasPhoto).length;
  const { percent: overallPercent } = computeOverallProgress();

  const cards = [
    statCardHTML(
      'Weight Progress',
      currentWeight !== null ? `${currentWeight}kg` : `${profile.startWeightKg}kg`,
      currentWeight !== null
        ? `${kgLost.toFixed(1)}kg lost · ${progressPct}% to ${profile.goalWeightKg}kg goal`
        : `No weight logged yet · goal ${profile.goalWeightKg}kg`,
      'accent'
    ),
    statCardHTML('Overall Completion', `${overallPercent}%`, `${daysLogged}/${totalPlanDays} days logged`),
    statCardHTML(
      'Average Score',
      daysLogged ? `${avgScore.toFixed(1)} / 10` : '—',
      bestDay ? `Best: ${bestDay.score}/10 on ${bestDay.dayName} ${bestDay.dateStr}` : 'No days logged yet'
    ),
    statCardHTML('Current Streak', `${streak} day${streak === 1 ? '' : 's'}`, 'Fully completed in a row', 'success'),
    statCardHTML('Workouts Done', totalWorkouts, `${totalStepDays} days hit 10k steps`),
    statCardHTML('Cheat Meals Enjoyed', cheatMeals, `${photosLogged} progress photo${photosLogged === 1 ? '' : 's'} logged`, 'purple'),
    statCardHTML('Days Remaining', daysRemaining, `of ${totalPlanDays} total plan days`, 'warning')
  ];

  document.getElementById('stats-cards').innerHTML = cards.join('');
}

function renderWeightChart(loggedDays) {
  const { profile } = MEAL_CONFIG;
  const entries = loggedDays
    .map(d => ({ ...d, weightNum: parseFloat(d.dayData.weight) }))
    .filter(d => !isNaN(d.weightNum));

  if (!entries.length) {
    emptyState('weightChartWrap', 'No weight logged yet — add it in the Sunday check-in to see your progress here.');
    return;
  }

  const labels = entries.map(d => d.dateStr);
  new Chart(document.getElementById('weightChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Weight (kg)',
          data: entries.map(d => d.weightNum),
          borderColor: COLORS.accent,
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          fill: true,
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: `Goal (${profile.goalWeightKg}kg)`,
          data: labels.map(() => profile.goalWeightKg),
          borderColor: COLORS.success,
          borderDash: [6, 6],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { boxWidth: 12 } } },
      scales: { y: { grid: { color: COLORS.grid } }, x: { grid: { display: false } } }
    }
  });
}

function renderMeasurementsChart(loggedDays) {
  const fields = [
    { key: 'waist', label: 'Waist', color: COLORS.accent },
    { key: 'chest', label: 'Chest', color: COLORS.success },
    { key: 'quads', label: 'Quads', color: COLORS.purple }
  ];

  const entries = loggedDays.filter(d => d.dayData.waist || d.dayData.chest || d.dayData.quads);

  if (!entries.length) {
    emptyState('measurementsChartWrap', 'No body measurements logged yet.');
    return;
  }

  const labels = entries.map(d => d.dateStr);
  new Chart(document.getElementById('measurementsChart'), {
    type: 'line',
    data: {
      labels,
      datasets: fields.map(f => ({
        label: f.label,
        data: entries.map(d => d.dayData[f.key] !== undefined && d.dayData[f.key] !== '' ? parseFloat(d.dayData[f.key]) : null),
        borderColor: f.color,
        backgroundColor: f.color,
        spanGaps: true,
        tension: 0.3,
        pointRadius: 3
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { boxWidth: 12 } } },
      scales: { y: { grid: { color: COLORS.grid } }, x: { grid: { display: false } } }
    }
  });
}

function renderHabitChart(loggedDays) {
  if (!loggedDays.length) {
    emptyState('habitChartWrap', 'No days logged yet.');
    return;
  }

  const habits = [
    { key: 'm1', label: 'Breakfast' },
    { key: 'm2', label: 'Morning Snack' },
    { key: 'm3', label: 'Lunch' },
    { key: 'm4', label: 'Afternoon Snack' },
    { key: 'm5', label: 'Dinner' },
    { key: 'steps', label: '10k Steps' },
    { key: 'exercise', label: 'Exercise' }
  ];

  const percents = habits.map(h => Math.round((loggedDays.filter(d => d.dayData[h.key]).length / loggedDays.length) * 100));

  new Chart(document.getElementById('habitChart'), {
    type: 'bar',
    data: {
      labels: habits.map(h => h.label),
      datasets: [{
        label: '% of logged days completed',
        data: percents,
        backgroundColor: COLORS.accent,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { min: 0, max: 100, grid: { color: COLORS.grid }, ticks: { callback: v => v + '%' } },
        y: { grid: { display: false } }
      }
    }
  });
}

function renderScoreChart(loggedDays) {
  if (!loggedDays.length) {
    emptyState('scoreChartWrap', 'No days logged yet — your daily 0-10 scores will show up here.');
    return;
  }

  const labels = loggedDays.map(d => d.dateStr);
  new Chart(document.getElementById('scoreChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Daily Score',
          data: loggedDays.map(d => d.score),
          borderColor: COLORS.accent,
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          fill: true,
          tension: 0.25,
          pointRadius: 2
        },
        {
          label: 'Great day (8.5+)',
          data: labels.map(() => 8.5),
          borderColor: COLORS.success,
          borderDash: [6, 6],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { boxWidth: 12 } } },
      scales: { y: { min: 0, max: 10, grid: { color: COLORS.grid } }, x: { grid: { display: false } } }
    }
  });
}

function renderCaloriesChart(loggedDays) {
  if (!loggedDays.length) {
    emptyState('caloriesChartWrap', 'No days logged yet.');
    return;
  }

  const labels = loggedDays.map(d => d.dateStr);
  new Chart(document.getElementById('caloriesChart'), {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Consumed',
          data: loggedDays.map(d => d.dayConsumedCal),
          backgroundColor: loggedDays.map(d => d.isCheat ? 'rgba(168, 85, 247, 0.5)' : 'rgba(56, 189, 248, 0.5)'),
          borderRadius: 4
        },
        {
          type: 'line',
          label: 'Planned',
          data: loggedDays.map(d => d.totalPlannedCal),
          borderColor: COLORS.warning,
          borderDash: [6, 6],
          pointRadius: 2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { boxWidth: 12 } } },
      scales: { y: { grid: { color: COLORS.grid } }, x: { grid: { display: false } } }
    }
  });
}

function renderWeeklyChart(allDays) {
  const weekly = [];
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const daysInWeek = allDays.filter(d => d.weekIndex === w);
    const totalTasks = daysInWeek.length * TASKS.length;
    const completedTasks = daysInWeek.reduce((sum, d) => sum + d.completedCount, 0);
    weekly.push(totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);
  }

  new Chart(document.getElementById('weeklyChart'), {
    type: 'bar',
    data: {
      labels: weekly.map((_, i) => `Week ${i + 1}`),
      datasets: [{
        label: '% Completed',
        data: weekly,
        backgroundColor: weekly.map(p => p >= 80 ? COLORS.success : p >= 50 ? COLORS.warning : COLORS.danger),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, grid: { color: COLORS.grid }, ticks: { callback: v => v + '%' } },
        x: { grid: { display: false } }
      }
    }
  });
}

async function renderPhotoTimeline(loggedDays) {
  const withPhotos = loggedDays.filter(d => d.dayData.hasPhoto);
  const container = document.getElementById('photo-timeline');

  if (!withPhotos.length) {
    container.innerHTML = '<div class="empty-state">No progress photos logged yet.</div>';
    return;
  }

  const items = [];
  for (const d of withPhotos) {
    const blob = await getPhoto(d.dayKey);
    if (!blob) continue;
    const url = URL.createObjectURL(blob);
    items.push(`
      <div class="photo-timeline-item">
        <img src="${url}" alt="Progress photo, Week ${d.weekIndex}">
        <div class="photo-timeline-caption">Wk ${d.weekIndex} · ${d.dateStr}</div>
      </div>
    `);
  }

  container.innerHTML = items.length ? items.join('') : '<div class="empty-state">No progress photos logged yet.</div>';
}
