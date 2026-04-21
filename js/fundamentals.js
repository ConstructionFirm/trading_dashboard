// ─── Safe UI Helper ───
function safe(val) {
  return val !== undefined && val !== null && val !== '' ? val : 'N/A';
}

// ─── Debug Toggle ───
let showRawFundamentals = false;
function toggleRawFundamentals() {
  showRawFundamentals = !showRawFundamentals;
  renderRawFundamentals();
}
function renderRawFundamentals() {
  const el = document.getElementById('raw-fundamentals');
  if (!el) return;
  if (showRawFundamentals && window.AppState && AppState.data && AppState.data.fundamentals) {
    el.innerHTML = `<pre style="max-height:300px;overflow:auto;background:#181c24;color:#fff;padding:8px;">${JSON.stringify(AppState.data.fundamentals, null, 2)}</pre>`;
  } else {
    el.innerHTML = '';
  }
}
/* ═══════════════════════════════════════════════
   fundamentals.js — Module 1
   Fundamental Analysis Display + Classification
   ═══════════════════════════════════════════════ */

'use strict';

function renderFundamentals(data) {
  const f = data.fundamentals;
  if (!f || Object.values(f).filter(v => v != null).length < 4) {
    document.getElementById('fundamental-metrics-grid').innerHTML =
      '<div class="news-loading">Fundamental data unavailable for this ticker.</div>';
    renderClassification('Insufficient Data');
    renderRawFundamentals();
    return;
  }
  // ─── Classify overall fundamentals ───
  const { score, classification, redFlags, greenFlags } = classifyFundamentals(f);
  renderClassification(classification);
  renderMetricCards(f, data.price.current);
  renderFlags(redFlags, greenFlags);
  renderRawFundamentals();
}

// ─── Fundamental Scoring & Classification ───
function classifyFundamentals(f) {
  const redFlags = [];
  const greenFlags = [];
  let score = 0;
  let maxScore = 0;

  function check(condition, weight, greenMsg, redMsg) {
    maxScore += weight;
    if (condition === true) { score += weight; greenFlags.push(greenMsg); }
    else if (condition === false) { redFlags.push(redMsg); }
    // null = data unavailable, skip
  }

  // ROE > 15%
  if (f.roe !== null) {
    check(f.roe > 0.15, 3,
      `Strong ROE: ${fmtPct(f.roe)} (>15% — efficient capital use)`,
      `Low ROE: ${fmtPct(f.roe)} (<15% — weak capital efficiency)`);
  }

  // Revenue Growth > 10%
  if (f.revenueGrowth !== null) {
    check(f.revenueGrowth > 0.10, 2,
      `Solid Revenue Growth: ${fmtPct(f.revenueGrowth)} YoY`,
      `Weak Revenue Growth: ${fmtPct(f.revenueGrowth)} YoY`);
    if (f.revenueGrowth < 0) {
      redFlags.push(`⚠️ CRITICAL: Revenue is declining YoY (${fmtPct(f.revenueGrowth)})`);
    }
  }

  // Debt-to-Equity < 1
  if (f.debtToEquity !== null) {
    check(f.debtToEquity < 1, 2,
      `Conservative Debt: D/E = ${fmtFixed(f.debtToEquity, 2)}x (manageable leverage)`,
      `High Leverage: D/E = ${fmtFixed(f.debtToEquity, 2)}x (debt risk)`);
    if (f.debtToEquity > 2) {
      redFlags.push(`⚠️ CRITICAL: Very high debt (D/E = ${fmtFixed(f.debtToEquity, 2)}x) — solvency risk`);
    }
  }

  // Positive Free Cash Flow
  if (f.freeCashFlow !== null) {
    check(f.freeCashFlow > 0, 2,
      `Positive FCF: ${fmtINR(f.freeCashFlow)} — company generates real cash`,
      `Negative FCF: ${fmtINR(f.freeCashFlow)} — cash burn is a concern`);
  }

  // Earnings Growth > 10%
  if (f.earningsGrowth !== null) {
    check(f.earningsGrowth > 0.10, 2,
      `EPS Growth: ${fmtPct(f.earningsGrowth)} YoY`,
      `EPS Declining/Flat: ${fmtPct(f.earningsGrowth)} YoY`);
  }

  // P/E Ratio check (not too high)
  if (f.pe !== null) {
    if (f.pe < 0) redFlags.push(`Negative P/E (${fmtFixed(f.pe, 1)}) — company is loss-making`);
    else if (f.pe > 80) redFlags.push(`Extreme valuation: P/E = ${fmtFixed(f.pe, 1)}x (overvalued risk)`);
    else if (f.pe > 0 && f.pe < 30) greenFlags.push(`Reasonable valuation: P/E = ${fmtFixed(f.pe, 1)}x`);
  }

  // Promoter Holding > 40%
  if (f.promoterHolding !== null) {
    check(f.promoterHolding > 0.40, 1,
      `Promoter/Insider holding: ${fmtPct(f.promoterHolding)} — strong insider confidence`,
      `Low insider holding: ${fmtPct(f.promoterHolding)} — limited skin in the game`);
    if (f.promoterHolding < 0.10) {
      redFlags.push(`⚠️ Very low insider holding (${fmtPct(f.promoterHolding)}) — potential governance risk`);
    }
  }

  // Operating Margins > 15%
  if (f.operatingMargins !== null) {
    check(f.operatingMargins > 0.15, 1,
      `Strong operating margins: ${fmtPct(f.operatingMargins)}`,
      `Thin operating margins: ${fmtPct(f.operatingMargins)}`);
  }

  // Current Ratio > 1 (liquidity)
  if (f.currentRatio !== null && f.currentRatio < 1) {
    redFlags.push(`Liquidity concern: Current Ratio = ${fmtFixed(f.currentRatio, 2)} (below 1.0)`);
  }

  // PEG Ratio check
  if (f.pegRatio !== null && f.pegRatio > 0) {
    if (f.pegRatio < 1) greenFlags.push(`Attractive PEG Ratio: ${fmtFixed(f.pegRatio, 2)} (growth-adjusted cheap)`);
    else if (f.pegRatio > 3) redFlags.push(`High PEG Ratio: ${fmtFixed(f.pegRatio, 2)} (expensive on growth basis)`);
  }

  const ratio = maxScore > 0 ? score / maxScore : 0;
  let classification;
  if (ratio >= 0.7) classification = 'strong';
  else if (ratio >= 0.4) classification = 'moderate';
  else classification = 'weak';

  return { score, maxScore, classification, redFlags, greenFlags };
}

