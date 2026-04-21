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

// Get stock universe (with cache)
async function getStockUniverse() {
  // Try cache first
  const cached = localStorage.getItem(STOCK_LIST_CACHE_KEY);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.time < STOCK_LIST_CACHE_TTL) {
      return parsed.data;
    }
  }
  // Try NSE ALL API
  let stocks = [];
  const nseData = await fetchNSEStockUniverse();
  if (nseData) {
    stocks = parseNSEStockUniverse(nseData);
  } else {
    // Fallback: CSV
    const csv = await fetchNSEStockCSV();
    if (csv) stocks = parseNSEStockCSV(csv);
  }
  // Format: ["TCS.NS", ...]
  const tickers = stocks.map(s => s.symbol + '.NS');
  // Cache
  localStorage.setItem(STOCK_LIST_CACHE_KEY, JSON.stringify({ data: tickers, time: Date.now() }));
  return tickers;
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
const ALPHA_VANTAGE_KEY = 'demo'; // TODO: Replace with your real key

// ─── In-memory cache for fundamentals ───
const fundamentalsCache = {};

// ─── Unified Normalization ───
function normalizeFundamentals(source, data) {
  if (source === 'yahoo') {
    return {
      market_cap: data.summaryDetail?.marketCap?.raw ?? null,
      pe_ratio: data.summaryDetail?.trailingPE?.raw ?? null,
      eps: data.defaultKeyStatistics?.trailingEps?.raw ?? null,
      revenue_growth: data.financialData?.revenueGrowth?.raw ?? null,
      roe: data.financialData?.returnOnEquity?.raw ?? null,
      debt_to_equity: data.financialData?.debtToEquity?.raw ?? null,
      free_cash_flow: data.financialData?.freeCashflow?.raw ?? null,
    };
  }
  if (source === 'alpha') {
    return {
      market_cap: Number(data.MarketCapitalization) || null,
      pe_ratio: Number(data.PERatio) || null,
      eps: Number(data.EPS) || null,
      revenue_growth: Number(data.RevenueTTM) || null,
      roe: Number(data.ReturnOnEquityTTM) || null,
      debt_to_equity: Number(data.DebtToEquity) || null,
      free_cash_flow: null, // Not available
    };
  }
  return {};
}

// ─── Alpha Vantage Fallback Fetch ───
async function fetchAlphaVantageOverview(symbol) {
  const ticker = symbol.replace('.NS', '');
  const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${ALPHA_VANTAGE_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('RAW API (Alpha):', data);
    if (data.Note || Object.keys(data).length === 0) throw new Error('Alpha Vantage limit or error');
    return data;
  } catch (e) {
    console.warn('Alpha Vantage failed:', e.message);
    return null;
  }
}

// ─── Caching Layer ───
function getCachedFundamentals(symbol) {
  const cached = fundamentalsCache[symbol];
  if (cached && Date.now() - cached.time < 5 * 60 * 1000) {
    return cached.data;
  }
  return null;
}

function setCachedFundamentals(symbol, data) {
  fundamentalsCache[symbol] = { data, time: Date.now() };
}

// ─── Robust Fundamentals Fetch with Fallback ───
async function fetchFundamentalsWithFallback(symbol) {
  // Check cache first
  let cached = getCachedFundamentals(symbol);
  if (cached) {
    console.log('CACHE HIT:', symbol, cached);
    return cached;
  }
  // Try Yahoo
  try {
    const yahooRaw = await fetchQuoteSummary(symbol);
    console.log('RAW API (Yahoo):', yahooRaw);
    const yahooNorm = normalizeFundamentals('yahoo', yahooRaw);
    console.log('PARSED (Yahoo):', yahooNorm);
    // If at least 4 fields are non-null, accept Yahoo
    if (Object.values(yahooNorm).filter(v => v != null).length >= 4) {
      setCachedFundamentals(symbol, yahooNorm);
      return yahooNorm;
    }
    console.warn('Yahoo data insufficient, trying fallback...');
  } catch (e) {
    console.warn('Yahoo failed:', e.message);
  }
  // Try Alpha Vantage
  try {
    const alphaRaw = await fetchAlphaVantageOverview(symbol);
    const alphaNorm = normalizeFundamentals('alpha', alphaRaw);
    console.log('PARSED (Alpha):', alphaNorm);
    setCachedFundamentals(symbol, alphaNorm);
    return alphaNorm;
  } catch (e) {
    console.error('Fallback failed:', e.message);
  }
  return null;
}
/* ═══════════════════════════════════════════════
   api.js — Data Fetching Layer
   Yahoo Finance (via CORS proxy) + News APIs
   ═══════════════════════════════════════════════ */

'use strict';

const API_CONFIG = {
  NEWSDATA_KEY: 'pub_051b50e271e3404bbec9bafa0ca0ad1a',
  GNEWS_KEY: '86366569c46b98b1cd1fa8828fc22c09',
  YF_BASE_1: 'https://query1.finance.yahoo.com',
  YF_BASE_2: 'https://query2.finance.yahoo.com',
  PROXY_1: 'https://api.allorigins.win/raw?url=',
  PROXY_2: 'https://corsproxy.io/?',
};

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

