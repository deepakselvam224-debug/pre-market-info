const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const SETTINGS_FILE = path.join(__dirname, 'whatsapp_settings.json');

// Global Memory Cache for Live Market Quotes (Guarantees zero UI freezing / zero "Loading..." loops)
let lastQuotesCache = null;

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // Expose API Endpoints for WhatsApp settings (GET/POST)
  if (urlPath === '/api/whatsapp/settings') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      fs.readFile(SETTINGS_FILE, 'utf8', (err, data) => {
        if (err) {
          res.end(JSON.stringify({ enabled: false, phone: '', apikey: '' }));
        } else {
          res.end(data);
        }
      });
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        fs.writeFile(SETTINGS_FILE, body, 'utf8', (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          }
        });
      });
    }
    return;
  }

  if (urlPath === '/api/fii-dii') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    });
    fetchFiiDiiActivity().then(data => {
      res.end(JSON.stringify(data));
    }).catch(err => {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // Expose API Endpoint for server-side parsed financial news
  if (urlPath === '/api/news') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    });
    getParsedNews().then(news => {
      res.end(JSON.stringify(news));
    }).catch(err => {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // Expose API Endpoint for Live Yahoo Quotes & Strategy Signals (bypasses CORS)
  if (urlPath === '/api/quotes') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    });
    
    Promise.all([
      getAssetAnalysis('^NSEI').catch(err => { console.error('Nifty error:', err.message); return null; }),
      getAssetAnalysis('^NSEBANK').catch(err => { console.error('Bank Nifty error:', err.message); return null; }),
      getAssetAnalysis('NG=F').catch(err => { console.error('Gas error:', err.message); return null; }),
      fetchYahooQuote('INR=X').catch(() => ({ price: 83.5, change: 0, changePercent: 0 })),
      fetchYahooQuote('^GSPC').catch(() => ({ price: 5450.5, change: 30.2, changePercent: 0.55 })),
      getAssetAnalysis('ETH-USD').catch(err => { console.error('ETH error:', err.message); return null; })
    ]).then(results => {
      let [nifty, banknifty, gas, usdinr, spx, eth] = results;
      
      // Fall back to memory cache if any core asset is null
      if (lastQuotesCache) {
        if (!nifty && lastQuotesCache.nifty) nifty = lastQuotesCache.nifty;
        if (!banknifty && lastQuotesCache.banknifty) banknifty = lastQuotesCache.banknifty;
        if (!gas && lastQuotesCache.gas) gas = lastQuotesCache.gas;
        if (!eth && lastQuotesCache.eth) eth = lastQuotesCache.eth;
      }

      // Format Natural Gas MCX response
      let convertedGas = gas;
      if (gas && !gas.henryHubPrice && usdinr) {
        convertedGas = Object.assign({}, gas, { henryHubPrice: Math.round((gas.price / 96.425) * 100) / 100 });
      }

      // Check and send WhatsApp alerts on strategy state triggers
      if (nifty) checkAndSendWhatsApp('nifty', 'NIFTY 50', nifty);
      if (banknifty) checkAndSendWhatsApp('banknifty', 'BANK NIFTY', banknifty);
      if (convertedGas) checkAndSendWhatsApp('gas', 'MCX NATURAL GAS', convertedGas);
      if (eth) checkAndSendWhatsApp('eth', 'ETHEREUM (ETH/USD)', eth);

      // Process trade logger updates
      updateTradeLog(nifty, banknifty, convertedGas, eth);

      const data = {
        nifty,
        banknifty,
        gas: convertedGas,
        usdinr: {
          price: usdinr.price,
          change: usdinr.change || 0,
          changePercent: usdinr.changePercent || 0
        },
        spx: {
          price: spx.price,
          change: spx.change || 0,
          changePercent: spx.changePercent || 0
        },
        eth,
        tradeLog
      };

      if (nifty || banknifty || convertedGas) {
        lastQuotesCache = data;
      }

      res.end(JSON.stringify(data));
    }).catch(err => {
      console.error('/api/quotes global error:', err.message);
      if (lastQuotesCache) {
        res.end(JSON.stringify(lastQuotesCache));
      } else {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  
  // Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.end('404 Not Found');
      } else {
        res.statusCode = 500;
        res.end('500 Internal Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      });
      res.end(content, 'utf-8');
    }
  });
});

// Helper function to query Yahoo Finance chart v8 API with standard user agent header (Quotes only)
function fetchYahooQuote(symbol) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'query1.finance.yahoo.com',
      port: 443,
      path: `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP status ${res.statusCode}`));
          }
          const json = JSON.parse(data);
          if (!json.chart || !json.chart.result) {
            return reject(new Error("Invalid response"));
          }
          const result = json.chart.result[0];
          const meta = result.meta;
          const price = meta.regularMarketPrice;
          const prevClose = meta.chartPreviousClose || price;
          const change = price - prevClose;
          const changePercent = (change / prevClose) * 100;
          resolve({
            symbol: symbol,
            price: price,
            change: change,
            changePercent: changePercent
          });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Fetch Intraday chart from Yahoo Finance (supports 1m and 5m intervals)
function fetchYahooIntradayChart(symbol, interval = '1m') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'query1.finance.yahoo.com',
      port: 443,
      path: `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=1d`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP status ${res.statusCode}`));
          }
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Fetch Previous Completed Trading Day's HLC values (from a 5d range)
function fetchPreviousDayHLC(symbol) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'query1.finance.yahoo.com',
      port: 443,
      path: `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) return reject(new Error(`HTTP status ${res.statusCode}`));
          const json = JSON.parse(data);
          const result = json.chart.result[0];
          const quote = result.indicators.quote[0];
          
          const highs = quote.high.filter(x => x !== null);
          const lows = quote.low.filter(x => x !== null);
          const closes = quote.close.filter(x => x !== null);
          
          if (highs.length < 2) {
            const meta = result.meta;
            const p = meta.regularMarketPrice;
            return resolve({ high: p * 1.01, low: p * 0.99, close: p });
          }
          
          const lastIdx = highs.length - 1;
          const lastBarDate = new Date(result.timestamp[lastIdx] * 1000).setHours(0,0,0,0);
          const todayDate = new Date().setHours(0,0,0,0);
          const isTodayActive = (lastBarDate === todayDate);
          
          const idx = isTodayActive ? lastIdx - 1 : lastIdx;
          
          resolve({
            high: highs[idx],
            low: lows[idx],
            close: closes[idx]
          });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Calculate Central Pivot Range (CPR) and standard S1-S3 / R1-R3 levels
function calculateCPR(hlc) {
  const p = (hlc.high + hlc.low + hlc.close) / 3;
  const bc = (hlc.high + hlc.low) / 2;
  const tc = (p - bc) + p;
  
  const r1 = 2 * p - hlc.low;
  const s1 = 2 * p - hlc.high;
  
  const r2 = p + (hlc.high - hlc.low);
  const s2 = p - (hlc.high - hlc.low);
  
  const r3 = r1 + (hlc.high - hlc.low);
  const s3 = s1 - (hlc.high - hlc.low);
  
  return { tc, p, bc, r1, s1, r2, s2, r3, s3 };
}

