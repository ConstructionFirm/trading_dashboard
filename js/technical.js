/* ═══════════════════════════════════════════════
   technical.js — Module 2
   Candlestick Charts + Indicators (Lightweight Charts v4)
   EMA, RSI, MACD, Volume — Multi-Timeframe
   ═══════════════════════════════════════════════ */

'use strict';

let charts = {};
let currentTF = '1d';

function renderTechnical(data) {
  currentTF = '1d';
  renderIndicatorBadges(data);
  renderCharts(data, '1d');
  renderTechSummaryGrid(data);
  setupTimeframeTabs(data);
}

// ─── Badge/Header Interpretation ───
function renderIndicatorBadges(data) {
  const { trend, crossSignal, breakout } = data.indicators;

  // Trend badge
  const trendBadge = document.getElementById('trend-direction-badge');
  const trendLabels = {
    bullish: '📈 Bullish Trend',
    bearish: '📉 Bearish Trend',
    sideways: '↔ Sideways / Consolidating'
  };
  trendBadge.textContent = trendLabels[trend] || '--';
  trendBadge.className = `trend-badge ${trend}`;

  // Cross badge
  const crossBadge = document.getElementById('cross-signal-badge');
  const crossMap = {
    golden: { label: '⭐ Golden Cross', cls: 'golden' },
    death: { label: '💀 Death Cross', cls: 'death' },
    above: { label: '✅ Price above 200 EMA', cls: 'above' },
    below: { label: '❌ Price below 200 EMA', cls: 'below' },
    none: { label: 'EMA Analysis', cls: '' }
  };
  const cm = crossMap[crossSignal] || crossMap.none;
  crossBadge.textContent = cm.label;
  crossBadge.className = `cross-badge ${cm.cls}`;

  // Breakout badge
  const boEl = document.getElementById('breakout-badge');
  if (breakout === 'breakout') {
    boEl.textContent = '🚀 Breakout Signal';
    boEl.className = 'breakout-badge';
    boEl.classList.remove('hidden');
  } else if (breakout === 'breakdown') {
    boEl.textContent = '⚠️ Breakdown Signal';
    boEl.className = 'breakout-badge';
    boEl.style.background = 'var(--red-dim)';
    boEl.style.color = 'var(--red)';
    boEl.style.border = '1px solid var(--red-border)';
    boEl.classList.remove('hidden');
  } else {
    boEl.classList.add('hidden');
  }
}

