# 10-Week Weight Loss & Habit Transformation Tracker

A lightweight, mobile-responsive web application for tracking a structured weight loss plan. Fully configurable via a built-in settings page — no code editing required.

![Mobile Friendly](https://img.shields.io/badge/Design-Mobile--First-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🌟 Key Features

* **First-run Setup:** On first visit, the app redirects automatically to the Settings page so you can configure your plan before tracking begins.
* **Monday–Sunday Calendar View:** Structured weekly views with a partial first week that adjusts automatically to your configured start date.
* **Automated Daily Score (0–10 Scale):** Evaluates daily performance using a weighted rating engine:
  * **40% Calories:** Rewards eating at or near that day's full planned meal total (or cheat day allowance).
  * **30% Meal Routine:** Evaluates 5-meal daily consistency.
  * **20% Exercise:** Tracks completed resistance/recovery workouts.
  * **10% Daily Steps:** Tracks hitting the 10,000-step threshold.
* **Sunday Progress Check-Ins:**
  * **Weight & Body Measurement Tracking:** Record weight, belly/waist, chest, and quad measurements every Sunday.
  * **Progress Photo Upload:** Upload progress pictures directly from your mobile camera or gallery. Photos are automatically compressed and stored locally.
* **Quick Actions:** One-tap access to the stats page, Settings, a "Log Weight & Measurements" form for any day in the plan, and backup export/import.
* **Backup Export / Import:** Download your entire tracker (progress, notes, measurements, and photos) as a single JSON file, and restore it later or on another device.
* **Confirm Modals:** Destructive actions (Reset All, deleting a photo, importing a backup) ask for confirmation through an in-app modal.
* **Exercise Logging:** Dedicated comment box for logging specific workouts (e.g., sets, reps, distance, or cardio duration).
* **Editable Meals:** Each meal's description and calorie value can be edited per day to reflect what you actually ate.
* **Dynamic Calorie Counter:** Calculates live consumed vs. target calorie totals based on checked items.
* **Stats & Charts Page:** A dedicated `stats.html` page (built with [Chart.js](https://www.chartjs.org/)) charting weight vs. goal, body measurements, daily score trend, habit consistency, calories, weekly completion, and a progress-photo timeline.
* **External JSON Meal Config (`meals.json`):** Centralized file for editing the weekly lunch and dinner plan without touching application logic.
* **100% Client-Side Privacy:** All user data stays in your browser — progress, measurements, and notes in `localStorage`, and photos as compressed blobs in `IndexedDB`.

---

## ⚙️ Settings Page

On first launch the app opens `config.html` automatically. You can return to it any time via the **⚙️ Settings** button in the quick actions bar.

### What you can configure

| Section | Fields |
|---|---|
| **Profile** | Height (m), start weight (kg), goal weight (kg) |
| **Plan** | Plan start date, total number of weeks |
| **Default Meals** | Breakfast, morning snack, and afternoon snack — name and calories each |
| **Scoring** | Cheat-day calorie thresholds (perfect / partial), green and yellow score display cutoffs |

Settings are saved to `localStorage` under the key `weightLossTrackerConfig`. Clicking **Reset to Defaults** restores all values without triggering the first-run redirect.

> The weekly lunch and dinner rotation is still controlled by `meals.json` (see below).

---

## 📂 Project Structure

```text
├── index.html     # Main tracker — redirects to config.html on first visit
├── stats.html     # Stats & charts page (Chart.js)
├── config.html    # Settings / first-run setup page
├── styles.css     # Dark-mode UI styling shared by all pages
├── shared.js      # Shared data loading, config system, score/calorie calculations
├── script.js      # Tracker page: rendering, state management, and user interactions
├── stats.js       # Stats page: aggregates logged data and renders charts
├── config.js      # Settings page: reads and writes APP_CONFIG to localStorage
├── meals.json     # Weekly lunch/dinner rotation and fallback default meals
└── README.md      # Project documentation
```

---

## 🚀 Getting Started

### Option 1: Local Development (VS Code / Local Server)
Because browsers restrict reading external files (`meals.json`) via `file://` due to CORS, use a local web server:
1. Clone or download this repository.
2. Open the project folder in **VS Code**.
3. Install the **Live Server** extension.
4. Right-click `index.html` and select **Open with Live Server**.
5. On first open you will be taken to the Settings page — fill in your details and click **Save & Start Tracking**.

### Option 2: Run Locally on Mobile
* **iOS:** Open the folder using **Documents by Readdle** or **DraftCode** and run the built-in local web server preview.
* **Android:** Open the folder in **TrebEdit** or **Acode** and hit the **Play** button to view via local host.

---

## 🌐 Free Deployment Guide

### Deploying with GitHub Pages (Recommended)
1. Push this repository to your GitHub account.
2. Go to **Settings** → **Pages** (under *Code and automation*).
3. Under **Source / Branch**, set the branch to `main` (or `master`) and folder to `/ (root)`.
4. Click **Save**.
5. GitHub will generate a URL (e.g., `https://username.github.io/repository-name/`).

---

## 📲 Add to Home Screen (Mobile App Feel)

Once deployed to a live URL, install it on your mobile device as a Progressive Web App (PWA):
* **iOS (Safari):** Tap the **Share** button → Select **Add to Home Screen**.
* **Android (Chrome):** Tap the three vertical dots → Select **Add to Home Screen** or **Install App**.

---

## 🍽️ Customizing the Meal Plan

The weekly lunch and dinner rotation is controlled by **`meals.json`**. Edit it to swap meals or update calorie values:

```json
{
  "lunchesWeek1": [
    { "name": "Tikka Masala", "cal": 490 },
    { "name": "Chili sin Carne", "cal": 445 }
  ],
  "dinnersWeek1": [
    { "name": "½ Green Forest Bowl + Greek Yogurt", "cal": 365 }
  ]
}
```

Default meals (breakfast, morning snack, afternoon snack) are managed through the **Settings page** and no longer need to be edited in `meals.json`.

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).
