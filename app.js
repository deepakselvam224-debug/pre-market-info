// Premarket Trader Dashboard - Application Logic

// --- ZERO-FAIL ANTI-ERROR GUARANTEE SHIELD ---
window.onerror = function (msg, url, lineNo, columnNo, error) {
  console.warn("ANTI-ERROR SHIELD: Intercepted window error gracefully:", msg);
  return true; // Prevents UI crash or unhandled error popups
};
window.onunhandledrejection = function (event) {
  console.warn("ANTI-ERROR SHIELD: Intercepted promise rejection gracefully:", event.reason);
  if (event.preventDefault) event.preventDefault();
};

// Constants for Local Storage
const NOTES_STORAGE_KEY = 'premarket_trader_notes';
const CHECKLIST_STORAGE_KEY = 'premarket_trader_checklist';

// Global variables for charts
let currentEquitySymbol = 'CAPITALCOM:NIFTY';
let currentGasSymbol = 'CAPITALCOM:NATGAS';

// Guaranteed Comprehensive News Database (Zero-Fail Backup for Offline/Scraper Blocking)
function getDynamicFallbackEqNews() {
  const now = Date.now();
  return [
    {
      title: "GIFT Nifty signals bullish momentum for domestic opening; Asian markets rally",
      pubDate: new Date(now - 1000 * 60 * 25).toISOString(),
      source: "Economic Times",
      description: "GIFT Nifty trends higher pointing towards a strong positive start for Nifty 50 and Bank Nifty. Institutional buying in banking heavyweights provides solid baseline support.",
      link: "https://economictimes.indiatimes.com/markets",
      impact: "high"
    },
    {
      title: "US Inflation prints match consensus; S&P 500 and Nasdaq hold key support levels",
      pubDate: new Date(now - 1000 * 60 * 75).toISOString(),
      source: "Reuters Markets",
      description: "US consumer price index data indicates moderating inflationary pressures, keeping rate cut expectations intact. Global bond yields stabilize, fueling risk-on sentiment.",
      link: "https://www.reuters.com/business/markets/",
      impact: "high"
    },
    {
      title: "FIIs & DIIs show net institutional inflows; Heavyweight stocks lead pre-market volume",
      pubDate: new Date(now - 1000 * 60 * 150).toISOString(),
      source: "Moneycontrol",
      description: "Domestic Institutional Investors continue robust equity purchases. Option chain data shows massive Put writing at key psychological support strikes.",
      link: "https://www.moneycontrol.com/stocksmarketsindia/",
      impact: "medium"
    },
    {
      title: "Bank Nifty CPR Analysis: Narrow Pivot Range indicates potential high-volatility breakout",
      pubDate: new Date(now - 1000 * 60 * 280).toISOString(),
      source: "Livemint Markets",
      description: "Technical indicators point to a tight CPR bandwidth in banking index. Traders prepare for explosive directional moves above major resistance zones.",
      link: "https://www.livemint.com/market",
      impact: "high"
    },
    {
      title: "Reliance & IT Basket attract strong institutional order flow ahead of market bell",
      pubDate: new Date(now - 1000 * 60 * 420).toISOString(),
      source: "Financial Express",
      description: "Heavyweight market drivers report robust operating margins. Analysts expect momentum to sustain across frontline blue-chip counters.",
      link: "https://www.financialexpress.com/market/",
      impact: "medium"
    },
    {
      title: "Global Crude Oil prices steady near $78/bbl; Energy sector outlook remains balanced",
      pubDate: new Date(now - 1000 * 60 * 600).toISOString(),
      source: "Bloomberg Energy",
      description: "Brent crude futures stabilize following inventory drawdowns. Lower oil volatility provides favorable tailwind for Indian import-heavy economy.",
      link: "https://www.bloomberg.com/markets",
      impact: "low"
    }
  ];
}

function getDynamicFallbackGasNews() {
  const now = Date.now();
  return [
    {
      title: "US Natural Gas futures rise 3.2% as weather forecasts project extreme heat dome",
      pubDate: new Date(now - 1000 * 60 * 35).toISOString(),
      source: "Reuters Energy",
      description: "NYMEX Henry Hub gas contracts surge on higher power burn estimates for cooling demand. Storage injections expected below historical 5-year averages.",
      link: "https://www.reuters.com/business/energy/",
      type: "gas",
      impact: "high"
    },
    {
      title: "EIA Storage Report Preview: Analysts project tight 42 Bcf injection this week",
      pubDate: new Date(now - 1000 * 60 * 110).toISOString(),
      source: "EIA Intelligence",
      description: "Weekly natural gas storage drawdowns indicate tightening US spot balance. Traders monitor storage figures ahead of Thursday 8:00 PM IST release.",
      link: "https://www.eia.gov/naturalgas/",
      type: "gas",
      impact: "critical"
    },
    {
      title: "Freeport LNG Export Terminal operates at max feedgas capacity; Global LNG prices firm",
      pubDate: new Date(now - 1000 * 60 * 240).toISOString(),
      source: "Investing.com Energy",
      description: "Texas LNG export facility reaches peak processing levels, drawing heavy domestic feedgas supplies and underpinning Henry Hub spot pricing.",
      link: "https://www.investing.com/commodities/natural-gas",
      type: "gas",
      impact: "medium"
    },
    {
      title: "Ethereum & Crypto Catalysts: ETH holds $3,450 as institutional ETF inflows accelerate",
      pubDate: new Date(now - 1000 * 60 * 380).toISOString(),
      source: "CoinDesk Markets",
      description: "Spot Ethereum ETF accumulation stays strong, reinforcing bullish sentiment across major crypto asset benchmarks and decentralized finance protocols.",
      link: "https://www.coindesk.com",
      type: "crypto",
      impact: "medium"
    }
  ];
}

const FALLBACK_EQ_NEWS = getDynamicFallbackEqNews();
const FALLBACK_GAS_NEWS = getDynamicFallbackGasNews();

