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
    
  } catch (error) {
    console.error("Quotes poller failed:", error);
  }
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
async function refreshAllFeeds() {
  const refreshButton = document.querySelector('.refresh-all-btn');
  if (refreshButton) refreshButton.classList.add('spinning');
  
  document.getElementById('eq-feed-time').textContent = "Updating...";
  document.getElementById('gas-feed-time').textContent = "Updating...";

  // 1. Fetch Indian Markets feed (including Google News backup for maximum reliability)
  const eqFeeds = [
    'https://www.moneycontrol.com/rss/marketnews.xml',
    'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    'https://news.google.com/rss/search?q=Nifty+50+OR+Bank+Nifty+OR+SEBI+market+when:1d&hl=en-IN&gl=IN&ceid=IN:en'
  ];
  
  // 2. Fetch Natural Gas feeds (Broadened Google News query for plenty of fresh bulletins)
  const gasFeeds = [
    'https://news.google.com/rss/search?q=Natural+Gas+OR+Henry+Hub+OR+LNG+energy+storage+weather+when:3d&hl=en-US&gl=US&ceid=US:en'
  ];

  try {
    // Parallel fetch feeds
    const [eqNews, gasNews] = await Promise.all([
      fetchMultipleFeeds(eqFeeds, 'equity'),
      fetchMultipleFeeds(gasFeeds, 'gas')
    ]);

    renderCatalystList('eq-news-list', eqNews, 'equity');
    renderCatalystList('gas-news-list', gasNews, 'gas');
    
    // Update US Weather and EIA status indicators
    updateGasStatIndicators(gasNews);

  } catch (error) {
    console.error("Feed aggregation error, serving fallback templates", error);
    renderCatalystList('eq-news-list', FALLBACK_EQ_NEWS, 'equity', true);
    renderCatalystList('gas-news-list', FALLBACK_GAS_NEWS, 'gas', true);
    updateGasStatIndicators(FALLBACK_GAS_NEWS);
  } finally {
    if (refreshButton) refreshButton.classList.remove('spinning');
    
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('eq-feed-time').innerHTML = `Refreshed ${timeStr}`;
    document.getElementById('gas-feed-time').innerHTML = `Refreshed ${timeStr}`;
  }
}

// Fetch RSS feeds converted to JSON via rss2json API
async function fetchMultipleFeeds(feedUrls, category) {
  let aggregated = [];
  
  const fetches = feedUrls.map(async (url) => {
    try {
      const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("CORS Proxy request failed");
      const data = await response.json();
      
      if (data.status === 'ok' && data.items) {
        return data.items.map(item => {
          let cleanSource = data.feed.title || "Financial Feed";
          if (cleanSource.includes("Moneycontrol")) cleanSource = "Moneycontrol";
          else if (cleanSource.includes("Economic Times")) cleanSource = "Economic Times";
          else if (cleanSource.includes("Yahoo")) cleanSource = "Yahoo Finance";
          else if (cleanSource.includes("Google News")) cleanSource = "Google News";

          return {
            title: item.title,
            pubDate: item.pubDate || item.pubdate,
            source: cleanSource,
            description: stripHTML(item.content || item.description || ""),
            link: item.link
          };
        });
      }
      return [];
    } catch (e) {
      console.warn(`Failed to fetch RSS feed: ${url}`, e);
      return [];
    }
  });

  const results = await Promise.all(fetches);
  results.forEach(res => { aggregated = aggregated.concat(res); });
  
  // Sort by date descending
  aggregated.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  // Filter for Overnight (from previous market close at 3:30 PM to today's open)
  if (category === 'equity') {
    aggregated = filterOvernightNews(aggregated);
  } else if (category === 'gas') {
    aggregated = filterGasSpecificNews(aggregated);
  }

  // Remove duplicates by title
  const unique = [];
  const seenTitles = new Set();
  for (const item of aggregated) {
    const normTitle = item.title.toLowerCase().trim();
    if (!seenTitles.has(normTitle)) {
      seenTitles.add(normTitle);
      unique.push(item);
    }
  }

  // If no news returned, throw to use fallbacks
  if (unique.length === 0) {
    throw new Error("No items returned from feed query");
  }

  return unique.slice(0, 12); // Limit to top 12 items
}

