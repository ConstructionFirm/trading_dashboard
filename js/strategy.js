/* ═══════════════════════════════════════════════
   strategy.js — Module 7
   Intraday vs Swing Strategy Mode
   Entry / SL / Target / Recommended Mode
   ═══════════════════════════════════════════════ */

'use strict';

let currentStrategyMode = 'swing';

function renderStrategy(data) {
  // Set recommended mode first
  const recommended = recommendMode(data);
  document.getElementById('recommended-mode-badge').textContent =
    `Recommended: ${recommended === 'intraday' ? '⚡ Intraday' : '📊 Swing'}`;

  // Sync with global strategy mode from header toggle
  currentStrategyMode = window.AppState?.strategyMode || 'swing';

  // Setup mode tabs
  setupStrategyModeTabs(data);

  // Sync tabs with current mode
  activateStrategyMode(currentStrategyMode, data);
  renderVolatilityCard(data);
}

function setupStrategyModeTabs(data) {
  document.querySelectorAll('.smode-btn').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      document.querySelectorAll('.smode-btn').forEach(b => b.classList.remove('active'));
      newBtn.classList.add('active');
      currentStrategyMode = newBtn.dataset.smode;
      activateStrategyMode(currentStrategyMode, data);
    });
  });

  // Set initial active
  document.querySelectorAll('.smode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.smode === currentStrategyMode);
  });
}

function activateStrategyMode(mode, data) {
  if (mode === 'intraday') renderIntradayStrategy(data);
  else renderSwingStrategy(data);
}