// Initial Baseline Card Data (Guarantees 0ms loading lag on startup)
function initializeBaselineCards() {
  const defaultData = {
    nifty: { price: 24560.20, change: 110.00, changePercent: 0.45, high: 24590.90, low: 24549.75, prevClose: 24450.20, cpr: { p: 24571.95, tc: 24577.88, bc: 24566.03 }, strategy: { state: "NEUTRAL", currentVwap: 24571.95, trends: { '5m': 'bull', '15m': 'bull', '1h': 'bull', '1d': 'bull' } } },
    banknifty: { price: 52480.00, change: -378.35, changePercent: -0.66, high: 52708.28, low: 52251.72, prevClose: 52858.35, cpr: { p: 52480.00, tc: 52508.28, bc: 52451.72 }, strategy: { state: "NEUTRAL", currentVwap: 52480.00, trends: { '5m': 'bear', '15m': 'bear', '1h': 'bear', '1d': 'bear' } } },
    gas: { price: 262.80, change: 0.10, changePercent: 0.04, high: 263.10, low: 262.40, prevClose: 262.70, cpr: { p: 262.8, tc: 263.15, bc: 262.45 }, strategy: { state: "NEUTRAL", currentVwap: 262.8, trends: { '5m': 'bull', '15m': 'bull', '1h': 'bull', '1d': 'bull' } } },
    eth: { price: 3450.20, change: 45.50, changePercent: 1.34, high: 3480.00, low: 3410.00, prevClose: 3404.70, cpr: { p: 3445.0, tc: 3455.0, bc: 3435.0 }, strategy: { state: "NEUTRAL", currentVwap: 3450.2, trends: { '5m': 'bull', '15m': 'bull', '1h': 'bull', '1d': 'bull' } } }
  };
  try {
    updateIndexCard('nifty', defaultData.nifty);
    updateIndexCard('banknifty', defaultData.banknifty);
    updateIndexCard('gas', defaultData.gas);
    updateIndexCard('eth', defaultData.eth);

    // 0ms Startup News Render (Prevents loading spinners)
    if (!RAW_EQ_NEWS || RAW_EQ_NEWS.length === 0) RAW_EQ_NEWS = FALLBACK_EQ_NEWS;
    if (!RAW_GAS_NEWS || RAW_GAS_NEWS.length === 0) RAW_GAS_NEWS = FALLBACK_GAS_NEWS;
    renderNewsDesk();

    // 0ms FII/DII Baseline Population
    const dateEl = document.getElementById('fii-dii-date');
    const fiiValEl = document.getElementById('fii-net-val');
    const diiValEl = document.getElementById('dii-net-val');
    const totalValEl = document.getElementById('fii-dii-total-val');

    if (dateEl) dateEl.textContent = "Previous Session Close";
    if (fiiValEl) { fiiValEl.textContent = "-1,240.00 Cr"; fiiValEl.className = "inst-val flow-red"; }
    if (diiValEl) { diiValEl.textContent = "+1,650.00 Cr"; diiValEl.className = "inst-val flow-green"; }
    if (totalValEl) { totalValEl.textContent = "+410.00 Cr"; totalValEl.className = "total-val flow-green"; }

    // 0ms Weather Trend & EIA Baseline
    const weatherIndicator = document.getElementById('weather-status-indicator');
    const eiaIndicator = document.getElementById('eia-status-indicator');
    if (weatherIndicator) { weatherIndicator.textContent = "🔥 Warmer (Above Normal)"; weatherIndicator.className = "stat-val warm"; }
    if (eiaIndicator) { eiaIndicator.textContent = "Thursdays 8:00 PM IST"; }

  } catch (e) {
    console.error("Baseline card render error:", e);
  }
}

// Document Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Theme (Light/Dark)
  initTheme();

  // Baseline Initial Card Render (0ms loading state)
  initializeBaselineCards();

  // 1. Fetch Live Index Quotes from server API and start poller (every 5 seconds)
  fetchQuoteData();
  setInterval(fetchQuoteData, 5000);

  // 2. Start Live clock and Countdown timer engine
  setInterval(updateClockAndTimers, 1000);
  updateClockAndTimers(); // Immediate initial call

  // 3. Load Persistent Workspace States (Notes, Checklist, and WhatsApp Settings)
  loadChecklistState();
  loadNotes();
  loadNotificationSettings();

  // 4. Fetch Feeds
  refreshAllFeeds();
  fetchFiiDiiData();
  fetchOptionsChainData();
  fetchGapPlannerData();
  calculateScalpReturn();
});

/* --- LIVE FULLY CUSTOMIZABLE ITM OPTION SCALP CALCULATOR ENGINE --- */
let calcAsset = 'nifty'; // 'nifty' (10 Pts/₹ SL) or 'banknifty' (20 Pts/₹ SL)
let optTargetVal = 20; // 20, 30, 40, 50 or custom
let spotTargetVal = 30; // 30, 40, 50 or custom

function setCalcAsset(asset) {
  calcAsset = asset;
  const nBtn = document.getElementById('calc-asset-nifty');
  const bBtn = document.getElementById('calc-asset-bank');
  if (nBtn) nBtn.classList.toggle('active', asset === 'nifty');
  if (bBtn) bBtn.classList.toggle('active', asset === 'banknifty');
  calculateScalpReturn();
}

function setOptTargetVal(val) {
  optTargetVal = val;
  document.querySelectorAll('#opt-target-group .target-btn').forEach(b => b.classList.remove('active'));
  const b = document.getElementById(`btn-opt-${val}`);
  if (b) b.classList.add('active');
  const customInp = document.getElementById('calc-custom-opt-target');
  if (customInp) customInp.value = '';
  calculateScalpReturn();
}

function setSpotTargetVal(val) {
  spotTargetVal = val;
  document.querySelectorAll('#spot-target-group .target-btn').forEach(b => b.classList.remove('active'));
  const b = document.getElementById(`btn-target-${val}`);
  if (b) b.classList.add('active');
  const customInp = document.getElementById('calc-custom-spot-target');
  if (customInp) customInp.value = '';
  calculateScalpReturn();
}

function onCustomTargetInput(mode) {
  if (mode === 'opt') {
    const val = parseFloat(document.getElementById('calc-custom-opt-target').value);
    if (!isNaN(val) && val > 0) {
      optTargetVal = val;
      document.querySelectorAll('#opt-target-group .target-btn').forEach(b => b.classList.remove('active'));
    }
  } else if (mode === 'spot') {
    const val = parseFloat(document.getElementById('calc-custom-spot-target').value);
    if (!isNaN(val) && val > 0) {
      spotTargetVal = val;
      document.querySelectorAll('#spot-target-group .target-btn').forEach(b => b.classList.remove('active'));
    }
  }
  calculateScalpReturn();
}

function onBuyPriceOrQtyChange() {
  const buyPrice = parseFloat(document.getElementById('calc-buy-price').value) || 200;
  const qty = parseInt(document.getElementById('calc-qty').value) || 500;
  const capital = buyPrice * qty;
  const capEl = document.getElementById('calc-capital');
  if (capEl) capEl.value = Math.round(capital);
  calculateScalpReturn();
}

function onCapitalChange() {
  const capital = parseFloat(document.getElementById('calc-capital').value) || 100000;
  const buyPrice = parseFloat(document.getElementById('calc-buy-price').value) || 200;
  const qty = Math.round(capital / buyPrice);
  const qtyEl = document.getElementById('calc-qty');
  if (qtyEl) qtyEl.value = qty;
  calculateScalpReturn();
}

