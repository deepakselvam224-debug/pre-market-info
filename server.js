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

  // Expose API Endpoint for Live Yahoo Quotes & Strategy Signals (bypasses CORS)
  if (urlPath === '/api/quotes') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    });
    
    Promise.all([
      getAssetAnalysis('^NSEI'),
      getAssetAnalysis('^NSEBANK'),
      getAssetAnalysis('NG=F'),
      fetchYahooQuote('INR=X').catch(() => ({ price: 83.5, change: 0, changePercent: 0 })),
      fetchYahooQuote('^GSPC').catch(() => ({ price: 5450.5, change: 30.2, changePercent: 0.55 })),
      getAssetAnalysis('ETH-USD')
    ]).then(results => {
      const [nifty, banknifty, gas, usdinr, spx, eth] = results;
      
      // Convert Natural Gas (Henry Hub USD) to MCX equivalent in Rupees using live USDINR rate
      let convertedGas = null;
      if (gas && usdinr) {
        const rate = usdinr.price;
        const convertVal = (v) => v !== null && v !== undefined ? Math.round(v * rate * 10) / 10 : null;
        
        // Convert CPR levels
        const convertedCPR = gas.cpr ? {
          tc: convertVal(gas.cpr.tc),
          p: convertVal(gas.cpr.p),
          bc: convertVal(gas.cpr.bc),
          r1: convertVal(gas.cpr.r1),
          s1: convertVal(gas.cpr.s1),
          r2: convertVal(gas.cpr.r2),
          s2: convertVal(gas.cpr.s2),
          r3: convertVal(gas.cpr.r3),
          s3: convertVal(gas.cpr.s3)
        } : null;

        // Convert Strategy parameters
        const convertedStrategy = gas.strategy ? {
          state: gas.strategy.state,
          swingHigh: convertVal(gas.strategy.swingHigh),
          swingLow: convertVal(gas.strategy.swingLow),
          entry: convertVal(gas.strategy.entry),
          sl: convertVal(gas.strategy.sl),
          target: convertVal(gas.strategy.target),
          signalType: gas.strategy.signalType,
          currentVwap: convertVal(gas.strategy.currentVwap)
        } : null;

        // Calculate change in Rupees
        const gasPrevClose = gas.price - gas.change;
        const mcxPrice = convertVal(gas.price);
        const mcxPrevClose = gasPrevClose * (rate - usdinr.change);
        const mcxChange = Math.round((mcxPrice - mcxPrevClose) * 10) / 10;

        convertedGas = {
          price: mcxPrice,
          change: mcxChange,
          changePercent: gas.changePercent || 0,
          high: convertVal(gas.high),
          low: convertVal(gas.low),
          prevClose: convertVal(gas.prevClose),
          cpr: convertedCPR,
          strategy: convertedStrategy,
          henryHubPrice: gas.price
        };
      }

      // Check and send WhatsApp alerts on strategy state triggers
      if (nifty) checkAndSendWhatsApp('nifty', 'NIFTY 50', nifty);
      if (banknifty) checkAndSendWhatsApp('banknifty', 'BANK NIFTY', banknifty);
      if (convertedGas) checkAndSendWhatsApp('gas', 'MCX NATURAL GAS', convertedGas);
      if (eth) checkAndSendWhatsApp('eth', 'ETHEREUM (ETH/USD)', eth);

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
        eth
      };
      
      res.end(JSON.stringify(data));
    }).catch(err => {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
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

// Fetch Intraday 5m chart from Yahoo Finance
function fetchYahooIntradayChart(symbol) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'query1.finance.yahoo.com',
      port: 443,
      path: `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`,
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
      legHighs.push(h);
      swingHigh = Math.max(...legHighs);

      // Check for breakout to Trigger
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
      legLows.push(l);
      swingLow = Math.min(...legLows);

      // Check for breakdown to Trigger
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
      }
    }
  }

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
    currentVwap: null
  };
}