// ─── INTRADAY Strategy ───
function renderIntradayStrategy(data) {
  const { indicators, price, ohlcv } = data;
  const closes = ohlcv.daily.slice(-5).map(d => d.close);
  const highs = ohlcv.daily.slice(-5).map(d => d.high);
  const lows = ohlcv.daily.slice(-5).map(d => d.low);
  const volumes = ohlcv.daily.slice(-5).map(d => d.volume);

  const current = price.current;
  const lastATR = indicators.lastATR;

  // 5 EMA & 20 EMA on last 60 days
  const dailyCloses = ohlcv.daily.map(d => d.close);
  const dailyHighs = ohlcv.daily.map(d => d.high);
  const dailyLows = ohlcv.daily.map(d => d.low);
  const dailyVols = ohlcv.daily.map(d => d.volume);
  const ema5 = calcEMA(dailyCloses, 5);
  const ema20 = calcEMA(dailyCloses, 20);
  const rsi9 = calcRSI(dailyCloses, 9);
  const vwap = calcVWAP(dailyHighs, dailyLows, dailyCloses, dailyVols);

  const lastE5 = ema5.filter(Boolean).slice(-1)[0];
  const lastE20 = ema20.filter(Boolean).slice(-1)[0];
  const lastRSI9 = rsi9.filter(Boolean).slice(-1)[0];
  const lastVWAP = vwap[vwap.length - 1];
  const lastVol = dailyVols[dailyVols.length - 1];
  const avgVol = avgVolume(dailyVols, 10);
  const volSpike = lastVol > avgVol * 1.3;

  // Entry: current price if conditions are met
  let entryBias = 'NEUTRAL';
  let entryPrice = current;
  let stopLoss, target1, target2;

  const atr = lastATR || current * 0.01;
  const aboveVWAP = current > lastVWAP;
  const ema5Bull = lastE5 > lastE20;
  const rsiMomentum = lastRSI9 > 55 && lastRSI9 < 70;

  if (aboveVWAP && ema5Bull && volSpike) {
    entryBias = 'LONG';
    entryPrice = current;
    stopLoss = current - 0.7 * atr;
    target1 = current + 1.0 * atr;  // 1:1.5 RR
    target2 = current + 1.4 * atr;  // 1:2 RR
  } else if (!aboveVWAP && !ema5Bull && volSpike) {
    entryBias = 'SHORT';
    entryPrice = current;
    stopLoss = current + 0.7 * atr;
    target1 = current - 1.0 * atr;
    target2 = current - 1.4 * atr;
  } else {
    entryBias = 'WAIT';
    stopLoss = current - 0.5 * atr;
    target1 = current + 0.75 * atr;
    target2 = current + 1.0 * atr;
  }

  const rrRatio1 = Math.abs(target1 - entryPrice) / Math.abs(entryPrice - stopLoss);
  const rrRatio2 = Math.abs(target2 - entryPrice) / Math.abs(entryPrice - stopLoss);

  const grid = document.getElementById('strategy-output-grid');
  grid.innerHTML = `
    <div class="strategy-card entry">
      <div class="strategy-card-title">⚡ Entry Signal</div>
      <div class="strategy-value" style="color:${entryBias === 'LONG' ? 'var(--green)' : entryBias === 'SHORT' ? 'var(--red)' : 'var(--yellow)'}">${entryBias}</div>
      <div class="strategy-note">Entry at: ${fmtPrice(entryPrice)}</div>
      <div class="strategy-note" style="margin-top:8px;padding:8px;background:var(--bg-card-3);border-radius:6px;font-size:12px;line-height:1.5;">
        ${entryBias === 'LONG' ? '✅ Price > VWAP, 5 EMA > 20 EMA, Volume spike' : entryBias === 'SHORT' ? '❌ Price < VWAP, 5 EMA < 20 EMA, Volume spike' : '⚠️ Mixed signals — wait for clear momentum'}
      </div>
    </div>
    <div class="strategy-card stoploss">
      <div class="strategy-card-title">🛑 Stop Loss (Tight)</div>
      <div class="strategy-value" style="color:var(--red)">${fmtPrice(stopLoss)}</div>
      <div class="strategy-note">Distance: ₹${Math.abs(entryPrice - stopLoss).toFixed(2)} (${(Math.abs(entryPrice - stopLoss) / entryPrice * 100).toFixed(2)}%)</div>
      <div class="strategy-note">Based on 0.7× ATR(14): ₹${atr.toFixed(2)}</div>
    </div>
    <div class="strategy-card target">
      <div class="strategy-card-title">🎯 Target 1 (1:1.5 RR)</div>
      <div class="strategy-value" style="color:var(--green)">${fmtPrice(target1)}</div>
      <div class="strategy-note">Upside: ₹${Math.abs(target1 - entryPrice).toFixed(2)} (${(Math.abs(target1 - entryPrice) / entryPrice * 100).toFixed(2)}%)</div>
      <div class="strategy-note">R/R = 1:${rrRatio1.toFixed(2)}</div>
    </div>
    <div class="strategy-card target">
      <div class="strategy-card-title">🎯 Target 2 (1:2 RR)</div>
      <div class="strategy-value" style="color:var(--green)">${fmtPrice(target2)}</div>
      <div class="strategy-note">Upside: ₹${Math.abs(target2 - entryPrice).toFixed(2)} (${(Math.abs(target2 - entryPrice) / entryPrice * 100).toFixed(2)}%)</div>
      <div class="strategy-note">R/R = 1:${rrRatio2.toFixed(2)}</div>
    </div>
    <div class="strategy-card rr" style="grid-column: span 2;">
      <div class="strategy-card-title">📊 Intraday Indicators</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:8px;">
        <div style="text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">5 EMA</div>
          <div style="font-family:var(--font-mono);font-weight:700">${lastE5 ? fmtPrice(lastE5) : 'N/A'}</div>
          <div style="font-size:11px;color:${ema5Bull ? 'var(--green)' : 'var(--red)'}">${ema5Bull ? '↑ Bullish' : '↓ Bearish'}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">20 EMA</div>
          <div style="font-family:var(--font-mono);font-weight:700">${lastE20 ? fmtPrice(lastE20) : 'N/A'}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">VWAP</div>
          <div style="font-family:var(--font-mono);font-weight:700">${lastVWAP ? fmtPrice(lastVWAP) : 'N/A'}</div>
          <div style="font-size:11px;color:${aboveVWAP ? 'var(--green)' : 'var(--red)'}">${aboveVWAP ? '↑ Above' : '↓ Below'}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">RSI (9)</div>
          <div style="font-family:var(--font-mono);font-weight:700">${lastRSI9 ? lastRSI9.toFixed(1) : 'N/A'}</div>
          <div style="font-size:11px;color:${lastRSI9 > 60 ? 'var(--green)' : lastRSI9 < 40 ? 'var(--red)' : 'var(--yellow)'}">${lastRSI9 > 70 ? 'Overbought' : lastRSI9 < 30 ? 'Oversold' : lastRSI9 > 50 ? 'Bullish' : 'Bearish'}</div>
        </div>
      </div>
      <div style="margin-top:12px;padding:10px;background:var(--blue-dim);border:1px solid var(--blue-border);border-radius:8px;font-size:12px;color:var(--text-secondary)">
        ⚠️ Intraday ignores fundamentals. Valid for minutes to hours. Book profits at Target 1, trail stop to entry for Target 2.
      </div>
    </div>
  `;
}

