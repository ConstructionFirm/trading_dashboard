/* ═══════════════════════════════════════════════
   scoring.js — Module 5
   AI Stock Scoring Model: 0–100
   Fundamental (0–40) + Technical (0–40) + Sentiment (0–20)
   ═══════════════════════════════════════════════ */

'use strict';

function renderScoring(data) {
  const result = computeAIScore(data);
  displayScore(result);
}

// ─── Core Scoring Engine ───
function computeAIScore(data) {
  const { fundamentals: f, indicators, price, news, nifty } = data;
  const closes = data.ohlcv.daily.map(d => d.close);
  const volumes = data.ohlcv.daily.map(d => d.volume);

  const deductions = [];
  const fundItems = [];
  const techItems = [];
  const sentItems = [];

  // ═══ A) FUNDAMENTAL SCORE — max 40 ═══

  // 1. Revenue & Profit Growth → +10
  let fundScore = 0;
  const growthPts = scoreGrowth(f.revenueGrowth, f.earningsGrowth, deductions, fundItems);
  fundScore += growthPts;

  // 2. ROE > 15% → +8
  const roePts = scoreROE(f.roe, deductions, fundItems);
  fundScore += roePts;

  // 3. Debt-to-Equity < 1 → +8
  const dePts = scoreDebt(f.debtToEquity, deductions, fundItems);
  fundScore += dePts;

  // 4. Positive FCF → +6
  const fcfPts = scoreFCF(f.freeCashFlow, deductions, fundItems);
  fundScore += fcfPts;

  // 5. Stable Promoter Holding → +8
  const promoterPts = scorePromoter(f.promoterHolding, deductions, fundItems);
  fundScore += promoterPts;

  fundScore = clamp(Math.round(fundScore), 0, 40);

  // ═══ B) TECHNICAL SCORE — max 40 ═══
  let techScore = 0;

  const lastClose = price.current;
  const lastE50 = indicators.ema50.filter(Boolean).slice(-1)[0];
  const lastE200 = indicators.ema200.filter(Boolean).slice(-1)[0];
  const rsiArr = indicators.rsi14.filter(Boolean);
  const lastRSI = rsiArr[rsiArr.length - 1];
  const macdLineArr = indicators.macd.macdLine.filter(Boolean);
  const sigLineArr = indicators.macd.signalLine.filter(Boolean);
  const lastMACD = macdLineArr[macdLineArr.length - 1];
  const lastSignal = sigLineArr[sigLineArr.length - 1];
  const prevMACD = macdLineArr[macdLineArr.length - 2];
  const prevSignal = sigLineArr[sigLineArr.length - 2];
  const lastVol = volumes[volumes.length - 1];
  const avgVol = indicators.avgVol20;

  // 1. Price above 50 EMA & 200 EMA → +10
  if (lastE50 && lastE200) {
    if (lastClose > lastE50 && lastClose > lastE200) {
      techScore += 10;
      techItems.push({ label: 'Price > 50 EMA & 200 EMA', points: 10, earned: true });
    } else if (lastClose > lastE200) {
      techScore += 5;
      techItems.push({ label: 'Price > 200 EMA only', points: 5, earned: true });
      deductions.push({ category: 'Technical', points: -5, reason: `Price (₹${lastClose.toFixed(0)}) is below 50 EMA (₹${lastE50?.toFixed(0)}) — momentum weakening` });
    } else {
      techItems.push({ label: 'Price < Both EMAs', points: 0, earned: false });
      deductions.push({ category: 'Technical', points: -10, reason: `Price below both EMAs — bearish structure. 50 EMA: ₹${lastE50?.toFixed(0)}, 200 EMA: ₹${lastE200?.toFixed(0)}` });
    }
  } else {
    techItems.push({ label: 'EMA Data Insufficient', points: 0, earned: false });
  }

  // 2. RSI between 50–65 → +8
  if (lastRSI !== undefined) {
    if (lastRSI >= 50 && lastRSI <= 65) {
      techScore += 8;
      techItems.push({ label: `RSI ${lastRSI.toFixed(1)} in 50–65 range`, points: 8, earned: true });
    } else if (lastRSI > 65 && lastRSI <= 70) {
      techScore += 4;
      techItems.push({ label: `RSI ${lastRSI.toFixed(1)} elevated (65–70)`, points: 4, earned: true });
      deductions.push({ category: 'Technical', points: -4, reason: `RSI ${lastRSI.toFixed(1)} is above ideal zone (50–65) — momentum stretched` });
    } else if (lastRSI > 70) {
      techItems.push({ label: `RSI ${lastRSI.toFixed(1)} overbought (>70)`, points: 0, earned: false });
      deductions.push({ category: 'Technical', points: -8, reason: `RSI ${lastRSI.toFixed(1)} is overbought (>70) — high pullback risk` });
    } else if (lastRSI < 30) {
      techScore += 4;
      techItems.push({ label: `RSI ${lastRSI.toFixed(1)} oversold (<30)`, points: 4, earned: true });
      deductions.push({ category: 'Technical', points: -4, reason: `RSI ${lastRSI.toFixed(1)} oversold — may bounce but trend is weak` });
    } else {
      techScore += 2;
      techItems.push({ label: `RSI ${lastRSI.toFixed(1)} below 50`, points: 2, earned: false });
      deductions.push({ category: 'Technical', points: -6, reason: `RSI ${lastRSI.toFixed(1)} below 50 — bearish momentum zone` });
    }
  }

  // 3. MACD bullish crossover → +8
  if (lastMACD !== undefined && lastSignal !== undefined) {
    const bullishCross = prevMACD !== undefined && prevSignal !== undefined && prevMACD < prevSignal && lastMACD > lastSignal;
    const bullishAbove = lastMACD > lastSignal;

    if (bullishCross) {
      techScore += 8;
      techItems.push({ label: 'MACD Bullish Crossover (fresh)', points: 8, earned: true });
    } else if (bullishAbove) {
      techScore += 5;
      techItems.push({ label: 'MACD above Signal Line', points: 5, earned: true });
    } else {
      techItems.push({ label: 'MACD below Signal Line', points: 0, earned: false });
      deductions.push({ category: 'Technical', points: -8, reason: `MACD (${lastMACD.toFixed(2)}) is below signal (${lastSignal.toFixed(2)}) — bearish momentum` });
    }
  }

  // 4. Volume above average → +6
  if (avgVol > 0 && lastVol > 0) {
    if (lastVol >= avgVol * 1.5) {
      techScore += 6;
      techItems.push({ label: `Volume ${(lastVol / avgVol).toFixed(1)}x avg — High`, points: 6, earned: true });
    } else if (lastVol >= avgVol) {
      techScore += 3;
      techItems.push({ label: `Volume ${(lastVol / avgVol).toFixed(1)}x avg — Normal`, points: 3, earned: true });
      deductions.push({ category: 'Technical', points: -3, reason: `Volume below 1.5x average — lacking strong conviction` });
    } else {
      techItems.push({ label: `Volume ${(lastVol / avgVol).toFixed(1)}x avg — Low`, points: 0, earned: false });
      deductions.push({ category: 'Technical', points: -6, reason: `Below-average volume (${(lastVol / avgVol).toFixed(2)}x) — weak participation` });
    }
  }

  // 5. Breakout above resistance → +8
  if (indicators.breakout === 'breakout') {
    techScore += 8;
    techItems.push({ label: 'Breakout above resistance zone', points: 8, earned: true });
  } else if (indicators.breakout === 'breakdown') {
    techItems.push({ label: 'Breakdown below support', points: 0, earned: false });
    deductions.push({ category: 'Technical', points: -8, reason: `Price has broken down below support — strong bearish signal` });
  } else {
    techScore += 2;
    techItems.push({ label: 'Price within range (no breakout)', points: 2, earned: true });
  }

  techScore = clamp(Math.round(techScore), 0, 40);

  // ═══ C) SENTIMENT / NEWS SCORE — max 20 ═══
  let sentScore = 0;

  // 1. Positive news sentiment → +10
  const { score: newsPts, positivityRatio } = getNewsSentimentScore(news);
  sentScore += newsPts;
  if (newsPts >= 8) {
    sentItems.push({ label: `News sentiment: ${Math.round(positivityRatio * 100)}% positive`, points: newsPts, earned: true });
  } else {
    sentItems.push({ label: `News sentiment: ${Math.round(positivityRatio * 100)}% positive`, points: newsPts, earned: newsPts > 5 });
    if (newsPts < 5) {
      deductions.push({ category: 'Sentiment', points: -(10 - newsPts), reason: `Negative news dominates (${news?.filter(a => classifyNewsSentiment(a.title, a.description) === 'negative').length || 0} negative headlines)` });
    }
  }

  // 2. Sector bullish → +5
  if (indicators.trend === 'bullish') {
    sentScore += 5;
    sentItems.push({ label: 'Sector / trend: Bullish', points: 5, earned: true });
  } else if (indicators.trend === 'sideways') {
    sentScore += 2;
    sentItems.push({ label: 'Sector / trend: Neutral', points: 2, earned: true });
    deductions.push({ category: 'Sentiment', points: -3, reason: 'Sideways price action indicates uncertain sector momentum' });
  } else {
    sentItems.push({ label: 'Sector / trend: Bearish', points: 0, earned: false });
    deductions.push({ category: 'Sentiment', points: -5, reason: 'Bearish sector trend — institutional selling pressure likely' });
  }

  // 3. Market trend (Nifty) → +5
  if (nifty) {
    if (nifty.changePercent > 0.003) {
      sentScore += 5;
      sentItems.push({ label: `Nifty 50: +${(nifty.changePercent * 100).toFixed(2)}% (bullish)`, points: 5, earned: true });
    } else if (nifty.changePercent > -0.003) {
      sentScore += 3;
      sentItems.push({ label: `Nifty 50: ${(nifty.changePercent * 100).toFixed(2)}% (neutral)`, points: 3, earned: true });
    } else {
      sentItems.push({ label: `Nifty 50: ${(nifty.changePercent * 100).toFixed(2)}% (bearish)`, points: 0, earned: false });
      deductions.push({ category: 'Sentiment', points: -5, reason: `Nifty 50 is down ${Math.abs(nifty.changePercent * 100).toFixed(2)}% — broad market headwind` });
    }
  } else {
    sentScore += 2;
    sentItems.push({ label: 'Nifty: Data unavailable', points: 2, earned: true });
  }

  sentScore = clamp(Math.round(sentScore), 0, 20);

  const totalScore = fundScore + techScore + sentScore;

  return {
    totalScore,
    fundScore,
    techScore,
    sentScore,
    classification: classifyScore(totalScore),
    fundItems,
    techItems,
    sentItems,
    deductions,
  };
}

