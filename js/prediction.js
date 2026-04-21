/* ═══════════════════════════════════════════════
   prediction.js — Module 3
   Price Prediction: EMA + RSI + Volume + S/R
   ATR-Based Price Range, Confidence Scoring
   ═══════════════════════════════════════════════ */

'use strict';

function renderPrediction(data) {
  const result = computePrediction(data);
  displayPrediction(result, data);
}

// ─── Core Prediction Algorithm ───
function computePrediction(data) {
  const { indicators, price, ohlcv } = data;
  const closes = ohlcv.daily.map(d => d.close);
  const volumes = ohlcv.daily.map(d => d.volume);
  const current = price.current;

  // --- Signal 1: EMA Trend (25 pts) ---
  const lastE50 = indicators.ema50.filter(Boolean).slice(-1)[0];
  const lastE200 = indicators.ema200.filter(Boolean).slice(-1)[0];
  let emaScore = 0;
  let emaVerdict = '';
  let emaDetail = '';

  if (lastE50 && lastE200) {
    if (current > lastE50 && current > lastE200 && lastE50 > lastE200) {
      emaScore = 25; emaVerdict = 'bullish'; emaDetail = 'Price above both EMAs (strong uptrend)';
    } else if (current > lastE50 && current > lastE200) {
      emaScore = 18; emaVerdict = 'bullish'; emaDetail = 'Price above both EMAs (moderate uptrend)';
    } else if (current < lastE50 && current < lastE200 && lastE50 < lastE200) {
      emaScore = 0; emaVerdict = 'bearish'; emaDetail = 'Price below both EMAs (strong downtrend)';
    } else if (current < lastE50 || current < lastE200) {
      emaScore = 8; emaVerdict = 'bearish'; emaDetail = 'Price below key EMA — weak structure';
    } else {
      emaScore = 12; emaVerdict = 'neutral'; emaDetail = 'Mixed EMA signals — consolidation likely';
    }
  }

  // --- Signal 2: RSI Level (25 pts) ---
  const rsiArr = indicators.rsi14.filter(Boolean);
  const lastRSI = rsiArr[rsiArr.length - 1];
  let rsiScore = 0;
  let rsiVerdict = '';
  let rsiDetail = '';

  if (lastRSI !== undefined) {
    if (lastRSI >= 50 && lastRSI <= 65) {
      rsiScore = 25; rsiVerdict = 'bullish'; rsiDetail = `RSI ${lastRSI.toFixed(1)} — ideal bullish zone (50–65)`;
    } else if (lastRSI > 65 && lastRSI <= 70) {
      rsiScore = 16; rsiVerdict = 'bullish'; rsiDetail = `RSI ${lastRSI.toFixed(1)} — elevated but not overbought`;
    } else if (lastRSI > 70) {
      rsiScore = 4; rsiVerdict = 'bearish'; rsiDetail = `RSI ${lastRSI.toFixed(1)} — overbought, expect pullback`;
    } else if (lastRSI >= 40 && lastRSI < 50) {
      rsiScore = 10; rsiVerdict = 'neutral'; rsiDetail = `RSI ${lastRSI.toFixed(1)} — slight bearish bias`;
    } else if (lastRSI < 30) {
      rsiScore = 20; rsiVerdict = 'bullish'; rsiDetail = `RSI ${lastRSI.toFixed(1)} — oversold, reversal watch`;
    } else {
      rsiScore = 6; rsiVerdict = 'bearish'; rsiDetail = `RSI ${lastRSI.toFixed(1)} — weak momentum`;
    }
  }

  // --- Signal 3: Volume Spike (25 pts) ---
  const lastVol = volumes[volumes.length - 1];
  const avgVol = indicators.avgVol20;
  const volRatio = avgVol > 0 ? lastVol / avgVol : 1;
  let volScore = 0;
  let volVerdict = '';
  let volDetail = '';

  if (volRatio >= 2.0) {
    volScore = 25; volVerdict = 'bullish'; volDetail = `Volume ${volRatio.toFixed(1)}x avg — strong institutional interest`;
  } else if (volRatio >= 1.5) {
    volScore = 20; volVerdict = 'bullish'; volDetail = `Volume ${volRatio.toFixed(1)}x avg — above-average activity`;
  } else if (volRatio >= 1.0) {
    volScore = 14; volVerdict = 'neutral'; volDetail = `Volume ${volRatio.toFixed(1)}x avg — normal trading activity`;
  } else if (volRatio >= 0.7) {
    volScore = 7; volVerdict = 'neutral'; volDetail = `Volume ${volRatio.toFixed(1)}x avg — below average (weak conviction)`;
  } else {
    volScore = 2; volVerdict = 'bearish'; volDetail = `Volume ${volRatio.toFixed(1)}x avg — very low participation`;
  }

  // --- Signal 4: Support / Resistance Zone (25 pts) ---
  const { support, resistance } = indicators;
  const rangeSize = resistance - support;
  const posInRange = rangeSize > 0 ? (current - support) / rangeSize : 0.5;
  let srScore = 0;
  let srVerdict = '';
  let srDetail = '';

  if (posInRange < 0.25) {
    srScore = 25; srVerdict = 'bullish'; srDetail = `Price near support (₹${support.toFixed(2)}) — low-risk entry zone`;
  } else if (posInRange < 0.45) {
    srScore = 18; srVerdict = 'bullish'; srDetail = 'Price in lower half of range — upside potential';
  } else if (posInRange < 0.65) {
    srScore = 12; srVerdict = 'neutral'; srDetail = 'Price in mid-range — watch for direction';
  } else if (posInRange < 0.85) {
    srScore = 6; srVerdict = 'neutral'; srDetail = `Price approaching resistance (₹${resistance.toFixed(2)}) — caution`;
  } else {
    srScore = 2; srVerdict = 'bearish'; srDetail = `Price near resistance (₹${resistance.toFixed(2)}) — high breakout or rejection risk`;
  }

  // --- Also factor MACD direction ---
  const macdLine = indicators.macd.macdLine.filter(Boolean);
  const signalLine = indicators.macd.signalLine.filter(Boolean);
  const lastMACD = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const macdBullish = lastMACD !== undefined && lastSignal !== undefined && lastMACD > lastSignal;

  // --- Total Score ---
  const totalScore = emaScore + rsiScore + volScore + srScore;

  // Map to direction
  let direction, confidence, confidenceLevel;
  if (totalScore >= 75) {
    direction = 'BULLISH'; confidence = totalScore; confidenceLevel = 'HIGH';
  } else if (totalScore >= 55) {
    direction = 'BULLISH'; confidence = totalScore; confidenceLevel = 'MEDIUM';
  } else if (totalScore >= 40) {
    direction = 'CONSOLIDATION'; confidence = totalScore; confidenceLevel = 'MEDIUM';
  } else if (totalScore >= 25) {
    direction = 'BEARISH'; confidence = 100 - totalScore; confidenceLevel = 'MEDIUM';
  } else {
    direction = 'BEARISH'; confidence = 100 - totalScore; confidenceLevel = 'HIGH';
  }

  // If score is 40-60 but MACD is clear, lean that way
  if (totalScore >= 40 && totalScore <= 60) {
    direction = macdBullish ? 'BULLISH' : 'BEARISH';
    confidenceLevel = 'LOW';
    confidence = Math.abs(totalScore - 50) * 2 + 40;
  }

  // --- ATR-Based Price Range ---
  const lastATR = indicators.lastATR;
  const bullTarget = current + 1.5 * lastATR;
  const bearTarget = current - 1.0 * lastATR;

  return {
    direction,
    confidence: clamp(confidence, 20, 95),
    confidenceLevel,
    totalScore,
    bullTarget,
    bearTarget,
    lastATR,
    support,
    resistance,
    signals: [
      { label: 'EMA Trend', score: emaScore, max: 25, verdict: emaVerdict, detail: emaDetail },
      { label: 'RSI Level', score: rsiScore, max: 25, verdict: rsiVerdict, detail: rsiDetail },
      { label: 'Volume', score: volScore, max: 25, verdict: volVerdict, detail: volDetail },
      { label: 'S/R Zone', score: srScore, max: 25, verdict: srVerdict, detail: srDetail },
    ],
  };
}

