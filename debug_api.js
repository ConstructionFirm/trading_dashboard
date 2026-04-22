const fs = require('fs');

const API_CONFIG = {
  NSE_RUBY_BASE: 'https://nse-api-ruby.vercel.app',
  FMP_KEY: 'MSYnvjjcS8HU7D93Fz7dUn9YXslByfXH',
  FMP_BASE: 'https://financialmodelingprep.com/stable',
  YF_BASE: 'https://query1.finance.yahoo.com'
};

const userSymbol = 'richa';
const fmpYahooSymbol = userSymbol.toUpperCase() + '.NS';
const nseRubySymbol = userSymbol.toUpperCase();

async function fetchAPI(name, url) {
    try {
        const res = await fetch(url);
        const text = await res.text();
        let parsed = text;
        try {
            parsed = JSON.parse(text);
        } catch(e) {}
        return {
            name: name,
            url: url.replace(API_CONFIG.FMP_KEY, 'HIDDEN_KEY'),
            response: parsed
        };
    } catch (e) {
        return {
            name: name,
            url: url.replace(API_CONFIG.FMP_KEY, 'HIDDEN_KEY'),
            response: { error: e.message }
        };
    }
}

async function run() {
    const output = {};
    
    // Price API (FMP)
    output["api_fmp_price"] = await fetchAPI(
        "FMP Price API (historical-price-eod/full)", 
        `${API_CONFIG.FMP_BASE}/historical-price-eod/full?symbol=${fmpYahooSymbol}&apikey=${API_CONFIG.FMP_KEY}`
    );

    // Fallback Price API (Yahoo)
    output["api_yahoo_price"] = await fetchAPI(
        "Yahoo Finance Price API", 
        `${API_CONFIG.YF_BASE}/v8/finance/chart/${fmpYahooSymbol}?interval=1d&range=1y`
    );

    // Fundamentals API (NSE Ruby Direct)
    output["api_nse_ruby_fundamentals"] = await fetchAPI(
        "NSE Ruby Direct Detail API", 
        `${API_CONFIG.NSE_RUBY_BASE}/stock?symbol=${nseRubySymbol}`
    );

    // Fundamentals API (FMP Quote)
    output["api_fmp_quote"] = await fetchAPI(
        "FMP Quote API", 
        `${API_CONFIG.FMP_BASE}/quote?symbol=${fmpYahooSymbol}&apikey=${API_CONFIG.FMP_KEY}`
    );

    // Fundamentals API (FMP Profile)
    output["api_fmp_profile"] = await fetchAPI(
        "FMP Profile API", 
        `${API_CONFIG.FMP_BASE}/profile?symbol=${fmpYahooSymbol}&apikey=${API_CONFIG.FMP_KEY}`
    );

    // Fundamentals API (FMP Ratios)
    output["api_fmp_ratios"] = await fetchAPI(
        "FMP Ratios API", 
        `${API_CONFIG.FMP_BASE}/ratios-ttm?symbol=${fmpYahooSymbol}&apikey=${API_CONFIG.FMP_KEY}`
    );

    // Fundamentals API (FMP Growth)
    output["api_fmp_growth"] = await fetchAPI(
        "FMP Financial Growth API", 
        `${API_CONFIG.FMP_BASE}/financial-growth?symbol=${fmpYahooSymbol}&limit=1&apikey=${API_CONFIG.FMP_KEY}`
    );

    // Fallback Fundamentals API (Yahoo)
    output["api_yahoo_summary"] = await fetchAPI(
        "Yahoo Quote Summary (Fundamentals API)", 
        `${API_CONFIG.YF_BASE}/v10/finance/quoteSummary/${fmpYahooSymbol}?modules=defaultKeyStatistics,financialData,summaryDetail,summaryProfile,price`
    );

    // Sentiment/Score API (FMP News)
    output["api_fmp_news"] = await fetchAPI(
        "FMP News API (Sentiment Source)", 
        `${API_CONFIG.FMP_BASE}/stock_news?tickers=${fmpYahooSymbol}&limit=10&apikey=${API_CONFIG.FMP_KEY}`
    );

    fs.writeFileSync('api_responses.json', JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
}

run();