// ─── Score Classification ───
function classifyScore(score) {
  if (score >= 80) return { label: '🟢 Strong Buy Zone', cls: 'strong-buy', color: 'var(--green)', hex: '#10b981', scoreCls: 'buy' };
  if (score >= 60) return { label: '🔵 Buy on Dip', cls: 'buy-dip', color: 'var(--blue)', hex: '#3b82f6', scoreCls: 'neutral' };
  if (score >= 40) return { label: '🟡 Neutral / Watchlist', cls: 'neutral', color: 'var(--yellow)', hex: '#f59e0b', scoreCls: 'neutral' };
  if (score >= 20) return { label: '🟠 Risky', cls: 'risky', color: 'var(--orange)', hex: '#f97316', scoreCls: 'watch' };
  return { label: '🔴 Avoid', cls: 'avoid', color: 'var(--red)', hex: '#ef4444', scoreCls: 'avoid' };
}

// ─── Display ───
function displayScore(result) {
  const { totalScore, fundScore, techScore, sentScore, classification, fundItems, techItems, sentItems, deductions } = result;

  // Main gauge
  const circumference = 2 * Math.PI * 80;
  const dashArray = (totalScore / 100) * circumference;
  const gaugeEl = document.getElementById('gauge-fill-large');
  if (gaugeEl) {
    gaugeEl.style.strokeDasharray = `${dashArray} ${circumference}`;
    gaugeEl.style.stroke = classification.color;
  }

  document.getElementById('gauge-score-num').textContent = totalScore;
  document.getElementById('gauge-classification').textContent = classification.label.replace(/^.*?]/, '').trim();
  document.getElementById('gauge-classification').style.color = classification.color;

  // AI badge
  const aiBadge = document.getElementById('ai-score-badge');
  aiBadge.textContent = `${totalScore}/100 — ${classification.label}`;
  aiBadge.className = `ai-score-badge ${classification.cls}`;
  // Use hex colors for valid CSS value concatenation
  aiBadge.style.color = classification.hex;
  aiBadge.style.borderColor = classification.hex + '88';
  aiBadge.style.background = classification.hex + '22';

  // Mini score ring in summary card
  const circumSmall = 2 * Math.PI * 50;
  const dashSmall = (totalScore / 100) * circumSmall;
  const ringEl = document.getElementById('ring-fill-circle');
  if (ringEl) {
    ringEl.style.strokeDasharray = `${dashSmall} ${circumSmall}`;
    ringEl.style.stroke = classification.color;
  }
  document.getElementById('total-score-num').textContent = totalScore;

  // Pillar scores
  renderPillarBar('fund', fundScore, 40, fundItems);
  renderPillarBar('tech', techScore, 40, techItems);
  renderPillarBar('sent', sentScore, 20, sentItems);

  // Mini bars in summary card
  animateMiniBar('mini-fund-bar', fundScore, 40);
  animateMiniBar('mini-tech-bar', techScore, 40);
  animateMiniBar('mini-sent-bar', sentScore, 20);
  document.getElementById('mini-fund-val').textContent = `${fundScore}/40`;
  document.getElementById('mini-tech-val').textContent = `${techScore}/40`;
  document.getElementById('mini-sent-val').textContent = `${sentScore}/20`;

  // Verdict badge in summary card
  const verdictBadge = document.getElementById('verdict-badge');
  const verdictCls = totalScore >= 60 ? 'buy' : totalScore >= 40 ? 'watch' : 'avoid';
  const verdictLabel = totalScore >= 60 ? '✅ BUY / WATCH' : totalScore >= 40 ? '👀 WATCHLIST' : '❌ AVOID';
  verdictBadge.textContent = verdictLabel;
  verdictBadge.className = `verdict-badge ${verdictCls}`;

  // Deductions
  renderDeductions(deductions);
}