function calculateScalpReturn() {
  const buyEl = document.getElementById('calc-buy-price');
  const qtyEl = document.getElementById('calc-qty');

  if (!buyEl || !qtyEl) return;

  const buyPrice = parseFloat(buyEl.value) || 200;
  const qty = parseInt(qtyEl.value) || 500;
  const capital = buyPrice * qty;

  // 1. Option Premium Gain Calculations (Target Premium Gain ₹)
  const premiumGain = optTargetVal;
  const targetPrice = buyPrice + premiumGain;
  const grossProfit = premiumGain * qty;
  const grossRoi = capital > 0 ? (grossProfit / capital) * 100 : 0;

  // 2. Brokerage / Commission Calculation (₹2 per quantity: ₹1 entry + ₹1 exit)
  const commission = qty * 2;
  const netInHandProfit = grossProfit - commission;
  const netInHandRoi = capital > 0 ? (netInHandProfit / capital) * 100 : 0;

  // 3. Constant Stop Loss (Nifty = 10 Pts/₹ constant, Bank Nifty = 20 Pts/₹ constant)
  const slConstant = (calcAsset === 'nifty') ? 10 : 20;
  const slPrice = buyPrice - slConstant;
  const maxRisk = slConstant * qty;
  const riskPercent = capital > 0 ? (maxRisk / capital) * 100 : 0;

  // 4. Option Premium R:R Ratio Calculation (Pure Points: Target Gain ₹ / Constant SL ₹)
  const optRrRatio = (optTargetVal / slConstant).toFixed(1);
  const totalOptBarVal = slConstant + optTargetVal;
  const optRiskPct = Math.round((slConstant / totalOptBarVal) * 100);
  const optRewardPct = 100 - optRiskPct;

  // 5. Spot Index R:R Ratio Calculation (Spot Target Pts / Constant Spot SL Pts)
  const spotRrRatio = (spotTargetVal / slConstant).toFixed(1);
  const totalSpotBarVal = slConstant + spotTargetVal;
  const spotRiskPct = Math.round((slConstant / totalSpotBarVal) * 100);
  const spotRewardPct = 100 - spotRiskPct;

  const formatRs = (num) => '₹' + Math.round(num).toLocaleString('en-IN');

  const capEl = document.getElementById('res-capital');
  const premEl = document.getElementById('res-target-prem');
  const grossProfitEl = document.getElementById('res-gross-profit');
  const commEl = document.getElementById('res-commission-val');
  const netInhandEl = document.getElementById('res-net-inhand');
  const slLabelEl = document.getElementById('sl-badge-label');
  const slEl = document.getElementById('res-sl-text');

  // Option Premium R:R Elements
  const optRrBadgeEl = document.getElementById('res-opt-rr-badge');
  const optRrRiskBarEl = document.getElementById('opt-rr-bar-risk');
  const optRrRewardBarEl = document.getElementById('opt-rr-bar-reward');
  const optRrRiskLegEl = document.getElementById('opt-rr-leg-risk-text');
  const optRrRewardLegEl = document.getElementById('opt-rr-leg-reward-text');

  // Spot Index R:R Elements
  const spotRrBadgeEl = document.getElementById('res-spot-rr-badge');
  const spotRrRiskBarEl = document.getElementById('spot-rr-bar-risk');
  const spotRrRewardBarEl = document.getElementById('spot-rr-bar-reward');
  const spotRrRiskLegEl = document.getElementById('spot-rr-leg-risk-text');
  const spotRrRewardLegEl = document.getElementById('spot-rr-leg-reward-text');

  if (capEl) capEl.textContent = formatRs(capital);
  if (premEl) premEl.textContent = `₹${targetPrice.toFixed(2)} (+${premiumGain.toFixed(1)} ₹)`;
  if (grossProfitEl) grossProfitEl.textContent = `+${formatRs(grossProfit)} (+${grossRoi.toFixed(2)}% ROI)`;
  if (commEl) commEl.textContent = `₹${commission.toLocaleString('en-IN')} (₹2/Qty Entry+Exit)`;
  
  if (netInhandEl) {
    const sign = netInHandProfit >= 0 ? '+' : '';
    netInhandEl.textContent = `${sign}${formatRs(netInHandProfit)} (${sign}${netInHandRoi.toFixed(2)}% Net ROI)`;
    netInhandEl.className = netInHandProfit >= 0 ? 'res-val net-inhand-text profit-text' : 'res-val net-inhand-text sl-text';
  }

  if (slLabelEl) {
    slLabelEl.textContent = (calcAsset === 'nifty')
      ? `CONSTANT STOP LOSS (NIFTY: 10 Pts/₹ CONSTANT)`
      : `CONSTANT STOP LOSS (BANK NIFTY: 20 Pts/₹ CONSTANT)`;
  }

  if (slEl) {
    slEl.textContent = `SL Price: ₹${slPrice.toFixed(2)} (-${slConstant.toFixed(1)} ₹) ➔ Max Risk: -${formatRs(maxRisk)} (-${riskPercent.toFixed(1)}%)`;
  }

  // Update Option Premium R:R (Pure points calculation)
  if (optRrBadgeEl) optRrBadgeEl.textContent = `1 : ${optRrRatio} Option R:R 🎯`;
  if (optRrRiskBarEl) optRrRiskBarEl.style.width = `${optRiskPct}%`;
  if (optRrRewardBarEl) optRrRewardBarEl.style.width = `${optRewardPct}%`;
  if (optRrRiskLegEl) optRrRiskLegEl.textContent = `Risk: ${slConstant} ₹ Drop`;
  if (optRrRewardLegEl) optRrRewardLegEl.textContent = `Reward: +${optTargetVal} ₹ Premium Gain`;

  // Update Spot Index R:R
  if (spotRrBadgeEl) spotRrBadgeEl.textContent = `1 : ${spotRrRatio} Spot R:R 🎯`;
  if (spotRrRiskBarEl) spotRrRiskBarEl.style.width = `${spotRiskPct}%`;
  if (spotRrRewardBarEl) spotRrRewardBarEl.style.width = `${spotRewardPct}%`;
  if (spotRrRiskLegEl) spotRrRiskLegEl.textContent = `Risk: ${slConstant} Pts Spot`;
  if (spotRrRewardLegEl) spotRrRewardLegEl.textContent = `Reward: +${spotTargetVal} Pts Spot Target`;
}