// ─── Get chart theme options ───
function getChartOptions(height, container) {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const width = container ? (container.clientWidth || 800) : 800;
  return {
    width,
    height,
    layout: {
      background: { type: 'solid', color: isDark ? '#111827' : '#ffffff' },
      textColor: isDark ? '#94a3b8' : '#64748b',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 11,
    },
    grid: {
      vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
      horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
    },
    crosshair: {
      mode: 1,
      vertLine: { color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', width: 1, style: 2 },
      horzLine: { color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', width: 1, style: 2 },
    },
    timeScale: {
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    },
  };
}

// ─── Build series data aligned by time ───
function buildSeriesData(ohlcv, values) {
  return ohlcv
    .map((bar, i) => ({ time: bar.time, value: values[i] }))
    .filter(d => d.value !== null && d.value !== undefined && !isNaN(d.value));
}

// ─── Destroy existing charts ───
function destroyCharts() {
  Object.values(charts).forEach(c => { try { c.remove(); } catch(e) {} });
  charts = {};
}

// ─── Render all charts for a given timeframe ───
function renderCharts(data, tf) {
  destroyCharts();

  let ohlcv;
  if (tf === '1d') ohlcv = data.ohlcv.daily;
  else if (tf === '1wk') ohlcv = data.ohlcv.weekly;
  else ohlcv = data.ohlcv.monthly;

  const closes = ohlcv.map(d => d.close);
  const highs = ohlcv.map(d => d.high);
  const lows = ohlcv.map(d => d.low);
  const volumes = ohlcv.map(d => d.volume);

  // Recalculate indicators for this TF
  const ema50 = calcEMA(closes, 50);
  const ema200 = calcEMA(closes, 200);
  const rsi = calcRSI(closes, 14);
  const { macdLine, signalLine, histogram } = calcMACD(closes, 12, 26, 9);

  renderMainChart(ohlcv, closes, ema50, ema200, highs, lows);
  renderVolumeChart(ohlcv, volumes, closes);
  renderRSIChart(ohlcv, rsi);
  renderMACDChart(ohlcv, macdLine, signalLine, histogram);

  // Sync time scales
  setTimeout(() => syncChartTimeScales(), 100);

  // Update RSI & MACD badges with latest values
  updateRSIBadge(rsi);
  updateMACDBadge(macdLine, signalLine);
}

function renderMainChart(ohlcv, closes, ema50, ema200, highs, lows) {
  const container = document.getElementById('main-chart-container');
  container.innerHTML = '';
  const chart = LightweightCharts.createChart(container, getChartOptions(360, container));
  charts.main = chart;

  // Candlestick series
  const candleSeries = chart.addCandlestickSeries({
    upColor: '#10b981',
    downColor: '#ef4444',
    borderUpColor: '#10b981',
    borderDownColor: '#ef4444',
    wickUpColor: '#10b981',
    wickDownColor: '#ef4444',
  });
  candleSeries.setData(ohlcv);

  // 50 EMA
  const ema50Series = chart.addLineSeries({
    color: '#f59e0b',
    lineWidth: 1.5,
    title: '50 EMA',
    priceLineVisible: false,
    lastValueVisible: true,
  });
  ema50Series.setData(buildSeriesData(ohlcv, ema50));

  // 200 EMA
  const ema200Series = chart.addLineSeries({
    color: '#8b5cf6',
    lineWidth: 1.5,
    title: '200 EMA',
    priceLineVisible: false,
    lastValueVisible: true,
  });
  ema200Series.setData(buildSeriesData(ohlcv, ema200));

  chart.timeScale().fitContent();
}

function renderVolumeChart(ohlcv, volumes, closes) {
  const container = document.getElementById('volume-chart-container');
  container.innerHTML = '';
  const chart = LightweightCharts.createChart(container, {
    ...getChartOptions(120, container),
    timeScale: { visible: false },
  });
  charts.volume = chart;

  const volSeries = chart.addHistogramSeries({
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume',
  });

  // Color each bar based on up/down
  const volData = ohlcv.map((bar, i) => ({
    time: bar.time,
    value: volumes[i] || 0,
    color: bar.close >= bar.open ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)',
  }));
  volSeries.setData(volData);

  // Avg volume line
  const avgVol = avgVolume(volumes, 20);
  const avgVolSeries = chart.addLineSeries({
    color: 'rgba(245,158,11,0.7)',
    lineWidth: 1,
    lineStyle: 2,
    priceScaleId: 'volume',
    title: 'Avg',
    lastValueVisible: false,
    priceLineVisible: false,
  });
  avgVolSeries.setData(ohlcv.map(bar => ({ time: bar.time, value: avgVol })));

  chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0, bottom: 0.1 } });
  chart.timeScale().fitContent();
}

function renderRSIChart(ohlcv, rsi) {
  const container = document.getElementById('rsi-chart-container');
  container.innerHTML = '';
  const chart = LightweightCharts.createChart(container, {
    ...getChartOptions(140, container),
    timeScale: { visible: false },
  });
  charts.rsi = chart;

  // RSI line
  const rsiSeries = chart.addLineSeries({
    color: '#3b82f6',
    lineWidth: 2,
    title: 'RSI(14)',
    priceLineVisible: false,
  });
  rsiSeries.setData(buildSeriesData(ohlcv, rsi));

  // Overbought line (70)
  const ob = chart.addLineSeries({ color: 'rgba(239,68,68,0.5)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
  ob.setData(ohlcv.map(d => ({ time: d.time, value: 70 })));

  // Oversold line (30)
  const os = chart.addLineSeries({ color: 'rgba(16,185,129,0.5)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
  os.setData(ohlcv.map(d => ({ time: d.time, value: 30 })));

  // Middle line (50)
  const mid = chart.addLineSeries({ color: 'rgba(148,163,184,0.25)', lineWidth: 1, lineStyle: 3, priceLineVisible: false, lastValueVisible: false });
  mid.setData(ohlcv.map(d => ({ time: d.time, value: 50 })));

  chart.priceScale('right').applyOptions({ minimum: 0, maximum: 100 });
  chart.timeScale().fitContent();
}

function renderMACDChart(ohlcv, macdLine, signalLine, histogram) {
  const container = document.getElementById('macd-chart-container');
  container.innerHTML = '';
  const chart = LightweightCharts.createChart(container, {
    ...getChartOptions(140, container),
    timeScale: { visible: true, timeVisible: true },
  });
  charts.macd = chart;

  // Histogram
  const histSeries = chart.addHistogramSeries({ priceLineVisible: false });
  histSeries.setData(ohlcv
    .map((bar, i) => ({
      time: bar.time,
      value: histogram[i],
      color: histogram[i] >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)',
    }))
    .filter(d => d.value !== null && !isNaN(d.value)));

  // MACD line
  const macdSeries = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1.5, title: 'MACD', priceLineVisible: false });
  macdSeries.setData(buildSeriesData(ohlcv, macdLine));

  // Signal line
  const sigSeries = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1.5, title: 'Signal', priceLineVisible: false });
  sigSeries.setData(buildSeriesData(ohlcv, signalLine));

  // Zero line
  const zeroSeries = chart.addLineSeries({ color: 'rgba(148,163,184,0.2)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
  zeroSeries.setData(ohlcv.map(d => ({ time: d.time, value: 0 })));

  chart.timeScale().fitContent();
}

// ─── Sync crosshair across all charts ───
function syncChartTimeScales() {
  const allCharts = Object.values(charts);
  if (allCharts.length < 2) return;

  allCharts.forEach(c => {
    c.subscribeCrosshairMove(param => {
      if (!param.time) return;
      allCharts.forEach(other => {
        if (other !== c) {
          try { other.setCrosshairPosition(0, param.time, other.chartElement()); } catch(e) {}
        }
      });
    });
    c.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range) return;
      allCharts.forEach(other => {
        if (other !== c) {
          try { other.timeScale().setVisibleLogicalRange(range); } catch(e) {}
        }
      });
    });
  });
}