// ─── Fetch OHLCV chart data ───
async function fetchChartData(symbol, interval = '1d', range = '1y') {
  const url = `${API_CONFIG.YF_BASE_2}/v8/finance/chart/${symbol}?interval=${interval}&range=${range}&includePrePost=false&events=div%2Csplit`;
  const data = await fetchWithProxy(url);

  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('No chart data returned');

  const meta = result.meta;
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];
  const adjCloses = result.indicators?.adjclose?.[0]?.adjclose || closes;

  // Build OHLCV array, filter out null candles
  const ohlcv = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] === null || closes[i] === undefined) continue;
    ohlcv.push({
      time: tsToDateStr(timestamps[i]),
      open: opens[i] ?? closes[i],
      high: highs[i] ?? closes[i],
      low: lows[i] ?? closes[i],
      close: closes[i],
      volume: volumes[i] ?? 0,
    });
  }

  return { ohlcv, meta };
}

// ─── Fetch quote summary (fundamentals) ───
async function fetchQuoteSummary(symbol) {
  const modules = [
    'price',
    'summaryDetail',
    'financialData',
    'defaultKeyStatistics',
    'summaryProfile',
    'earningsTrend',
    'incomeStatementHistory',
    'balanceSheetHistory',
    'cashflowStatementHistory',
  ].join(',');

  const url = `${API_CONFIG.YF_BASE_2}/v10/finance/quoteSummary/${symbol}?modules=${modules}`;
  const data = await fetchWithProxy(url);

  const result = data?.quoteSummary?.result?.[0];
  if (!result) throw new Error('No quote summary returned');
  return result;
}

// ─── Fetch Nifty 50 data ───
async function fetchNiftyData() {
  try {
    const url = `${API_CONFIG.YF_BASE_2}/v8/finance/chart/%5ENSEI?interval=1d&range=5d`;
    const data = await fetchWithProxy(url);
    const r = data?.chart?.result?.[0];
    if (!r) return null;
    const meta = r.meta;
    const closes = r.indicators?.quote?.[0]?.close || [];
    const validCloses = closes.filter(Boolean);
    const len = validCloses.length;
    const curr = meta.regularMarketPrice || validCloses[len - 1];
    const prev = meta.chartPreviousClose || validCloses[len - 2] || curr;
    const chg = curr - prev;
    const chgPct = prev !== 0 ? (chg / prev) : 0;
    return { price: curr, change: chg, changePercent: chgPct };
  } catch (e) {
    console.warn('Nifty fetch failed:', e.message);
    return null;
  }
}

// ─── Fetch News from newsdata.io ───
async function fetchNewsDataIO(query) {
  try {
    const url = `https://newsdata.io/api/1/news?apikey=${API_CONFIG.NEWSDATA_KEY}&q=${encodeURIComponent(query)}&language=en&category=business,technology`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`newsdata.io HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'success' || !Array.isArray(data.results)) throw new Error('Bad newsdata response');
    return data.results.map(item => ({
      title: item.title || '',
      description: item.description || '',
      url: item.link || '#',
      publishedAt: item.pubDate || new Date().toISOString(),
      source: item.source_name || 'newsdata.io',
    })).slice(0, 12);
  } catch (e) {
    console.warn('newsdata.io failed:', e.message);
    return null;
  }
}

// ─── Fetch News from gnews.io ───
async function fetchGNews(query) {
  try {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=10&token=${API_CONFIG.GNEWS_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`gnews HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.articles)) throw new Error('Bad gnews response');
    return data.articles.map(item => ({
      title: item.title || '',
      description: item.description || '',
      url: item.url || '#',
      publishedAt: item.publishedAt || new Date().toISOString(),
      source: item.source?.name || 'gnews.io',
    }));
  } catch (e) {
    console.warn('gnews.io failed:', e.message);
    return null;
  }
}