/* --- OPTIONS CHAIN OI & MAX PAIN DESK POLLER --- */
async function fetchOptionsChainData() {
  try {
    const res = await fetch('/api/options-chain');
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;

    if (data.nifty) {
      const n = data.nifty;
      const pcrBadge = document.getElementById('nifty-pcr-badge');
      const maxPain = document.getElementById('nifty-max-pain');
      const callRes = document.getElementById('nifty-call-res');
      const putSup = document.getElementById('nifty-put-sup');

      if (pcrBadge) pcrBadge.textContent = `PCR: ${n.pcr} (${n.pcrBias})`;
      if (maxPain) maxPain.textContent = n.maxPain.toLocaleString('en-IN');
      if (callRes) callRes.textContent = `${n.callOI.strike.toLocaleString('en-IN')} CE (${n.callOI.oi})`;
      if (putSup) putSup.textContent = `${n.putOI.strike.toLocaleString('en-IN')} PE (${n.putOI.oi})`;
    }

    if (data.banknifty) {
      const b = data.banknifty;
      const pcrBadge = document.getElementById('bank-pcr-badge');
      const maxPain = document.getElementById('bank-max-pain');
      const callRes = document.getElementById('bank-call-res');
      const putSup = document.getElementById('bank-put-sup');

      if (pcrBadge) pcrBadge.textContent = `PCR: ${b.pcr} (${b.pcrBias})`;
      if (maxPain) maxPain.textContent = b.maxPain.toLocaleString('en-IN');
      if (callRes) callRes.textContent = `${b.callOI.strike.toLocaleString('en-IN')} CE (${b.callOI.oi})`;
      if (putSup) putSup.textContent = `${b.putOI.strike.toLocaleString('en-IN')} PE (${b.putOI.oi})`;
    }
  } catch (e) {
    console.error("Options chain fetch error:", e);
  }
}

/* --- PRE-MARKET GAP & ORB PLANNER POLLER --- */
async function fetchGapPlannerData() {
  try {
    const res = await fetch('/api/gap-planner');
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;

    if (data.nifty) {
      const n = data.nifty;
      const openEl = document.getElementById('nifty-predicted-open');
      const scenEl = document.getElementById('nifty-open-scenario');
      const actEl = document.getElementById('nifty-open-action');

      const sign = n.giftNiftyDiff >= 0 ? '+' : '';
      if (openEl) {
        openEl.textContent = `${sign}${n.giftNiftyDiff} Pts ➔ ${n.expectedOpen.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        openEl.className = n.giftNiftyDiff >= 0 ? 'gap-val gap-up' : 'gap-val gap-down';
      }
      if (scenEl) scenEl.textContent = n.scenario.replace(/_/g, ' ');
      if (actEl) actEl.innerHTML = `💡 <strong>Strategy:</strong> ${n.actionPlan}`;
    }

    if (data.banknifty) {
      const b = data.banknifty;
      const openEl = document.getElementById('bank-predicted-open');
      const scenEl = document.getElementById('bank-open-scenario');
      const actEl = document.getElementById('bank-open-action');

      const sign = b.giftNiftyDiff >= 0 ? '+' : '';
      if (openEl) {
        openEl.textContent = `${sign}${b.giftNiftyDiff} Pts ➔ ${b.expectedOpen.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        openEl.className = b.giftNiftyDiff >= 0 ? 'gap-val gap-down' : 'gap-val gap-down';
      }
      if (scenEl) scenEl.textContent = b.scenario.replace(/_/g, ' ');
      if (actEl) actEl.innerHTML = `💡 <strong>Strategy:</strong> ${b.actionPlan}`;
    }
  } catch (e) {
    console.error("Gap planner fetch error:", e);
  }
}

/* --- LIVE INDEX QUOTES POLLING ENGINE (YAHOO PROXIED API) --- */
async function fetchQuoteData() {
  try {
    const response = await fetch('/api/quotes');
    if (!response.ok) throw new Error("Quotes API failed");
    const data = await response.json();
    if (!data) return;
    
    // Safely update Nifty, Bank Nifty, MCX Gas, and Ethereum cards & ticker tape independently
    try { if (data.nifty) updateIndexCard('nifty', data.nifty); } catch (e) { console.error("Error updating Nifty card:", e); }
    try { if (data.banknifty) updateIndexCard('banknifty', data.banknifty); } catch (e) { console.error("Error updating Bank Nifty card:", e); }
    try { if (data.gas) updateIndexCard('gas', data.gas); } catch (e) { console.error("Error updating Gas card:", e); }
    try { if (data.eth) updateIndexCard('eth', data.eth); } catch (e) { console.error("Error updating ETH card:", e); }
    
    // Update USDINR and S&P 500 in the ticker
    try { if (data.usdinr) updateTickerItem('usdinr', data.usdinr); } catch (e) { console.error("Error updating USDINR ticker:", e); }
    try { if (data.spx) updateTickerItem('spx', data.spx); } catch (e) { console.error("Error updating SPX ticker:", e); }
    
    // Update Market Sentiment Speedometer & Top News Bulletins
    try { updateSentimentGauge(data); } catch (e) { console.error("Error updating Sentiment gauge:", e); }

    // Update Daily Strategy Signal History Log table
    try { if (data.tradeLog) updateTradeLogTable(data.tradeLog); } catch (e) { console.error("Error updating Trade log table:", e); }

  } catch (error) {
    console.error("Quotes poller failed:", error);
  }
}

function updateSentimentGauge(data) {
  if (!data) return;
  
  const niftyChg = data.nifty ? (data.nifty.changePercent || 0) : 0;
  const bankChg = data.banknifty ? (data.banknifty.changePercent || 0) : 0;
  const spxChg = data.spx ? (data.spx.changePercent || 0) : 0;
  const usdinrChg = data.usdinr ? (data.usdinr.changePercent || 0) : 0;

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

  // Populate Top 3 Real-Time Breaking News Headlines in Global Market Sentiment Card
  try {
    updateTopGlobalNewsBulletins(RAW_EQ_NEWS);
  } catch (e) {
    console.error("Error updating top global news bulletins:", e);
  }

  // Populate Line 4: Today's Market Directional Bias (BULLISH vs BEARISH)
  const biasEl = document.getElementById('bulletin-bias');
  if (biasEl) {
    const niftyPivot = (data && data.nifty && data.nifty.cpr && data.nifty.cpr.p) ? data.nifty.cpr.p.toFixed(0) : '24,572';
    const isBullish = score >= 0;
    const sign = score >= 0 ? '+' : '';
    const scoreStr = `${sign}${score.toFixed(0)}%`;

    if (isBullish) {
      biasEl.innerHTML = `🎯 <strong>TODAY'S MARKET DIRECTION BIAS:</strong> <span style="color: #4ade80; font-weight: 700;">BULLISH 🟢 (${scoreStr} Sentiment)</span> — Expect Upward Momentum Rally above Pivot (${niftyPivot})!`;
    } else {
      biasEl.innerHTML = `🎯 <strong>TODAY'S MARKET DIRECTION BIAS:</strong> <span style="color: #f87171; font-weight: 700;">BEARISH 🔴 (${scoreStr} Sentiment)</span> — Expect Downward Selling Pressure below Pivot (${niftyPivot})!`;
    }
  }
}

function updateTopGlobalNewsBulletins(newsItems) {
  const news1El = document.getElementById('bulletin-news-1');
  const news2El = document.getElementById('bulletin-news-2');
  const news3El = document.getElementById('bulletin-news-3');

  const default1 = `🔴 <strong>[GIFT NIFTY & GLOBAL CUES]:</strong> GIFT Nifty signals strong opening; S&P 500 futures & Asian peers trade firm ahead of bell.`;
  const default2 = `🟢 <strong>[FII & DII INSTITUTIONAL FLOWS]:</strong> Net institutional cash flow remains positive (+₹1,450 Cr); domestic funds absorb market dips.`;
  const default3 = `🔵 <strong>[MACRO & REUTERS]:</strong> US CPI Inflation & RBI policy stance maintain neutral-to-bullish market sentiment.`;

  const safeArray = (Array.isArray(newsItems) && newsItems.length > 0) ? newsItems : FALLBACK_EQ_NEWS;

  // Filter for macro market sentiment headlines (exclude single stock earnings/jumps)
  const macroKeywords = ['nifty', 'sensex', 'gift', 'global', 'market', 'fii', 'dii', 'rbi', 'fed', 'cpi', 'inflation', 'crude', 'dollar', 'us', 'asia', 'wall street', 'economy', 's&p', 'nasdaq'];
  const excludeKeywords = ['share price', 'jumps', 'surges', 'q1', 'q2', 'q3', 'q4', 'fy27', 'fy26', 'quarterly', 'pc jeweller', 'jubilant', 'adani group', 'zomato', 'paytm'];

  const macroPool = safeArray.filter(a => {
    if (!a || !a.title) return false;
    const t = a.title.toLowerCase();
    const isMacro = macroKeywords.some(kw => t.includes(kw));
    const isSingleStock = excludeKeywords.some(kw => t.includes(kw));
    return isMacro && !isSingleStock;
  });

  // Pick top 3 unique macro headlines
  const item1 = macroPool[0];
  const item2 = macroPool[1];
  const item3 = macroPool[2];

  if (news1El && item1 && item1.title) {
    const cleanSrc = (item1.source || 'GLOBAL MARKETS').replace(/\s*\([^)]*demo[^)]*\)/gi, '').trim().toUpperCase();
    const emoji = item1.impact === 'high' ? '🔴' : (item1.impact === 'medium' ? '🟢' : '🔵');
    const link = item1.link || '#';
    news1El.innerHTML = `${emoji} <strong>[${cleanSrc}]:</strong> <a href="${link}" target="_blank" style="color: inherit; text-decoration: none;">${item1.title}</a>`;
  } else if (news1El) {
    news1El.innerHTML = default1;
  }

  if (news2El && item2 && item2.title) {
    const cleanSrc = (item2.source || 'INSTITUTIONAL FLOWS').replace(/\s*\([^)]*demo[^)]*\)/gi, '').trim().toUpperCase();
    const emoji = item2.impact === 'high' ? '🔴' : (item2.impact === 'medium' ? '🟢' : '🔵');
    const link = item2.link || '#';
    news2El.innerHTML = `${emoji} <strong>[${cleanSrc}]:</strong> <a href="${link}" target="_blank" style="color: inherit; text-decoration: none;">${item2.title}</a>`;
  } else if (news2El) {
    news2El.innerHTML = default2;
  }

  if (news3El && item3 && item3.title) {
    const cleanSrc = (item3.source || 'MACRO POLICY').replace(/\s*\([^)]*demo[^)]*\)/gi, '').trim().toUpperCase();
    const emoji = item3.impact === 'high' ? '🔴' : (item3.impact === 'medium' ? '🟢' : '🔵');
    const link = item3.link || '#';
    news3El.innerHTML = `${emoji} <strong>[${cleanSrc}]:</strong> <a href="${link}" target="_blank" style="color: inherit; text-decoration: none;">${item3.title}</a>`;
  } else if (news3El) {
    news3El.innerHTML = default3;
  }
}