function renderPillarBar(prefix, score, max, items) {
  const pct = (score / max) * 100;
  document.getElementById(`${prefix}-score-num`).textContent = `${score}/${max}`;
  setTimeout(() => {
    const bar = document.getElementById(`${prefix}-pillar-bar`);
    if (bar) bar.style.width = `${pct}%`;
  }, 200);

  const itemsEl = document.getElementById(`${prefix}-score-items`);
  if (!itemsEl || !items) return;
  itemsEl.innerHTML = items.map(item => `
    <div class="score-item">
      <span class="score-item-label">${item.label}</span>
      <span class="score-item-points ${item.earned ? 'earned' : 'missed'}">
        ${item.earned ? '+' : ''}${item.points}
      </span>
    </div>
  `).join('');
}

function animateMiniBar(id, score, max) {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.style.width = `${(score / max) * 100}%`;
  }, 300);
}

function renderDeductions(deductions) {
  const list = document.getElementById('deductions-list');
  if (!list) return;
  if (deductions.length === 0) {
    list.innerHTML = '<div class="news-loading" style="color: var(--green)">✅ No significant deductions — strong across all pillars!</div>';
    return;
  }
  list.innerHTML = deductions.map(d => `
    <div class="deduction-item">
      <span class="deduction-points">${d.points} pts</span>
      <span>[${d.category}] ${d.reason}</span>
    </div>
  `).join('');
}

