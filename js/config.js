const isFirstSetup = !localStorage.getItem(CONFIG_KEY);

document.addEventListener("DOMContentLoaded", async () => {
  rewriteInternalLinks();
  await fetchMealsJSON();
  loadConfig();
  fillForm(APP_CONFIG);

  if (isFirstSetup) {
    document.querySelector(".brand-badge").textContent = "Welcome";
    document.querySelector("h1").textContent = "Set Up Your Plan";
    document.querySelector(".subtitle").textContent = "Fill in your details below to get started. You can change these any time from Settings.";
    document.querySelector(".btn-back").style.display = "none";
    document.querySelector(".btn-cfg-save").textContent = "Save & Start Tracking";
  }
});

function fillForm(cfg) {
  document.getElementById("cfg-name").value = cfg.profile.name || "";
  document.getElementById("cfg-height").value = cfg.profile.heightM;
  document.getElementById("cfg-start-weight").value = cfg.profile.startWeightKg;
  document.getElementById("cfg-goal-weight").value = cfg.profile.goalWeightKg;
  document.getElementById("cfg-initial-waist").value = cfg.profile.initialWaist ?? "";
  document.getElementById("cfg-initial-chest").value = cfg.profile.initialChest ?? "";
  document.getElementById("cfg-initial-quads").value = cfg.profile.initialQuads ?? "";

  document.getElementById("cfg-start-date").value = cfg.planStartDate;
  document.getElementById("cfg-total-weeks").value = cfg.totalWeeks;

  document.getElementById("cfg-b-name").value = cfg.defaultBreakfast.name;
  document.getElementById("cfg-b-cal").value = cfg.defaultBreakfast.cal;
  document.getElementById("cfg-s1-name").value = cfg.defaultSnack1.name;
  document.getElementById("cfg-s1-cal").value = cfg.defaultSnack1.cal;
  document.getElementById("cfg-s2-name").value = cfg.defaultSnack2.name;
  document.getElementById("cfg-s2-cal").value = cfg.defaultSnack2.cal;

  document.getElementById("cfg-cheat-perfect").value = cfg.scoring.cheatPerfectCal;
  document.getElementById("cfg-cheat-partial").value = cfg.scoring.cheatPartialCal;
  document.getElementById("cfg-score-high").value = cfg.scoring.highThreshold;
  document.getElementById("cfg-score-mid").value = cfg.scoring.midThreshold;
}

function readForm() {
  return {
    planStartDate: document.getElementById("cfg-start-date").value || DEFAULT_CONFIG.planStartDate,
    totalWeeks: Math.max(1, parseInt(document.getElementById("cfg-total-weeks").value, 10) || DEFAULT_CONFIG.totalWeeks),
    profile: {
      name: document.getElementById("cfg-name").value.trim(),
      heightM: parseFloat(document.getElementById("cfg-height").value) || DEFAULT_CONFIG.profile.heightM,
      startWeightKg: parseFloat(document.getElementById("cfg-start-weight").value) || DEFAULT_CONFIG.profile.startWeightKg,
      goalWeightKg: parseFloat(document.getElementById("cfg-goal-weight").value) || DEFAULT_CONFIG.profile.goalWeightKg,
      initialWaist: parseFloat(document.getElementById("cfg-initial-waist").value) || null,
      initialChest: parseFloat(document.getElementById("cfg-initial-chest").value) || null,
      initialQuads: parseFloat(document.getElementById("cfg-initial-quads").value) || null
    },
    defaultBreakfast: {
      name: document.getElementById("cfg-b-name").value.trim() || DEFAULT_CONFIG.defaultBreakfast.name,
      cal: Math.max(0, parseFloat(document.getElementById("cfg-b-cal").value) || DEFAULT_CONFIG.defaultBreakfast.cal)
    },
    defaultSnack1: {
      name: document.getElementById("cfg-s1-name").value.trim() || DEFAULT_CONFIG.defaultSnack1.name,
      cal: Math.max(0, parseFloat(document.getElementById("cfg-s1-cal").value) || DEFAULT_CONFIG.defaultSnack1.cal)
    },
    defaultSnack2: {
      name: document.getElementById("cfg-s2-name").value.trim() || DEFAULT_CONFIG.defaultSnack2.name,
      cal: Math.max(0, parseFloat(document.getElementById("cfg-s2-cal").value) || DEFAULT_CONFIG.defaultSnack2.cal)
    },
    scoring: {
      cheatPerfectCal: Math.max(0, parseFloat(document.getElementById("cfg-cheat-perfect").value) || DEFAULT_CONFIG.scoring.cheatPerfectCal),
      cheatPartialCal: Math.max(0, parseFloat(document.getElementById("cfg-cheat-partial").value) || DEFAULT_CONFIG.scoring.cheatPartialCal),
      highThreshold: Math.min(10, Math.max(0, parseFloat(document.getElementById("cfg-score-high").value) ?? DEFAULT_CONFIG.scoring.highThreshold)),
      midThreshold: Math.min(10, Math.max(0, parseFloat(document.getElementById("cfg-score-mid").value) ?? DEFAULT_CONFIG.scoring.midThreshold))
    }
  };
}

function saveSettings() {
  const cfg = readForm();
  saveConfig(cfg);
  window.location.href = profileUrl('index.html');
}

function resetToDefaults() {
  if (!confirm("Reset all settings to their defaults?")) return;
  const defaults = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  saveConfig(defaults);
  fillForm(defaults);
  showToast("Reset to defaults.");
}

function showToast(msg) {
  const el = document.getElementById("cfg-toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.hidden = true; }, 2500);
}