// ─── RSI badge update ───
function updateRSIBadge(rsi) {
  const validRSI = rsi.filter(v => v !== null);
  const lastRSI = validRSI[validRSI.length - 1];
  const valEl = document.getElementById('rsi-current-value');
  const zoneEl = document.getElementById('rsi-zone');

  if (lastRSI === undefined) return;

  valEl.textContent = lastRSI.toFixed(1);

  if (lastRSI > 70) {
    zoneEl.textContent = 'Overbought';
    zoneEl.className = 'rsi-zone-badge overbought';
  } else if (lastRSI < 30) {
    zoneEl.textContent = 'Oversold';
    zoneEl.className = 'rsi-zone-badge oversold';
  } else if (lastRSI >= 50) {
    zoneEl.textContent = 'Bullish Zone';
    zoneEl.className = 'rsi-zone-badge normal';
  } else {
    zoneEl.textContent = 'Bearish Zone';
    zoneEl.className = 'rsi-zone-badge overbought'; // reuse red style
  }
}

// ─── MACD badge update ───
function updateMACDBadge(macdLine, signalLine) {
  const badge = document.getElementById('macd-signal-badge');
  let lastMACD = null, lastSignal = null;
  let prevMACD = null, prevSignal = null;

  for (let i = macdLine.length - 1; i >= 0; i--) {
    if (macdLine[i] !== null && signalLine[i] !== null) {
      if (lastMACD === null) { lastMACD = macdLine[i]; lastSignal = signalLine[i]; }
      else if (prevMACD === null) { prevMACD = macdLine[i]; prevSignal = signalLine[i]; break; }
    }
  }

  if (lastMACD === null) return;

  const isBullishCross = prevMACD !== null && prevMACD < prevSignal && lastMACD > lastSignal;
  const isBearishCross = prevMACD !== null && prevMACD > prevSignal && lastMACD < lastSignal;
  const aboveSignal = lastMACD > lastSignal;

  if (isBullishCross) {
    badge.textContent = '🚀 Bullish Crossover';
    badge.className = 'macd-signal bullish';
  } else if (isBearishCross) {
    badge.textContent = '📉 Bearish Crossover';
    badge.className = 'macd-signal bearish';
  } else if (aboveSignal) {
    badge.textContent = '↑ MACD above Signal';
    badge.className = 'macd-signal bullish';
  } else {
    badge.textContent = '↓ MACD below Signal';
    badge.className = 'macd-signal bearish';
  }
}