function renderClassification(cls) {
  const el = document.getElementById('fundamental-classification');
  const labels = { strong: '✅ Strong Fundamentals', moderate: '⚠️ Moderate Fundamentals', weak: '❌ Weak Fundamentals' };
  el.textContent = labels[cls] || '--';
  el.className = `classification-badge ${cls}`;
}

// ─── Render Metric Cards ───
function renderMetricCards(f, currentPrice) {
  const grid = document.getElementById('fundamental-metrics-grid');

  const metrics = [
    {
      label: 'Market Cap',
      value: fmtINR(f.marketCap),
      note: f.marketCap > 1e12 ? 'Large Cap' : f.marketCap > 2e10 ? 'Mid Cap' : 'Small Cap',
      quality: 'neutral-metric'
    },
    {
      label: 'P/E Ratio (TTM)',
      value: f.pe !== null ? fmtFixed(f.pe, 1) + 'x' : 'N/A',
      note: f.pe > 0 && f.pe < 30 ? 'Fairly valued' : f.pe > 50 ? 'Expensive' : f.pe < 0 ? 'Loss-making' : '--',
      quality: f.pe > 0 && f.pe < 35 ? 'good' : f.pe > 50 || f.pe < 0 ? 'bad' : 'neutral-metric'
    },
    {
      label: 'Forward P/E',
      value: f.forwardPE !== null ? fmtFixed(f.forwardPE, 1) + 'x' : 'N/A',
      note: f.forwardPE !== null && f.pe !== null ? (f.forwardPE < f.pe ? 'Earnings expected to grow' : 'Earnings slowdown priced in') : '--',
      quality: 'neutral-metric'
    },
    {
      label: 'EPS (TTM)',
      value: f.eps !== null ? fmtPrice(f.eps) : 'N/A',
      note: f.eps > 0 ? 'Profitable' : 'Loss per share',
      quality: f.eps > 0 ? 'good' : 'bad'
    },
    {
      label: 'Revenue Growth (YoY)',
      value: f.revenueGrowth !== null ? fmtPct(f.revenueGrowth) : 'N/A',
      note: f.revenueGrowth > 0.15 ? '🚀 High growth' : f.revenueGrowth > 0 ? 'Moderate growth' : 'Revenue declining',
      quality: f.revenueGrowth > 0.10 ? 'good' : f.revenueGrowth < 0 ? 'bad' : 'neutral-metric',
      valueClass: f.revenueGrowth !== null ? (f.revenueGrowth > 0 ? 'positive' : 'negative') : ''
    },
    {
      label: 'EPS Growth (YoY)',
      value: f.earningsGrowth !== null ? fmtPct(f.earningsGrowth) : 'N/A',
      note: f.earningsGrowth > 0.20 ? 'Strong earnings acceleration' : f.earningsGrowth > 0 ? 'Stable earnings growth' : 'Earnings pressure',
      quality: f.earningsGrowth > 0.10 ? 'good' : f.earningsGrowth < 0 ? 'bad' : 'neutral-metric',
      valueClass: f.earningsGrowth !== null ? (f.earningsGrowth > 0 ? 'positive' : 'negative') : ''
    },
    {
      label: 'ROE',
      value: f.roe !== null ? fmtPct(f.roe) : 'N/A',
      note: f.roe > 0.20 ? 'Excellent returns' : f.roe > 0.15 ? 'Healthy' : f.roe > 0 ? 'Below benchmark' : 'Negative returns',
      quality: f.roe > 0.15 ? 'good' : f.roe > 0 && f.roe < 0.10 ? 'bad' : 'neutral-metric'
    },
    {
      label: 'Debt-to-Equity',
      value: f.debtToEquity !== null ? fmtFixed(f.debtToEquity, 2) + 'x' : 'N/A',
      note: f.debtToEquity < 0.5 ? 'Very low debt' : f.debtToEquity < 1 ? 'Conservative leverage' : f.debtToEquity < 2 ? 'Moderate debt' : 'High leverage risk',
      quality: f.debtToEquity < 1 ? 'good' : f.debtToEquity > 2 ? 'bad' : 'neutral-metric'
    },
    {
      label: 'Free Cash Flow',
      value: f.freeCashFlow !== null ? fmtINR(f.freeCashFlow) : 'N/A',
      note: f.freeCashFlow > 0 ? 'Cash generative' : 'Cash burn',
      quality: f.freeCashFlow > 0 ? 'good' : f.freeCashFlow < 0 ? 'bad' : 'neutral-metric',
      valueClass: f.freeCashFlow !== null ? (f.freeCashFlow > 0 ? 'positive' : 'negative') : ''
    },
    {
      label: 'Operating Margin',
      value: f.operatingMargins !== null ? fmtPct(f.operatingMargins) : 'N/A',
      note: f.operatingMargins > 0.20 ? 'High margin business' : f.operatingMargins > 0.10 ? 'Average' : 'Thin margins',
      quality: f.operatingMargins > 0.15 ? 'good' : f.operatingMargins < 0.05 ? 'bad' : 'neutral-metric'
    },
    {
      label: 'Promoter / Insider Holding',
      value: f.promoterHolding !== null ? fmtPct(f.promoterHolding) : 'N/A',
      note: f.promoterHolding > 0.50 ? 'Strong insider confidence' : f.promoterHolding > 0.25 ? 'Moderate insider stake' : 'Low insider ownership',
      quality: f.promoterHolding > 0.40 ? 'good' : f.promoterHolding < 0.15 ? 'bad' : 'neutral-metric'
    },
    {
      label: 'Dividend Yield',
      value: f.dividendYield !== null && f.dividendYield > 0 ? fmtPct(f.dividendYield) : 'No Dividend',
      note: f.dividendYield > 0.03 ? 'Income-generating' : f.dividendYield > 0 ? 'Low yield' : 'Growth-oriented',
      quality: 'neutral-metric'
    },
    {
      label: 'Beta (Market Sensitivity)',
      value: f.beta !== null ? fmtFixed(f.beta, 2) : 'N/A',
      note: f.beta > 1.5 ? 'High volatility stock' : f.beta > 1 ? 'Slightly volatile' : f.beta > 0 ? 'Less volatile than market' : 'Defensive/inverse',
      quality: 'neutral-metric'
    },
    {
      label: 'Price / Book',
      value: f.priceToBook !== null ? fmtFixed(f.priceToBook, 2) + 'x' : 'N/A',
      note: f.priceToBook < 1 ? 'Trading below book value' : f.priceToBook < 3 ? 'Reasonable P/B' : 'Premium valuation',
      quality: f.priceToBook > 0 && f.priceToBook < 3 ? 'good' : 'neutral-metric'
    },
    {
      label: 'Current Ratio',
      value: f.currentRatio !== null ? fmtFixed(f.currentRatio, 2) : 'N/A',
      note: f.currentRatio > 2 ? 'Very liquid' : f.currentRatio > 1 ? 'Adequate liquidity' : 'Liquidity risk',
      quality: f.currentRatio > 1.5 ? 'good' : f.currentRatio !== null && f.currentRatio < 1 ? 'bad' : 'neutral-metric'
    },
    {
      label: 'Institutional Holding',
      value: f.institutionalHolding !== null ? fmtPct(f.institutionalHolding) : 'N/A',
      note: f.institutionalHolding > 0.30 ? 'Heavy institutional interest' : 'Lower institutional stake',
      quality: f.institutionalHolding > 0.20 ? 'good' : 'neutral-metric'
    },
  ];

  grid.innerHTML = metrics.map(m => `
    <div class="metric-card ${m.quality}">
      <div class="metric-label">${m.label}</div>
      <div class="metric-value ${m.valueClass || ''}">${m.value}</div>
      <div class="metric-note">${m.note}</div>
    </div>
  `).join('');
}

// ─── Render Red/Green Flags ───
function renderFlags(redFlags, greenFlags) {
  const redSection = document.getElementById('red-flags-section');
  const greenSection = document.getElementById('green-flags-section');
  const redList = document.getElementById('red-flags-list');
  const greenList = document.getElementById('green-flags-list');

  if (redFlags.length === 0) {
    redSection.classList.add('hidden');
  } else {
    redSection.classList.remove('hidden');
    redList.innerHTML = redFlags.map(f => `
      <div class="flag-item red">
        <span class="flag-icon">🚩</span>
        <span>${f}</span>
      </div>
    `).join('');
  }

  if (greenFlags.length === 0) {
    greenSection.classList.add('hidden');
  } else {
    greenSection.classList.remove('hidden');
    greenList.innerHTML = greenFlags.map(f => `
      <div class="flag-item green">
        <span class="flag-icon">✅</span>
        <span>${f}</span>
      </div>
    `).join('');
  }
}
