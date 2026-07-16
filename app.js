// Premarket Trader Dashboard - Application Logic

// Constants for Local Storage
const NOTES_STORAGE_KEY = 'premarket_trader_notes';
const CHECKLIST_STORAGE_KEY = 'premarket_trader_checklist';

// Global variables for charts
let currentEquitySymbol = 'CAPITALCOM:NIFTY';
let currentGasSymbol = 'CAPITALCOM:NATGAS';

// Fallback News Database for Offline/Error conditions
const FALLBACK_EQ_NEWS = [
  {
    title: "GIFT Nifty indicates positive opening for Indian indices; global cues remain stable",
    pubDate: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    source: "Economic Times (Demo Feed)",
    description: "The GIFT Nifty was trading higher around 24,310, pointing to a positive start for domestic indices Nifty 50 and Bank Nifty. Global stocks are mixed ahead of economic prints.",
    link: "https://economictimes.indiatimes.com/markets",
    impact: "high"
  },
  {
    title: "US Federal Reserve signals patience on rate cuts; Wall Street closes flat",
    pubDate: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    source: "Yahoo Finance (Demo Feed)",
    description: "Stocks closed mixed as Fed officials highlighted the need for more convincing inflation data before lowering interest rates. S&P 500 slipped 0.1% while bond yields steadied.",
    link: "https://finance.yahoo.com",
    impact: "medium"
  },
  {
    title: "FIIs turn net sellers in previous session; DII buying supports market",
    pubDate: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    source: "Moneycontrol (Demo Feed)",
    description: "Foreign Institutional Investors sold shares worth ₹1,240 crore, while Domestic Institutional Investors bought shares worth ₹1,650 crore in the secondary markets.",
    link: "https://www.moneycontrol.com",
    impact: "medium"
  },
  {
    title: "Reliance Q1 Net Profit beats estimates; margins expand in retail & telecom",
    pubDate: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
    source: "Moneycontrol (Demo Feed)",
    description: "Heavyweight Reliance Industries reported a net profit growth of 6.2% YoY, beating analyst estimates. Major volatility is expected at market open in oil-to-telecom basket.",
    link: "https://www.moneycontrol.com",
    impact: "high"
  },
  {
    title: "Bank Nifty faces immediate resistance at 52,500; analysts recommend cautious stance",
    pubDate: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    source: "Livemint (Demo Feed)",
    description: "Technically, Bank Nifty is trading close to its crucial moving averages. A breakout above 52,500 could trigger a short-covering rally towards 53,000, while failure risks a retest of 51,800.",
    link: "https://www.livemint.com",
    impact: "medium"
  }
];

const FALLBACK_GAS_NEWS = [
  {
    title: "US Natural Gas jumps 3.5% on revised cooler forecasts for late July",
    pubDate: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    source: "Reuters Energy (Demo Feed)",
    description: "NYMEX Henry Hub gas futures rose on colder weather anomalies forecast for Northern US, increasing natural gas residential heating demand and tightening overall spot supply.",
    link: "https://www.reuters.com",
    type: "gas",
    impact: "high"
  },
  {
    title: "Freeport LNG terminal increases feedgas intake as operations normalize",
    pubDate: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    source: "EIA Portal (Demo Feed)",
    description: "LNG tanker departures from Texas terminal resumed normal levels, rising feedgas demand and providing bullish support for spot prices at the Henry Hub shipping point.",
    link: "https://www.eia.gov",
    type: "gas",
    impact: "medium"
  },
  {
    title: "EIA storage preview: Analysts expect below-average gas storage injection of 48 Bcf",
    pubDate: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    source: "Investing.com (Demo Feed)",
    description: "Ahead of Thursday's EIA weekly report, consensus points to a modest inventory injection. Current stocks are 16% above the 5-year average but narrowing.",
    link: "https://www.investing.com",
    type: "gas",
    impact: "critical"
  },
  {
    title: "Geopolitical tensions in Middle East increase LNG supply route risks",
    pubDate: new Date(Date.now() - 1000 * 60 * 540).toISOString(),
    source: "Bloomberg Commodities (Demo Feed)",
    description: "Maritime shipping reports express caution near Bab-el-Mandeb Strait. European gas benchmarks rise on supply disruption fears, lifting US futures sentiment.",
    link: "https://www.bloomberg.com",
    type: "gas",
    impact: "medium"
  }
];

// Document Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
  // 1. Fetch Live Index Quotes from server API and start poller (every 5 seconds)
  fetchLiveQuotes();
  setInterval(fetchLiveQuotes, 5000);

  // 2. Start Live clock and Countdown timer engine
  setInterval(updateClockAndTimers, 1000);
  updateClockAndTimers(); // Immediate initial call

  // 3. Load Persistent Workspace States (Notes, Checklist, and WhatsApp Settings)
  loadChecklistState();
  loadNotes();
  loadNotificationSettings();

  // 4. Fetch Feeds
  refreshAllFeeds();
});