// ─── Display ───
function displayPrediction(result, data) {
  const { direction, confidence, confidenceLevel, bullTarget, bearTarget, lastATR, support, resistance, signals } = result;
  const current = data.price.current;

  // Direction display
  const dirEl = document.getElementById('pred-direction-display');
  const icons = { BULLISH: '📈 BULLISH', BEARISH: '📉 BEARISH', CONSOLIDATION: '↔ CONSOLIDATION' };
  const dirClass = { BULLISH: 'bullish', BEARISH: 'bearish', CONSOLIDATION: 'consolidation' };
  dirEl.textContent = icons[direction] || direction;
  dirEl.className = `pred-direction ${dirClass[direction]}`;

  // Card class
  const card = document.getElementById('prediction-main-card');
  card.className = `prediction-main-card ${dirClass[direction]}`;

  // Confidence
  const confBadge = document.getElementById('prediction-confidence');
  confBadge.textContent = `${confidenceLevel} Confidence`;
  confBadge.className = `confidence-badge ${confidenceLevel.toLowerCase()}`;

  document.getElementById('pred-confidence-bar').style.width = `${confidence}%`;
  document.getElementById('pred-confidence-text').textContent = `${Math.round(confidence)}%`;

  // Price range
  document.getElementById('pred-current-price').textContent = fmtPrice(current);
  document.getElementById('bull-target').textContent = fmtPrice(bullTarget);
  document.getElementById('bear-target').textContent = fmtPrice(bearTarget);
  document.getElementById('atr-note').textContent =
    `ATR(14): ₹${lastATR.toFixed(2)} · Bull = +1.5×ATR · Bear = −1.0×ATR`;

  // Support & Resistance
  document.getElementById('resistance-level').textContent = fmtPrice(resistance);
  document.getElementById('support-level').textContent = fmtPrice(support);

  // Signal Breakdown
  const driverGrid = document.getElementById('driver-grid');
  driverGrid.innerHTML = signals.map(sig => {
    const pct = Math.round((sig.score / sig.max) * 100);
    const colorMap = { bullish: 'positive', bearish: 'negative', neutral: '' };
    return `
      <div class="driver-item">
        <div class="driver-item-label">${sig.label}</div>
        <div class="driver-item-val ${colorMap[sig.verdict] || ''}">${sig.score}/${sig.max} pts</div>
        <div class="driver-item-verdict" style="color: var(--text-muted)">${sig.detail}</div>
      </div>
    `;
  }).join('');
}
