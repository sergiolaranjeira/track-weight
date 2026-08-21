# 10-Week Weight Loss & Habit Transformation Tracker

A lightweight, mobile-responsive web application designed to track a structured 10-week weight loss plan. Optimized for a 1.93m height profile, this application tracks a daily ~1,600 kcal regimen using Every Foods pre-made meals, high-protein snacks, 10,000 daily steps, and workout sessions.

![Mobile Friendly](https://img.shields.io/badge/Design-Mobile--First-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🌟 Key Features

* **Monday–Sunday Calendar View:** Displays structured weekly views with a shortened 5-day layout for Week 1 (starting Wednesday, Aug 26).
* **Automated Daily Score (0–10 Scale):** Evaluates daily performance using a weighted rating engine:
  * **40% Calories:** Rewards staying within the optimal 1,400–1,650 kcal target (or Sunday cheat allowance).
  * **30% Meal Routine:** Evaluates 5-meal daily consistency.
  * **20% Exercise:** Tracks completed resistance/recovery workouts.
  * **10% Daily Steps:** Tracks hitting the 10,000-step threshold.
* **Sunday Progress Check-Ins:**
  * **Body Diameter Tracking:** Record belly/waist, chest, and quad measurements every Sunday.
  * **Progress Photo Upload:** Upload progress pictures directly from your mobile camera or gallery. Photos are automatically compressed and stored locally.
* **Exercise Logging:** Dedicated comment box for logging specific workouts (e.g., sets, reps, distance, or cardio duration).
* **Dynamic Calorie Counter:** Calculates live consumed vs. target calorie totals based on checked items.
* **External JSON Meal Config (`meals.json`):** Centralized file to easily edit meal names and calorie values without modifying application logic.
* **100% Client-Side Privacy:** All user data stays in your browser — progress, measurements, and notes in `localStorage`, and photos as compressed blobs in `IndexedDB` (which has a much higher storage quota than `localStorage`).

---

## 📂 Project Structure

```text
├── index.html     # Main HTML structure and UI layout
├── styles.css     # Dark-mode UI styling and mobile-first CSS
├── script.js     # State management, score calculation, and JSON fetch logic
├── meals.json     # Editable database for breakfast, snacks, lunches, and dinners
└── README.md      # Project documentation
```

## 🚀 Getting Started

### Option 1: Local Development (VS Code / Local Server)
Because modern web browsers restrict reading external files (`meals.json`) via standard `file://` protocols due to CORS security rules, use a local web server to run the app on your computer:
1. Clone or download this repository.
2. Open the project folder in **VS Code**.
3. Install the **Live Server** extension.
4. Right-click `index.html` and select **Open with Live Server**.

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
5. GitHub will generate a private URL (e.g., `https://username.github.io/repository-name/`).

---

## 📲 Add to Home Screen (Mobile App Feel)

Once deployed to a live URL, you can install it on your mobile device as a Progressive Web App (PWA):
* **iOS (Safari):** Tap the **Share** button → Select **Add to Home Screen**.
* **Android (Chrome):** Tap the three vertical dots → Select **Add to Home Screen** or **Install App**.

---

## ⚙️ Customizing Meals

To change the meal plan or calorie values, edit **`meals.json`**:

```json
{
  "defaultBreakfast": { "name": "2 Boiled Eggs", "cal": 140 },
  "defaultSnack1": { "name": "Protein Shake OR 40g Jerky", "cal": 150 },
  "lunchesWeek1": [
    { "name": "Tikka Masala", "cal": 490 }
  ]
}
```
## 📜 License

This project is open-source and available under the [MIT License](LICENSE).