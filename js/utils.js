/* ═══════════════════════════════════════════════
   utils.js — Technical Indicator Mathematics
   EMA, RSI, MACD, ATR, VWAP, Support/Resistance
   ═══════════════════════════════════════════════ */

'use strict';

// ─── EMA (Exponential Moving Average) ───
function calcEMA(closes, period) {
  if (!closes || closes.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];
  let sum = 0;

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      sum += closes[i];
      result.push(null);
      continue;
    }
    if (i === period - 1) {
      sum += closes[i];
      const sma = sum / period;
      result.push(sma);
      continue;
    }
    const prev = result[i - 1];
    result.push((closes[i] - prev) * k + prev);
  }
  return result;
}

// ─── SMA (Simple Moving Average) ───
function calcSMA(closes, period) {
  const result = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    result.push(sum / period);
  }
  return result;
}

// ─── RSI (Wilder's Smoothing) ───
function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return [];
  const result = new Array(period).fill(null);
  const changes = [];

  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs0 = avgLoss === 0 ? 999 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs0));

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 999 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

// ─── MACD ───
function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);

  const macdLine = emaFast.map((v, i) =>
    v !== null && emaSlow[i] !== null ? v - emaSlow[i] : null
  );

  // Compute signal line from valid MACD values only
  const firstValidIdx = macdLine.findIndex(v => v !== null);
  const validMacd = macdLine.slice(firstValidIdx);
  const k = 2 / (signal + 1);
  const signalArr = [];
  let prevSignal = null;

  for (let i = 0; i < validMacd.length; i++) {
    if (i < signal - 1) { signalArr.push(null); continue; }
    if (i === signal - 1) {
      let s = 0;
      for (let j = 0; j <= i; j++) s += validMacd[j];
      prevSignal = s / signal;
      signalArr.push(prevSignal);
      continue;
    }
    prevSignal = (validMacd[i] - prevSignal) * k + prevSignal;
    signalArr.push(prevSignal);
  }

  const signalFull = new Array(firstValidIdx).fill(null).concat(signalArr);
  const histogram = macdLine.map((v, i) =>
    v !== null && signalFull[i] !== null ? v - signalFull[i] : null
  );

  return { macdLine, signalLine: signalFull, histogram };
}

// ─── ATR (Average True Range, Wilder) ───
function calcATR(highs, lows, closes, period = 14) {
  if (!closes || closes.length < 2) return [];
  const tr = [];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hcp = Math.abs(highs[i] - closes[i - 1]);
    const lcp = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(hl, hcp, lcp));
  }

  const result = [null]; // offset for the missing first candle
  let avgTR = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period - 1; i++) result.push(null);
  result.push(avgTR);

  for (let i = period; i < tr.length; i++) {
    avgTR = (avgTR * (period - 1) + tr[i]) / period;
    result.push(avgTR);
  }
  return result;
}

// ─── VWAP (Cumulative) ───
function calcVWAP(highs, lows, closes, volumes) {
  const vwap = [];
  let cumTPV = 0, cumVol = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * volumes[i];
    cumVol += volumes[i];
    vwap.push(cumVol === 0 ? closes[i] : cumTPV / cumVol);
  }
  return vwap;
}

// ─── Average Volume ───
function avgVolume(volumes, period = 20) {
  if (!volumes || volumes.length === 0) return 0;
  const recent = volumes.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

// ─── Support / Resistance (swing highs/lows) ───
function findSupportResistance(highs, lows, closes, lookback = 20) {
  const len = closes.length;
  const recentHighs = highs.slice(Math.max(0, len - lookback));
  const recentLows = lows.slice(Math.max(0, len - lookback));
  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);
  const currentPrice = closes[len - 1];
  return { support, resistance, currentPrice };
}

// ─── Pivot Points (daily) ───
function calcPivot(high, low, close) {
  const p = (high + low + close) / 3;
  return {
    pivot: p,
    r1: 2 * p - low,
    s1: 2 * p - high,
    r2: p + (high - low),
    s2: p - (high - low),
  };
}

// ─── Golden/Death Cross detector ───
function detectCross(ema50, ema200) {
  const n = Math.min(ema50.length, ema200.length);
  if (n < 2) return 'none';

  // Find last two valid values
  let valid = [];
  for (let i = n - 1; i >= 0 && valid.length < 2; i--) {
    if (ema50[i] !== null && ema200[i] !== null) valid.push(i);
  }
  if (valid.length < 2) return ema50[n - 1] > ema200[n - 1] ? 'above' : 'below';

  const [curr, prev] = valid;
  const prev50 = ema50[prev], prev200 = ema200[prev];
  const curr50 = ema50[curr], curr200 = ema200[curr];

  if (prev50 < prev200 && curr50 > curr200) return 'golden';
  if (prev50 > prev200 && curr50 < curr200) return 'death';
  return curr50 > curr200 ? 'above' : 'below';
}

