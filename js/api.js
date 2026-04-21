// ─── Stock Universe Fetch, Parse, and Cache (NSE + BSE) ───
const STOCK_LIST_CACHE_KEY = 'stock_universe_v1';
const STOCK_LIST_CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day

// Fetch NSE equity list (preferred)
async function fetchNSEStockUniverse() {
  try {
    const url = 'https://www.nseindia.com/api/equity-stockIndices?index=ALL';
    const res = await fetchWithProxy(url, 30000);
    if (!res || !res.data || !Array.isArray(res.data)) throw new Error('Invalid NSE ALL response');
    return res.data;
  } catch (e) {
    console.warn('NSE ALL fetch failed:', e.message);
    return null;
  }
}

// Fallback: Fetch static CSV
async function fetchNSEStockCSV() {
  try {
    const url = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
    const res = await fetchWithProxy(url, 30000);
    if (typeof res !== 'string') throw new Error('CSV not string');
    return res;
  } catch (e) {
    console.warn('NSE CSV fetch failed:', e.message);
    return null;
  }
}

// Parse NSE ALL API response
function parseNSEStockUniverse(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter(s => s.symbol && s.series === 'EQ')
    .map(s => ({ symbol: s.symbol, name: s.meta && s.meta.companyName ? s.meta.companyName : s.symbol, series: s.series }));
}

// Parse CSV fallback
function parseNSEStockCSV(csv) {
  const lines = csv.split(/\r?\n/);
  const header = lines[0].split(',');
  const idxSymbol = header.indexOf('SYMBOL');
  const idxName = header.indexOf('NAME OF COMPANY');
  const idxSeries = header.indexOf('SERIES');
  if (idxSymbol < 0 || idxName < 0 || idxSeries < 0) return [];
  return lines.slice(1).map(row => {
    const cols = row.split(',');
    return {
      symbol: cols[idxSymbol],
      name: cols[idxName],
      series: cols[idxSeries],
    };
  }).filter(s => s.symbol && s.series === 'EQ');
}

// Get stock universe (with cache and local fallback)
async function getStockUniverse() {
  const localFallback = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "INFY.NS", "BHARTIARTL.NS", "ITC.NS", "SBIN.NS", "LICI.NS", "HINDUNILVR.NS", "TITAN.NS", "HINDZINC.NS", "HCLTECH.NS", "MARUTI.NS", "SUNPHARMA.NS", "BAJFINANCE.NS", "ADANIENT.NS", "TATAMOTORS.NS", "ONGC.NS", "JSWSTEEL.NS", "ADANIPORTS.NS", "ASIANPAINT.NS", "KOTAKBANK.NS", "COALINDIA.NS", "AXISBANK.NS", "ADANIPOWER.NS", "ULTRACEMCO.NS", "NTPC.NS", "BAJAJFINSV.NS", "M&M.NS", "SHREECEM.NS", "NESTLEIND.NS", "GRASIM.NS", "POWERGRID.NS", "INDUSINDBK.NS", "JSWENERGY.NS", "TATASTEEL.NS", "HINDALCO.NS", "ADANIGREEN.NS", "ADANITRANS.NS", "DMART.NS", "BAJAJ-AUTO.NS", "DLF.NS", "VBL.NS", "HAL.NS", "BEL.NS", "SIEMENS.NS", "IRFC.NS", "PFC.NS", "RECLTD.NS"];

  try {
    // Try cache first
    const cached = localStorage.getItem(STOCK_LIST_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.time < STOCK_LIST_CACHE_TTL) {
        console.log("DEBUG: Using cached stock universe");
        return parsed.data;
      }
    }

    // Try NSE ALL API with strict timeout
    let stocks = [];
    console.log("DEBUG: Fetching NSE universe...");
    const nseData = await fetchNSEStockUniverse(); // fetchWithProxy already has timeout
    
    if (nseData) {
      stocks = parseNSEStockUniverse(nseData);
      console.log("DEBUG: NSE API universe success");
    } else {
      console.log("DEBUG: NSE API failed, trying CSV...");
      const csv = await fetchNSEStockCSV();
      if (csv) {
        stocks = parseNSEStockCSV(csv);
        console.log("DEBUG: NSE CSV universe success");
      }
    }

    if (stocks.length > 0) {
      const tickers = stocks.map(s => s.symbol + '.NS');
      localStorage.setItem(STOCK_LIST_CACHE_KEY, JSON.stringify({ data: tickers, time: Date.now() }));
      return tickers;
    }
  } catch (err) {
    console.error("DEBUG: getStockUniverse failed:", err.message);
  }

  console.warn("DEBUG: Using local hardcoded fallback stock universe");
  return localFallback;
}