/* --- LIVE INDEX QUOTES POLLING ENGINE (YAHOO PROXIED API) --- */
async function fetchLiveQuotes() {
  try {
    const response = await fetch('/api/quotes');
    if (!response.ok) throw new Error("Quotes API failed");
    const data = await response.json();
    
    // Update Nifty, Bank Nifty, MCX Gas, and Ethereum cards & ticker tape
    updateIndexCard('nifty', data.nifty);
    updateIndexCard('banknifty', data.banknifty);
    updateIndexCard('gas', data.gas);
    updateIndexCard('eth', data.eth);
    
    // Update USDINR and S&P 500 in the ticker
    updateTickerItem('usdinr', data.usdinr);
    updateTickerItem('spx', data.spx);
    
    // Update Market Sentiment Speedometer
    updateSentimentGauge(data);

    // Update Daily Strategy Signal History Log table
    updateTradeLogTable(data.tradeLog);

  } catch (error) {
    console.error("Quotes poller failed:", error);
  }
}

function updateSentimentGauge(data) {
  if (!data) return;
  
  const niftyChg = data.nifty ? data.nifty.changePercent : 0;
  const bankChg = data.banknifty ? data.banknifty.changePercent : 0;
  const spxChg = data.spx ? data.spx.changePercent : 0;
  const usdinrChg = data.usdinr ? data.usdinr.changePercent : 0;

  // Sentiment calculation: aggregate weighted changes
  let score = (niftyChg * 40) + (bankChg * 40) + (spxChg * 30) - (usdinrChg * 50);
  score = Math.max(-100, Math.min(100, score));

  // Needle position is 0% to 100% (50% is Neutral)
  const needleLeft = 50 + (score / 2);
  const needleEl = document.getElementById('sentiment-needle');
  if (needleEl) {
    needleEl.style.left = `${needleLeft}%`;
  }

  let ratingText = "NEUTRAL";
  if (score > 60) ratingText = "STRONG BULLISH 🔥";
  else if (score > 15) ratingText = "BULLISH 🟢";
  else if (score < -60) ratingText = "STRONG BEARISH ⚡";
  else if (score < -15) ratingText = "BEARISH 🔴";
  
  const labelEl = document.getElementById('sentiment-score-text');
  if (labelEl) {
    const formattedScore = score >= 0 ? `+${score.toFixed(0)}` : score.toFixed(0);
    labelEl.textContent = `${ratingText} (${formattedScore}%)`;
  }

  // Populate dynamic Pre-Market Bulletins
  const bulletinGlobalEl = document.getElementById('bulletin-global');
  const bulletinForexEl = document.getElementById('bulletin-forex');
  const bulletinCprEl = document.getElementById('bulletin-cpr');

  if (bulletinGlobalEl) {
    if (spxChg > 0.25) {
      bulletinGlobalEl.innerHTML = `🟢 Global markets are pointing to a positive open (S&P 500 up +${spxChg.toFixed(2)}%).`;
    } else if (spxChg < -0.25) {
      bulletinGlobalEl.innerHTML = `🔴 Global markets are pointing to a weak open (S&P 500 down ${spxChg.toFixed(2)}%).`;
    } else {
      bulletinGlobalEl.innerHTML = `⚪ Global markets are flat and rangebound (S&P 500 change is ${spxChg.toFixed(2)}%).`;
    }
  }

  if (bulletinForexEl) {
    if (usdinrChg > 0.1) {
      bulletinForexEl.innerHTML = `🔴 USD/INR is rising (+${usdinrChg.toFixed(2)}%), indicating minor bearish pressure on INR.`;
    } else if (usdinrChg < -0.1) {
      bulletinForexEl.innerHTML = `🟢 USD/INR is declining (${usdinrChg.toFixed(2)}%), providing bullish support for Indian stocks.`;
    } else {
      bulletinForexEl.innerHTML = `⚪ USD/INR remains stable, holding neutral pre-market sentiment.`;
    }
  }

  if (bulletinCprEl && data.nifty && data.nifty.strategy) {
    const cpr = data.nifty.cpr;
    if (cpr) {
      const width = Math.abs(cpr.tc - cpr.bc);
      if (width < 35) {
        bulletinCprEl.innerHTML = `⚡ Narrow Nifty CPR today (${width.toFixed(1)} pts): expect a strong momentum trend.`;
      } else {
        bulletinCprEl.innerHTML = `🔄 Wider Nifty CPR today (${width.toFixed(1)} pts): expect rangebound volatility.`;
      }
    } else {
      bulletinCprEl.innerHTML = `⚡ Nifty strategy is active: monitoring price breakout points.`;
    }
  }
}