// ─── Breakout / Breakdown detection ───
function detectBreakout(closes, highs, lows, lookback = 20) {
  const len = closes.length;
  if (len < lookback + 2) return 'none';
  const refHighs = highs.slice(len - lookback - 2, len - 2);
  const refLows = lows.slice(len - lookback - 2, len - 2);
  const recentClose = closes[len - 1];
  const prevHigh = Math.max(...refHighs);
  const prevLow = Math.min(...refLows);

  const breakoutPct = (recentClose - prevHigh) / prevHigh;
  const breakdownPct = (prevLow - recentClose) / prevLow;

  if (breakoutPct > 0.02) return 'breakout';
  if (breakdownPct > 0.02) return 'breakdown';
  return 'none';
}

// ─── Trend direction ───
function detectTrend(closes, ema50, ema200) {
  const n = closes.length - 1;
  const c = closes[n];

  // Find latest valid EMAs
  let e50 = null, e200 = null;
  for (let i = ema50.length - 1; i >= 0; i--) {
    if (ema50[i] !== null) { e50 = ema50[i]; break; }
  }
  for (let i = ema200.length - 1; i >= 0; i--) {
    if (ema200[i] !== null) { e200 = ema200[i]; break; }
  }

  if (!e50 || !e200) return 'sideways';
  if (c > e50 && c > e200 && e50 > e200) return 'bullish';
  if (c < e50 && c < e200 && e50 < e200) return 'bearish';
  return 'sideways';
}

// ─── Number Formatters ───
function fmtNum(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return 'N/A';
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(dec) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(dec) + 'B';
  if (abs >= 1e7) return (n / 1e7).toFixed(dec) + 'Cr';
  if (abs >= 1e5) return (n / 1e5).toFixed(dec) + 'L';
  if (abs >= 1e3) return (n / 1e3).toFixed(dec) + 'K';
  return n.toFixed(dec);
}

function fmtINR(n) {
  if (n === null || n === undefined || isNaN(n)) return 'N/A';
  return '₹' + fmtNum(n);
}

function fmtPct(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return 'N/A';
  const sign = n > 0 ? '+' : '';
  return sign + (n * 100).toFixed(dec) + '%';
}

function fmtFixed(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return 'N/A';
  return n.toFixed(dec);
}

function fmtPrice(n) {
  if (n === null || n === undefined || isNaN(n)) return 'N/A';
  return '₹' + n.toFixed(2);
}

// ─── Date Helpers ───
function tsToDateStr(ts) {
  const d = new Date(ts * 1000);
  return d.toISOString().slice(0, 10);
}

function relativeTime(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Color helpers ───
function signColor(val) {
  if (!val && val !== 0) return '';
  return val > 0 ? 'positive' : val < 0 ? 'negative' : '';
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ─── ADX (simplified, for volatility assess) ───
function calcADX(highs, lows, closes, period = 14) {
  if (closes.length < period * 2) return null;
  const tr = [], plusDM = [], minusDM = [];

  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hcp = Math.abs(highs[i] - closes[i - 1]);
    const lcp = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(hl, hcp, lcp));

    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  let smTR = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let smPlus = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smMinus = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

  const dx = [];
  for (let i = period; i < tr.length; i++) {
    smTR = smTR - smTR / period + tr[i];
    smPlus = smPlus - smPlus / period + plusDM[i];
    smMinus = smMinus - smMinus / period + minusDM[i];
    const pdi = (smPlus / smTR) * 100;
    const mdi = (smMinus / smTR) * 100;
    const sum = pdi + mdi;
    dx.push(sum === 0 ? 0 : Math.abs(pdi - mdi) / sum * 100);
  }

  if (dx.length < period) return null;
  return dx.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// ─── Weekly & Monthly resampling ───
function resampleToWeekly(ohlcv) {
  // ohlcv: [{time, open, high, low, close, volume}]
  const weeks = {};
  for (const bar of ohlcv) {
    const d = new Date(bar.time + 'T00:00:00Z');
    // ISO week Monday
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 1 - day);
    const key = d.toISOString().slice(0, 10);
    if (!weeks[key]) weeks[key] = { time: key, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
    else {
      weeks[key].high = Math.max(weeks[key].high, bar.high);
      weeks[key].low = Math.min(weeks[key].low, bar.low);
      weeks[key].close = bar.close;
      weeks[key].volume += bar.volume;
    }
  }
  return Object.values(weeks).sort((a, b) => a.time.localeCompare(b.time));
}

function resampleToMonthly(ohlcv) {
  const months = {};
  for (const bar of ohlcv) {
    const key = bar.time.slice(0, 7);
    if (!months[key]) months[key] = { time: key + '-01', open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
    else {
      months[key].high = Math.max(months[key].high, bar.high);
      months[key].low = Math.min(months[key].low, bar.low);
      months[key].close = bar.close;
      months[key].volume += bar.volume;
    }
  }
  return Object.values(months).sort((a, b) => a.time.localeCompare(b.time));
}