// ─── SWING Strategy ───
function renderSwingStrategy(data) {
  const { indicators, price, ohlcv, fundamentals: f } = data;
  const current = price.current;
  const atr = indicators.lastATR || current * 0.015;

  const lastE50 = indicators.ema50.filter(Boolean).slice(-1)[0] ?? current;
  const lastE200 = indicators.ema200.filter(Boolean).slice(-1)[0] ?? current;
  const rsiArr = indicators.rsi14.filter(Boolean);
  const lastRSI = rsiArr[rsiArr.length - 1] ?? 50;
  const macdBull = (() => {
    const ml = indicators.macd.macdLine.filter(Boolean);
    const sl = indicators.macd.signalLine.filter(Boolean);
    return ml[ml.length-1] > sl[sl.length-1];
  })();

  const { support, resistance } = indicators;
  const trend = indicators.trend;

  // Entry zone
  let entryLow, entryHigh, stopLoss, target1, target2;
  let tradeType = 'WATCH';

  if (trend === 'bullish' && lastRSI > 45 && lastRSI < 65 && macdBull) {
    tradeType = 'LONG';
    // Entry zone: current to small pullback to 50 EMA
    entryLow = Math.max(support, current - 0.5 * atr);
    entryHigh = current + 0.3 * atr;
    stopLoss = Math.min(support - atr * 0.5, current - 1.5 * atr);
    target1 = current + 2.0 * atr;
    target2 = resistance > current ? resistance + 0.5 * atr : current + 3.5 * atr;
  } else if (trend === 'bearish' && lastRSI > 35 && lastRSI < 55 && !macdBull) {
    tradeType = 'SHORT';
    entryLow = current - 0.3 * atr;
    entryHigh = Math.min(resistance, current + 0.5 * atr);
    stopLoss = Math.max(resistance + atr * 0.5, current + 1.5 * atr);
    target1 = current - 2.0 * atr;
    target2 = support > 0 ? support - 0.5 * atr : current - 3.5 * atr;
  } else {
    tradeType = 'WAIT';
    entryLow = support;
    entryHigh = current;
    stopLoss = support - atr;
    target1 = resistance;
    target2 = resistance + atr;
  }

  const rr1 = Math.abs(target1 - current) / Math.abs(current - stopLoss);
  const rr2 = Math.abs(target2 - current) / Math.abs(current - stopLoss);

  // Fundamental check
  const fundGood = f.roe > 0.12 && f.debtToEquity < 1.5 && f.freeCashFlow > 0;
  const fundNote = fundGood
    ? '✅ Fundamentals support swing trade (ROE, FCF, Debt OK)'
    : '⚠️ Mixed fundamentals — see Fundamentals tab before entry';

  const grid = document.getElementById('strategy-output-grid');
  grid.innerHTML = `
    <div class="strategy-card entry">
      <div class="strategy-card-title">📊 Trade Setup</div>
      <div class="strategy-value" style="color:${tradeType === 'LONG' ? 'var(--green)' : tradeType === 'SHORT' ? 'var(--red)' : 'var(--yellow)'}">${tradeType}</div>
      <div class="strategy-note">Entry Zone: ${fmtPrice(entryLow)} – ${fmtPrice(entryHigh)}</div>
      <div class="strategy-note" style="margin-top:8px;padding:8px;background:var(--bg-card-3);border-radius:6px;font-size:12px;line-height:1.5;">
        ${tradeType === 'LONG' ? '📈 Bullish trend + RSI healthy + MACD bullish — quality setup' : tradeType === 'SHORT' ? '📉 Bearish trend + RSI weak — downside play' : '⏳ No clear setup — wait for confirmation (Golden Cross or RSI > 55)'}
      </div>
    </div>
    <div class="strategy-card stoploss">
      <div class="strategy-card-title">🛑 Stop Loss</div>
      <div class="strategy-value" style="color:var(--red)">${fmtPrice(stopLoss)}</div>
      <div class="strategy-note">Risk: ₹${Math.abs(current - stopLoss).toFixed(2)} (${(Math.abs(current - stopLoss) / current * 100).toFixed(2)}%)</div>
      <div class="strategy-note">Place below support: ${fmtPrice(support)}</div>
    </div>
    <div class="strategy-card target">
      <div class="strategy-card-title">🎯 Target 1 (2× ATR)</div>
      <div class="strategy-value" style="color:var(--green)">${fmtPrice(target1)}</div>
      <div class="strategy-note">Potential: ₹${Math.abs(target1 - current).toFixed(2)}</div>
      <div class="strategy-note">R/R = 1:${rr1.toFixed(2)}</div>
    </div>
    <div class="strategy-card target">
      <div class="strategy-card-title">🎯 Target 2 (Resistance)</div>
      <div class="strategy-value" style="color:var(--green)">${fmtPrice(target2)}</div>
      <div class="strategy-note">Potential: ₹${Math.abs(target2 - current).toFixed(2)}</div>
      <div class="strategy-note">R/R = 1:${rr2.toFixed(2)} · Hold: Days to weeks</div>
    </div>
    <div class="strategy-card rr" style="grid-column: span 2;">
      <div class="strategy-card-title">📋 Swing Indicators</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:8px;">
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">50 EMA</div>
          <div style="font-family:var(--font-mono);font-weight:700">${fmtPrice(lastE50)}</div>
          <div style="font-size:11px;color:${current > lastE50 ? 'var(--green)' : 'var(--red)'}">${current > lastE50 ? '↑ Above' : '↓ Below'}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">200 EMA</div>
          <div style="font-family:var(--font-mono);font-weight:700">${fmtPrice(lastE200)}</div>
          <div style="font-size:11px;color:${current > lastE200 ? 'var(--green)' : 'var(--red)'}">${current > lastE200 ? '↑ Above' : '↓ Below'}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">RSI (14)</div>
          <div style="font-family:var(--font-mono);font-weight:700">${lastRSI.toFixed(1)}</div>
          <div style="font-size:11px;color:${lastRSI > 55 ? 'var(--green)' : lastRSI < 40 ? 'var(--red)' : 'var(--yellow)'}">${lastRSI > 70 ? 'Overbought' : lastRSI < 30 ? 'Oversold' : lastRSI > 50 ? 'Bullish' : 'Bearish'}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">MACD Signal</div>
          <div style="font-family:var(--font-mono);font-weight:700">${macdBull ? 'BULLISH' : 'BEARISH'}</div>
          <div style="font-size:11px;color:${macdBull ? 'var(--green)' : 'var(--red)'}">${macdBull ? '↑ MACD > Signal' : '↓ MACD < Signal'}</div>
        </div>
      </div>
      <div style="margin-top:12px;padding:10px;background:var(--bg-card-3);border-radius:8px;font-size:12px;color:var(--text-secondary)">
        ${fundNote}
      </div>
    </div>
  `;
}

