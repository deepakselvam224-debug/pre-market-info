# PreMarket Alpha - Market Preparation Dashboard

PreMarket Alpha is a premium, high-fidelity pre-market preparation dashboard built specifically for Indian traders who trade **Nifty 50**, **Bank Nifty**, and **MCX Natural Gas**.

Designed to optimize your trading morning, it pulls global catalysts, filters overnight news, and compiles Natural Gas specific drivers before the market opens at **9:15 AM IST** (Pre-market opens at **9:00 AM IST**).

## Features

- **Countdown & Market Timeline**: Live countdown timers to 9:00 AM IST (Pre-market Open) and 9:15 AM IST (Normal Market Open). The status bar updates in real-time depending on the trading session.
- **Indian Equities Desk**: Toggle between live interactive charts for Nifty 50 and Bank Nifty powered by TradingView.
- **Overnight Catalyst Feed**: Pulls news from Moneycontrol and Economic Times Markets, filtering for articles published since the previous close (3:30 PM) to show only fresh pre-market drivers.
- **MCX Natural Gas Commodity Hub**: Dedicated Natural Gas panel displaying US Henry Hub (NYMEX) and MCX Natural Gas charts.
- **Weather & Inventory Trackers**: Analyzes gas headlines for weather trends (colder/warmer forecasts) and tracks the EIA weekly storage report timing.
- **Daily Strategy Notepad**: Write levels and trading triggers using a pre-configured template. Notes persist automatically in local storage.
- **Prep Checklist**: Interactive checkbox checklist to ensure risk parameters and global cues are audited before open. State is saved automatically.

## How to Run

Since the application is built using standard web technologies (HTML5, CSS3, ES6 JavaScript) and utilizes embedded charts and open APIs, it runs completely in the browser with **no installation, Node modules, or servers required**.

### Option 1: Direct Execution (Simplest)
1. Navigate to the project folder: `C:\Users\ELCOT\.gemini\antigravity\scratch\premarket-trader-dashboard`.
2. Double-click [index.html](file:///C:/Users/ELCOT/.gemini/antigravity/scratch/premarket-trader-dashboard/index.html) to open the dashboard directly in your web browser.

### Option 2: Run via Local Development Server (Recommended for development)
If you would like to run the dashboard on a local server, you can use `npx` to start a simple hot-reloaded dev server:
1. Open terminal and run:
   ```bash
   npx live-server C:\Users\ELCOT\.gemini\antigravity\scratch\premarket-trader-dashboard
   ```
2. The browser will automatically open at `http://127.0.5.1:8080` (or similar port).

## Project Structure
- [index.html](file:///C:/Users/ELCOT/.gemini/antigravity/scratch/premarket-trader-dashboard/index.html): Core page layout and TradingView configurations.
- [styles.css](file:///C:/Users/ELCOT/.gemini/antigravity/scratch/premarket-trader-dashboard/styles.css): Sleek dark theme styling, glassmorphism layout, and responsiveness.
- [app.js](file:///C:/Users/ELCOT/.gemini/antigravity/scratch/premarket-trader-dashboard/app.js): Application engines including the timer loops, RSS parsers, and local storage hooks.