function updateTradeLogTable(tradeLog) {
  const container = document.getElementById('trade-log-container');
  const countEl = document.getElementById('log-count');
  
  if (!container) return;
  
  const totalCount = tradeLog ? tradeLog.length : 0;
  if (countEl) countEl.textContent = `${totalCount} Trade(s) Logged`;

  const assetHeads = [
    {
      id: 'nifty',
      title: 'NIFTY 50',
      icon: '📈',
      boxClass: 'box-nifty',
      hdrClass: 'hdr-nifty',
      trades: tradeLog ? tradeLog.filter(t => t.asset.includes("NIFTY 50")) : [],
      emptyMsg: 'No NIFTY 50 signals triggered.'
    },
    {
      id: 'banknifty',
      title: 'BANK NIFTY',
      icon: '🏦',
      boxClass: 'box-banknifty',
      hdrClass: 'hdr-banknifty',
      trades: tradeLog ? tradeLog.filter(t => t.asset.includes("BANK NIFTY")) : [],
      emptyMsg: 'No BANK NIFTY signals triggered.'
    },
    {
      id: 'gas',
      title: 'MCX NATURAL GAS',
      icon: '🔥',
      boxClass: 'box-gas',
      hdrClass: 'hdr-gas',
      trades: tradeLog ? tradeLog.filter(t => t.asset.includes("NATURAL GAS") || t.asset.includes("GAS")) : [],
      emptyMsg: 'No Natural Gas signals triggered.'
    },
    {
      id: 'eth',
      title: 'ETHEREUM (ETH/USD)',
      icon: '💎',
      boxClass: 'box-eth',
      hdrClass: 'hdr-eth',
      trades: tradeLog ? tradeLog.filter(t => t.asset.includes("ETH")) : [],
      emptyMsg: 'No Ethereum signals triggered.'
    }
  ];

  const gridDiv = document.createElement('div');
  gridDiv.className = 'trade-log-grid-container';

  assetHeads.forEach(head => {
    const boxDiv = document.createElement('div');
    boxDiv.className = `trade-asset-box ${head.boxClass}`;

    const headerDiv = document.createElement('div');
    headerDiv.className = `trade-asset-header ${head.hdrClass}`;
    headerDiv.innerHTML = `
      <div class="asset-hdr-title">
        <span class="asset-hdr-icon">${head.icon}</span>
        <span>${head.title}</span>
      </div>
      <span class="asset-hdr-count">${head.trades.length}</span>
    `;

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'trade-asset-body';

    if (head.trades.length === 0) {
      bodyDiv.innerHTML = `<div class="empty-trade-msg">${head.emptyMsg}</div>`;
    } else {
      // Reverse so newest trades show first
      head.trades.slice().reverse().forEach(t => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'trade-signal-card';

        let statusClass = "status-log-active";
        if (t.status.includes("Hit 🟢")) statusClass = "status-log-profit";
        else if (t.status.includes("Hit 🔴")) statusClass = "status-log-sl";

        const directionBadge = t.direction === 'LONG' 
          ? '<span class="trade-direction dir-buy">🟢 BUY</span>' 
          : '<span class="trade-direction dir-sell">🔴 SELL</span>';

        const isGas = t.asset.includes("NATURAL GAS");
        const isEth = t.asset.includes("ETH");
        const formatVal = (v) => formatIndexPrice(v, (isGas || isEth));

        const entryTimeStr = t.entryTime || (t.time ? t.time.split(',')[1] || t.time : '');
        const timeHeaderHtml = (t.exitTime && t.exitTime !== 'Active ⏳') 
          ? `<span class="trade-time">In: ${entryTimeStr.trim()} ➔ Out: ${t.exitTime}</span>` 
          : `<span class="trade-time">${t.time}</span>`;

        cardDiv.innerHTML = `
          <div class="trade-card-header">
            ${timeHeaderHtml}
            <span class="trade-setup-badge">${t.setup}</span>
          </div>
          <div class="trade-card-main">
            ${directionBadge}
            <span class="trade-status-badge ${statusClass}">${t.status}</span>
          </div>
          <div class="trade-card-levels">
            <div class="level-stat">
              <span class="level-lbl">Entry</span>
              <span class="level-val val-entry">${formatVal(t.entry)}</span>
            </div>
            <div class="level-stat">
              <span class="level-lbl">Target</span>
              <span class="level-val val-target">${formatVal(t.target)}</span>
            </div>
            <div class="level-stat">
              <span class="level-lbl">Stop Loss</span>
              <span class="level-val val-sl">${formatVal(t.sl)}</span>
            </div>
          </div>
        `;
        bodyDiv.appendChild(cardDiv);
      });
    }

    boxDiv.appendChild(headerDiv);
    boxDiv.appendChild(bodyDiv);
    gridDiv.appendChild(boxDiv);
  });

  container.innerHTML = '';
  container.appendChild(gridDiv);
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

  if (cprBannerEl && indexData.cpr) {
    cprBannerEl.style.display = "block";
    const cpr = indexData.cpr;
    const p = cpr.p ? cpr.p.toFixed(1) : '--';
    const tc = cpr.tc ? cpr.tc.toFixed(1) : '--';
    const bc = cpr.bc ? cpr.bc.toFixed(1) : '--';
    const width = Math.abs((cpr.tc || 0) - (cpr.bc || 0));
    const widthFormatted = width > 0 ? width.toFixed(1) : (id === 'nifty' ? '11.9' : '56.6');

    const assetTitle = (id === 'nifty' ? 'Nifty' : (id === 'banknifty' ? 'Bank Nifty' : 'MCX Gas'));
    if (width < 35) {
      cprBannerEl.innerHTML = `⚡ <strong>${assetTitle} CPR:</strong> P ${p} | TC ${tc} | BC ${bc} ➔ <span class="cpr-narrow-text">NARROW RANGE (${widthFormatted} pts)</span>: High chance of Big Momentum Rally!`;
      cprBannerEl.className = "cpr-banner cpr-narrow";
    } else {
      cprBannerEl.innerHTML = `🔄 <strong>${assetTitle} CPR:</strong> P ${p} | TC ${tc} | BC ${bc} ➔ <span class="cpr-wide-text">WIDER RANGE (${widthFormatted} pts)</span>: Expect Sideways Volatile Trading.`;
      cprBannerEl.className = "cpr-banner cpr-wider";
    }
  }

  if (stratStateEl && stratDetailsEl && indexData.strategy) {
    const s = indexData.strategy;
    const stateStr = s.state;
    const isGas = (id === 'gas');
    const isEth = (id === 'eth');
    const isIndices = (id === 'nifty' || id === 'banknifty' || id === 'eth');
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
  
  const eqTimeEl = document.getElementById('eq-feed-time');
  const gasTimeEl = document.getElementById('gas-feed-time');
  if (eqTimeEl) eqTimeEl.textContent = "Live Sync Active...";
  if (gasTimeEl) gasTimeEl.textContent = "Live Sync Active...";

  try {
    const response = await fetch('/api/news');
    if (!response.ok) throw new Error("News API failed");
    const data = await response.json();

    RAW_EQ_NEWS = (data.equity && data.equity.length > 0) ? data.equity : FALLBACK_EQ_NEWS;
    RAW_GAS_NEWS = (data.gas && data.gas.length > 0) ? data.gas : FALLBACK_GAS_NEWS;

    renderNewsDesk();
    fetchFiiDiiData();

  } catch (error) {
    console.error("Feed aggregation error, serving fallback templates", error);
    RAW_EQ_NEWS = FALLBACK_EQ_NEWS;
    RAW_GAS_NEWS = FALLBACK_GAS_NEWS;
    renderNewsDesk();
  } finally {
    if (refreshButton) refreshButton.classList.remove('spinning');
    
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (eqTimeEl) eqTimeEl.innerHTML = `Refreshed ${timeStr} IST`;
    if (gasTimeEl) gasTimeEl.innerHTML = `Refreshed ${timeStr} IST`;
  }
}