// Filter Nifty 50 and Bank Nifty news since previous day 3:30 PM
function filterOvernightNews(items) {
  const marketCloseTimestamp = getPreviousMarketCloseTimestamp();
  
  return items.filter(item => {
    const itemTime = parseFeedDate(item.pubDate).getTime();
    return itemTime >= marketCloseTimestamp;
  });
}

// Parse custom feed date strings to prevent browser date crashes
function parseFeedDate(dateStr) {
  if (!dateStr) return new Date();
  
  // Check if it is space separated space like "2026-07-15 03:43:47" and lacks 'T'
  if (typeof dateStr === 'string' && dateStr.includes(' ') && !dateStr.includes('T')) {
    return new Date(dateStr.replace(' ', 'T'));
  }
  
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

// Helper to find previous trading day's 3:30 PM (15:30) IST closing timestamp
function getPreviousMarketCloseTimestamp() {
  const now = new Date();
  let checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 30, 0);

  // If today is weekend (Saturday or Sunday), go back to Friday close
  if (now.getDay() === 0) { // Sunday
    checkDate.setDate(checkDate.getDate() - 2);
  } else if (now.getDay() === 6) { // Saturday
    checkDate.setDate(checkDate.getDate() - 1);
  } else if (now.getDay() === 1 && now.getHours() < 9) { // Monday before open
    checkDate.setDate(checkDate.getDate() - 3);
  } else if (now.getHours() < 9) { 
    // If it's a weekday before 9 AM, we want yesterday's market close
    checkDate.setDate(checkDate.getDate() - 1);
  } else if (now > checkDate) {
    // If it's a weekday and current time is past 3:30 PM, target today's 15:30 PM
    return checkDate.getTime();
  } else {
    // If it's between 9:00 AM and 3:30 PM today, target yesterday's close
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  return checkDate.getTime();
}

// Filter Natural Gas items
function filterGasSpecificNews(items) {
  const keywords = ['natural gas', 'gas futures', 'henry hub', 'eia', 'lng', 'weather', 'cold', 'freeze', 'heatwave', 'heating degree', 'cooling degree', 'nord stream', 'pipeline', 'gazprom', 'storage', 'inventory', 'fracking', 'energy stocks', 'drillers'];
  
  return items.filter(item => {
    const text = (item.title + " " + item.description).toLowerCase();
    const isGasRelated = keywords.some(keyword => text.includes(keyword));
    
    if (isGasRelated) {
      item.type = 'gas';
      // Identify impact
      if (text.includes('eia') || text.includes('storage') || text.includes('inventory') || text.includes('jump') || text.includes('surge') || text.includes('plummet')) {
        item.impact = 'critical';
      } else if (text.includes('weather') || text.includes('forecast') || text.includes('freeze') || text.includes('colder')) {
        item.impact = 'high';
      } else {
        item.impact = 'medium';
      }
    }
    return isGasRelated;
  });
}

// Render cards showing summaries directly and redirecting to links on click (no modal)
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
    if (article.impact === 'critical') itemDiv.classList.add('impact-critical');
    else if (article.impact === 'high') itemDiv.classList.add('impact-high');
    
    if (article.type === 'gas') itemDiv.classList.add('type-gas');

    // Humanize publication date
    const timeFormatted = formatRelativeTime(article.pubDate);
    
    // Fallback badge if displaying cached/fallback data
    const fallbackHTML = isFallback ? `<span class="fallback-badge">Cached</span>` : '';

    itemDiv.innerHTML = `
      <div class="catalyst-meta">
        <span class="catalyst-source">${article.source} ${fallbackHTML}</span>
        <span class="catalyst-time">${timeFormatted}</span>
      </div>
      <div class="catalyst-title">${article.title}</div>
      <div class="catalyst-summary">${article.description}</div>
    `;

    // Click card to open the external link directly (Original V1 style)
    itemDiv.addEventListener('click', () => {
      window.open(article.link, '_blank');
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