// ─── Fundamental sub-scorers ───
function scoreGrowth(revGrowth, epsGrowth, deductions, items) {
  const revOk = revGrowth !== null && revGrowth > 0.10;
  const epsOk = epsGrowth !== null && epsGrowth > 0.10;
  if (revOk && epsOk) {
    items.push({ label: `Rev +${fmtPct(revGrowth)} & EPS +${fmtPct(epsGrowth)}`, points: 10, earned: true });
    return 10;
  } else if (revOk || epsOk) {
    items.push({ label: `Partial growth (Rev: ${fmtPct(revGrowth)}, EPS: ${fmtPct(epsGrowth)})`, points: 6, earned: true });
    deductions.push({ category: 'Fundamental', points: -4, reason: `Only one of revenue/EPS growth is strong > 10%` });
    return 6;
  } else {
    const rev = revGrowth !== null ? fmtPct(revGrowth) : 'N/A';
    const eps = epsGrowth !== null ? fmtPct(epsGrowth) : 'N/A';
    items.push({ label: `Weak growth (Rev: ${rev}, EPS: ${eps})`, points: 0, earned: false });
    if (revGrowth !== null || epsGrowth !== null) {
      deductions.push({ category: 'Fundamental', points: -10, reason: `Revenue growth ${rev} and EPS growth ${eps} are below 10% threshold` });
    }
    return 0;
  }
}