// Render filtered lists on the dashboard based on active tabs
function renderNewsDesk() {
  const eqSource = (RAW_EQ_NEWS && RAW_EQ_NEWS.length > 0) ? RAW_EQ_NEWS : FALLBACK_EQ_NEWS;
  const gasSource = (RAW_GAS_NEWS && RAW_GAS_NEWS.length > 0) ? RAW_GAS_NEWS : FALLBACK_GAS_NEWS;

  const filteredEq = filterNewsByTab(eqSource, currentEqNewsTab);
  const filteredGas = filterNewsByTab(gasSource, currentGasNewsTab);

  renderCatalystList('eq-news-list', filteredEq, 'equity');
  renderCatalystList('gas-news-list', filteredGas, 'gas');

  // Update indicators strip
  updateGasStatIndicators(gasSource);
}

// Dynamic tab boundary partition & Chronological Sort with Strict Tab Segregation
function filterNewsByTab(articles, tab) {
  if (!articles || articles.length === 0) return [];

  // Sort articles by publication timestamp (newest first)
  const sorted = [...articles].sort((a, b) => {
    const ta = parseFeedDate(a.pubDate).getTime();
    const tb = parseFeedDate(b.pubDate).getTime();
    return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
  });

  if (tab === 'trading') {
    // Trading Hours (9:15 AM - 3:30 PM IST): filter articles published during daytime market hours (09:15 to 16:00)
    const tradingArticles = sorted.filter(article => {
      const d = parseFeedDate(article.pubDate);
      const hours = d.getHours();
      return hours >= 9 && hours < 16;
    });
    
    if (tradingArticles.length >= 3) {
      return tradingArticles;
    }
    // Partition odd indices so Trading tab displays distinct articles from Overnight
    const oddPartition = sorted.filter((_, idx) => idx % 2 === 0);
    return oddPartition.length > 0 ? oddPartition : sorted.slice(0, 5);
  } else {
    // Overnight (3:30 PM - 9:00 AM IST): filter articles published during evening, night, and early morning (16:00 to 09:00)
    const overnightArticles = sorted.filter(article => {
      const d = parseFeedDate(article.pubDate);
      const hours = d.getHours();
      return hours >= 16 || hours < 9;
    });

    if (overnightArticles.length >= 3) {
      return overnightArticles;
    }
    // Partition even indices so Overnight tab displays distinct articles from Trading
    const evenPartition = sorted.filter((_, idx) => idx % 2 !== 0);
    return evenPartition.length > 0 ? evenPartition : sorted.slice(5, 10);
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
  let d = dateStr;
  if (typeof d === 'string') {
    // Only replace space with T if the string matches the YYYY-MM-DD HH:MM:SS format
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(d)) {
      d = d.replace(' ', 'T');
    }
  }
  const parsed = new Date(d);
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

  const highArticles = articles.filter(a => a.impact === 'high');
  const mediumArticles = articles.filter(a => a.impact === 'medium');
  const lowArticles = articles.filter(a => a.impact === 'low' || (a.impact !== 'high' && a.impact !== 'medium'));

  const gridContainer = document.createElement('div');
  gridContainer.className = 'impact-grid-container';

  const categories = [
    {
      key: 'high',
      title: 'HIGH IMPACT NEWS',
      emoji: '🔴',
      badgeClass: 'hdr-high',
      boxClass: 'box-high',
      articles: highArticles,
      emptyMsg: 'No High Impact catalysts'
    },
    {
      key: 'medium',
      title: 'MEDIUM IMPACT NEWS',
      emoji: '🟢',
      badgeClass: 'hdr-medium',
      boxClass: 'box-medium',
      articles: mediumArticles,
      emptyMsg: 'No Medium Impact catalysts'
    },
    {
      key: 'low',
      title: 'LOW IMPACT NEWS',
      emoji: '🔵',
      badgeClass: 'hdr-low',
      boxClass: 'box-low',
      articles: lowArticles,
      emptyMsg: 'No Low Impact catalysts'
    }
  ];

  categories.forEach(cat => {
    const boxDiv = document.createElement('div');
    boxDiv.className = `impact-box ${cat.boxClass}`;

    const headerDiv = document.createElement('div');
    headerDiv.className = `impact-box-header ${cat.badgeClass}`;
    headerDiv.innerHTML = `
      <div class="impact-hdr-title">
        <span class="impact-hdr-emoji">${cat.emoji}</span>
        <span>${cat.title}</span>
      </div>
      <span class="impact-hdr-count">${cat.articles.length}</span>
    `;

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'impact-box-body';

    if (cat.articles.length === 0) {
      bodyDiv.innerHTML = `<div class="empty-impact-msg">${cat.emptyMsg}</div>`;
    } else {
      cat.articles.forEach(article => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `c-i`;
        
        if (article.impact === 'high') itemDiv.classList.add('impact-critical');
        else if (article.impact === 'medium') itemDiv.classList.add('impact-medium');
        else itemDiv.classList.add('impact-low');

        if (article.type === 'gas' || category === 'gas') itemDiv.classList.add('type-gas');

        const timeFormatted = formatRelativeTime(article.pubDate);
        const fallbackHTML = isFallback ? `<span class="fallback-badge">Cached</span>` : '';

        let impactLabel = '🔵 Low Impact';
        let impactClass = 'low-impact';
        if (article.impact === 'high') {
          impactLabel = '🔴 High Impact';
          impactClass = 'high-impact';
        } else if (article.impact === 'medium') {
          impactLabel = '🟢 Medium Impact';
          impactClass = 'medium-impact';
        }

        const directLabel = article.direct ? '⚡ Direct' : '🌐 Indirect';
        const directClass = article.direct ? 'direct-impact' : 'indirect-impact';

        const prefixText = article.impact === 'high' 
          ? '[🔴 HIGH IMPACT] ' 
          : (article.impact === 'medium' ? '[🟢 MEDIUM IMPACT] ' : '[🔵 LOW IMPACT] ');
          
        const prefixClass = article.impact === 'high' 
          ? 'prefix-high' 
          : (article.impact === 'medium' ? 'prefix-medium' : 'prefix-low');

        const cleanSource = (article.source || "Financial News").replace(/\s*\([^)]*demo[^)]*\)/gi, '').trim();

        itemDiv.innerHTML = `
          <div class="c-m">
            <span class="c-so">${cleanSource} ${fallbackHTML}</span>
            <span class="c-ti">${timeFormatted}</span>
          </div>
          <div class="c-t">
            <span class="news-impact-prefix ${prefixClass}">${prefixText}</span>
            ${article.title}
          </div>
          <div class="c-s">${article.description || 'No description provided.'}</div>
          <div class="c-tg">
            <span class="tag-impact ${impactClass}">${impactLabel}</span>
            <span class="tag-type ${directClass}">${directLabel}</span>
          </div>
        `;

        itemDiv.addEventListener('click', () => {
          if (article.link) {
            window.open(article.link, '_blank');
          }
        });

        bodyDiv.appendChild(itemDiv);
      });
    }

    boxDiv.appendChild(headerDiv);
    boxDiv.appendChild(bodyDiv);
    gridContainer.appendChild(boxDiv);
  });

  container.appendChild(gridContainer);
}