function updateTradeLogTable(tradeLog) {
  const tbody = document.getElementById('trade-log-tbody');
  const countEl = document.getElementById('log-count');
  
  if (!tbody) return;
  
  if (!tradeLog || tradeLog.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="no-trades-msg">No strategy signals triggered in today's session.</td>
      </tr>
    `;
    if (countEl) countEl.textContent = "0 Trade(s) Logged";
    return;
  }

  if (countEl) countEl.textContent = `${tradeLog.length} Trade(s) Logged`;

  tbody.innerHTML = '';
  
  // Render trades from newest to oldest
  tradeLog.slice().reverse().forEach(t => {
    const tr = document.createElement('tr');
    
    // Status formatting
    let statusClass = "status-log-active";
    if (t.status.includes("Hit 🟢")) statusClass = "status-log-profit";
    else if (t.status.includes("Hit 🔴")) statusClass = "status-log-sl";
    
    const directionBadge = t.direction === 'LONG' 
      ? '<span style="color: #4ade80; font-weight: 700;">🟢 BUY</span>' 
      : '<span style="color: #f87171; font-weight: 700;">🔴 SELL</span>';

    const isGas = t.asset.includes("NATURAL GAS");
    const isEth = t.asset.includes("ETH");
    const formatVal = (v) => formatIndexPrice(v, (isGas || isEth));

    tr.innerHTML = `
      <td>${t.time}</td>
      <td style="font-weight: 700; color: #ffffff;">${t.asset}</td>
      <td>${t.setup}</td>
      <td>${directionBadge}</td>
      <td style="font-weight: 700;">${formatVal(t.entry)}</td>
      <td style="color: #34d399;">${formatVal(t.target)}</td>
      <td style="color: #f87171;">${formatVal(t.sl)}</td>
      <td class="${statusClass}">${t.status}</td>
    `;
    
    tbody.appendChild(tr);
  });
}

function updateIndexCard(id, indexData) {
  if (!indexData) return;
  
  const priceEl = document.getElementById(`${id}-live-price`);
  const changeEl = document.getElementById(`${id}-live-change`);
  const highEl = document.getElementById(`${id}-live-high`);
  const lowEl = document.getElementById(`${id}-live-low`);
  const prevEl = document.getElementById(`${id}-live-prev`);
  const statusEl = document.getElementById(`${id}-market-status`);

  // Format numbers
  const isGas = (id === 'gas');
  const priceFormatted = formatIndexPrice(indexData.price, isGas);
  const highFormatted = formatIndexPrice(indexData.high, isGas);
  const lowFormatted = formatIndexPrice(indexData.low, isGas);
  const prevFormatted = formatIndexPrice(indexData.prevClose, isGas);

  const changeSign = indexData.change >= 0 ? '+' : '';
  const changeValFormatted = isGas ? indexData.change.toFixed(1) : indexData.change.toFixed(2);
  const changePercentFormatted = indexData.changePercent.toFixed(2);

  // Apply colors and text
  priceEl.textContent = priceFormatted;
  changeEl.textContent = `${changeSign}${changeValFormatted} (${changeSign}${changePercentFormatted}%)`;
  
  if (indexData.change >= 0) {
    changeEl.className = 'index-card-change up';
  } else {
    changeEl.className = 'index-card-change down';
  }

  highEl.textContent = highFormatted;
  lowEl.textContent = lowFormatted;
  prevEl.textContent = prevFormatted;

  // Update Status based on market active times (9:15 AM - 3:30 PM IST weekdays for Indian, 9:00 AM - 11:30 PM IST MCX, 24/7 for ETH)
  const now = new Date();
  const hours = now.getHours();
  const mins = now.getMinutes();
  const day = now.getDay();
  const isWeekend = (day === 0 || day === 6);
  
  let isLive = false;
  if (id === 'eth') {
    isLive = true; // Crypto markets never close
  } else if (!isWeekend) {
    if (id === 'gas') {
      // MCX is open 9:00 AM to 11:30 PM
      isLive = (hours >= 9 && hours < 23) || (hours === 23 && mins < 30);
    } else {
      // NSE is open 9:15 AM to 3:30 PM
      isLive = (hours > 9 || (hours === 9 && mins >= 15)) && (hours < 15 || (hours === 15 && mins < 30));
    }
  }

  if (statusEl) {
    if (isLive) {
      statusEl.textContent = "LIVE";
      statusEl.className = "index-live-status blink";
    } else {
      statusEl.textContent = "CLOSED";
      statusEl.className = "index-live-status closed";
    }
  }

  // Update Strategy State Display
  const stratStateEl = document.getElementById(`${id}-strat-state`);
  const stratDetailsEl = document.getElementById(`${id}-strat-details`);
  const cprBannerEl = document.getElementById(`${id}-cpr-banner`);

  if (cprBannerEl) {
    if (indexData.strategy && indexData.strategy.cprText) {
      cprBannerEl.style.display = "block";
      cprBannerEl.textContent = indexData.strategy.cprText;
      if (indexData.strategy.cprText.includes("Narrow")) {
        cprBannerEl.className = "cpr-banner cpr-narrow";
      } else {
        cprBannerEl.className = "cpr-banner cpr-wider";
      }
    } else {
      cprBannerEl.style.display = "none";
    }
  }

  if (stratStateEl && stratDetailsEl && indexData.strategy) {
    const s = indexData.strategy;
    const stateStr = s.state;
    const isGas = (id === 'gas');
    const isEth = (id === 'eth');
    const isIndices = (id === 'nifty' || id === 'banknifty');
    const formatVal = (v) => formatIndexPrice(v, (isGas || isEth));

    let stateClass = "status-neutral";
    let stateText = "NEUTRAL";
    let detailsHtml = "";

    const setupSuffix = s.setupType ? ` (Setup ${s.setupType})` : '';

    if (stateStr === "NO_TRADE_ZONE") {
      stateClass = "status-neutral";
      stateText = "NO TRADE ZONE";
      detailsHtml = `<span style="color: #ef4444; font-weight: 700;">Inside CPR boundary</span><br><span>No trades allowed inside this zone.</span>`;
    } else if (stateStr === "NEUTRAL") {
      stateClass = "status-neutral";
      stateText = "NEUTRAL";
      detailsHtml = isIndices
        ? `<span>Waiting for CPR breakout or reversal...</span>`
        : `<span>VWAP: ${formatVal(s.currentVwap)}</span><br><span>Waiting for price momentum...</span>`;
    } else if (stateStr === "LONG_MOMENTUM") {
      stateClass = "status-momentum";
      stateText = `MOMENTUM (UP)${setupSuffix}`;
      detailsHtml = isIndices
        ? `<span>Leg High: ${formatVal(s.swingHigh)}</span><br><span>Tracking leg swing high...</span>`
        : `<span>VWAP: ${formatVal(s.currentVwap)}</span><br><span>Leg High: ${formatVal(s.swingHigh)}</span><br><span>Tracking leg swing high...</span>`;
    } else if (stateStr === "LONG_RETEST") {
      stateClass = "status-retest";
      stateText = isIndices ? `RETESTING${setupSuffix}` : "RETESTING VWAP";
      
      let lineLabel = "VWAP";
      if (isIndices) {
        if (s.setupType === 1) lineLabel = "CPR Top (TC)";
        else if (s.setupType === 2) lineLabel = "Support 1 (S1)";
        else if (s.setupType === 3) lineLabel = "Resistance 1 (R1)";
      }
      
      detailsHtml = isIndices
        ? `<span>Retest Bound: ${lineLabel}</span><br><span>Swing High: ${formatVal(s.swingHigh)}</span><br><span style="color: #facc15;">Wait for breakout above Swing High</span>`
        : `<span>VWAP: ${formatVal(s.currentVwap)}</span><br><span>Swing High: ${formatVal(s.swingHigh)}</span><br><span style="color: #facc15;">Wait for breakout above Swing High</span>`;
    } else if (stateStr === "LONG_TRIGGERED") {
      stateClass = "status-triggered-long";
      stateText = `LONG ENTRY${setupSuffix}`;
      detailsHtml = `<span style="color: #4ade80; font-weight: 700;">🚨 ENTRY TAKEN</span><br><span>Entry: ${formatVal(s.entry)}</span><br><span>SL: ${formatVal(s.sl)}</span><br><span>Target: ${formatVal(s.target)}</span>`;
    } else if (stateStr === "SHORT_MOMENTUM") {
      stateClass = "status-momentum";
      stateText = `MOMENTUM (DN)${setupSuffix}`;
      detailsHtml = isIndices
        ? `<span>Leg Low: ${formatVal(s.swingLow)}</span><br><span>Tracking leg swing low...</span>`
        : `<span>VWAP: ${formatVal(s.currentVwap)}</span><br><span>Leg Low: ${formatVal(s.swingLow)}</span><br><span>Tracking leg swing low...</span>`;
    } else if (stateStr === "SHORT_RETEST") {
      stateClass = "status-retest";
      stateText = isIndices ? `RETESTING${setupSuffix}` : "RETESTING VWAP";
      
      let lineLabel = "VWAP";
      if (isIndices) {
        if (s.setupType === 1) lineLabel = "CPR Bottom (BC)";
        else if (s.setupType === 2) lineLabel = "Resistance 1 (R1)";
        else if (s.setupType === 3) lineLabel = "Support 1 (S1)";
      }

      detailsHtml = isIndices
        ? `<span>Retest Bound: ${lineLabel}</span><br><span>Swing Low: ${formatVal(s.swingLow)}</span><br><span style="color: #facc15;">Wait for breakdown below Swing Low</span>`
        : `<span>VWAP: ${formatVal(s.currentVwap)}</span><br><span>Swing Low: ${formatVal(s.swingLow)}</span><br><span style="color: #facc15;">Wait for breakdown below Swing Low</span>`;
    } else if (stateStr === "SHORT_TRIGGERED") {
      stateClass = "status-triggered-short";
      stateText = `SHORT ENTRY${setupSuffix}`;
      detailsHtml = `<span style="color: #f87171; font-weight: 700;">🚨 ENTRY TAKEN</span><br><span>Entry: ${formatVal(s.entry)}</span><br><span>SL: ${formatVal(s.sl)}</span><br><span>Target: ${formatVal(s.target)}</span>`;
    }

    stratStateEl.className = `strat-status-val ${stateClass}`;
    stratStateEl.textContent = stateText;
    stratDetailsEl.innerHTML = detailsHtml;

    // Render Multi-Timeframe Trend Grid
    if (s.trends) {
      const timeframes = ['5m', '15m', '1h', '1d'];
      timeframes.forEach(tf => {
        const pill = document.getElementById(`${id}-trend-${tf}`);
        if (pill) {
          const isBull = (s.trends[tf] === 'bull');
          pill.className = `trend-pill ${isBull ? 'trend-bull' : 'trend-bear'}`;
          pill.textContent = `${tf}: ${isBull ? 'Bull 🟢' : 'Bear 🔴'}`;
        }
      });
    }
  }

  // Update corresponding ticker items
  updateTickerItem(id, indexData);
}

function updateTickerItem(id, indexData) {
  if (!indexData) return;
  
  const priceEl = document.getElementById(`tick-${id}-price`);
  const changeEl = document.getElementById(`tick-${id}-change`);
  
  if (!priceEl || !changeEl) return;

  const isGas = (id === 'gas');
  const isUsdInr = (id === 'usdinr');
  
  // Format price
  const priceFormatted = formatIndexPrice(indexData.price, isUsdInr);

  const changeSign = indexData.change >= 0 ? '+' : '';
  const changePercentVal = indexData.changePercent.toFixed(2);

  priceEl.textContent = priceFormatted;
  changeEl.textContent = `${changeSign}${changePercentVal}%`;
  
  if (indexData.change >= 0) {
    changeEl.className = 't-change up';
  } else {
    changeEl.className = 't-change down';
  }
}

function formatIndexPrice(val, decimalsOnly = false) {
  if (val === null || val === undefined || isNaN(val)) return '--';
  if (decimalsOnly) {
    return val.toFixed(2);
  }
  // Standard integer with commas formatting (e.g. 24,186.05)
  const parts = val.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}


/* --- LIVE CLOCK & COUNTDOWN TIMERS --- */
function updateClockAndTimers() {
  const now = new Date();
  
  // Format Clock display (Indian Standard Time)
  const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
  const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  
  document.getElementById('live-ist-clock').textContent = now.toLocaleTimeString('en-US', timeOptions);
  document.getElementById('live-ist-date').textContent = now.toLocaleDateString('en-US', dateOptions);

  // Set Target Premarket and Open Timings
  // Premarket begins at 9:00:00 AM IST
  // Normal Market opens at 9:15:00 AM IST
  let premarketTarget = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
  let openTarget = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 15, 0);
  let closeTarget = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 30, 0);

  // Status Indicator logic
  const statusBadge = document.getElementById('market-status-badge');
  const statusPulse = statusBadge.querySelector('.status-pulse');
  const statusText = document.getElementById('market-status-text');

  if (now >= openTarget && now < closeTarget) {
    statusText.textContent = "Market Active";
    statusPulse.className = "status-pulse";
    statusPulse.style.backgroundColor = "var(--bullish)";
  } else if (now >= premarketTarget && now < openTarget) {
    statusText.textContent = "Pre-Market Open";
    statusPulse.className = "status-pulse";
    statusPulse.style.backgroundColor = "var(--gas-cyan)";
  } else {
    statusText.textContent = "Overnight Watch";
    statusPulse.className = "status-pulse inactive";
  }

  // Adjust targets to next day if we are past the open/premarket times for today
  if (now > premarketTarget) {
    premarketTarget.setDate(premarketTarget.getDate() + 1);
  }
  if (now > openTarget) {
    openTarget.setDate(openTarget.getDate() + 1);
  }

  // Calculate Countdowns
  const premarketDiff = premarketTarget - now;
  const openDiff = openTarget - now;

  document.getElementById('premarket-countdown').textContent = formatCountdown(premarketDiff);
  document.getElementById('open-countdown').textContent = formatCountdown(openDiff);

  // Update Live Event Countdown Warnings
  updateCalendarCountdowns(now);
}

const CALENDAR_EVENTS = [
  { id: 'ev-premarket', title: 'NSE Pre-market Trading Window opens', timeStr: '09:00 AM', country: 'IN', impact: 'HIGH IMPACT', hour: 9, min: 0 },
  { id: 'ev-open', title: 'Indian Equity Markets Open', timeStr: '09:15 AM', country: 'IN', impact: 'HIGH IMPACT', hour: 9, min: 15 },
  { id: 'ev-building', title: 'US Building Permits / Housing Starts', timeStr: '06:00 PM', country: 'US', impact: 'MEDIUM IMPACT', hour: 18, min: 0 },
  { id: 'ev-eia', title: 'EIA Weekly Natural Gas Storage Report', timeStr: '08:00 PM', country: 'US', impact: 'CRITICAL FOR NG', hour: 20, min: 0 }
];

function updateCalendarCountdowns(now) {
  const container = document.querySelector('.calendar-events');
  if (!container) return;

  container.innerHTML = '';

  const day = now.getDay();
  const isWeekend = (day === 0 || day === 6);

  CALENDAR_EVENTS.forEach(ev => {
    let targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ev.hour, ev.min, 0);
    
    // Check if event is completed for today
    let timeDiffMs = targetTime.getTime() - now.getTime();
    
    let countdownText = '';
    let statusClass = '';

    if (timeDiffMs > 0) {
      // Event is upcoming
      const totalSecs = Math.floor(timeDiffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      
      if (hours > 0) {
        countdownText = `starts in ${hours}h ${minutes}m`;
      } else {
        countdownText = `starts in ${minutes}m`;
      }
      statusClass = 'event-upcoming';
    } else if (timeDiffMs <= 0 && timeDiffMs >= -3600000) {
      // Currently active (running within last 1 hour)
      countdownText = '🟢 LIVE ACTIVE';
      statusClass = 'event-active';
    } else {
      // Completed today
      countdownText = '✓ COMPLETED';
      statusClass = 'event-completed';
      
      // Target next day's event if past
      targetTime.setDate(targetTime.getDate() + 1);
      timeDiffMs = targetTime.getTime() - now.getTime();
      const totalSecs = Math.floor(timeDiffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      countdownText = `next in ${hours}h ${minutes}m`;
    }

    const eventItem = document.createElement('div');
    eventItem.className = `event-item ${statusClass}`;
    
    const highlightTodayClass = (ev.id === 'ev-premarket' || ev.id === 'ev-open') ? 'highlight-today' : '';
    if (highlightTodayClass) eventItem.classList.add(highlightTodayClass);

    // Custom coloring for critical/high impact indicators
    const isCritical = ev.impact.includes("CRITICAL");
    const isHigh = ev.impact.includes("HIGH");
    const impactClass = isCritical ? 'critical' : (isHigh ? 'high' : 'medium');

    eventItem.innerHTML = `
      <div class="event-meta">
        <span class="event-time">${ev.timeStr}</span>
        <span class="event-country ${ev.country}">${ev.country}</span>
      </div>
      <div class="event-detail">
        <p class="event-title">${ev.title}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem;">
          <span class="event-impact ${impactClass}">${ev.impact}</span>
          <span class="event-countdown-badge">${countdownText}</span>
        </div>
      </div>
    `;

    container.appendChild(eventItem);
  });
}

function formatCountdown(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
}


/* --- PERSISTENT PREP CHECKLIST --- */
function saveChecklistState() {
  const checklist = document.getElementById('checklist');
  const checkboxes = checklist.querySelectorAll('input[type="checkbox"]');
  const states = {};
  
  checkboxes.forEach(chk => {
    states[chk.id] = chk.checked;
  });
  
  localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(states));
}

function loadChecklistState() {
  const savedStatesStr = localStorage.getItem(CHECKLIST_STORAGE_KEY);
  if (!savedStatesStr) return;
  
  try {
    const states = JSON.parse(savedStatesStr);
    Object.keys(states).forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.checked = states[id];
      }
    });
  } catch (e) {
    console.error("Error loading checklist state", e);
  }
}

function resetChecklist() {
  const checklist = document.getElementById('checklist');
  const checkboxes = checklist.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(chk => {
    chk.checked = false;
  });
  saveChecklistState();
}


/* --- STRATEGY NOTES & SUPPORT/RESISTANCE LEVELS --- */
let saveNotesTimeout = null;

function saveNotes() {
  const text = document.getElementById('trading-notes').value;
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = 'Saving...';
  
  clearTimeout(saveNotesTimeout);
  saveNotesTimeout = setTimeout(() => {
    localStorage.setItem(NOTES_STORAGE_KEY, text);
    statusEl.textContent = 'All changes saved locally';
  }, 400);
}

function loadNotes() {
  const savedNotes = localStorage.getItem(NOTES_STORAGE_KEY);
  const textarea = document.getElementById('trading-notes');
  if (savedNotes !== null) {
    textarea.value = savedNotes;
  } else {
    applyNoteTemplate(true);
  }
}

const TEMPLATE_STORAGE_KEY = 'premarket_trader_custom_template';

function saveAsTemplate() {
  const text = document.getElementById('trading-notes').value;
  localStorage.setItem(TEMPLATE_STORAGE_KEY, text);
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = 'Saved as your custom default template!';
  setTimeout(() => {
    statusEl.textContent = 'All changes saved locally';
  }, 2000);
}

function applyNoteTemplate(forceSilent = false) {
  const textarea = document.getElementById('trading-notes');
  const customTemplate = localStorage.getItem(TEMPLATE_STORAGE_KEY);
  
  const defaultTemplate = `--- PRE-MARKET TRADING PLAN (${new Date().toLocaleDateString('en-IN', {day: '2-digit', month: 'short'})}) ---

[NIFTY 50]
- Support: S1: _______ | S2: _______
- Resistance: R1: _______ | R2: _______
- Trigger Action: 

[BANK NIFTY]
- Support: S1: _______ | S2: _______
- Resistance: R1: _______ | R2: _______
- Trigger Action: 

[MCX NATURAL GAS]
- Support: S1: _______ | S2: _______
- Resistance: R1: _______ | R2: _______
- Trigger Action: `;
  const templateToApply = customTemplate || defaultTemplate;

  if (forceSilent || textarea.value.trim() === '' || confirm("Overwrite current notes with your template?")) {
    textarea.value = templateToApply;
    saveNotes();
  }
}


/* --- CATALYST NEWS FEED AGGREGATION & OVERNIGHT NEWS FILTER --- */
let RAW_EQ_NEWS = [];
let RAW_GAS_NEWS = [];
let currentEqNewsTab = 'overnight';
let currentGasNewsTab = 'overnight';

// Expose switch functions to global window context so onclick inline handlers work
window.switchEqNewsTab = function(tab) {
  currentEqNewsTab = tab;
  document.getElementById('tab-eq-overnight').className = tab === 'overnight' ? 'news-tab active' : 'news-tab';
  document.getElementById('tab-eq-trading').className = tab === 'trading' ? 'news-tab active' : 'news-tab';
  renderNewsDesk();
};

window.switchGasNewsTab = function(tab) {
  currentGasNewsTab = tab;
  document.getElementById('tab-gas-overnight').className = tab === 'overnight' ? 'news-tab active' : 'news-tab';
  document.getElementById('tab-gas-trading').className = tab === 'trading' ? 'news-tab active' : 'news-tab';
  renderNewsDesk();
};

async function refreshAllFeeds() {
  const refreshButton = document.querySelector('.refresh-all-btn');
  if (refreshButton) refreshButton.classList.add('spinning');
  
  document.getElementById('eq-feed-time').textContent = "Updating...";
  document.getElementById('gas-feed-time').textContent = "Updating...";

  try {
    const response = await fetch('/api/news');
    if (!response.ok) throw new Error("News API failed");
    const data = await response.json();

    RAW_EQ_NEWS = data.equity || [];
    RAW_GAS_NEWS = data.gas || [];

    renderNewsDesk();

  } catch (error) {
    console.error("Feed aggregation error, serving fallback templates", error);
    RAW_EQ_NEWS = FALLBACK_EQ_NEWS;
    RAW_GAS_NEWS = FALLBACK_GAS_NEWS;
    renderNewsDesk();
  } finally {
    if (refreshButton) refreshButton.classList.remove('spinning');
    
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('eq-feed-time').innerHTML = `Refreshed ${timeStr}`;
    document.getElementById('gas-feed-time').innerHTML = `Refreshed ${timeStr}`;
  }
}

// Render filtered lists on the dashboard based on active tabs
function renderNewsDesk() {
  const filteredEq = filterNewsByTab(RAW_EQ_NEWS, currentEqNewsTab);
  const filteredGas = filterNewsByTab(RAW_GAS_NEWS, currentGasNewsTab);

  renderCatalystList('eq-news-list', filteredEq, 'equity');
  renderCatalystList('gas-news-list', filteredGas, 'gas');
  
  // Update indicators strip
  updateGasStatIndicators(RAW_GAS_NEWS);
}

// Dynamic tab boundary partition
function filterNewsByTab(articles, tab) {
  const now = new Date();
  const day = now.getDay();
  const isWeekend = (day === 0 || day === 6);
  
  if (tab === 'trading') {
    // Check if we are currently past today's open (9:15 AM)
    const todayOpen = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 15, 0).getTime();
    
    let startTrading, endTrading;
    if (now.getTime() >= todayOpen && !isWeekend) {
      startTrading = todayOpen;
      endTrading = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 30, 0).getTime();
    } else {
      // Use previous trading day's range
      const prevCloseTime = getPreviousMarketCloseTimestamp();
      const prevCloseDate = new Date(prevCloseTime);
      startTrading = new Date(prevCloseDate.getFullYear(), prevCloseDate.getMonth(), prevCloseDate.getDate(), 9, 15, 0).getTime();
      endTrading = prevCloseTime;
    }
    
    const filtered = articles.filter(article => {
      const t = parseFeedDate(article.pubDate).getTime();
      return t >= startTrading && t <= endTrading;
    });

    // If no trading hours news found in bounds, return the most recent 6 articles so the tab is never empty
    return filtered.length > 0 ? filtered : articles.slice(0, 6);
  } else {
    // Overnight (previous close 3:30 PM to today 9:00 AM)
    const startOvernight = getPreviousMarketCloseTimestamp();
    const endOvernight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0).getTime();
    
    const filtered = articles.filter(article => {
      const t = parseFeedDate(article.pubDate).getTime();
      return t >= startOvernight && t <= endOvernight;
    });

    return filtered.length > 0 ? filtered : articles.slice(0, 6);
  }
}

// Helper to find previous trading day's 3:30 PM (15:30) IST closing timestamp
function getPreviousMarketCloseTimestamp() {
  const now = new Date();
  let checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 30, 0);

  if (now.getDay() === 0) { // Sunday
    checkDate.setDate(checkDate.getDate() - 2);
  } else if (now.getDay() === 6) { // Saturday
    checkDate.setDate(checkDate.getDate() - 1);
  } else if (now.getDay() === 1 && now.getHours() < 9) { // Monday before open
    checkDate.setDate(checkDate.getDate() - 3);
  } else if (now.getHours() < 9) { 
    checkDate.setDate(checkDate.getDate() - 1);
  } else if (now > checkDate) {
    return checkDate.getTime();
  } else {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  return checkDate.getTime();
}

// Parse custom feed date strings to prevent browser date crashes
function parseFeedDate(dateStr) {
  if (!dateStr) return new Date();
  if (typeof dateStr === 'string' && dateStr.includes(' ') && !dateStr.includes('T')) {
    return new Date(dateStr.replace(' ', 'T'));
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

// Render cards showing summaries directly and redirecting to links on click
function renderCatalystList(elementId, articles, category, isFallback = false) {
  const container = document.getElementById(elementId);
  container.innerHTML = '';

  if (!articles || articles.length === 0) {
    container.innerHTML = `
      <div class="loading-state">
        <p>No catalysts found in this window.</p>
      </div>
    `;
    return;
  }

  articles.forEach(article => {
    const itemDiv = document.createElement('div');
    itemDiv.className = `catalyst-item`;
    
    // Add specific border glow styles
    if (article.impact === 'high') itemDiv.classList.add('impact-critical');
    if (article.type === 'gas' || category === 'gas') itemDiv.classList.add('type-gas');

    const timeFormatted = formatRelativeTime(article.pubDate);
    const fallbackHTML = isFallback ? `<span class="fallback-badge">Cached</span>` : '';

    const impactLabel = article.impact === 'high' ? '🔴 High Impact' : '⚪ Low Impact';
    const impactClass = article.impact === 'high' ? 'high-impact' : 'low-impact';

    const directLabel = article.direct ? '⚡ Direct' : '🌐 Indirect';
    const directClass = article.direct ? 'direct-impact' : 'indirect-impact';

    itemDiv.innerHTML = `
      <div class="catalyst-meta">
        <span class="catalyst-source">${article.source} ${fallbackHTML}</span>
        <span class="catalyst-time">${timeFormatted}</span>
      </div>
      <div class="catalyst-title">${article.title}</div>
      <div class="catalyst-summary">${article.description || 'No description provided.'}</div>
      <div class="catalyst-tags">
        <span class="tag-impact ${impactClass}">${impactLabel}</span>
        <span class="tag-type ${directClass}">${directLabel}</span>
      </div>
    `;

    // Click card to open the external link directly (Original V1 style)
    itemDiv.addEventListener('click', () => {
      if (article.link) {
        window.open(article.link, '_blank');
      }
    });

    container.appendChild(itemDiv);
  });
}

function formatRelativeTime(dateStr) {
  const date = parseFeedDate(dateStr);
  const now = new Date();
  const diffMs = now - date;
  
  if (isNaN(diffMs) || diffMs < 0) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Update indicators inside the original stat-box layout
function updateGasStatIndicators(gasNews) {
  const weatherIndicator = document.getElementById('weather-status-indicator');
  const eiaIndicator = document.getElementById('eia-status-indicator');
  
  let coldSignals = 0;
  let warmSignals = 0;
  
  const coldKeywords = ['cold', 'freeze', 'winter', 'chill', 'below normal', 'cooler', 'arctic', 'snow'];
  const warmKeywords = ['warm', 'heatwave', 'hot', 'above normal', 'summer', 'mild', 'temperatures rise'];

  gasNews.forEach(item => {
    const text = (item.title + " " + item.description).toLowerCase();
    
    coldKeywords.forEach(word => { if (text.includes(word)) coldSignals++; });
    warmKeywords.forEach(word => { if (text.includes(word)) warmSignals++; });
  });

  if (coldSignals > warmSignals) {
    weatherIndicator.textContent = "❄️ Colder (Bullish)";
    weatherIndicator.className = "stat-val cold";
  } else if (warmSignals > coldSignals) {
    weatherIndicator.textContent = "🔥 Warmer (Bearish)";
    weatherIndicator.className = "stat-val warm";
  } else {
    weatherIndicator.textContent = "🍃 Neutral Forecast";
    weatherIndicator.className = "stat-val neutral";
  }

  // Update EIA consensus from news if available
  let parsedEIA = false;
  for (let item of gasNews) {
    const text = (item.title + " " + item.description).toLowerCase();
    if (text.includes('eia') && (text.includes('bcf') || text.includes('storage') || text.includes('inventory'))) {
      const match = text.match(/(\d+)\s*bcf/);
      if (match) {
        eiaIndicator.textContent = `${match[0]} (Consensus)`;
        parsedEIA = true;
        break;
      }
    }
  }

  if (!parsedEIA) {
    eiaIndicator.textContent = "Thursdays 8:00 PM";
  }
}

// Utility to clean HTML descriptions
function stripHTML(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let text = doc.body.textContent || "";
  
  if (text.length > 250) {
    text = text.substring(0, 247) + "...";
  }
  return text.trim();
}

/* --- NOTIFICATION SETTINGS MANAGEMENT (WHATSAPP & NTFY.SH) --- */
async function loadNotificationSettings() {
  try {
    const response = await fetch('/api/whatsapp/settings');
    if (!response.ok) throw new Error("Settings fetch failed");
    const settings = await response.json();
    
    // WhatsApp UI
    document.getElementById('whatsapp-toggle').checked = settings.enabled || false;
    document.getElementById('whatsapp-phone').value = settings.phone || '';
    document.getElementById('whatsapp-apikey').value = settings.apikey || '';

    // ntfy.sh UI
    document.getElementById('ntfy-toggle').checked = settings.ntfyEnabled || false;
    document.getElementById('ntfy-topic').value = settings.ntfyTopic || '';
  } catch (error) {
    console.error("Failed to load notification settings:", error);
  }
}

let saveNotificationTimeout = null;
function saveNotificationSettings() {
  clearTimeout(saveNotificationTimeout);
  
  saveNotificationTimeout = setTimeout(async () => {
    const enabled = document.getElementById('whatsapp-toggle').checked;
    const phone = document.getElementById('whatsapp-phone').value.trim();
    const apikey = document.getElementById('whatsapp-apikey').value.trim();

    const ntfyEnabled = document.getElementById('ntfy-toggle').checked;
    const ntfyTopic = document.getElementById('ntfy-topic').value.trim();
    
    const settings = { 
      enabled, 
      phone, 
      apikey,
      ntfyEnabled,
      ntfyTopic
    };
    
    try {
      const response = await fetch('/api/whatsapp/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error("Settings save failed");
      console.log("Notification settings saved successfully.");
    } catch (error) {
      console.error("Failed to save notification settings:", error);
    }
  }, 500);
}
