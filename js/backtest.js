/* ═══════════════════════════════════════════════
   backtest.js — Module 6
   Strategy Backtesting: EMA + RSI + Volume
   Equity Curve, Trade Log, Win Rate, Drawdown
   ═══════════════════════════════════════════════ */

'use strict';

let backtestChartInstance = null;
let currentPeriod = '1y';

function renderBacktest(data) {
  // Set up period and run buttons
  setupBacktestControls(data);

  // Run with default period
  runBacktest(data, currentPeriod);
}

function setupBacktestControls(data) {
  document.querySelectorAll('.period-btn').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      newBtn.classList.add('active');
      currentPeriod = newBtn.dataset.period;
    });
  });

  const runBtn = document.getElementById('run-backtest-btn');
  if (runBtn) {
    const newBtn = runBtn.cloneNode(true);
    runBtn.parentNode.replaceChild(newBtn, runBtn);
    newBtn.addEventListener('click', () => {
      runBacktest(data, currentPeriod);
    });
  }
}

// ─── Core Backtesting Engine ───
function runBacktest(data, period) {
  let ohlcv = data.ohlcv.daily;

  // Filter by period
  if (period === '6mo') {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    ohlcv = ohlcv.filter(d => d.time >= cutoffStr);
  }

  if (ohlcv.length < 30) {
    document.getElementById('backtest-metrics-row').innerHTML =
      '<div class="news-loading">Insufficient data for backtesting (need 30+ bars).</div>';
    return;
  }

  const closes = ohlcv.map(d => d.close);
  const highs = ohlcv.map(d => d.high);
  const lows = ohlcv.map(d => d.low);
  const volumes = ohlcv.map(d => d.volume);

  // Calculate indicators fresh for chosen period
  const ema50 = calcEMA(closes, 50);
  const ema200 = calcEMA(closes, 200);
  const rsi14 = calcRSI(closes, 14);
  const avgVol = avgVolume(volumes, 20);

  // ── Strategy Loop ──
  const trades = [];
  let inPosition = false;
  let entryPrice = 0;
  let entryDate = '';
  let entryIdx = 0;

  for (let i = 200; i < closes.length; i++) {
    const c = closes[i];
    const e50 = ema50[i];
    const e200 = ema200[i];
    const rsi = rsi14[i];
    const vol = volumes[i];

    if (e50 === null || e200 === null || rsi === null) continue;

    if (!inPosition) {
      // BUY condition
      const aboveBothEMA = c > e50 && c > e200;
      const rsiInRange = rsi >= 50 && rsi <= 65;
      const volumeSpike = vol > avgVol;

      if (aboveBothEMA && rsiInRange && volumeSpike) {
        inPosition = true;
        entryPrice = closes[i + 1] ?? c; // next bar open approximation
        entryDate = ohlcv[Math.min(i + 1, ohlcv.length - 1)].time;
        entryIdx = i;
      }
    } else {
      // SELL condition
      const rsiOverbought = rsi > 70;
      const belowEMA50 = c < e50;
      const holdDays = i - entryIdx;

      if ((rsiOverbought || belowEMA50) && holdDays >= 1) {
        const exitPrice = closes[i + 1] ?? c;
        const exitDate = ohlcv[Math.min(i + 1, ohlcv.length - 1)].time;
        const pnl = ((exitPrice - entryPrice) / entryPrice) * 100;

        trades.push({
          entryDate,
          exitDate,
          entryPrice,
          exitPrice,
          pnl,
          holdDays,
          exitReason: rsiOverbought ? 'RSI > 70' : 'Below 50 EMA',
          isWin: pnl > 0,
        });

        inPosition = false;
        entryPrice = 0;
      }
    }
  }

  // Close open position at last price
  if (inPosition) {
    const exitPrice = closes[closes.length - 1];
    const exitDate = ohlcv[ohlcv.length - 1].time;
    const pnl = ((exitPrice - entryPrice) / entryPrice) * 100;
    trades.push({
      entryDate,
      exitDate,
      entryPrice,
      exitPrice,
      pnl,
      holdDays: closes.length - entryIdx,
      exitReason: 'Period End (Open)',
      isWin: pnl > 0,
    });
  }

  // ── Compute Metrics ──
  const metrics = computeBacktestMetrics(trades);

  // ── Equity Curve ──
  const equityCurve = buildEquityCurve(trades, ohlcv);

  // ── Render ──
  renderBacktestMetrics(metrics, trades.length);
  renderEquityCurve(equityCurve);
  renderTradeLog(trades);

  // Verdict
  const verdictEl = document.getElementById('backtest-verdict');
  if (metrics.winRate >= 0.55 && metrics.profitFactor >= 1.3) {
    verdictEl.textContent = '✅ Strategy Profitable';
    verdictEl.className = 'backtest-verdict-badge profitable';
  } else if (trades.length < 3) {
    verdictEl.textContent = '⚠️ Too Few Trades';
    verdictEl.className = 'backtest-verdict-badge';
    verdictEl.style.background = 'var(--yellow-dim)';
    verdictEl.style.color = 'var(--yellow)';
  } else {
    verdictEl.textContent = '❌ Not Reliable';
    verdictEl.className = 'backtest-verdict-badge not-reliable';
  }
}