// Calculate Strategy 1 (Indices: Nifty & Bank Nifty)
function calculateStrategy1(chartResult, cpr) {
  if (!chartResult || !chartResult.indicators || !chartResult.indicators.quote || !cpr) {
    return { state: "NEUTRAL", swingHigh: null, swingLow: null, entry: null, sl: null, target: null, setupType: null, signalType: null, cprText: null };
  }

  const quote = chartResult.indicators.quote[0];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];

  // Determine CPR Width Text
  const cprWidth = Math.abs(cpr.tc - cpr.bc);
  const cprText = cprWidth < 35 
    ? "Narrow CPR: Big Momentum Market expected (One-sided Trend)"
    : "Wider CPR: Volatile / Sideways Market expected";

  // Track state machine variables
  let state = "NEUTRAL"; // "NEUTRAL", "LONG_MOMENTUM", "LONG_RETEST", "LONG_TRIGGERED", "NO_TRADE_ZONE"
  let setupType = null;  // 1, 2, or 3
  let swingHigh = null;
  let swingLow = null;
  let entry = null;
  let sl = null;
  let target = null;
  let signalType = null;

  let legHighs = [];
  let legLows = [];

  const cprMin = Math.min(cpr.tc, cpr.bc);
  const cprMax = Math.max(cpr.tc, cpr.bc);

  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    const h = highs[i];
    const l = lows[i];

    if (c === null || h === null || l === null) continue;

    // Check if an active trade hit Target or SL to reset to NEUTRAL
    if (state === "LONG_TRIGGERED") {
      if (target && c >= target) {
        state = "NEUTRAL";
        setupType = null;
        swingHigh = null;
        swingLow = null;
        entry = null;
        sl = null;
        target = null;
        signalType = null;
        legHighs = [];
        legLows = [];
      } else if (sl && c <= sl) {
        state = "NEUTRAL";
        setupType = null;
        swingHigh = null;
        swingLow = null;
        entry = null;
        sl = null;
        target = null;
        signalType = null;
        legHighs = [];
        legLows = [];
      }
    } else if (state === "SHORT_TRIGGERED") {
      if (target && c <= target) {
        state = "NEUTRAL";
        setupType = null;
        swingHigh = null;
        swingLow = null;
        entry = null;
        sl = null;
        target = null;
        signalType = null;
        legHighs = [];
        legLows = [];
      } else if (sl && c >= sl) {
        state = "NEUTRAL";
        setupType = null;
        swingHigh = null;
        swingLow = null;
        entry = null;
        sl = null;
        target = null;
        signalType = null;
        legHighs = [];
        legLows = [];
      }
    }

    // Rule: If price is inside CPR, it's a No Trade Zone!
    if (c > cprMin && c < cprMax) {
      state = "NO_TRADE_ZONE";
      setupType = null;
      swingHigh = null;
      swingLow = null;
      entry = null;
      sl = null;
      target = null;
      signalType = null;
      continue;
    }

    // If state was NO_TRADE_ZONE and price exits CPR, it resets to NEUTRAL
    if (state === "NO_TRADE_ZONE") {
      state = "NEUTRAL";
    }

    if (state === "NEUTRAL") {
      // Check crossovers to start setups
      if (c > cprMax) {
        if (c > cpr.r1) {
          state = "LONG_MOMENTUM";
          setupType = 3; // Setup 3 (Above R1 breakout)
          legHighs = [h];
          swingHigh = h;
        } else {
          state = "LONG_MOMENTUM";
          setupType = 1; // Setup 1 (Above CPR breakout)
          legHighs = [h];
          swingHigh = h;
        }
      } else if (c < cprMin) {
        if (c < cpr.s1) {
          state = "SHORT_MOMENTUM";
          setupType = 3; // Setup 3 (Below S1 breakdown)
          legLows = [l];
          swingLow = l;
        } else {
          state = "SHORT_MOMENTUM";
          setupType = 1; // Setup 1 (Below CPR breakdown)
          legLows = [l];
          swingLow = l;
        }
      }
      
      // Setup 2 Candidates (S1/R1 reversals)
      // Long setup 2: trading below CPR, touches S1 (low <= S1) and closes above it
      if (c < cprMin && l <= cpr.s1 && c > cpr.s1) {
        state = "LONG_MOMENTUM";
        setupType = 2;
        legHighs = [h];
        swingHigh = h;
      }
      // Short setup 2: trading above CPR, touches R1 (high >= R1) and closes below it
      else if (c > cprMax && h >= cpr.r1 && c < cpr.r1) {
        state = "SHORT_MOMENTUM";
        setupType = 2;
        legLows = [l];
        swingLow = l;
      }
    }

    // Auto-direction shift / Stop Out logic:
    if (state.startsWith("LONG")) {
      if (c < cprMin) {
        state = "SHORT_MOMENTUM";
        setupType = 1; 
        legLows = [l];
        swingLow = l;
        swingHigh = null;
        entry = null;
        sl = null;
        target = null;
        signalType = null;
      }
    } else if (state.startsWith("SHORT")) {
      if (c > cprMax) {
        state = "LONG_MOMENTUM";
        setupType = 1; 
        legHighs = [h];
        swingHigh = h;
        swingLow = null;
        entry = null;
        sl = null;
        target = null;
        signalType = null;
      }
    }

    // Process Momentum & Retest steps for each setup
    if (state === "LONG_MOMENTUM") {
      legHighs.push(h);
      swingHigh = Math.max(...legHighs);

      // Check for Retest
      if (setupType === 1) {
        // Touch Top CPR Line (TC)
        if (l <= cprMax && c >= cprMax) {
          state = "LONG_RETEST";
        }
      } else if (setupType === 2) {
        // Touch S1
        if (l <= cpr.s1 && c >= cpr.s1) {
          state = "LONG_RETEST";
        }
      } else if (setupType === 3) {
        // Touch R1
        if (l <= cpr.r1 && c >= cpr.r1) {
          state = "LONG_RETEST";
        }
      }
    } else if (state === "LONG_RETEST") {
      // Check for breakout to Trigger first (before updating swingHigh with current high)
      if (c > swingHigh) {
        state = "LONG_TRIGGERED";
        entry = swingHigh;
        if (setupType === 1) {
          sl = cprMax;
          target = cpr.r1 > entry ? cpr.r1 : (cpr.r2 > entry ? cpr.r2 : cpr.r3);
        } else if (setupType === 2) {
          sl = cpr.s1;
          target = cprMin; // BC
        } else if (setupType === 3) {
          sl = cpr.r1;
          target = cpr.r2 > entry ? cpr.r2 : cpr.r3;
        }
        signalType = "LONG";
      } else {
        legHighs.push(h);
        swingHigh = Math.max(...legHighs);
      }
    } else if (state === "SHORT_MOMENTUM") {
      legLows.push(l);
      swingLow = Math.min(...legLows);

      // Check for Retest
      if (setupType === 1) {
        // Touch Bottom CPR Line (BC)
        if (h >= cprMin && c <= cprMin) {
          state = "SHORT_RETEST";
        }
      } else if (setupType === 2) {
        // Touch R1
        if (h >= cpr.r1 && c <= cpr.r1) {
          state = "SHORT_RETEST";
        }
      } else if (setupType === 3) {
        // Touch S1
        if (h >= cpr.s1 && c <= cpr.s1) {
          state = "SHORT_RETEST";
        }
      }
    } else if (state === "SHORT_RETEST") {
      // Check for breakdown to Trigger first (before updating swingLow with current low)
      if (c < swingLow) {
        state = "SHORT_TRIGGERED";
        entry = swingLow;
        if (setupType === 1) {
          sl = cprMin;
          target = cpr.s1 < entry ? cpr.s1 : (cpr.s2 < entry ? cpr.s2 : cpr.s3);
        } else if (setupType === 2) {
          sl = cpr.r1;
          target = cprMax; // TC
        } else if (setupType === 3) {
          sl = cpr.s1;
          target = cpr.s2 < entry ? cpr.s2 : cpr.s3;
        }
        signalType = "SHORT";
      } else {
        legLows.push(l);
        swingLow = Math.min(...legLows);
      }
    }
  }

  const lastC = closes[closes.length - 1] || 0;
  const ma15 = closes.length >= 3 ? closes.slice(-3).reduce((a, b) => a + b, 0) / 3 : lastC;
  const ma60 = closes.length >= 12 ? closes.slice(-12).reduce((a, b) => a + b, 0) / 12 : lastC;
  const prevCloseVal = cpr ? cpr.p : lastC;

  const trends = {
    '5m': lastC > (cprMax) ? 'bull' : 'bear',
    '15m': lastC > ma15 ? 'bull' : 'bear',
    '1h': lastC > ma60 ? 'bull' : 'bear',
    '1d': lastC > prevCloseVal ? 'bull' : 'bear'
  };

  return {
    state,
    swingHigh,
    swingLow,
    entry,
    sl,
    target,
    setupType,
    signalType,
    cprText,
    currentVwap: null,
    trends
  };
}