// ─── Batch Processing Utilities ───
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

// ─── Batch Fetch with Retry, Timeout, and Error Handling ───
async function batchFetchStocks(tickers, fetchFn, batchSize = 10, delayMs = 1500, maxRetries = 2, timeoutMs = 20000) {
  const results = {};
  const chunks = chunkArray(tickers, batchSize);
  for (const batch of chunks) {
    await Promise.all(batch.map(async ticker => {
      let tries = 0;
      while (tries <= maxRetries) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          const data = await fetchFn(ticker, controller.signal);
          clearTimeout(timer);
          results[ticker] = data;
          break;
        } catch (e) {
          tries++;
          if (tries > maxRetries) {
            results[ticker] = { error: e.message || 'Failed' };
          } else {
            await sleep(500); // short retry delay
          }
        }
      }
    }));
    await sleep(delayMs);
  }
  return results;
}
// ─── Alpha Vantage API Key (replace with your free key) ───
const API_CONFIG = {
  FMP_KEY: 'MSYnvjjcS8HU7D93Fz7dUn9YXslByfXH',
  FMP_BASE: 'https://financialmodelingprep.com/api/v3',
};

// ─── Centralized FMP Fetch Helper ───
async function fetchFMP(endpoint, params = {}) {
  const queryParams = new URLSearchParams({ ...params, apikey: API_CONFIG.FMP_KEY });
  const url = `${API_CONFIG.FMP_BASE}/${endpoint}?${queryParams.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FMP HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`FMP Fetch failed for ${endpoint}:`, e.message);
    throw e;
  }
}

// ─── Core fetch with multi-proxy fallback ───
async function fetchWithProxy(url, timeout = 20000) {
  const proxies = [
    API_CONFIG.PROXY_1 + encodeURIComponent(url),
    API_CONFIG.PROXY_2 + encodeURIComponent(url),
  ];

  for (const proxyUrl of proxies) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return JSON.parse(text);
    } catch (e) {
      console.warn(`Proxy failed: ${proxyUrl.slice(0, 60)}...`, e.message);
    }
  }
  throw new Error(`All proxies failed for: ${url}`);
}

// ─── Normalize ticker to NSE format ───
function normalizeSymbol(ticker) {
  const t = ticker.trim().toUpperCase();
  if (t.endsWith('.NS') || t.endsWith('.BO')) return t;
  return t + '.NS';
}

function tsToDateStr(ts) {
  const d = new Date(ts);
  return d.toISOString().split('T')[0];
}

// ─── Fetch OHLCV chart data from FMP ───
async function fetchChartData(symbol) {
  const data = await fetchFMP(`historical-price-full/${symbol}`);
  if (!data || !data.historical) throw new Error(`No historical data for ${symbol}`);

  // Transform FMP historical to app standard OHLCV (ascending order)
  const ohlcv = data.historical.reverse().map(d => ({
    time: d.date,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volume,
  }));

  // Create a pseudo-meta object for compatibility
  const meta = {
    symbol: data.symbol,
    regularMarketPrice: ohlcv[ohlcv.length - 1].close,
    regularMarketPreviousClose: ohlcv[ohlcv.length - 2].close,
  };

  return { ohlcv, meta };
}

// ─── Fetch pseudo quote summary from FMP ───
// FMP spreads what Yahoo had across multiple endpoints. We combine them here.
async function fetchQuoteSummary(symbol) {
  try {
    const [quote, profile, ratios, growth] = await Promise.all([
      fetchFMP(`quote/${symbol}`),
      fetchFMP(`profile/${symbol}`),
      fetchFMP(`ratios-ttm/${symbol}`),
      fetchFMP(`financial-growth/${symbol}`, { limit: 1 })
    ]);

    return {
      price: quote?.[0] || {},
      profile: profile?.[0] || {},
      ratios: ratios?.[0] || {},
      growth: growth?.[0] || {},
      symbol: symbol
    };
  } catch (e) {
    throw new Error(`Failed to fetch FMP data for ${symbol}: ${e.message}`);
  }
}

// ─── Fetch Nifty 50 data from FMP ───
async function fetchNiftyData() {
  try {
    const data = await fetchFMP('quote/%5ENSEI');
    const quote = data?.[0];
    if (!quote) return null;
    return {
      price: quote.price,
      change: quote.change,
      changePercent: quote.changesPercentage / 100 // FMP gives percent, we internalize as decimal
    };
  } catch (e) {
    console.warn('FMP Nifty fetch failed:', e.message);
    return null;
  }
}

// ─── Fetch News from FMP ───
async function fetchNewsFMP(symbol) {
  try {
    const data = await fetchFMP('stock_news', { tickers: symbol, limit: 10 });
    if (!Array.isArray(data)) return null;
    return data.map(item => ({
      title: item.title || '',
      description: item.text || '',
      url: item.url || '#',
      publishedAt: item.publishedDate || new Date().toISOString(),
      source: item.site || 'FMP',
      image: item.image
    }));
  } catch (e) {
    console.warn('FMP News failed:', e.message);
    return null;
  }
}

// ─── Combined News fetch with FMP primary ───
async function fetchNews(companyName, symbol) {
  let articles = await fetchNewsFMP(symbol);
  if (!articles || articles.length === 0) {
    articles = generateSampleNews(companyName || symbol);
  }
  return articles;
}

// ─── Sample news for when APIs fail ───
function generateSampleNews(company) {
  const now = new Date();
  const templates = [
    { title: `${company} Q4 results: Strong earnings beat expectations`, sentiment: 'positive' },
    { title: `Analysts upgrade ${company} on robust revenue growth outlook`, sentiment: 'positive' },
    { title: `${company} announces strategic expansion into new markets`, sentiment: 'positive' },
    { title: `Nifty 50 sees mixed session; ${company} holds steady`, sentiment: 'neutral' },
    { title: `FII activity in ${company}: Institutional buying observed this week`, sentiment: 'positive' },
    { title: `${company} faces input cost pressure in challenging macro environment`, sentiment: 'negative' },
  ];
  return templates.map((t, i) => ({
    title: t.title,
    description: '',
    url: '#',
    publishedAt: new Date(now - i * 86400000).toISOString(),
    source: 'Sample Data',
    _isSimulated: true,
  }));
}

// ─── Master data loader ───
async function loadAllData(ticker, onStep) {
  console.log("DEBUG: loadAllData start for:", ticker);
  const symbol = normalizeSymbol(ticker);
  console.log("DEBUG: Normalized symbol:", symbol);

  const step = (msg, status = 'loading') => {
    console.log(`DEBUG: API Load Step: ${msg} (${status})`);
    if (onStep) onStep(msg, status);
  };

  // 1. Price & Chart data
  step('Fetching price & chart data (1Y)...');
  let chartData, meta;
  try {
    const result = await fetchChartData(symbol, '1d', '1y');
    chartData = result.ohlcv;
    meta = result.meta;
    console.log("DEBUG: Price & Chart data success, meta exists:", !!meta);
    step('Price data loaded ✓', 'done');
  } catch (e) {
    console.error("DEBUG: Price & Chart data fetch FAILED:", e.message);
    throw new Error(`Failed to fetch chart data for ${symbol}: ${e.message}`);
  }

  // 2. Fundamentals & Company Info
  step('Loading fundamental data...');
  let fundamentals = null;
  let summary = null;
  try {
    console.log("DEBUG: Fetching fundamentals for:", symbol);
    summary = await fetchQuoteSummary(symbol);
    fundamentals = extractFundamentals(summary);
    console.log("DEBUG: Fundamentals extracted successfully");
    step('Fundamentals loaded ✓', 'done');
  } catch (e) {
    console.warn('DEBUG: Yahoo fundamentals failed, trying fallback:', e.message);
    fundamentals = await fetchFundamentalsWithFallback(symbol);
    console.log("DEBUG: Fallback fundamentals success:", !!fundamentals);
    step('Fundamentals loaded (fallback) ✓', 'done');
  }

  // 3. Calculate indicators client-side
  step('Calculating technical indicators...');
  console.log("DEBUG: Starting technical calculations");
  const closes = chartData.map(d => d.close);
  const highs = chartData.map(d => d.high);
  const lows = chartData.map(d => d.low);
  const volumes = chartData.map(d => d.volume);
  const opens = chartData.map(d => d.open);

  const indicators = {
    ema5: calcEMA(closes, 5),
    ema20: calcEMA(closes, 20),
    ema50: calcEMA(closes, 50),
    ema200: calcEMA(closes, 200),
    rsi14: calcRSI(closes, 14),
    rsi9: calcRSI(closes, 9),
    macd: calcMACD(closes, 12, 26, 9),
    atr14: calcATR(highs, lows, closes, 14),
    vwap: calcVWAP(highs, lows, closes, volumes),
    adx: calcADX(highs, lows, closes, 14),
    avgVol20: avgVolume(volumes, 20),
    sr: findSupportResistance(highs, lows, closes, 20),
  };
  console.log("DEBUG: Indicators calculated");

  const { support, resistance } = indicators.sr;
  const crossSignal = detectCross(indicators.ema50, indicators.ema200);
  const trend = detectTrend(closes, indicators.ema50, indicators.ema200);
  const breakout = detectBreakout(closes, highs, lows, 20);

  step('Indicators computed ✓', 'done');

  // 4. Nifty correlation
  step('Fetching Nifty 50 data...');
  console.log("DEBUG: Fetching Nifty 50 data...");
  const niftyData = await fetchNiftyData();
  console.log("DEBUG: Nifty data success:", !!niftyData);

  // 5. News & Sentiment
  step('Fetching market news & sentiment...');
  const companyName = summary?.price?.longName || 
                      summary?.summaryProfile?.longBusinessSummary?.split(' ')[0] || 
                      meta?.symbol || 
                      symbol;
  console.log("DEBUG: Fetching news for name:", companyName);
  const newsArticles = await fetchNews(companyName, symbol);
  console.log("DEBUG: News fetch success, count:", newsArticles.length);
  step('News loaded ✓', 'done');

  // 6. Build processed data object
  console.log("DEBUG: Assembling final data object");
  const currentPrice = summary.price.price || closes[closes.length - 1];
  const dayChange = summary.price.change || 0;
  const dayChangePct = (summary.price.changesPercentage || 0) / 100;
  const prevClose = currentPrice - dayChange;

  const weekAgoClose = closes.length > 5 ? closes[closes.length - 6] : prevClose;
  const weekChange = currentPrice - weekAgoClose;
  const weekChangePct = weekAgoClose ? weekChange / weekAgoClose : 0;

  const lastATR = indicators.atr14.filter(v => v !== null).slice(-1)[0] || 0;

  const finalData = {
    symbol,
    ticker: symbol.replace('.NS', '').replace('.BO', ''),
    companyName: summary.profile.companyName || summary.price.name || symbol,
    sector: summary.profile.sector || 'India',
    exchange: summary.profile.exchangeShortName || (symbol.endsWith('.NS') ? 'NSE' : 'BSE'),

    price: {
      current: currentPrice,
      prev: prevClose,
      dayChange,
      dayChangePct,
      weekChange,
      weekChangePct,
    },

    ohlcv: {
      daily: chartData,
      weekly: resampleToWeekly(chartData),
      monthly: resampleToMonthly(chartData),
    },

    indicators: {
      ...indicators,
      lastATR,
      support,
      resistance,
      crossSignal,
      trend,
      breakout,
    },

    fundamentals,
    news: newsArticles,
    nifty: niftyData,
    meta,
  };
  console.log("DEBUG: loadAllData complete");
  return finalData;
}

// ─── Extract and normalize fundamentals from FMP ───
function extractFundamentals(summary) {
  if (!summary) return {};

  const q = summary.price || {};
  const p = summary.profile || {};
  const r = summary.ratios || {};
  const g = summary.growth || {};

  return {
    marketCap: q.marketCap || p.mktCap || null,
    pe: r.priceEarningsRatioTTM || null,
    forwardPE: null, 
    eps: r.netIncomePerShareTTM || null,
    revenueGrowth: g.revenueGrowth || null,
    earningsGrowth: g.epsgrowth || null,
    roe: r.returnOnEquityTTM || null,
    roa: r.returnOnAssetsTTM || null,
    debtToEquity: r.debtToEquityTTM || null,
    freeCashFlow: r.freeCashFlowPerShareTTM ? r.freeCashFlowPerShareTTM * (q.marketCap / q.price) : null,
    operatingCashFlow: null,
    grossMargins: r.grossProfitMarginTTM || null,
    operatingMargins: r.operatingProfitMarginTTM || null,
    profitMargins: r.netProfitMarginTTM || null,
    revenue: q.revenue || null,
    currentRatio: r.currentRatioTTM || null,
    quickRatio: r.quickRatioTTM || null,
    priceToBook: r.priceToBookRatioTTM || null,
    beta: p.beta || null,
    dividendYield: r.dividendYieldTTM || null,
    promoterHolding: null,
    institutionalHolding: null,
    enterpriseValue: null,
    pegRatio: r.pegRatioTTM || null,
  };
}
