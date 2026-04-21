/* ═══════════════════════════════════════════════
   news.js — Module 4
   News Sentiment + Market Driver Classification
   Nifty Correlation, Company vs Sector vs Market
   ═══════════════════════════════════════════════ */

'use strict';

// ─── Keyword-based sentiment classifier ───
const POSITIVE_KEYWORDS = [
  'profit', 'revenue', 'growth', 'beats', 'record', 'upgrade', 'buy', 'bullish',
  'expansion', 'wins', 'strong', 'surge', 'gain', 'rises', 'jumps', 'upbeat',
  'outperform', 'deal', 'partnership', 'acquisition', 'dividend', 'buyback',
  'launch', 'innovation', 'capex', 'order', 'approval', 'positive', 'rally',
  'exceeds', 'robust', 'beat expectations', 'ipo', 'listing', 'premium',
];

const NEGATIVE_KEYWORDS = [
  'loss', 'decline', 'fall', 'drop', 'miss', 'downgrade', 'sell', 'bearish',
  'layoff', 'fraud', 'penalty', 'fine', 'debt', 'bankruptcy', 'default',
  'lawsuit', 'recall', 'probe', 'investigation', 'corruption', 'crisis',
  'cut', 'weak', 'lower', 'disappoints', 'concern', 'warning', 'risk',
  'below expectations', 'shrink', 'pressure', 'challenging', 'volatile',
];

function classifyNewsSentiment(title, description) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  let posScore = 0, negScore = 0;

  POSITIVE_KEYWORDS.forEach(kw => { if (text.includes(kw)) posScore++; });
  NEGATIVE_KEYWORDS.forEach(kw => { if (text.includes(kw)) negScore++; });

  if (posScore > negScore) return 'positive';
  if (negScore > posScore) return 'negative';
  return 'neutral';
}

// ─── Main render function ───
function renderNews(data) {
  const { news, nifty, price, indicators } = data;

  renderNiftyCorrelation(nifty, price);
  renderNewsArticles(news);
  renderSentimentSummary(news);
  renderDriverAnalysis(news, nifty, price, indicators, data.sector);
}

// ─── Nifty 50 Correlation ───
function renderNiftyCorrelation(nifty, price) {
  if (!nifty) {
    document.getElementById('nifty-price').textContent = 'N/A';
    document.getElementById('nifty-change').textContent = 'Unavailable';
    document.getElementById('correlation-insight').textContent = 'Nifty data unavailable.';
    return;
  }

  const niftyEl = document.getElementById('nifty-price');
  const niftyChgEl = document.getElementById('nifty-change');
  const corrInsight = document.getElementById('correlation-insight');
  const stockChgEl = document.getElementById('corr-stock-change');
  const arrowEl = document.getElementById('correlation-arrow');

  niftyEl.textContent = fmtPrice(nifty.price);

  const niftyPct = nifty.changePercent * 100;
  const stockPct = price.dayChangePct * 100;

  niftyChgEl.textContent = `${niftyPct >= 0 ? '+' : ''}${niftyPct.toFixed(2)}%`;
  niftyChgEl.className = `nifty-change ${niftyPct >= 0 ? 'bullish-text' : 'bearish-text'}`;

  stockChgEl.textContent = `${stockPct >= 0 ? '+' : ''}${stockPct.toFixed(2)}%`;
  stockChgEl.className = `nifty-price ${stockPct >= 0 ? 'bullish-text' : 'bearish-text'}`;

  // Correlation inference
  const sameDir = (niftyPct >= 0 && stockPct >= 0) || (niftyPct < 0 && stockPct < 0);
  const stockMagnitude = Math.abs(stockPct);
  const niftyMagnitude = Math.abs(niftyPct);

  if (sameDir) {
    arrowEl.textContent = '≈';
    if (stockMagnitude > niftyMagnitude * 1.5) {
      corrInsight.textContent = `${data ? 'Stock' : 'Stock'} is moving in the same direction as Nifty 50 but with significantly more strength (${(stockMagnitude / niftyMagnitude).toFixed(1)}x), suggesting stock-specific catalysts amplifying market momentum.`;
    } else {
      corrInsight.textContent = `Stock is moving in line with Nifty 50 — this appears to be broad market-driven movement rather than company-specific news.`;
    }
  } else {
    arrowEl.textContent = '≠';
    corrInsight.textContent = `Stock is diverging from Nifty 50 (Nifty: ${niftyPct >= 0 ? '+' : ''}${niftyPct.toFixed(2)}% vs Stock: ${stockPct >= 0 ? '+' : ''}${stockPct.toFixed(2)}%) — strong company-specific or sector-specific driver at play.`;
  }
}

