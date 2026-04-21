# Graph Report - C:\appium\trading_dashboard  (2026-04-21)

## Corpus Check
- 10 files · ~17,724 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 124 nodes · 256 edges · 9 communities detected
- Extraction: 76% EXTRACTED · 24% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `loadAllData()` - 21 edges
2. `renderCharts()` - 13 edges
3. `analyzeStock()` - 10 edges
4. `renderAll()` - 10 edges
5. `runBacktest()` - 10 edges
6. `computeAIScore()` - 10 edges
7. `fmtPrice()` - 10 edges
8. `renderIntradayStrategy()` - 7 edges
9. `renderFundamentals()` - 6 edges
10. `renderMetricCards()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `computeAIScore()` --calls--> `getNewsSentimentScore()`  [INFERRED]
  C:\appium\trading_dashboard\js\scoring.js → C:\appium\trading_dashboard\js\news.js
- `loadAllData()` --calls--> `calcRSI()`  [INFERRED]
  C:\appium\trading_dashboard\js\api.js → C:\appium\trading_dashboard\js\utils.js
- `loadAllData()` --calls--> `calcATR()`  [INFERRED]
  C:\appium\trading_dashboard\js\api.js → C:\appium\trading_dashboard\js\utils.js
- `loadAllData()` --calls--> `calcADX()`  [INFERRED]
  C:\appium\trading_dashboard\js\api.js → C:\appium\trading_dashboard\js\utils.js
- `loadAllData()` --calls--> `avgVolume()`  [INFERRED]
  C:\appium\trading_dashboard\js\api.js → C:\appium\trading_dashboard\js\utils.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (25): extractFundamentals(), fetchChartData(), fetchGNews(), fetchNews(), fetchNewsDataIO(), fetchNiftyData(), fetchQuoteSummary(), fetchWithProxy() (+17 more)

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (13): analyzeStock(), applyTheme(), clearRefreshTimer(), initTheme(), renderAll(), renderSummaryCard(), shakeInput(), showDashboard() (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.22
Nodes (17): buildSeriesData(), destroyCharts(), getChartOptions(), refreshChartThemes(), renderCharts(), renderIndicatorBadges(), renderMACDChart(), renderMainChart() (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.29
Nodes (13): animateMiniBar(), classifyScore(), computeAIScore(), displayScore(), renderDeductions(), renderPillarBar(), renderScoring(), scoreDebt() (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.47
Nodes (8): activateStrategyMode(), recommendMode(), renderIntradayStrategy(), renderStrategy(), renderSwingStrategy(), renderVolatilityCard(), setupStrategyModeTabs(), fmtPrice()

### Community 5 - "Community 5"
Cohesion: 0.39
Nodes (8): renderSmartInsight(), classifyFundamentals(), renderClassification(), renderFlags(), renderFundamentals(), renderMetricCards(), fmtFixed(), fmtINR()

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (7): escapeHtml(), getNewsSentimentScore(), renderDriverAnalysis(), renderNews(), renderNewsArticles(), renderNiftyCorrelation(), renderSentimentSummary()

### Community 7 - "Community 7"
Cohesion: 0.42
Nodes (8): buildEquityCurve(), computeBacktestMetrics(), renderBacktest(), renderBacktestMetrics(), renderEquityCurve(), renderTradeLog(), runBacktest(), setupBacktestControls()

### Community 8 - "Community 8"
Cohesion: 0.6
Nodes (4): computePrediction(), displayPrediction(), renderPrediction(), clamp()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `renderAll()` connect `Community 1` to `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`?**
  _High betweenness centrality (0.294) - this node is a cross-community bridge._
- **Why does `loadAllData()` connect `Community 0` to `Community 1`, `Community 2`?**
  _High betweenness centrality (0.205) - this node is a cross-community bridge._
- **Why does `analyzeStock()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `loadAllData()` (e.g. with `calcEMA()` and `calcRSI()`) actually correct?**
  _`loadAllData()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `renderCharts()` (e.g. with `calcEMA()` and `calcRSI()`) actually correct?**
  _`renderCharts()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `renderAll()` (e.g. with `renderFundamentals()` and `renderTechnical()`) actually correct?**
  _`renderAll()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `runBacktest()` (e.g. with `calcEMA()` and `calcRSI()`) actually correct?**
  _`runBacktest()` has 3 INFERRED edges - model-reasoned connections that need verification._