// ─── Recommended Mode ───
function recommendMode(data) {
  const { indicators, price, ohlcv } = data;
  const closes = ohlcv.daily.map(d => d.close);
  const atr = indicators.lastATR;
  const atrPct = atr > 0 ? (atr / price.current) * 100 : 2;
  const adx = indicators.adx;

  // High ATR% + trending → swing
  // Low ADX → intraday scalp
  if (adx !== null && adx > 25 && indicators.trend !== 'sideways') return 'swing';
  if (atrPct > 3) return 'intraday'; // Very volatile — scalp
  return 'swing';
}

// ─── Volatility Card ───
function renderVolatilityCard(data) {
  const { indicators, price } = data;
  const atr = indicators.lastATR;
  const atrPct = atr > 0 ? (atr / price.current) * 100 : 0;
  const adx = indicators.adx;

  const metrics = [
    {
      label: 'ATR (14)',
      value: fmtPrice(atr),
      note: `${atrPct.toFixed(2)}% of price — ${atrPct < 1.5 ? 'Low volatility' : atrPct < 3 ? 'Moderate volatility' : 'High volatility'}`,
    },
    {
      label: 'ADX (14)',
      value: adx ? adx.toFixed(1) : 'N/A',
      note: adx ? (adx > 25 ? '💪 Strong trend' : adx > 15 ? '→ Developing trend' : '↔ Weak / Ranging') : 'N/A',
    },
    {
      label: 'Bollinger Width (approx)',
      value: `${(atrPct * 2.5).toFixed(2)}%`,
      note: atrPct * 2.5 < 5 ? 'Tight bands — expect expansion' : 'Normal band width',
    },
    {
      label: 'Recommended Mode',
      value: recommendMode(data) === 'swing' ? '📊 SWING' : '⚡ INTRADAY',
      note: recommendMode(data) === 'swing' ? 'Trending + manageable volatility' : 'High volatility — quick trades preferred',
    },
  ];

  const container = document.getElementById('volatility-metrics');
  if (!container) return;
  container.innerHTML = metrics.map(m => `
    <div class="bt-metric-card">
      <div class="bt-metric-label">${m.label}</div>
      <div class="bt-metric-value" style="font-size:18px">${m.value}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${m.note}</div>
    </div>
  `).join('');
}
