console.log("🚀 StockPulse AI: app.js loaded successfully");

// ─── Global Error Logger ───
window.onerror = function(msg, url, line, col, error) {
  const logMsg = `[ERROR] ${msg} at ${url}:${line}:${col}`;
  console.error(logMsg, error);
  const debugEl = document.getElementById('debug-last-error');
  if (debugEl) debugEl.textContent = logMsg;
  return false;
};

window.onunhandledrejection = function(event) {
  console.error('[PROMISE REJECTION]', event.reason);
  const debugEl = document.getElementById('debug-last-error');
  if (debugEl) debugEl.textContent = `[PROMISE] ${event.reason}`;
};

// ─── Debug Toggle Button ───
document.addEventListener('DOMContentLoaded', () => {
  const debugBtn = document.createElement('button');
  debugBtn.textContent = 'Show Raw Data';
  debugBtn.style = 'position:absolute;top:10px;right:10px;z-index:1000;padding:4px 12px;background:#222;color:#fff;border:none;border-radius:4px;cursor:pointer;';
  debugBtn.onclick = () => {
    if (typeof toggleRawFundamentals === 'function') toggleRawFundamentals();
    debugBtn.textContent = debugBtn.textContent === 'Show Raw Data' ? 'Hide Raw Data' : 'Show Raw Data';
  };
  document.body.appendChild(debugBtn);
  const rawDiv = document.createElement('div');
  rawDiv.id = 'raw-fundamentals';
  rawDiv.style = 'position:absolute;top:50px;right:10px;z-index:1000;max-width:400px;';
  document.body.appendChild(rawDiv);

  // Step 9: Diagnostic Debug Overlay
  const debugOverlay = document.createElement('div');
  debugOverlay.id = 'diagnostic-debug';
  debugOverlay.style = 'position:fixed;bottom:10px;right:10px;z-index:9999;padding:12px;background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:10px;border:1px solid #0f0;border-radius:8px;pointer-events:none;';
  debugOverlay.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px;border-bottom:1px solid #0f0">🔍 AGENT DIAGNOSTICS</div>
    <div>Ticker: <span id="debug-ticker">None</span></div>
    <div>Source: <span id="debug-source" style="color:#ff0">UNKNOWN</span></div>
    <div>Loading: <span id="debug-loading">false</span></div>
    <div>App State: <span id="debug-state">IDLE</span></div>
    <div style="margin-top:4px;color:#f00;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">Err: <span id="debug-last-error">None</span></div>
  `;
  document.body.appendChild(debugOverlay);
  
  // Simulation Warning Banner
  const simBanner = document.createElement('div');
  simBanner.id = 'simulation-banner';
  simBanner.className = 'hidden';
  simBanner.style = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:999;padding:6px 20px;background:rgba(255,165,0,0.9);color:#000;font-weight:bold;font-size:12px;border-radius:20px;box-shadow:0 4px 15px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px;transition:all 0.3s ease;';
  simBanner.innerHTML = '⚠️ AUTONOMOUS SIMULATION MODE (External APIs Restricted)';
  document.body.appendChild(simBanner);
});
/* ═══════════════════════════════════════════════
   app.js — Main Application Orchestrator
   Ticker Search · Theme Toggle · Module Dispatch
   Auto-refresh · Smart Insight Generator
   ═══════════════════════════════════════════════ */

'use strict';

// ─── Global App State ───
window.AppState = {
  symbol: null,
  strategyMode: 'swing',
  theme: 'dark',
  data: null,
  refreshInterval: null,
  refreshCountdown: null,
  refreshSecs: 60,
};

// ─── Stock Universe (dynamic, top 100 for initial suggestions) ───
let STOCK_UNIVERSE = [];
let TOP_TICKERS = [];
let stockUniverseLoaded = false;

async function loadStockUniverse() {
  if (stockUniverseLoaded) return;
  STOCK_UNIVERSE = await getStockUniverse();
  TOP_TICKERS = STOCK_UNIVERSE.slice(0, 100).map(t => t.replace('.NS', ''));
  stockUniverseLoaded = true;
}

// ────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  console.log("DEBUG: DOMContentLoaded fired");
  initTheme();
  initStrategyToggle();
  initSearch();
  initQuickTickers();
  initTabNavigation();
});

// ─── Theme ───
function initTheme() {
  const saved = localStorage.getItem('sp_theme') || 'dark';
  applyTheme(saved);

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const newTheme = AppState.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('sp_theme', newTheme);
    // Refresh charts for new theme
    if (AppState.data) {
      setTimeout(() => refreshChartThemes(AppState.data), 50);
    }
  });
}

function applyTheme(theme) {
  AppState.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const moonIcon = document.querySelector('.moon-icon');
  const sunIcon = document.querySelector('.sun-icon');
  if (theme === 'light') {
    moonIcon?.classList.add('hidden');
    sunIcon?.classList.remove('hidden');
  } else {
    moonIcon?.classList.remove('hidden');
    sunIcon?.classList.add('hidden');
  }
}

// ─── Strategy Toggle ───
function initStrategyToggle() {
  document.querySelectorAll('.strategy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.strategy-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.strategyMode = btn.dataset.mode;
      // If strategy tab is active, re-render it
      if (AppState.data) {
        const stratTab = document.getElementById('tab-strategy');
        if (stratTab && !stratTab.classList.contains('hidden')) {
          renderStrategy(AppState.data);
        }
      }
    });
  });
}

// ─── Search ───
function initSearch() {
  const input = document.getElementById('ticker-input');
  const btn = document.getElementById('analyze-btn');
  const suggestions = document.getElementById('search-suggestions');

  // Debounced input for search suggestions
  let debounceTimer = null;
  input.addEventListener('input', async () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      await loadStockUniverse();
      const q = input.value.trim().toUpperCase();
      if (q.length < 1) { suggestions.classList.add('hidden'); return; }
      const matches = STOCK_UNIVERSE.filter(t => t.startsWith(q)).slice(0, 10).map(t => t.replace('.NS', ''));
      if (matches.length === 0) { suggestions.classList.add('hidden'); return; }
      suggestions.innerHTML = matches.map(t => `
        <div class="suggestion-item" style="padding:10px 14px;cursor:pointer;font-size:13px;font-weight:600;border-bottom:1px solid var(--border);font-family:var(--font-mono);transition:background 0.15s"
          onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'"
          onclick="selectTicker('${t}')">
          ${t}<span style="font-size:11px;color:var(--text-muted);font-weight:400;margin-left:8px">NSE</span>
        </div>
      `).join('');
      suggestions.classList.remove('hidden');
    }, 200);
  });

  // Enter key
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { suggestions.classList.add('hidden'); analyzeStock(); }
    if (e.key === 'Escape') suggestions.classList.add('hidden');
  });

  // Analyze button
  console.log("DEBUG: Binding click event to #analyze-btn");
  btn.addEventListener('click', () => { 
    console.log("DEBUG: Analyze button clicked");
    suggestions.classList.add('hidden'); 
    analyzeStock(); 
  });

  // Close suggestions on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-container')) suggestions.classList.add('hidden');
  });
}

window.selectTicker = function (ticker) {
  document.getElementById('ticker-input').value = ticker;
  document.getElementById('search-suggestions').classList.add('hidden');
  analyzeStock();
};

function initQuickTickers() {
  // Show top 100 tickers as quick buttons
  (async () => {
    await loadStockUniverse();
    const quickContainer = document.getElementById('quick-tickers');
    if (!quickContainer) return;
    quickContainer.innerHTML = TOP_TICKERS.map(t => `<button class="quick-ticker" data-ticker="${t}">${t}</button>`).join(' ');
    quickContainer.querySelectorAll('.quick-ticker').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('ticker-input').value = btn.dataset.ticker;
        analyzeStock();
      });
    });
  })();
}

// ─── Tab Navigation ───
function initTabNavigation() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!AppState.data) return;
      switchTab(btn.dataset.tab);
    });
  });
}

function switchTab(tabName) {
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });

  // Update content sections
  document.querySelectorAll('.tab-content').forEach(section => {
    const isActive = section.id === `tab-${tabName}`;
    section.classList.toggle('hidden', !isActive);
    section.classList.toggle('active', isActive);
  });
}

// ────────────────────────────────────────────────
// MAIN ANALYSIS FLOW
// ────────────────────────────────────────────────
async function analyzeStock() {
  console.log("DEBUG: analyzeStock entry");
  const ticker = document.getElementById('ticker-input').value.trim();
  console.log("DEBUG: Ticker read:", ticker);
  document.getElementById('debug-ticker').textContent = ticker || 'None';
  document.getElementById('debug-state').textContent = 'INITIALIZING';
  
  if (!ticker) { 
    console.log("DEBUG: Empty ticker, shaking input");
    shakeInput(); 
    return; 
  }

  // ─── IMMEDIATE FEEDBACK ───
  console.log("DEBUG: Ticker found. Showing loading immediately.");
  showLoading(true);
  document.getElementById('debug-loading').textContent = 'true';
  document.getElementById('debug-state').textContent = 'LOADING_UNIVERSE';
  setLoadingStatus('Initializing analysis engine...');
  clearRefreshTimer();

  try {
    // Reset steps
    stepDone('step-price', false);
    stepDone('step-fundamentals', false);
    stepDone('step-indicators', false);
    stepDone('step-news', false);

    const onStep = (msg, status) => {
      console.log(`DEBUG: Analysis Step: ${msg} (${status || 'progress'})`);
      setLoadingStatus(msg);
      if (status === 'done') {
        if (msg.includes('price') || msg.includes('chart')) stepDone('step-price');
        else if (msg.includes('amental')) stepDone('step-fundamentals');
        else if (msg.includes('ndicator')) stepDone('step-indicators');
        else if (msg.includes('ews') || msg.includes('news')) stepDone('step-news');
      }
    };

    // Load universe with error handling
    console.log("DEBUG: Loading stock universe...");
    setLoadingStatus('Verifying ticker in Indian universe...');
    try {
      await loadStockUniverse();
    } catch (uErr) {
      console.warn("DEBUG: Stock universe fetch failed, using fallback:", uErr.message);
      // Fallback is handled within loadStockUniverse if it was properly written, 
      // but let's ensure we proceed if it fails.
    }
    
    const symbolNS = ticker + '.NS';
    const symbolBSE = ticker + '.BSE';
    const exists = STOCK_UNIVERSE && (STOCK_UNIVERSE.includes(symbolNS) || STOCK_UNIVERSE.includes(symbolBSE));

    if (!exists) {
      console.warn("DEBUG: Ticker not found in universe list:", ticker);
      setLoadingStatus(`Ticker ${ticker} not in central list, trying direct fetch...`);
    }

    console.log("DEBUG: Calling loadAllData...");
    document.getElementById('debug-state').textContent = 'FETCHING_DATA';
    const data = await loadAllData(ticker, onStep);
    
    console.log("DEBUG: loadAllData returned successful data for:", data.symbol);
    document.getElementById('debug-source').textContent = window._activeSource || 'FMP';
    document.getElementById('debug-state').textContent = 'DATA_READY';
    
    // Toggle simulation banner
    const simBanner = document.getElementById('simulation-banner');
    if (window._activeSource && window._activeSource.includes('Simulation')) {
      simBanner.classList.remove('hidden');
    } else {
      simBanner.classList.add('hidden');
    }
    
    AppState.data = data;
    AppState.symbol = data.symbol;

    // All steps done
    ['step-price', 'step-fundamentals', 'step-indicators', 'step-news'].forEach(stepDone);

    console.log("DEBUG: Hiding loading and showing dashboard");
    showLoading(false);
    document.getElementById('debug-loading').textContent = 'false';
    document.getElementById('debug-state').textContent = 'COMPLETE';
    showDashboard();
    renderAll(data);
    startRefreshTimer(ticker);
    console.log('DEBUG: Analysis Finished:', data);

  } catch (err) {
    console.error("DEBUG: Analysis Flow FAILED:", err);
    showLoading(false);
    document.getElementById('debug-loading').textContent = 'false';
    document.getElementById('debug-state').textContent = 'ERROR';
    document.getElementById('debug-last-error').textContent = err.message;
    showError(err.message);
  }
}

// ─── Render All Modules ───
function renderAll(data) {
  try { renderSummaryCard(data); } catch (e) { console.error('Summary card error:', e); }
  try { renderFundamentals(data); } catch (e) { console.error('Fundamentals error:', e); }
  try { renderTechnical(data); } catch (e) { console.error('Technical error:', e); }
  try { renderPrediction(data); } catch (e) { console.error('Prediction error:', e); }
  try { renderNews(data); } catch (e) { console.error('News error:', e); }
  try { renderScoring(data); } catch (e) { console.error('Scoring error:', e); }
  try { renderBacktest(data); } catch (e) { console.error('Backtest error:', e); }
  try { renderStrategy(data); } catch (e) { console.error('Strategy error:', e); }
  console.log('PROPS:', data);
}

// ─── Summary Card ───
function renderSummaryCard(data) {
  const { companyName, ticker, sector, exchange, price, fundamentals: f } = data;

  document.getElementById('stock-full-name').textContent = companyName || ticker;
  document.getElementById('stock-ticker-badge').textContent = ticker;
  document.getElementById('stock-sector-tag').textContent = sector !== 'N/A' ? sector : 'India';
  document.getElementById('stock-exchange-tag').textContent = exchange;
  document.getElementById('market-cap-summary').textContent = `MCap: ${fmtINR(f?.marketCap)}`;

  // Price
  const priceEl = document.getElementById('live-price');
  priceEl.textContent = fmtPrice(price.current);

  // Day change
  const dayEl = document.getElementById('price-change-day');
  dayEl.textContent = `Day: ${price.dayChange >= 0 ? '+' : ''}${price.dayChange.toFixed(2)} (${(price.dayChangePct * 100).toFixed(2)}%)`;
  dayEl.className = `change-chip day-change ${price.dayChange >= 0 ? 'positive' : 'negative'}`;

  // Week change
  const weekEl = document.getElementById('price-change-week');
  weekEl.textContent = `Week: ${price.weekChange >= 0 ? '+' : ''}${(price.weekChangePct * 100).toFixed(2)}%`;
  weekEl.className = `change-chip week-change ${price.weekChange >= 0 ? 'positive' : 'negative'}`;

  // Smart Insight (generated after scoring)
  setTimeout(() => renderSmartInsight(data), 800);
}

// ─── Smart Insight Generator ───
function renderSmartInsight(data) {
  const { indicators, price, fundamentals: f, news } = data;
  const sentiments = (news || []).map(a => classifyNewsSentiment(a.title, a.description));
  const posRatio = sentiments.length > 0
    ? sentiments.filter(s => s === 'positive').length / sentiments.length
    : 0.5;

  const rsiArr = indicators.rsi14.filter(Boolean);
  const lastRSI = rsiArr[rsiArr.length - 1] ?? 50;
  const trend = indicators.trend;
  const crossSignal = indicators.crossSignal;
  const lastVol = data.ohlcv.daily[data.ohlcv.daily.length - 1]?.volume ?? 0;
  const avgVol = indicators.avgVol20;
  const volSpike = lastVol > avgVol * 1.3;

  let insights = [];

  // Trend insight
  if (trend === 'bullish' && crossSignal === 'golden') {
    insights.push(`A Golden Cross has formed — 50 EMA crossed above 200 EMA. A professional trader would consider this a high-probability entry zone and size up positions with a trail stop below the 50 EMA.`);
  } else if (trend === 'bullish') {
    insights.push(`The stock is in an uptrend with price above both EMAs. A pro trader would look to buy pullbacks to the 50 EMA rather than chasing the rally at current levels.`);
  } else if (crossSignal === 'death') {
    insights.push(`A Death Cross has formed — 50 EMA crossed below 200 EMA. This is a significant bearish signal. A professional trader would exit or hedge long positions and wait for a confirmed reversal before re-entering.`);
  } else if (trend === 'bearish') {
    insights.push(`The stock is in a clear downtrend. A professional trader avoids bottom-fishing here and instead waits for a reclaim of the 50 EMA on strong volume before considering any long position.`);
  } else {
    insights.push(`The stock is in a sideways consolidation phase. A professional trader prefers to wait for a confirmed breakout above resistance with 1.5x+ average volume before committing capital.`);
  }

  // RSI insight
  if (lastRSI > 70) {
    insights.push(`RSI at ${lastRSI.toFixed(0)} is overbought — a professional would take partial profits or tighten stop-losses rather than add to the position at these levels.`);
  } else if (lastRSI < 30) {
    insights.push(`RSI at ${lastRSI.toFixed(0)} is oversold. If the broader market is stable and fundamentals are intact, a seasoned trader would view this as a potential mean-reversion opportunity with a tight stop.`);
  } else if (lastRSI >= 50 && lastRSI <= 65) {
    insights.push(`RSI at ${lastRSI.toFixed(0)} is in the ideal bull zone. Momentum is healthy without being stretched — professional traders favor this zone for swing trade entries.`);
  }

  // Volume / News insight
  if (volSpike && posRatio > 0.6) {
    insights.push(`Volume is spiking alongside positive news — this is a classic institutional accumulation signal. A pro trader tracks this closely for continuation potential.`);
  } else if (volSpike && posRatio <= 0.4) {
    insights.push(`Volume spike on negative news suggests distribution — smart money may be exiting. A professional trader treats this as a warning sign and reduces exposure.`);
  } else if (f?.debtToEquity > 2) {
    insights.push(`High debt-to-equity (${fmtFixed(f.debtToEquity, 2)}x) is a structural risk. A professional trader would avoid building a large position and focus on companies with cleaner balance sheets in the same sector.`);
  }

  // Keep most relevant 2–3 sentences
  const text = insights.slice(0, 3).join(' ');
  document.getElementById('smart-insight-text').textContent = text || 'Insufficient data to generate a smart insight for this ticker.';
}

// ────────────────────────────────────────────────
// AUTO-REFRESH (60s)
// ────────────────────────────────────────────────
function startRefreshTimer(ticker) {
  clearRefreshTimer();
  let secs = AppState.refreshSecs;

  const countdownEl = document.getElementById('refresh-countdown');
  AppState.refreshCountdown = setInterval(() => {
    secs--;
    if (countdownEl) countdownEl.textContent = secs;
    if (secs <= 0) {
      secs = AppState.refreshSecs;
      refreshPrice(ticker);
    }
  }, 1000);
}

function clearRefreshTimer() {
  if (AppState.refreshCountdown) clearInterval(AppState.refreshCountdown);
  if (AppState.refreshInterval) clearInterval(AppState.refreshInterval);
}

async function refreshPrice(ticker) {
  try {
    // Fetch just the price update
    const symbol = normalizeSymbol(ticker);
    const url = `${API_CONFIG.YF_BASE_2}/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const raw = await fetchWithProxy(url);
    const result = raw?.chart?.result?.[0];
    if (!result) return;

    const meta = result.meta;
    const newPrice = meta.regularMarketPrice;
    if (!newPrice || !AppState.data) return;

    const oldPrice = AppState.data.price.current;
    const prevClose = AppState.data.price.prev;
    const dayChange = newPrice - prevClose;
    const dayChangePct = prevClose ? dayChange / prevClose : 0;

    AppState.data.price.current = newPrice;
    AppState.data.price.dayChange = dayChange;
    AppState.data.price.dayChangePct = dayChangePct;

    // Update UI
    const priceEl = document.getElementById('live-price');
    if (priceEl) {
      priceEl.textContent = fmtPrice(newPrice);
      priceEl.className = `live-price ${newPrice > oldPrice ? 'flash-green' : newPrice < oldPrice ? 'flash-red' : ''}`;
      setTimeout(() => { if (priceEl) priceEl.className = 'live-price'; }, 600);
    }

    const dayEl = document.getElementById('price-change-day');
    if (dayEl) {
      dayEl.textContent = `Day: ${dayChange >= 0 ? '+' : ''}${dayChange.toFixed(2)} (${(dayChangePct * 100).toFixed(2)}%)`;
      dayEl.className = `change-chip day-change ${dayChange >= 0 ? 'positive' : 'negative'}`;
    }

    document.getElementById('pred-current-price').textContent = fmtPrice(newPrice);
  } catch (e) {
    console.warn('Price refresh failed:', e.message);
  }
}