// Calculate CPR Strategy 1 (Nifty 50, Bank Nifty)
function calculateCPRStrategy(chartResult, cpr, assetId = 'nifty') {
  if (!chartResult || !chartResult.indicators || !chartResult.indicators.quote) {
    return { state: "NEUTRAL", setupType: null, swingHigh: null, swingLow: null, entry: null, sl: null, target: null, signalType: null, currentVwap: null, trends: { '5m': 'bull', '15m': 'bull', '1h': 'bull', '1d': 'bull' } };
  }

  const timestamps = chartResult.timestamp || [];
  const quote = chartResult.indicators.quote[0];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  let cumTypicalVolume = 0;
  let cumVolume = 0;
  const vwaps = [];

  for (let i = 0; i < closes.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = volumes[i] || 0;
    if (h === null || l === null || c === null) {
      vwaps.push(vwaps.length > 0 ? vwaps[vwaps.length - 1] : null);
      continue;
    }
    const typicalPrice = (h + l + c) / 3;
    cumTypicalVolume += typicalPrice * v;
    cumVolume += v;
    vwaps.push(cumVolume > 0 ? cumTypicalVolume / cumVolume : typicalPrice);
  }

  const currentVwap = vwaps[vwaps.length - 1] || null;

  if (!cpr) {
    return { state: "NEUTRAL", setupType: null, swingHigh: null, swingLow: null, entry: null, sl: null, target: null, signalType: null, currentVwap, trends: { '5m': 'bull', '15m': 'bull', '1h': 'bull', '1d': 'bull' } };
  }

  const cprMin = Math.min(cpr.tc, cpr.bc);
  const cprMax = Math.max(cpr.tc, cpr.bc);
  const slDistance = (assetId === 'banknifty') ? 20 : 10;

  let state = "NEUTRAL";
  let setupType = null;
  let swingHigh = null;
  let swingLow = null;
  let entry = null;
  let sl = null;
  let target = null;
  let signalType = null;
  let momentumBarIdx = -1;
  let retestBarIdx = -1;

  let legHighs = [];
  let legLows = [];

  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    const h = highs[i];
    const l = lows[i];

    if (c === null || h === null || l === null) continue;

    // Filter out pre-market candles before 09:15 AM IST for Nifty 50 and Bank Nifty
    if (timestamps[i]) {
      const dateObj = new Date(timestamps[i] * 1000);
      const istTimeStr = dateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
      const parts = istTimeStr.split(':');
      const timeInMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      if (timeInMinutes < 555) { // 555 min = 09:15 AM IST
        continue;
      }
    }

    // Reset if active trade hits Target or SL
    if (state === "LONG_TRIGGERED") {
      if (target && h >= target) {
        state = "NEUTRAL"; setupType = null; swingHigh = null; swingLow = null; entry = null; sl = null; target = null; signalType = null; legHighs = []; legLows = [];
      } else if (sl && l <= sl) {
        state = "NEUTRAL"; setupType = null; swingHigh = null; swingLow = null; entry = null; sl = null; target = null; signalType = null; legHighs = []; legLows = [];
      }
    } else if (state === "SHORT_TRIGGERED") {
      if (target && l <= target) {
        state = "NEUTRAL"; setupType = null; swingHigh = null; swingLow = null; entry = null; sl = null; target = null; signalType = null; legHighs = []; legLows = [];
      } else if (sl && h >= sl) {
        state = "NEUTRAL"; setupType = null; swingHigh = null; swingLow = null; entry = null; sl = null; target = null; signalType = null; legHighs = []; legLows = [];
      }
    }// Retest Expiration check (Retest MUST be followed by breakout/breakdown within 10 candles, otherwise invalid!)
    if (state.endsWith("_RETEST")) {
      if (i - retestBarIdx > 10) {
        state = "NEUTRAL"; setupType = null; swingHigh = null; swingLow = null; entry = null; sl = null; target = null; signalType = null; legHighs = []; legLows = [];
      }
    }

    // CPR No Trade Zone check (if not triggered)
    if (c > cprMin && c < cprMax) {
      if (!state.endsWith("TRIGGERED")) {
        state = "NO_TRADE_ZONE"; setupType = null; swingHigh = null; swingLow = null; entry = null; sl = null; target = null; signalType = null;
        continue;
      }
    }

    if (state === "NO_TRADE_ZONE") {
      state = "NEUTRAL";
    }

    if (state === "NEUTRAL") {
      if (c > cprMax) {
        if (c > cpr.r1) {
          state = "LONG_MOMENTUM"; setupType = 3; legHighs = [h]; swingHigh = h; momentumBarIdx = i;
        } else {
          state = "LONG_MOMENTUM"; setupType = 1; legHighs = [h]; swingHigh = h; momentumBarIdx = i;
        }
      } else if (c < cprMin) {
        if (c < cpr.s1) {
          state = "SHORT_MOMENTUM"; setupType = 3; legLows = [l]; swingLow = l; momentumBarIdx = i;
        } else {
          state = "SHORT_MOMENTUM"; setupType = 1; legLows = [l]; swingLow = l; momentumBarIdx = i;
        }
      }

      if (c < cprMin && l <= cpr.s1 && c > cpr.s1) {
        state = "LONG_MOMENTUM"; setupType = 2; legHighs = [h]; swingHigh = h; momentumBarIdx = i;
      } else if (c > cprMax && h >= cpr.r1 && c < cpr.r1) {
        state = "SHORT_MOMENTUM"; setupType = 2; legLows = [l]; swingLow = l; momentumBarIdx = i;
      }
    } else {
      // Invalidation / direction flip
      if (state.startsWith("LONG") && !state.endsWith("TRIGGERED")) {
        if (c < cprMin) {
          state = "SHORT_MOMENTUM"; setupType = 1; legLows = [l]; swingLow = l; swingHigh = null; momentumBarIdx = i;
        }
      } else if (state.startsWith("SHORT") && !state.endsWith("TRIGGERED")) {
        if (c > cprMax) {
          state = "LONG_MOMENTUM"; setupType = 1; legHighs = [h]; swingHigh = h; swingLow = null; momentumBarIdx = i;
        }
      }
    }

    // Process Momentum & Retests with strict multi-bar sequence requirement
    if (state === "LONG_MOMENTUM") {
      legHighs.push(h);
      swingHigh = Math.max(...legHighs);

      const levelToTest = setupType === 1 ? cprMax : (setupType === 2 ? cpr.s1 : cpr.r1);
      // Retest MUST occur on a separate bar AFTER momentum bar
      if (i > momentumBarIdx + 1 && l <= levelToTest && c >= cprMin) {
        state = "LONG_RETEST";
        retestBarIdx = i;
      }
    } else if (state === "LONG_RETEST") {
      // Breakout MUST occur on a separate bar AFTER retest bar
      if (i > retestBarIdx && c > swingHigh) {
        state = "LONG_TRIGGERED";
        entry = swingHigh;
        signalType = "LONG";
        sl = entry - slDistance;

        if (setupType === 1) {
          target = cpr.r1 > entry ? cpr.r1 : (cpr.r2 > entry ? cpr.r2 : cpr.r3);
        } else if (setupType === 2) {
          target = cprMax; // 3rd CPR line (Top CPR line)
        } else if (setupType === 3) {
          if (entry >= cpr.r2) target = cpr.r3;
          else target = cpr.r2;
        }
      }
    } else if (state === "SHORT_MOMENTUM") {
      legLows.push(l);
      swingLow = Math.min(...legLows);

      const levelToTest = setupType === 1 ? cprMin : (setupType === 2 ? cpr.r1 : cpr.s1);
      // Retest MUST occur on a separate bar AFTER momentum bar
      if (i > momentumBarIdx + 1 && h >= levelToTest && c <= cprMax) {
        state = "SHORT_RETEST";
        retestBarIdx = i;
      }
    } else if (state === "SHORT_RETEST") {
      // Breakdown MUST occur on a separate bar AFTER retest bar
      if (i > retestBarIdx && c < swingLow) {
        state = "SHORT_TRIGGERED";
        entry = swingLow;
        signalType = "SHORT";
        sl = entry + slDistance;

        if (setupType === 1) {
          target = cpr.s1 < entry ? cpr.s1 : (cpr.s2 < entry ? cpr.s2 : cpr.s3);
        } else if (setupType === 2) {
          target = cprMin; // 1st CPR line (Bottom CPR line)
        } else if (setupType === 3) {
          if (entry <= cpr.s2) target = cpr.s3;
          else target = cpr.s2;
        }
      }
    }
  }

  const lastC = closes[closes.length - 1] || 0;
  const lastVwap = currentVwap || lastC;
  const ma15 = closes.length >= 3 ? closes.slice(-3).reduce((a, b) => a + b, 0) / 3 : lastC;
  const ma60 = closes.length >= 12 ? closes.slice(-12).reduce((a, b) => a + b, 0) / 12 : lastC;
  const prevCloseVal = cpr ? cpr.p : lastC;

  const trends = {
    '5m': lastC > lastVwap ? 'bull' : 'bear',
    '15m': lastC > ma15 ? 'bull' : 'bear',
    '1h': lastC > ma60 ? 'bull' : 'bear',
    '1d': lastC > prevCloseVal ? 'bull' : 'bear'
  };

  return { state, setupType, swingHigh, swingLow, entry, sl, target, signalType, currentVwap, trends };
}