// Calculate VWAP & Track Strategy Setup State Machine
function calculateVWAPAndStrategy(chartResult, cpr, isCommodityCrypto = false) {
  if (!chartResult || !chartResult.indicators || !chartResult.indicators.quote) {
    return { state: "NEUTRAL", swingHigh: null, swingLow: null, entry: null, sl: null, target: null, currentVwap: null };
  }

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

    const vwapVal = cumVolume > 0 ? cumTypicalVolume / cumVolume : typicalPrice;
    vwaps.push(vwapVal);
  }

  const currentVwap = vwaps.length > 0 ? vwaps[vwaps.length - 1] : null;

  // Run Strategy State Machine
  let state = "NEUTRAL";
  let swingHigh = null;
  let swingLow = null;
  let entry = null;
  let sl = null;
  let target = null;
  let signalType = null; // "LONG" or "SHORT"

  // Temporary trackers for legs
  let legHighs = [];
  let legLows = [];

  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    const h = highs[i];
    const l = lows[i];
    const vwap = vwaps[i];

    if (c === null || vwap === null) continue;

    // Check for crossovers of VWAP to force direction shifts
    if (c > vwap) {
      if (state.startsWith("SHORT") || state === "NEUTRAL") {
        state = "LONG_MOMENTUM";
        legHighs = [h];
        swingHigh = h;
        swingLow = null;
        entry = null;
        sl = null;
        target = null;
        signalType = null;
      }
    } else if (c < vwap) {
      if (state.startsWith("LONG") || state === "NEUTRAL") {
        state = "SHORT_MOMENTUM";
        legLows = [l];
        swingLow = l;
        swingHigh = null;
        entry = null;
        sl = null;
        target = null;
        signalType = null;
      }
    }

    // Now process the active direction state
    if (state === "LONG_MOMENTUM") {
      legHighs.push(h);
      swingHigh = Math.max(...legHighs);
      
      if (isCommodityCrypto) {
        // Confirmation 3 (Retest): Low must touch or cross below VWAP, but close remains on/above it
        if (l <= vwap && c >= vwap) {
          state = "LONG_RETEST";
        }
      } else {
        // Pullback threshold: price pulls back to within 35% of the distance between swingHigh and VWAP
        const threshold = vwap + (swingHigh - vwap) * 0.35;
        if (c <= threshold) {
          state = "LONG_RETEST";
        }
      }
    } else if (state === "LONG_RETEST") {
      // If price goes up and makes a new high without breakout close, track it
      legHighs.push(h);
      swingHigh = Math.max(...legHighs);

      // Waiting for breakout above swingHigh
      if (c > swingHigh) {
        state = "LONG_TRIGGERED";
        entry = swingHigh;
        sl = vwap;
        target = cpr ? (cpr.r1 > entry ? cpr.r1 : (cpr.r2 > entry ? cpr.r2 : cpr.r3)) : null;
        signalType = "LONG";
      }
    } else if (state === "SHORT_MOMENTUM") {
      legLows.push(l);
      swingLow = Math.min(...legLows);
      
      if (isCommodityCrypto) {
        // Confirmation 3 (Retest): High must touch or cross above VWAP, but close remains on/below it
        if (h >= vwap && c <= vwap) {
          state = "SHORT_RETEST";
        }
      } else {
        // Pullback threshold: price pulls back to within 35% of the distance between VWAP and swingLow
        const threshold = vwap - (vwap - swingLow) * 0.35;
        if (c >= threshold) {
          state = "SHORT_RETEST";
        }
      }
    } else if (state === "SHORT_RETEST") {
      // If price goes down and makes a new low without breakdown close, track it
      legLows.push(l);
      swingLow = Math.min(...legLows);

      // Waiting for breakdown below swingLow
      if (c < swingLow) {
        state = "SHORT_TRIGGERED";
        entry = swingLow;
        sl = vwap;
        target = cpr ? (cpr.s1 < entry ? cpr.s1 : (cpr.s2 < entry ? cpr.s2 : cpr.s3)) : null;
        signalType = "SHORT";
      }
    }
  }

  return {
    state,
    swingHigh,
    swingLow,
    entry,
    sl,
    target,
    signalType,
    currentVwap
  };
}

// Integrated Quote & CPR Analysis function
function getAssetAnalysis(symbol) {
  return Promise.all([
    fetchYahooIntradayChart(symbol).catch(() => null),
    fetchPreviousDayHLC(symbol).catch(() => null)
  ]).then(([intradayResult, hlc]) => {
    if (!intradayResult || !intradayResult.chart || !intradayResult.chart.result) return null;
    
    const meta = intradayResult.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || price;
    const change = price - prevClose;
    const changePercent = (change / prevClose) * 100;
    
    const cpr = hlc ? calculateCPR(hlc) : null;
    const isCommodityCrypto = (symbol === 'NG=F' || symbol === 'ETH-USD');
    const strategy = isCommodityCrypto
      ? calculateVWAPAndStrategy(intradayResult.chart.result[0], cpr, true)
      : calculateStrategy1(intradayResult.chart.result[0], cpr);
    
    return {
      price,
      change,
      changePercent,
      high: meta.regularMarketDayHigh || price,
      low: meta.regularMarketDayLow || price,
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/`);
});