// ─── Technical Summary Grid ───
function renderTechSummaryGrid(data) {
  const { indicators, ohlcv, price } = data;
  const closes = ohlcv.daily.map(d => d.close);
  const volumes = ohlcv.daily.map(d => d.volume);
  const rsi = indicators.rsi14.filter(Boolean);
  const lastRSI = rsi[rsi.length - 1];
  const lastE50 = indicators.ema50.filter(Boolean).slice(-1)[0];
  const lastE200 = indicators.ema200.filter(Boolean).slice(-1)[0];
  const macdLine = indicators.macd.macdLine.filter(Boolean);
  const signalLine = indicators.macd.signalLine.filter(Boolean);
  const lastMACD = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const lastVol = volumes[volumes.length - 1];
  const avgVol = indicators.avgVol20;

  const items = [
    {
      label: '50 EMA',
      value: lastE50 ? fmtPrice(lastE50) : 'N/A',
      verdict: price.current > lastE50 ? '✅ Price above 50 EMA' : '❌ Price below 50 EMA',
      bullish: price.current > lastE50
    },
    {
      label: '200 EMA',
      value: lastE200 ? fmtPrice(lastE200) : 'N/A',
      verdict: price.current > lastE200 ? '✅ Price above 200 EMA' : '❌ Price below 200 EMA',
      bullish: price.current > lastE200
    },
    {
      label: 'RSI (14)',
      value: lastRSI ? lastRSI.toFixed(1) : 'N/A',
      verdict: lastRSI > 70 ? '⚠️ Overbought — caution' : lastRSI < 30 ? '🎯 Oversold — potential reversal' : lastRSI > 50 ? '✅ Healthy bullish zone' : '⚠️ Bearish momentum',
      bullish: lastRSI > 50 && lastRSI < 70
    },
    {
      label: 'MACD',
      value: lastMACD ? fmtFixed(lastMACD, 2) : 'N/A',
      verdict: lastMACD > lastSignal ? '✅ MACD above signal — bullish momentum' : '❌ MACD below signal — bearish momentum',
      bullish: lastMACD > lastSignal
    },
    {
      label: 'Volume vs Avg',
      value: lastVol ? `${(lastVol / 1e6).toFixed(2)}M` : 'N/A',
      verdict: lastVol > avgVol * 1.5 ? '🔥 Volume spike (1.5x avg)' : lastVol > avgVol ? '✅ Above average volume' : '⚠️ Below average volume',
      bullish: lastVol >= avgVol
    },
    {
      label: 'Trend Status',
      value: indicators.trend.toUpperCase(),
      verdict: indicators.trend === 'bullish' ? '📈 Uptrend confirmed' : indicators.trend === 'bearish' ? '📉 Downtrend confirmed' : '↔ No clear trend',
      bullish: indicators.trend === 'bullish'
    },
    {
      label: 'Cross Signal',
      value: indicators.crossSignal.toUpperCase().replace('_', ' '),
      verdict: indicators.crossSignal === 'golden' ? '⭐ Golden Cross — strong buy signal' : indicators.crossSignal === 'death' ? '💀 Death Cross — sell signal' : indicators.crossSignal === 'above' ? '✅ 50 EMA > 200 EMA (bullish)' : '❌ 50 EMA < 200 EMA (bearish)',
      bullish: ['golden', 'above'].includes(indicators.crossSignal)
    },
    {
      label: 'Breakout Status',
      value: indicators.breakout.toUpperCase(),
      verdict: indicators.breakout === 'breakout' ? '🚀 Breakout above resistance' : indicators.breakout === 'breakdown' ? '⚠️ Breakdown below support' : 'Price within range',
      bullish: indicators.breakout === 'breakout'
    },
  ];

  const grid = document.getElementById('technical-summary-grid');
  grid.innerHTML = items.map(item => `
    <div class="metric-card ${item.bullish ? 'good' : 'bad'}">
      <div class="metric-label">${item.label}</div>
      <div class="metric-value">${item.value}</div>
      <div class="metric-note">${item.verdict}</div>
    </div>
  `).join('');
}

// ─── Timeframe tab handlers ───
function setupTimeframeTabs(data) {
  document.querySelectorAll('.tf-btn').forEach(btn => {
    // Remove old listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
      newBtn.classList.add('active');
      currentTF = newBtn.dataset.tf;
      renderCharts(data, currentTF);
    });
  });
}

// ─── Refresh chart themes (when theme toggles) ───
function refreshChartThemes(data) {
  if (Object.keys(charts).length > 0) {
    renderCharts(data, currentTF);
  }
}

// ─── Window resize handler ───
window.addEventListener('resize', () => {
  const allCharts = Object.values(charts);
  allCharts.forEach(chart => {
    try {
      const el = chart.chartElement ? chart.chartElement() : null;
      if (el && el.parentElement) {
        chart.applyOptions({ width: el.parentElement.clientWidth });
      }
    } catch(e) {}
  });
});