function scoreROE(roe, deductions, items) {
  if (roe === null) { items.push({ label: 'ROE: Data unavailable', points: 0, earned: false }); return 0; }
  if (roe > 0.20) { items.push({ label: `Excellent ROE: ${fmtPct(roe)}`, points: 8, earned: true }); return 8; }
  if (roe > 0.15) { items.push({ label: `Good ROE: ${fmtPct(roe)}`, points: 8, earned: true }); return 8; }
  if (roe > 0.08) {
    items.push({ label: `Moderate ROE: ${fmtPct(roe)}`, points: 4, earned: true });
    deductions.push({ category: 'Fundamental', points: -4, reason: `ROE ${fmtPct(roe)} is below the 15% benchmark` });
    return 4;
  }
  items.push({ label: `Low ROE: ${fmtPct(roe)}`, points: 0, earned: false });
  deductions.push({ category: 'Fundamental', points: -8, reason: `ROE ${fmtPct(roe)} indicates poor capital efficiency (target: >15%)` });
  return 0;
}

function scoreDebt(de, deductions, items) {
  if (de === null) { items.push({ label: 'D/E: Data unavailable', points: 0, earned: false }); return 0; }
  if (de < 0.5) { items.push({ label: `Very low D/E: ${fmtFixed(de, 2)}x`, points: 8, earned: true }); return 8; }
  if (de < 1.0) { items.push({ label: `Acceptable D/E: ${fmtFixed(de, 2)}x`, points: 8, earned: true }); return 8; }
  if (de < 2.0) {
    items.push({ label: `Moderate D/E: ${fmtFixed(de, 2)}x`, points: 4, earned: true });
    deductions.push({ category: 'Fundamental', points: -4, reason: `D/E ratio ${fmtFixed(de, 2)}x exceeds 1.0 — elevated leverage` });
    return 4;
  }
  items.push({ label: `High D/E: ${fmtFixed(de, 2)}x`, points: 0, earned: false });
  deductions.push({ category: 'Fundamental', points: -8, reason: `High leverage: D/E = ${fmtFixed(de, 2)}x. Debt servicing risk in a rising rate environment.` });
  return 0;
}

function scoreFCF(fcf, deductions, items) {
  if (fcf === null) { items.push({ label: 'FCF: Data unavailable', points: 0, earned: false }); return 0; }
  if (fcf > 0) { items.push({ label: `Positive FCF: ${fmtINR(fcf)}`, points: 6, earned: true }); return 6; }
  items.push({ label: `Negative FCF: ${fmtINR(fcf)}`, points: 0, earned: false });
  deductions.push({ category: 'Fundamental', points: -6, reason: `Negative free cash flow (${fmtINR(fcf)}) — company is not self-funding operations` });
  return 0;
}

function scorePromoter(holding, deductions, items) {
  if (holding === null) { items.push({ label: 'Promoter holding: N/A', points: 0, earned: false }); return 0; }
  if (holding > 0.50) { items.push({ label: `High promoter holding: ${fmtPct(holding)}`, points: 8, earned: true }); return 8; }
  if (holding > 0.30) { items.push({ label: `Moderate holding: ${fmtPct(holding)}`, points: 5, earned: true }); deductions.push({ category: 'Fundamental', points: -3, reason: `Promoter/insider holding ${fmtPct(holding)} is below 50% — limited insider conviction` }); return 5; }
  items.push({ label: `Low promoter holding: ${fmtPct(holding)}`, points: 2, earned: false });
  deductions.push({ category: 'Fundamental', points: -6, reason: `Low insider stake (${fmtPct(holding)}) — promoters have limited skin in the game` });
  return 2;
}