// ─── Metrics Computation ───
function computeBacktestMetrics(trades) {
  if (trades.length === 0) return { winRate: 0, avgPnL: 0, maxDrawdown: 0, profitFactor: 1, rrRatio: 0 };

  const wins = trades.filter(t => t.isWin);
  const losses = trades.filter(t => !t.isWin);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const avgPnL = trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length;

  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 1;
  const rrRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin;

  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;

  // Max drawdown from equity curve
  let peak = 100, maxDD = 0, equity = 100;
  for (const t of trades) {
    equity *= (1 + t.pnl / 100);
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  }

  return { winRate, avgPnL, maxDrawdown: maxDD, profitFactor, rrRatio, avgWin, avgLoss };
}

// ─── Build Equity Curve Data ───
function buildEquityCurve(trades, ohlcv) {
  const curve = [{ time: ohlcv[0]?.time || '2024-01-01', value: 100 }];
  let capital = 100;

  for (const trade of trades) {
    capital *= (1 + trade.pnl / 100);
    curve.push({ time: trade.exitDate, value: parseFloat(capital.toFixed(2)) });
  }

  // Ensure last point
  if (trades.length === 0) {
    curve.push({ time: ohlcv[ohlcv.length - 1]?.time || curve[0].time, value: 100 });
  }

  return curve;
}

// ─── Render Metrics ───
function renderBacktestMetrics(metrics, totalTrades) {
  const row = document.getElementById('backtest-metrics-row');

  const m = [
    {
      label: 'Total Trades',
      value: totalTrades,
      color: 'var(--text-primary)',
    },
    {
      label: 'Win Rate',
      value: `${(metrics.winRate * 100).toFixed(1)}%`,
      color: metrics.winRate >= 0.55 ? 'var(--green)' : metrics.winRate >= 0.45 ? 'var(--yellow)' : 'var(--red)',
    },
    {
      label: 'Avg P&L / Trade',
      value: `${metrics.avgPnL >= 0 ? '+' : ''}${metrics.avgPnL.toFixed(2)}%`,
      color: metrics.avgPnL >= 0 ? 'var(--green)' : 'var(--red)',
    },
    {
      label: 'Profit Factor',
      value: metrics.profitFactor > 900 ? '∞' : metrics.profitFactor.toFixed(2) + 'x',
      color: metrics.profitFactor >= 1.3 ? 'var(--green)' : metrics.profitFactor >= 1 ? 'var(--yellow)' : 'var(--red)',
    },
    {
      label: 'Max Drawdown',
      value: `-${metrics.maxDrawdown.toFixed(2)}%`,
      color: metrics.maxDrawdown < 10 ? 'var(--green)' : metrics.maxDrawdown < 20 ? 'var(--yellow)' : 'var(--red)',
    },
    {
      label: 'Risk/Reward Ratio',
      value: metrics.rrRatio.toFixed(2),
      color: metrics.rrRatio >= 1.5 ? 'var(--green)' : metrics.rrRatio >= 1 ? 'var(--yellow)' : 'var(--red)',
    },
    {
      label: 'Avg Win',
      value: `+${metrics.avgWin.toFixed(2)}%`,
      color: 'var(--green)',
    },
    {
      label: 'Avg Loss',
      value: `-${metrics.avgLoss.toFixed(2)}%`,
      color: 'var(--red)',
    },
  ];

  row.innerHTML = m.map(item => `
    <div class="bt-metric-card">
      <div class="bt-metric-label">${item.label}</div>
      <div class="bt-metric-value" style="color:${item.color}">${item.value}</div>
    </div>
  `).join('');
}