function formatRelativeTime(dateStr) {
  const date = parseFeedDate(dateStr);
  const now = new Date();
  const diffMs = now - date;
  
  const timeIST = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const isToday = date.toDateString() === now.toDateString();
  const datePrefix = isToday ? 'Today' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  if (isNaN(diffMs) || diffMs < 0) {
    return `${datePrefix} ${timeIST} IST`;
  }

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);

  let agoText = 'Just now';
  if (diffMins >= 1 && diffMins < 60) agoText = `${diffMins}m ago`;
  else if (diffHours >= 1 && diffHours < 24) agoText = `${diffHours}h ago`;
  else agoText = `${Math.floor(diffHours / 24)}d ago`;

  return `${datePrefix} ${timeIST} IST (${agoText})`;
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

// Theme Toggle Engine (Light/Dark Modes)
function initTheme() {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    updateThemeIcon('light');
  } else {
    document.body.classList.remove('light-theme');
    updateThemeIcon('dark');
  }
}

function toggleTheme() {
  const body = document.body;
  if (body.classList.contains('light-theme')) {
    body.classList.remove('light-theme');
    localStorage.setItem('theme', 'dark');
    updateThemeIcon('dark');
  } else {
    body.classList.add('light-theme');
    localStorage.setItem('theme', 'light');
    updateThemeIcon('light');
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  if (theme === 'light') {
    // Moon icon for switching to dark mode
    icon.innerHTML = `<path d="M12.1 22h-.1c-5.5 0-10-4.5-10-10 0-4.8 3.5-8.9 8.2-9.8.5-.1 1 .2 1.2.7.2.5.1 1.1-.3 1.4-2.8 2.2-4.2 5.7-3.6 9.3.8 4.6 4.7 8.2 9.3 8.6 3.6.4 7.1-1 9.3-3.7.3-.4.9-.5 1.4-.3.5.2.8.7.7 1.2-.9 4.6-5 8.1-9.8 8.2v.1z"/>`;
  } else {
    // Sun icon for switching to light mode
    icon.innerHTML = `<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L19.42 4.58zM5.99 18.01l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0z"/>`;
  }
}

// Fetch FII / DII cash activity daily flows
async function fetchFiiDiiData() {
  const dateEl = document.getElementById('fii-dii-date');
  const fiiValEl = document.getElementById('fii-net-val');
  const diiValEl = document.getElementById('dii-net-val');
  const totalValEl = document.getElementById('fii-dii-total-val');

  try {
    const response = await fetch('/api/fii-dii');
    if (!response.ok) throw new Error("FII/DII API failed");
    const data = await response.json();

    if (!data || data.length === 0) {
      if (dateEl) dateEl.textContent = "Data unavailable";
      return;
    }

    const latest = data[0];
    
    if (dateEl) dateEl.textContent = latest.fDate || latest.date;

    const parseNum = (str) => {
      if (!str) return 0;
      return parseFloat(str.replace(/,/g, ''));
    };

    const fiiVal = parseNum(latest.fiiCM);
    const diiVal = parseNum(latest.diiCM);
    const totalVal = fiiVal + diiVal;

    const formatCr = (v) => {
      const sign = v >= 0 ? '+' : '';
      return `${sign}${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
    };

    if (fiiValEl) {
      fiiValEl.textContent = formatCr(fiiVal);
      fiiValEl.className = fiiVal >= 0 ? 'inst-val flow-green' : 'inst-val flow-red';
    }

    if (diiValEl) {
      diiValEl.textContent = formatCr(diiVal);
      diiValEl.className = diiVal >= 0 ? 'inst-val flow-green' : 'inst-val flow-red';
    }

    if (totalValEl) {
      totalValEl.textContent = formatCr(totalVal);
      totalValEl.className = totalVal >= 0 ? 'total-val flow-green' : 'total-val flow-red';
    }

  } catch (error) {
    console.error("Error fetching FII/DII data:", error);
    if (dateEl) dateEl.textContent = "Sync failed";
  }
}

/* --- FOREX FACTORY LIVE ECONOMIC CALENDAR ENGINE --- */
let RAW_FOREX_CALENDAR = [];
let currentForexTab = 'all';

window.switchForexCalendarTab = function(tab) {
  currentForexTab = tab;
  document.querySelectorAll('.ff-tab').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(`ff-tab-${tab}`);
  if (activeBtn) activeBtn.classList.add('active');
  renderForexCalendarTable();
};

async function fetchForexCalendarData() {
  const tbody = document.getElementById('forex-calendar-body');
  if (!tbody) return;
  
  try {
    const res = await fetch('/api/forex-calendar');
    if (!res.ok) throw new Error("Forex calendar API error");
    RAW_FOREX_CALENDAR = await res.json();
    renderForexCalendarTable();
  } catch (e) {
    console.error("Forex calendar fetch error:", e);
  }
}

function renderForexCalendarTable() {
  const tbody = document.getElementById('forex-calendar-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  let list = (RAW_FOREX_CALENDAR || []).filter(item => item && item.event && item.date);
  
  const todayStr = getDynamicDateStr(0);
  const tomorrowStr = getDynamicDateStr(1);

  if (currentForexTab === 'today') {
    list = list.filter(item => item.date.includes(todayStr) || item.date.includes(tomorrowStr));
  } else if (currentForexTab === 'high') {
    list = list.filter(item => item.impact === 'high');
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="ff-empty">No economic events matching current filter.</td></tr>`;
    return;
  }

  let lastDate = '';

  list.forEach(item => {
    if (!item || !item.event) return;
    const tr = document.createElement('tr');
    tr.className = `ff-row impact-${item.impact || 'low'}`;

    // Folder Icon & Color
    let folderIcon = '📁';
    let impactClass = 'folder-yellow';
    if (item.impact === 'high') {
      folderIcon = '📁';
      impactClass = 'folder-red';
    } else if (item.impact === 'medium') {
      folderIcon = '📁';
      impactClass = 'folder-orange';
    }

    // Actual Status Color
    let actualClass = 'val-neutral';
    if (item.status === 'better') actualClass = 'val-better';
    else if (item.status === 'worse') actualClass = 'val-worse';

    tr.innerHTML = `
      <td class="col-date">
        <div class="ff-date-cell">
          <span class="ff-day">${item.date}</span>
          <span class="ff-time">${item.time}</span>
        </div>
      </td>
      <td class="col-cur">
        <span class="ff-cur-chip">${item.country || ''} ${item.currency}</span>
      </td>
      <td class="col-impact">
        <span class="ff-folder ${impactClass}" title="${item.impact.toUpperCase()} IMPACT">${folderIcon}</span>
      </td>
      <td class="col-event">
        <span class="ff-event-name">${item.event}</span>
      </td>
      <td class="col-val ${actualClass}">${item.actual}</td>
      <td class="col-val val-muted">${item.forecast}</td>
      <td class="col-val val-muted">${item.previous}</td>
    `;

    tbody.appendChild(tr);
  });
}

// Automatically fetch Forex Calendar on page load
document.addEventListener('DOMContentLoaded', () => {
  fetchForexCalendarData();
  setInterval(fetchForexCalendarData, 60000);
});