// ─── News Articles ───
function renderNewsArticles(articles) {
  const list = document.getElementById('news-list');

  if (!articles || articles.length === 0) {
    list.innerHTML = '<div class="news-loading">No news found for this stock.</div>';
    return;
  }

  const analyzed = articles.map(article => ({
    ...article,
    sentiment: classifyNewsSentiment(article.title, article.description),
  }));

  list.innerHTML = analyzed.map(item => {
    const sentClass = item.sentiment === 'positive' ? 'positive' : item.sentiment === 'negative' ? 'negative' : 'neutral-news';
    const sentLabel = item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1);
    const timeAgo = relativeTime(item.publishedAt);
    const isSimulated = item._isSimulated ? ' · Sample Data' : '';

    return `
      <a class="news-item ${sentClass}" href="${item.url}" target="_blank" rel="noopener noreferrer">
        <div class="news-sentiment-dot"></div>
        <div class="news-content">
          <div class="news-title">${escapeHtml(item.title)}</div>
          <div class="news-meta">
            <span>${escapeHtml(item.source || 'Unknown')}</span>
            <span>${timeAgo}${isSimulated}</span>
            <span style="color: ${sentClass === 'positive' ? 'var(--green)' : sentClass === 'negative' ? 'var(--red)' : 'var(--yellow)'}">${sentLabel}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

// ─── Sentiment Summary Bars ───
function renderSentimentSummary(articles) {
  if (!articles || articles.length === 0) return;

  const sentiments = articles.map(a => classifyNewsSentiment(a.title, a.description));
  const pos = sentiments.filter(s => s === 'positive').length;
  const neg = sentiments.filter(s => s === 'negative').length;
  const neu = sentiments.filter(s => s === 'neutral').length;
  const total = sentiments.length;

  document.getElementById('pos-sent-bar').style.width = `${(pos / total) * 100}%`;
  document.getElementById('neu-sent-bar').style.width = `${(neu / total) * 100}%`;
  document.getElementById('neg-sent-bar').style.width = `${(neg / total) * 100}%`;
  document.getElementById('pos-sent-count').textContent = pos;
  document.getElementById('neu-sent-count').textContent = neu;
  document.getElementById('neg-sent-count').textContent = neg;
}

// ─── Driver Analysis ───
function renderDriverAnalysis(articles, nifty, price, indicators, sector) {
  const sentiments = (articles || []).map(a => classifyNewsSentiment(a.title, a.description));
  const posCount = sentiments.filter(s => s === 'positive').length;
  const negCount = sentiments.filter(s => s === 'negative').length;
  const totalNews = sentiments.length;
  const positivityRatio = totalNews > 0 ? posCount / totalNews : 0.5;

  // Company-specific driver score
  const hasStrongNews = totalNews >= 3 && (posCount > totalNews * 0.6 || negCount > totalNews * 0.6);
  const companyScore = hasStrongNews ? 'High Impact' : totalNews > 1 ? 'Moderate Impact' : 'Low Signal';
  const companyPrimary = hasStrongNews;

  // Market driver score
  let marketScore = 'Unclear';
  let marketPrimary = false;
  if (nifty) {
    const niftyPct = Math.abs(nifty.changePercent);
    const stockPct = Math.abs(price.dayChangePct);
    const sameDir = (nifty.changePercent * price.dayChangePct) > 0;
    if (sameDir && niftyPct > 0.005) {
      marketScore = niftyPct > 0.01 ? 'Strong Market Move' : 'Moderate Market Move';
      marketPrimary = !companyPrimary && stockPct < niftyPct * 2;
    } else {
      marketScore = 'Market Not Driving';
    }
  }

  // Sector driver score (inferred from trend + sector)
  const trend = indicators.trend;
  const sectorScore = trend === 'bullish' ? 'Sector Tailwind' : trend === 'bearish' ? 'Sector Headwind' : 'Neutral Sector';
  const sectorPrimary = !companyPrimary && !marketPrimary;

  // Update UI
  document.getElementById('driver-company-val').textContent = companyScore;
  document.getElementById('driver-sector-val').textContent = sectorScore;
  document.getElementById('driver-market-val').textContent = marketScore;

  // Highlight primary driver
  ['driver-company', 'driver-sector', 'driver-market'].forEach(id => {
    document.getElementById(id).classList.remove('primary-driver');
  });

  let primaryDriverText = '';
  if (companyPrimary) {
    document.getElementById('driver-company').classList.add('primary-driver');
    const sentiment = positivityRatio > 0.6 ? 'positive company-specific' : 'negative company-specific';
    primaryDriverText = `🏢 PRIMARY DRIVER: Company-specific news — ${sentiment} news flow (${posCount} positive, ${negCount} negative headlines). The stock's movement appears driven by company fundamentals, earnings updates, or corporate announcements rather than broader market forces.`;
  } else if (marketPrimary) {
    document.getElementById('driver-market').classList.add('primary-driver');
    const mktDir = nifty?.changePercent > 0 ? 'bullish (Nifty up' : 'bearish (Nifty down';
    primaryDriverText = `📊 PRIMARY DRIVER: Broad market movement — ${mktDir} ${Math.abs(nifty?.changePercent * 100).toFixed(2)}%). The stock is tracking the overall Nifty 50 direction. No strong company-specific catalyst detected.`;
  } else {
    document.getElementById('driver-sector').classList.add('primary-driver');
    primaryDriverText = `🏭 PRIMARY DRIVER: Sector rotation — the ${sector || 'sector'} appears to be experiencing a ${trend} phase. The stock is likely moving with its peer group. Monitor sector-level ETFs and peer stocks to confirm.`;
  }

  document.getElementById('primary-driver-badge').textContent =
    companyPrimary ? 'Company-Specific' : marketPrimary ? 'Market-Wide' : 'Sector Rotation';
  document.getElementById('primary-driver-text').textContent = primaryDriverText;
}

// ─── Get overall news sentiment (used by scoring.js) ───
function getNewsSentimentScore(articles) {
  if (!articles || articles.length === 0) return { score: 5, positivityRatio: 0.5 };
  const sentiments = articles.map(a => classifyNewsSentiment(a.title, a.description));
  const pos = sentiments.filter(s => s === 'positive').length;
  const neg = sentiments.filter(s => s === 'negative').length;
  const total = sentiments.length;
  const ratio = pos / total;

  let score = 5;
  if (ratio >= 0.7) score = 10;
  else if (ratio >= 0.5) score = 7;
  else if (ratio <= 0.3) score = 2;
  else score = 5;

  return { score, positivityRatio: ratio };
}

// ─── Safe HTML escape ───
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