// ─── Equity Curve Chart ───
function renderEquityCurve(curveData) {
  const container = document.getElementById('equity-curve-container');
  if (!container) return;
  container.innerHTML = '';

  if (backtestChartInstance) {
    try { backtestChartInstance.remove(); } catch(e) {}
    backtestChartInstance = null;
  }

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  const chart = LightweightCharts.createChart(container, {
    width: container.clientWidth || 900,
    height: 280,
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
    crosshair: { mode: 1 },
    timeScale: { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
    rightPriceScale: { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
  });

  backtestChartInstance = chart;

  const baseLine = 100;
  // Area series for equity curve
  const areaSeries = chart.addAreaSeries({
    topColor: 'rgba(16,185,129,0.3)',
    bottomColor: 'rgba(16,185,129,0.02)',
    lineColor: '#10b981',
    lineWidth: 2,
    title: 'Portfolio Value (base 100)',
  });

  // Color based on whether it's profitable overall
  const finalVal = curveData[curveData.length - 1]?.value ?? 100;
  if (finalVal < baseLine) {
    areaSeries.applyOptions({
      topColor: 'rgba(239,68,68,0.3)',
      bottomColor: 'rgba(239,68,68,0.02)',
      lineColor: '#ef4444',
    });
  }

  areaSeries.setData(curveData.filter(d => d.time && !isNaN(d.value)));

  // Baseline at 100
  const baselineSeries = chart.addLineSeries({
    color: 'rgba(148,163,184,0.3)',
    lineWidth: 1,
    lineStyle: 2,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  baselineSeries.setData(curveData.map(d => ({ time: d.time, value: 100 })));

  chart.timeScale().fitContent();
}

// ─── Trade Log Table ───
function renderTradeLog(trades) {
  const container = document.getElementById('trade-log-table');
  if (!container) return;

  if (trades.length === 0) {
    container.innerHTML = '<div class="news-loading">No trades generated. The strategy conditions were not met for this period.</div>';
    return;
  }

  container.innerHTML = `
    <table class="trade-log-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Entry Date</th>
          <th>Entry ₹</th>
          <th>Exit Date</th>
          <th>Exit ₹</th>
          <th>Hold Days</th>
          <th>P&L %</th>
          <th>Exit Reason</th>
        </tr>
      </thead>
      <tbody>
        ${trades.map((t, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${t.entryDate}</td>
            <td>₹${t.entryPrice.toFixed(2)}</td>
            <td>${t.exitDate}</td>
            <td>₹${t.exitPrice.toFixed(2)}</td>
            <td>${t.holdDays}d</td>
            <td class="${t.isWin ? 'trade-profit' : 'trade-loss'}">${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}%</td>
            <td style="color: var(--text-muted); font-size: 11px">${t.exitReason}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