// ─── Combined News fetch with fallback ───
async function fetchNews(companyName, symbol) {
  const query = companyName ? `${companyName} stock India` : `${symbol.replace('.NS', '')} NSE share`;

  let articles = await fetchNewsDataIO(query);
  if (!articles || articles.length === 0) {
    articles = await fetchGNews(query);
  }
  if (!articles || articles.length === 0) {
    // Generic fallback
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
  const symbol = normalizeSymbol(ticker);

  const step = (msg, status = 'loading') => {
    if (onStep) onStep(msg, status);
  };

  // 1. Price & Chart data
  step('Fetching price & chart data (1Y)...');
  let chartData, meta;
  try {
    const result = await fetchChartData(symbol, '1d', '1y');
    chartData = result.ohlcv;
    meta = result.meta;
    step('Price data loaded ✓', 'done');
  } catch (e) {
    throw new Error(`Failed to fetch chart data for ${symbol}: ${e.message}`);
  }

  // 2. Fundamentals & Company Info
  step('Loading fundamental data...');
  let fundamentals = null;
  let summary = null;
  try {
    // Try to get raw summary for both fundamentals and extra metadata (company name, sector)
    summary = await fetchQuoteSummary(symbol);
    fundamentals = extractFundamentals(summary);
    step('Fundamentals loaded ✓', 'done');
  } catch (e) {
    console.warn('Yahoo fundamentals failed, trying fallback:', e.message);
    // Fallback to Alpha Vantage or other sources via existing logic
    fundamentals = await fetchFundamentalsWithFallback(symbol);
    step('Fundamentals loaded (fallback) ✓', 'done');
  }

  // 3. Calculate indicators client-side
  step('Calculating technical indicators...');
  const closes = chartData.map(d => d.close);
  const highs = chartData.map(d => d.high);
  const lows = chartData.map(d => d.low);
  const volumes = chartData.map(d => d.volume);
  const opens = chartData.map(d => d.open);

  // Technical Indicator Hub (Optimized per Graphify insights)
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

  // Support/Resistance destructured for main object
  const { support, resistance } = indicators.sr;
  const crossSignal = detectCross(indicators.ema50, indicators.ema200);
  const trend = detectTrend(closes, indicators.ema50, indicators.ema200);
  const breakout = detectBreakout(closes, highs, lows, 20);

  step('Indicators computed ✓', 'done');

  // 4. Nifty correlation
  step('Fetching Nifty 50 data...');
  const niftyData = await fetchNiftyData();

  // 5. News & Sentiment
  step('Fetching market news & sentiment...');
  // Fixed ReferenceError: companyName derived from summary (if available) or meta
  const companyName = summary?.price?.longName || 
                      summary?.summaryProfile?.longBusinessSummary?.split(' ')[0] || 
                      meta?.symbol || 
                      symbol;
  const newsArticles = await fetchNews(companyName, symbol);
  step('News loaded ✓', 'done');

  // 6. Build processed data object
  const currentPrice = meta.regularMarketPrice || closes[closes.length - 1];
  const prevClose = meta.regularMarketPreviousClose || closes[closes.length - 2];
  const dayChange = currentPrice - prevClose;
  const dayChangePct = prevClose ? dayChange / prevClose : 0;

  // Weekly change
  const weekAgoClose = closes.length > 5 ? closes[closes.length - 6] : prevClose;
  const weekChange = currentPrice - weekAgoClose;
  const weekChangePct = weekAgoClose ? weekChange / weekAgoClose : 0;

  // Last ATR
  const lastATR = indicators.atr14.filter(v => v !== null).slice(-1)[0] || 0;

  return {
    symbol,
    ticker: symbol.replace('.NS', '').replace('.BO', ''),
    companyName: companyName,
    sector: summary?.summaryProfile?.sector || 'India',
    exchange: symbol.endsWith('.NS') ? 'NSE' : 'BSE',

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

}

// ─── Extract and normalize fundamentals ───
function extractFundamentals(summary) {
  if (!summary) return {};

  const g = (obj, key) => obj?.[key]?.raw ?? null;

  const financialData = summary.financialData || {};
  const statsData = summary.defaultKeyStatistics || {};
  const summaryDetail = summary.summaryDetail || {};
  const price = summary.price || {};

  return {
    marketCap: g(price, 'marketCap') || g(summaryDetail, 'marketCap'),
    pe: g(summaryDetail, 'trailingPE') || g(statsData, 'trailingPE'),
    forwardPE: g(summaryDetail, 'forwardPE'),
    eps: g(statsData, 'trailingEps'),
    revenueGrowth: g(financialData, 'revenueGrowth'),
    earningsGrowth: g(financialData, 'earningsGrowth'),
    roe: g(financialData, 'returnOnEquity'),
    roa: g(financialData, 'returnOnAssets'),
    debtToEquity: financialData?.debtToEquity?.raw != null
      ? financialData.debtToEquity.raw / 100  // YF reports as percentage
      : null,
    freeCashFlow: g(financialData, 'freeCashflow'),
    operatingCashFlow: g(financialData, 'operatingCashflow'),
    grossMargins: g(financialData, 'grossMargins'),
    operatingMargins: g(financialData, 'operatingMargins'),
    profitMargins: g(financialData, 'profitMargins'),
    revenue: g(financialData, 'totalRevenue'),
    currentRatio: g(financialData, 'currentRatio'),
    quickRatio: g(financialData, 'quickRatio'),
    priceToBook: g(statsData, 'priceToBook'),
    beta: g(summaryDetail, 'beta'),
    dividendYield: g(summaryDetail, 'dividendYield'),
    promoterHolding: g(statsData, 'heldPercentInsiders'),
    institutionalHolding: g(statsData, 'heldPercentInstitutions'),
    shortRatio: g(statsData, 'shortRatio'),
    enterpriseValue: g(statsData, 'enterpriseValue'),
    pegRatio: g(statsData, 'pegRatio'),
  };
}