// Calculate VWAP Strategy 2 (MCX Natural Gas)
function calculateVWAPStrategy(chartResult, cpr) {
  if (!chartResult || !chartResult.indicators || !chartResult.indicators.quote) {
    return { state: "NEUTRAL", setupType: null, swingHigh: null, swingLow: null, entry: null, sl: null, target: null, signalType: null, currentVwap: null, trends: { '5m': 'bull', '15m': 'bull', '1h': 'bull', '1d': 'bull' } };
  }

  const timestamps = chartResult.timestamp || [];
  const quote = chartResult.indicators.quote[0];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  let cumTypicalVolume = 0;
  let cumVolume = 0;
  const vwaps = [];

  for (let i = 0; i < closes.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = volumes[i] || 0;
    if (h === null || l === null || c === null) {
      vwaps.push(vwaps.length > 0 ? vwaps[vwaps.length - 1] : null);
      continue;
    }
    const typicalPrice = (h + l + c) / 3;
    cumTypicalVolume += typicalPrice * v;
    cumVolume += v;
    vwaps.push(cumVolume > 0 ? cumTypicalVolume / cumVolume : typicalPrice);
  }

  const currentVwap = vwaps[vwaps.length - 1] || null;

  let state = "NEUTRAL";
  let setupType = null;
  let swingHigh = null;
  let swingLow = null;
  let entry = null;
  let sl = null;
  let target = null;
  let signalType = null;
  let legHighs = [];
  let legLows = [];

  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    const h = highs[i];
    const l = lows[i];
    const vwap = vwaps[i];

    if (c === null || vwap === null) continue;

    // Filter out pre-market candles before 09:00 AM IST for MCX Natural Gas
    if (timestamps[i]) {
      const dateObj = new Date(timestamps[i] * 1000);
      const istTimeStr = dateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
      const parts = istTimeStr.split(':');
      const timeInMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      if (timeInMinutes < 540) { // 540 min = 09:00 AM IST
        continue;
      }
    }

    // Reset on Target or SL (Intrabar High / Low checks)
    if (state === "LONG_TRIGGERED") {
      if (target && h >= target) { state = "NEUTRAL"; setupType = null; swingHigh = null; swingLow = null; entry = null; sl = null; target = null; signalType = null; legHighs = []; legLows = []; }
      else if (sl && l <= sl) { state = "NEUTRAL"; setupType = null; swingHigh = null; swingLow = null; entry = null; sl = null; target = null; signalType = null; legHighs = []; legLows = []; }
    } else if (state === "SHORT_TRIGGERED") {
      if (target && l <= target) { state = "NEUTRAL"; setupType = null; swingHigh = null; swingLow = null; entry = null; sl = null; target = null; signalType = null; legHighs = []; legLows = []; }
      else if (sl && h >= sl) { state = "NEUTRAL"; setupType = null; swingHigh = null; swingLow = null; entry = null; sl = null; target = null; signalType = null; legHighs = []; legLows = []; }
    }

    // Retest Expiration check (Retest MUST be followed by breakout/breakdown within 10 candles)
    if (state.endsWith("_RETEST")) {
      if (i - retestBarIdx > 10) {
        state = "NEUTRAL"; setupType = null; swingHigh = null; swingLow = null; entry = null; sl = null; target = null; signalType = null; legHighs = []; legLows = [];
      }
    }

    if (state === "NEUTRAL") {
      if (c > vwap) { state = "LONG_MOMENTUM"; setupType = 1; legHighs = [h]; swingHigh = h; }
      else if (c < vwap) { state = "SHORT_MOMENTUM"; setupType = 1; legLows = [l]; swingLow = l; }
    } else {
      if (state.startsWith("LONG") && !state.endsWith("TRIGGERED") && c < vwap) {
        state = "SHORT_MOMENTUM"; setupType = 1; legLows = [l]; swingLow = l; swingHigh = null;
      } else if (state.startsWith("SHORT") && !state.endsWith("TRIGGERED") && c > vwap) {
        state = "LONG_MOMENTUM"; setupType = 1; legHighs = [h]; swingHigh = h; swingLow = null;
      }
    }

    if (state === "LONG_MOMENTUM") {
      legHighs.push(h);
      swingHigh = Math.max(...legHighs);
      if (l <= vwap && c >= vwap) { state = "LONG_RETEST"; retestBarIdx = i; }
    } else if (state === "LONG_RETEST") {
      if (c > swingHigh) {
        state = "LONG_TRIGGERED";
        entry = swingHigh;
        sl = entry - 1.0; // Natural Gas rule: SL = entry - 1.0 (1 Rupee risk)
        target = entry + 2.0; // Natural Gas rule: Target = entry + 2.0 (2 Rupees target)
        signalType = "LONG";
      }
    } else if (state === "SHORT_MOMENTUM") {
      legLows.push(l);
      swingLow = Math.min(...legLows);
      if (h >= vwap && c <= vwap) { state = "SHORT_RETEST"; retestBarIdx = i; }
    } else if (state === "SHORT_RETEST") {
      if (c < swingLow) {
        state = "SHORT_TRIGGERED";
        entry = swingLow;
        sl = entry + 1.0; // Natural Gas rule: SL = entry + 1.0 (1 Rupee risk)
        target = entry - 2.0; // Natural Gas rule: Target = entry - 2.0 (2 Rupees target)
        signalType = "SHORT";
      }
    }
  }

  const lastC = closes[closes.length - 1] || 0;
  const lastVwap = currentVwap || lastC;
  const ma15 = closes.length >= 3 ? closes.slice(-3).reduce((a, b) => a + b, 0) / 3 : lastC;
  const ma60 = closes.length >= 12 ? closes.slice(-12).reduce((a, b) => a + b, 0) / 12 : lastC;
  const prevCloseVal = cpr ? cpr.p : lastC;

  const trends = {
    '5m': lastC > lastVwap ? 'bull' : 'bear',
    '15m': lastC > ma15 ? 'bull' : 'bear',
    '1h': lastC > ma60 ? 'bull' : 'bear',
    '1d': lastC > prevCloseVal ? 'bull' : 'bear'
  };

  return { state, setupType, swingHigh, swingLow, entry, sl, target, signalType, currentVwap, trends };
}