// ────────────────────────────────────────────────
// UI HELPERS
// ────────────────────────────────────────────────
function showLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !show);
}

function setLoadingStatus(msg) {
  const el = document.getElementById('loading-status');
  if (el) el.textContent = msg;
}

function stepDone(id, done = true) {
  const el = document.getElementById(id);
  if (!el) return;
  if (done) {
    el.classList.add('done');
    el.style.color = 'var(--green)';
  } else {
    el.classList.remove('done');
    el.style.color = '';
  }
}

function showDashboard() {
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  // Reset to fundamentals tab
  switchTab('fundamentals');
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shakeInput() {
  const wrapper = document.getElementById('search-wrapper');
  wrapper.style.animation = 'shake 0.4s ease';
  setTimeout(() => { wrapper.style.animation = ''; }, 400);
}

function showError(msg) {
  // Show in empty state area
  const empty = document.getElementById('empty-state');
  const errDiv = document.createElement('div');
  errDiv.className = 'card';
  errDiv.style.cssText = 'max-width:500px;margin:20px auto;text-align:center;background:var(--red-dim);border-color:var(--red-border)';
  errDiv.innerHTML = `
    <div style="font-size:32px;margin-bottom:12px">⚠️</div>
    <h3 style="color:var(--red);margin-bottom:8px">Failed to Load Data</h3>
    <p style="color:var(--text-secondary);font-size:14px;line-height:1.5">${escapeHtml(msg)}</p>
    <p style="color:var(--text-muted);font-size:12px;margin-top:12px">Check the ticker symbol. Indian NSE stocks: RELIANCE, TCS, INFY etc.</p>
  `;
  // Remove any previous error
  const prev = document.getElementById('error-card');
  if (prev) prev.remove();
  errDiv.id = 'error-card';
  empty.classList.remove('hidden');
  empty.prepend(errDiv);
}

// ─── CSS shake animation (injected) ───
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);

// ─── classifyNewsSentiment available globally ───
// (defined in news.js, but called from app.js for smart insight)
// Fallback simple version if news.js not loaded yet
if (typeof window.classifyNewsSentiment === 'undefined') {
  window.classifyNewsSentiment = function (title, desc) {
    const text = (title + ' ' + (desc || '')).toLowerCase();
    const pos = ['profit', 'growth', 'beats', 'record', 'upgrade', 'strong', 'surge'].some(k => text.includes(k));
    const neg = ['loss', 'decline', 'fraud', 'penalty', 'probe', 'crisis', 'weak'].some(k => text.includes(k));
    return pos && !neg ? 'positive' : neg ? 'negative' : 'neutral';
  };
}

// ─── normalizeSymbol available globally ───
// (also defined in api.js — safe redundancy)
if (typeof window.normalizeSymbol === 'undefined') {
  window.normalizeSymbol = function (ticker) {
    const t = ticker.trim().toUpperCase();
    if (t.endsWith('.NS') || t.endsWith('.BO')) return t;
    return t + '.NS';
  };
}