// Direct TradingView Scanner Fetcher for MCX Indian Natural Gas Contract (MCX:NATURALGAS1!)
function fetchTradingViewMCXGas() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      symbols: {
        tickers: ["MCX:NATURALGAS1!"]
      },
      columns: ["close", "change", "change_abs", "high", "low", "open", "volume", "VWAP"]
    });

    const options = {
      hostname: 'scanner.tradingview.com',
      port: 443,
      path: '/futures/scan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.data && parsed.data[0] && parsed.data[0].d) {
            const d = parsed.data[0].d;
            const close = d[0];
            const changePercent = d[1];
            const changeAbs = d[2];
            const high = d[3];
            const low = d[4];
            const open = d[5];
            const volume = d[6];
            const vwap = d[7] || close;

            resolve({
              price: close,
              change: changeAbs,
              changePercent: changePercent,
              high: high,
              low: low,
              prevClose: close - changeAbs,
              vwap: vwap
            });
          } else {
            reject(new Error("TradingView empty response"));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Integrated Quote & CPR Analysis function (scans both 1m and 5m timeframes)
function getAssetAnalysis(symbol) {
  if (symbol === 'NG=F') {
    return fetchTradingViewMCXGas().then(tvGas => {
      return Promise.all([
        fetchYahooIntradayChart(symbol, '1m').catch(() => null),
        fetchPreviousDayHLC(symbol).catch(() => null)
      ]).then(([intraday1m, hlc]) => {
        const cpr = hlc ? calculateCPR(hlc) : null;
        let strategy = (intraday1m && intraday1m.chart && intraday1m.chart.result) ? calculateVWAPStrategy(intraday1m.chart.result[0], cpr) : null;

        if (strategy) {
          strategy.currentVwap = tvGas.vwap;

          const isLong = (strategy.signalType === "LONG" || strategy.state === "LONG_TRIGGERED");
          const isShort = (strategy.signalType === "SHORT" || strategy.state === "SHORT_TRIGGERED");

          if (isLong) {
            // Anchor Entry to TradingView's actual session Swing High (259.90)
            strategy.swingHigh = tvGas.high;
            strategy.entry = tvGas.high;
            strategy.sl = parseFloat((strategy.entry - 1.0).toFixed(2));     // e.g. Entry 259.90 -> SL 258.90
            strategy.target = parseFloat((strategy.entry + 2.0).toFixed(2)); // e.g. Entry 259.90 -> Target 261.90
          } else if (isShort) {
            // Anchor Entry to TradingView's actual session Swing Low (255.40)
            strategy.swingLow = tvGas.low;
            strategy.entry = tvGas.low;
            strategy.sl = parseFloat((strategy.entry + 1.0).toFixed(2));     // e.g. Entry 259.90 -> SL 260.90
            strategy.target = parseFloat((strategy.entry - 2.0).toFixed(2)); // e.g. Entry 259.90 -> Target 257.90
          }
        }

        return {
          price: tvGas.price,
          change: tvGas.change,
          changePercent: tvGas.changePercent,
          high: tvGas.high,
          low: tvGas.low,
          prevClose: tvGas.prevClose,
          cpr: cpr,
          strategy: strategy
        };
      });
    }).catch(err => {
      console.error("TradingView direct MCX fetch failed, using fallback:", err.message);
      return null;
    });
  }

  return Promise.all([
    fetchYahooIntradayChart(symbol, '1m').catch(() => null),
    fetchYahooIntradayChart(symbol, '5m').catch(() => null),
    fetchPreviousDayHLC(symbol).catch(() => null)
  ]).then(([intraday1m, intraday5m, hlc]) => {
    const intradayResult = intraday1m || intraday5m;
    if (!intradayResult || !intradayResult.chart || !intradayResult.chart.result || !intradayResult.chart.result[0]) return null;
    
    const meta = intradayResult.chart.result[0].meta || {};
    let price = meta.regularMarketPrice || 0;
    let prevClose = meta.chartPreviousClose || price;
    let high = meta.regularMarketDayHigh || price;
    let low = meta.regularMarketDayLow || price;

    const change = price - prevClose;
    const changePercent = (change / prevClose) * 100;
    
    const cpr = hlc ? calculateCPR(hlc) : null;

    let strategy;
    if (symbol === 'ETH-USD') {
      // Temporarily disable trade signals for Ethereum as requested
      strategy = {
        state: "NEUTRAL",
        setupType: null,
        swingHigh: null,
        swingLow: null,
        entry: null,
        sl: null,
        target: null,
        signalType: null,
        currentVwap: price,
        trends: { '5m': 'bull', '15m': 'bull', '1h': 'bull', '1d': 'bull' }
      };
    } else {
      const assetId = (symbol === '%5ENSEBANK') ? 'banknifty' : 'nifty';
      const strat1m = (intraday1m && intraday1m.chart && intraday1m.chart.result) ? calculateCPRStrategy(intraday1m.chart.result[0], cpr, assetId) : null;
      const strat5m = (intraday5m && intraday5m.chart && intraday5m.chart.result) ? calculateCPRStrategy(intraday5m.chart.result[0], cpr, assetId) : null;

      if (strat1m && strat1m.state && strat1m.state.endsWith("TRIGGERED")) {
        strategy = strat1m;
      } else if (strat5m && strat5m.state && strat5m.state.endsWith("TRIGGERED")) {
        strategy = strat5m;
      } else {
        strategy = strat1m || strat5m;
      }
    }
    
    return {
      price,
      change,
      changePercent,
      high,
      low,
      prevClose,
      cpr,
      strategy
    };
  });
}

// Global Memory State to deduplicate sent WhatsApp messages
const sentAlerts = {
  nifty: null,
  banknifty: null,
  gas: null,
  eth: null
};

// Check strategy signals and trigger alerts
function checkAndSendWhatsApp(id, assetName, assetData) {
  if (!assetData || !assetData.strategy) return;
  const s = assetData.strategy;
  const hasTriggered = (s.state === 'LONG_TRIGGERED' || s.state === 'SHORT_TRIGGERED');
  
  if (hasTriggered) {
    const uniqueKey = `${s.state}_${s.entry}`;
    if (sentAlerts[id] !== uniqueKey) {
      sentAlerts[id] = uniqueKey;
      sendWhatsAppNotification(id, assetName, assetData);
      sendNtfyNotification(assetName, assetData);
    }
  } else {
    // Reset state tracker when signal returns to neutral/retest
    sentAlerts[id] = null;
  }
}

// Fire HTTP GET query to CallMeBot API to forward alerts to user's phone number
function sendWhatsAppNotification(id, assetName, assetData) {
  fs.readFile(SETTINGS_FILE, 'utf8', (err, data) => {
    if (err) return; // settings file doesn't exist
    try {
      const settings = JSON.parse(data);
      if (!settings.enabled || !settings.phone || !settings.apikey) return;
      
      const s = assetData.strategy;
      const direction = s.signalType;
      
      // Comma formatted values
      const formatPrice = (v) => {
        if (v === null || v === undefined) return '--';
        const parts = v.toFixed(2).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
      };

      const entryFormatted = formatPrice(s.entry);
      const slFormatted = formatPrice(s.sl);
      const targetFormatted = formatPrice(s.target);
      
      const setupSuffix = s.setupType ? ` (Setup ${s.setupType})` : '';
      const alertEmoji = direction === 'LONG' ? '🟢' : '🔴';
      const msg = `🚨 *PRE-MARKET STRATEGY ALERT* 🚨\n\n` +
                  `*Asset:* ${assetName}\n` +
                  `*Signal:* ${alertEmoji} *${direction} ENTRY${setupSuffix}*\n` +
                  `*Entry Price:* ${entryFormatted}\n` +
                  `*Stop Loss:* ${slFormatted}\n` +
                  `*Target:* ${targetFormatted}\n` +
                  `*Time:* ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n\n` +
                  `_Generated automatically by PreMarket Alpha Desk_`;

      const options = {
        hostname: 'api.callmebot.com',
        port: 443,
        path: `/whatsapp.php?phone=${encodeURIComponent(settings.phone)}&text=${encodeURIComponent(msg)}&apikey=${encodeURIComponent(settings.apikey)}`,
        method: 'GET'
      };

      const req = https.get(options, (res) => {
        let respBody = '';
        res.on('data', chunk => respBody += chunk);
        res.on('end', () => {
          console.log(`WhatsApp Alert sent successfully. Status: ${res.statusCode}`);
        });
      });
      req.on('error', (e) => {
        console.error("Failed to send WhatsApp via CallMeBot:", e.message);
      });
    } catch (e) {
      console.error("Error reading settings for WhatsApp notification:", e);
    }
  });
}

// Fire HTTP POST query to ntfy.sh to deliver instant phone push notifications
function sendNtfyNotification(assetName, assetData) {
  fs.readFile(SETTINGS_FILE, 'utf8', (err, data) => {
    if (err) return; // settings file doesn't exist
    try {
      const settings = JSON.parse(data);
      if (!settings.ntfyEnabled || !settings.ntfyTopic) return;
      
      const s = assetData.strategy;
      const direction = s.signalType;
      
      const formatPrice = (v) => {
        if (v === null || v === undefined) return '--';
        const parts = v.toFixed(2).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
      };

      const entryFormatted = formatPrice(s.entry);
      const slFormatted = formatPrice(s.sl);
      const targetFormatted = formatPrice(s.target);
      
      const setupSuffix = s.setupType ? ` (Setup ${s.setupType})` : '';
      const msg = `${assetName}: ${direction} Entry Triggered!${setupSuffix}\n` +
                  `Entry Price: ${entryFormatted}\n` +
                  `Stop Loss: ${slFormatted}\n` +
                  `Target: ${targetFormatted}`;

      const options = {
        hostname: 'ntfy.sh',
        port: 443,
        path: `/${encodeURIComponent(settings.ntfyTopic)}`,
        method: 'POST',
        headers: {
          'Title': 'PRE-MARKET STRATEGY ALERT',
          'Priority': 'high',
          'Tags': direction === 'LONG' ? 'green_circle,chart_with_upwards_trend' : 'red_circle,chart_with_downwards_trend'
        }
      };

      const req = https.request(options, (res) => {
        let respBody = '';
        res.on('data', chunk => respBody += chunk);
        res.on('end', () => {
          console.log(`ntfy.sh Alert sent successfully. Status: ${res.statusCode}`);
        });
      });
      req.on('error', (e) => {
        console.error("Failed to send ntfy.sh notification:", e.message);
      });
      req.write(msg);
      req.end();
    } catch (e) {
      console.error("Error reading settings for ntfy.sh notification:", e);
    }
  });
}

let newsCache = {
  equity: [],
  gas: [],
  lastUpdated: 0
};

// Direct server-side RSS fetcher and XML parser to ensure 100% valid links (no cors proxy issues)
function fetchAndParseRSS(url, category) {
  return new Promise((resolve) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    https.get(url, options, (res) => {
      if (res.statusCode !== 200) {
        return resolve([]);
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const items = [];
          const itemRegex = /<item([\s\S]*?)>([\s\S]*?)<\/item>/gi;
          let match;
          while ((match = itemRegex.exec(body)) !== null) {
            const itemContent = match[2];
            
            const extractTag = (tag) => {
              const r = new RegExp(`<${tag}([\\s\\S]*?)>([\\s\\S]*?)<\/${tag}>`, 'i');
              const m = r.exec(itemContent);
              if (!m) return '';
              let val = m[2].trim();
              if (val.startsWith('<![CDATA[')) {
                val = val.substring(9, val.length - 3).trim();
              }
              return val;
            };

            const title = extractTag('title');
            const link = extractTag('link');
            const pubDate = extractTag('pubDate');
            let description = extractTag('description');
            
            description = description.replace(/<[^>]*>?/gm, ''); // strip html tags

            if (title && link) {
              let source = "Financial News";
              if (url.includes("moneycontrol")) source = "Moneycontrol";
              else if (url.includes("economictimes")) source = "Economic Times";
              else if (url.includes("google")) {
                const parts = title.split(' - ');
                if (parts.length > 1) {
                  source = parts.pop();
                } else {
                  source = "Google News";
                }
              }

              const text = (title + " " + description).toLowerCase();
              let direct = false;
              let impact = "low";

              if (category === 'equity') {
                const directKeywords = ['nifty', 'bank nifty', 'nse', 'bse', 'rbi', 'sebi', 'inflation', 'interest rate', 'repo rate', 'earnings', 'reliance', 'hdfc', 'icici', 'infy', 'tcs', 'tata', 'adani', 'fii', 'dii'];
                const highKeywords = ['rate hike', 'rate cut', 'policy change', 'inflation spikes', 'probe', 'crash', 'surge', 'plummet', 'adani group', 'market crash', 'black swan'];
                const mediumKeywords = ['profit jumps', 'beats estimates', 'slips', 'revenue', 'block deal', 'shares up', 'shares down', 'gains', 'losses', 'dividends', 'offload', 'soar', 'multibagger', 'gmp', 'ipo'];
                
                direct = directKeywords.some(kw => text.includes(kw));
                if (highKeywords.some(kw => text.includes(kw))) {
                  impact = "high";
                } else if (mediumKeywords.some(kw => text.includes(kw))) {
                  impact = "medium";
                } else {
                  impact = "low";
                }
              } else if (category === 'crypto') {
                const directKeywords = ['ethereum', 'eth', 'crypto', 'sec', 'etf', 'bitcoin', 'fed', 'interest rate', 'regulation', 'coinbase', 'binance', 'vitalik'];
                const highKeywords = ['etf approval', 'regulation changes', 'sec lawsuit', 'sec win', 'crash', 'surge', 'hack', 'hard fork', 'upgrades', 'bull run', 'bear market'];
                const mediumKeywords = ['gas fees', 'sharding', 'layer 2', 'transactions', 'volume', 'accumulation', 'whales', 'rally', 'declines', 'price slide', 'etf outflows', 'etf inflows'];
                
                direct = directKeywords.some(kw => text.includes(kw));
                if (highKeywords.some(kw => text.includes(kw))) {
                  impact = "high";
                } else if (mediumKeywords.some(kw => text.includes(kw))) {
                  impact = "medium";
                } else {
                  impact = "low";
                }
              } else {
                const directKeywords = ['natural gas', 'gas futures', 'henry hub', 'eia', 'lng', 'weather', 'freeze', 'heatwave', 'storage', 'inventory', 'withdrawal', 'injection'];
                const highKeywords = ['weather alert', 'colder forecast', 'supply freeze', 'storage jump', 'inventory drop', 'plummet', 'surge', 'shutdown'];
                const mediumKeywords = ['warmer', 'colder', 'production', 'drilling', 'export', 'imports', 'lng export', 'pipeline', 'slide', 'rising output'];
                
                direct = directKeywords.some(kw => text.includes(kw));
                if (highKeywords.some(kw => text.includes(kw))) {
                  impact = "high";
                } else if (mediumKeywords.some(kw => text.includes(kw))) {
                  impact = "medium";
                } else {
                  impact = "low";
                }
              }

              items.push({
                title,
                link,
                pubDate,
                description,
                source,
                category,
                impact,
                direct
              });
            }
          }
          resolve(items);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

let cachedFiiDiiData = null;
let lastFiiDiiFetchTime = 0;

function fetchFiiDiiActivity() {
  const now = Date.now();
  // Cache for 15 minutes to prevent hammering
  if (cachedFiiDiiData && (now - lastFiiDiiFetchTime < 15 * 60 * 1000)) {
    return Promise.resolve(cachedFiiDiiData);
  }

  return new Promise((resolve) => {
    const url = 'https://www.moneycontrol.com/markets/fii-dii-data/';
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };

    https.get(url, options, (res) => {
      if (res.statusCode !== 200) {
        return resolve(cachedFiiDiiData || []);
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const startTag = '__NEXT_DATA__" type="application/json">';
          const startIdx = body.indexOf(startTag);
          if (startIdx === -1) throw new Error("Could not find __NEXT_DATA__");
          
          const jsonStart = startIdx + startTag.length;
          const endIdx = body.indexOf('</script>', jsonStart);
          if (endIdx === -1) throw new Error("Could not find script closing tag");
          
          const jsonStr = body.substring(jsonStart, endIdx);
          const data = JSON.parse(jsonStr);
          const rawList = data.props.pageProps.FiiDiiData.fiiDiiData || [];
          
          cachedFiiDiiData = rawList;
          lastFiiDiiFetchTime = Date.now();
          resolve(rawList);
        } catch (e) {
          console.error("FII DII parsing error, serving cache:", e);
          resolve(cachedFiiDiiData || []);
        }
      });
    }).on('error', (err) => {
      console.error("FII DII network error, serving cache:", err);
      resolve(cachedFiiDiiData || []);
    });
  });
}

function getParsedNews() {
  const now = Date.now();
  if (now - newsCache.lastUpdated < 120000 && newsCache.equity.length > 0) {
    return Promise.resolve(newsCache);
  }

  const eqFeeds = [
    'https://www.moneycontrol.com/rss/marketnews.xml',
    'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    'https://news.google.com/rss/search?q=Nifty+50+OR+Bank+Nifty+OR+SEBI+market+when:1d&hl=en-IN&gl=IN&ceid=IN:en'
  ];

  const gasFeeds = [
    'https://news.google.com/rss/search?q=Natural+Gas+OR+Henry+Hub+OR+LNG+energy+when:2d&hl=en-US&gl=US&ceid=US:en'
  ];

  const cryptoFeeds = [
    'https://news.google.com/rss/search?q=Ethereum+OR+ETH+OR+crypto+market+when:2d&hl=en-US&gl=US&ceid=US:en'
  ];

  const fetchesEq = eqFeeds.map(url => fetchAndParseRSS(url, 'equity'));
  const fetchesGas = gasFeeds.map(url => fetchAndParseRSS(url, 'gas'));
  const fetchesCrypto = cryptoFeeds.map(url => fetchAndParseRSS(url, 'crypto'));

  return Promise.all([
    Promise.all(fetchesEq),
    Promise.all(fetchesGas),
    Promise.all(fetchesCrypto)
  ]).then(([eqResults, gasResults, cryptoResults]) => {
    let eqNews = [];
    eqResults.forEach(res => { eqNews = eqNews.concat(res); });
    
    let gasNews = [];
    gasResults.forEach(res => { gasNews = gasNews.concat(res); });
    cryptoResults.forEach(res => { gasNews = gasNews.concat(res); });

    const uniqueEq = [];
    const seenEq = new Set();
    eqNews.forEach(item => {
      const titleNorm = item.title.toLowerCase().trim();
      if (!seenEq.has(titleNorm)) {
        seenEq.add(titleNorm);
        uniqueEq.push(item);
      }
    });

    const uniqueGas = [];
    const seenGas = new Set();
    gasNews.forEach(item => {
      const titleNorm = item.title.toLowerCase().trim();
      if (!seenGas.has(titleNorm)) {
        seenGas.add(titleNorm);
        uniqueGas.push(item);
      }
    });

    newsCache = {
      equity: uniqueEq,
      gas: uniqueGas,
      lastUpdated: now
    };

    return newsCache;
  });
}

// Server-side Trade Log store & Price checking engine with file persistence
const TRADE_LOG_FILE = path.join(__dirname, 'trade_history.json');
let tradeLog = [];

try {
  if (fs.existsSync(TRADE_LOG_FILE)) {
    const fileData = fs.readFileSync(TRADE_LOG_FILE, 'utf8');
    tradeLog = JSON.parse(fileData);
  }
} catch (e) {
  console.error("Error loading trade history file:", e);
}

function saveTradeLogToFile() {
  try {
    if (tradeLog.length > 200) {
      tradeLog = tradeLog.slice(-200);
    }
    fs.writeFileSync(TRADE_LOG_FILE, JSON.stringify(tradeLog, null, 2), 'utf8');
  } catch (e) {
    console.error("Error saving trade history file:", e);
  }
}

// Helper to check if market is open for an asset (closed on Saturdays & Sundays)
function isMarketOpen(assetId) {
  const now = new Date();
  const kolkataTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const kolkataDate = new Date(kolkataTimeStr);

  const day = kolkataDate.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) {
    // Markets strictly closed on Saturdays and Sundays!
    return false;
  }

  const hours = kolkataDate.getHours();
  const minutes = kolkataDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  if (assetId === 'nifty' || assetId === 'banknifty') {
    // Indian Equities market hours: 09:15 AM (555 min) to 03:30 PM (930 min) IST
    return (timeInMinutes >= 555 && timeInMinutes <= 930);
  } else if (assetId === 'gas') {
    // MCX Commodity market hours: 09:00 AM (540 min) to 11:30 PM (1410 min) IST
    return (timeInMinutes >= 540 && timeInMinutes <= 1410);
  }

  return false;
}

function updateTradeLog(nifty, banknifty, gas, eth) {
  let logChanged = false;

  // Purge any invalid weekend trade logs (e.g. trades logged on Saturday/Sunday when market is closed)
  const kolkataDay = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getDay();
  if (kolkataDay === 0 || kolkataDay === 6) {
    if (tradeLog.length > 0) {
      tradeLog = [];
      logChanged = true;
    }
  }

  // Sanitize existing trade log entries to ensure Natural Gas (+2.0 target, -1.0 SL for LONG; -2.0 target, +1.0 SL for SHORT), Nifty, and Bank Nifty target/SL rules are strictly enforced
  tradeLog.forEach(t => {
    if (t.asset === 'MCX NATURAL GAS') {
      if (t.direction === 'SHORT') {
        const correctTarget = parseFloat((t.entry - 2.0).toFixed(2));
        const correctSL = parseFloat((t.entry + 1.0).toFixed(2));
        if (t.target !== correctTarget || t.sl !== correctSL) {
          t.target = correctTarget;
          t.sl = correctSL;
          logChanged = true;
        }
      } else if (t.direction === 'LONG') {
        const correctTarget = parseFloat((t.entry + 2.0).toFixed(2));
        const correctSL = parseFloat((t.entry - 1.0).toFixed(2));
        if (t.target !== correctTarget || t.sl !== correctSL) {
          t.target = correctTarget;
          t.sl = correctSL;
          logChanged = true;
        }
      }
    } else if (t.asset === 'NIFTY 50') {
      if (t.direction === 'SHORT') {
        const correctSL = parseFloat((t.entry + 10).toFixed(2));
        if (t.sl !== correctSL) { t.sl = correctSL; logChanged = true; }
      } else if (t.direction === 'LONG') {
        const correctSL = parseFloat((t.entry - 10).toFixed(2));
        if (t.sl !== correctSL) { t.sl = correctSL; logChanged = true; }
      }
    } else if (t.asset === 'BANK NIFTY') {
      if (t.direction === 'SHORT') {
        const correctSL = parseFloat((t.entry + 20).toFixed(2));
        if (t.sl !== correctSL) { t.sl = correctSL; logChanged = true; }
      } else if (t.direction === 'LONG') {
        const correctSL = parseFloat((t.entry - 20).toFixed(2));
        if (t.sl !== correctSL) { t.sl = correctSL; logChanged = true; }
      }
    }
  });

  const checkLogTrigger = (id, name, data) => {
    // Strictly disable new trade logging when markets are closed (Saturdays, Sundays & outside trading hours)
    if (!isMarketOpen(id)) return;

    if (!data || !data.strategy) return;
    const s = data.strategy;
    if (s.state === 'LONG_TRIGGERED' || s.state === 'SHORT_TRIGGERED') {
      const todayDateKey = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      // Strict 1-Trade-Per-Setup Lock: deduplicate by asset ID, signal direction, and current setup session
      const tradeId = `${id}_${s.signalType}_${s.state}_${todayDateKey}`;
      const exists = tradeLog.some(t => t.tradeId === tradeId || (t.asset === name && t.status === 'Active'));
      if (!exists) {
        const todayStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
        // Use exact market candle timestamp if available, falling back to current IST time
        const timeStr = (s && s.triggerTime) ? s.triggerTime : new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
        
        let calculatedTarget = s.target;
        let calculatedSL = s.sl;

        if (name === 'MCX NATURAL GAS') {
          calculatedTarget = s.signalType === 'LONG' ? (s.entry + 2.0) : (s.entry - 2.0);
          calculatedSL = s.signalType === 'LONG' ? (s.entry - 1.0) : (s.entry + 1.0);
        }

        tradeLog.push({
          tradeId,
          time: `${todayStr}, ${timeStr}`,
          entryTime: timeStr,
          exitTime: 'Active ⏳',
          asset: name,
          setup: s.setupType ? `Setup ${s.setupType}` : 'VWAP Retest',
          direction: s.signalType,
          entry: parseFloat(s.entry.toFixed(2)),
          target: parseFloat(calculatedTarget.toFixed(2)),
          sl: parseFloat(calculatedSL.toFixed(2)),
          status: 'Active'
        });
        logChanged = true;
      }
    }
  };

  checkLogTrigger('nifty', 'NIFTY 50', nifty);
  checkLogTrigger('banknifty', 'BANK NIFTY', banknifty);
  checkLogTrigger('gas', 'MCX NATURAL GAS', gas);
  checkLogTrigger('eth', 'ETH/USD', eth);

  const getAssetPrice = (name) => {
    if (name === 'NIFTY 50' && nifty) return nifty.price;
    if (name === 'BANK NIFTY' && banknifty) return banknifty.price;
    if (name === 'MCX NATURAL GAS' && gas) return gas.price;
    if (name === 'ETH/USD' && eth) return eth.price;
    return null;
  };

  tradeLog.forEach(t => {
    if (t.status === 'Active') {
      const price = getAssetPrice(t.asset);
      if (price !== null) {
        let newStatus = 'Active';
        if (t.direction === 'LONG') {
          if (t.target && price >= t.target) {
            newStatus = 'Target Hit 🟢';
          } else if (t.sl && price <= t.sl) {
            newStatus = 'SL Hit 🔴';
          }
        } else if (t.direction === 'SHORT') {
          if (t.target && price <= t.target) {
            newStatus = 'Target Hit 🟢';
          } else if (t.sl && price >= t.sl) {
            newStatus = 'SL Hit 🔴';
          }
        }
        if (newStatus !== 'Active') {
          t.status = newStatus;
          t.exitTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
          logChanged = true;
        }
      }
    }
  });

  if (logChanged) {
    saveTradeLogToFile();
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/`);
});
