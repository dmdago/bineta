const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;
const BINANCE_ENV = process.env.BINANCE_ENV;
const PROD_URL = process.env.BINANCE_PROD_URL;
const TESTNET_URL = process.env.BINANCE_TESTNET_URL;
const BASE_URL = BINANCE_ENV === 'testnet' ? TESTNET_URL : PROD_URL;

async function sendSignedRequest(method, endpoint, params = {}) {
  params.timestamp = Date.now();

  const queryString = new URLSearchParams(params).toString();
  
  const signature = crypto
    .createHmac('sha256', API_SECRET)
    .update(queryString)
    .digest('hex');

  const finalQuery = queryString + '&signature=' + signature;
  const url = BASE_URL + endpoint;
  const headers = { 'X-MBX-APIKEY': API_KEY };

  try {
    if (method === 'GET') {
      const response = await axios.get(url + '?' + finalQuery, { headers });
      return response.data;
    } else if (method === 'POST') {
      const response = await axios.post(url + '?' + finalQuery, null, { headers });
      return response.data;
    }
  } catch (error) {
    console.error(`Error en ${method} ${endpoint}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

async function getBalance(asset) {
  const accountInfo = await sendSignedRequest('GET', '/api/v3/account');
  const assetBalance = accountInfo.balances.find(b => b.asset === asset);
  return assetBalance ? parseFloat(assetBalance.free) : 0;
}

async function buyCrypto(amount, baseAsset, quoteAsset, orderType, limitPrice = null) {
  const symbol = baseAsset + quoteAsset;

  if (typeof amount === 'string' && amount.toLowerCase() === 'all') {
    amount = await getBalance(quoteAsset);
    console.log(`Using full balance of ${quoteAsset}: ${amount}`);
  }

  if (orderType.toLowerCase() === 'limit') {
    if (!limitPrice) {
      throw new Error('Limit price must be provided for limit orders.');
    }
    const quantity = parseFloat(amount) / parseFloat(limitPrice);
    const params = {
      symbol,
      side: 'BUY',
      type: 'LIMIT',
      timeInForce: 'GTC',
      quantity: quantity.toFixed(8),
      price: parseFloat(limitPrice).toFixed(8)
    };
    return await sendSignedRequest('POST', '/api/v3/order', params);
  } else {
    
    const params = {
      symbol,
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: amount.toString()
    };
    return await sendSignedRequest('POST', '/api/v3/order', params);
  }
}

async function sellCrypto(amount, baseAsset, quoteAsset, orderType, limitPrice = null) {
  const symbol = baseAsset + quoteAsset;

  if (typeof amount === 'string' && amount.toLowerCase() === 'all') {
    amount = await getBalance(baseAsset);
    console.log(`Using full balance of ${baseAsset}: ${amount}`);
  }

  if (orderType.toLowerCase() === 'limit') {
    if (!limitPrice) {
      throw new Error('Limit price must be provided for limit orders.');
    }
    const params = {
      symbol,
      side: 'SELL',
      type: 'LIMIT',
      timeInForce: 'GTC',
      quantity: parseFloat(amount).toFixed(8),
      price: parseFloat(limitPrice).toFixed(8)
    };
    return await sendSignedRequest('POST', '/api/v3/order', params);
  } else {
    const params = {
      symbol,
      side: 'SELL',
      type: 'MARKET',
      quantity: parseFloat(amount).toFixed(8)
    };
    return await sendSignedRequest('POST', '/api/v3/order', params);
  }
}

(async () => {
  try {
    const buyResponse = await buyCrypto('all', 'BTC', 'USDT', 'market');
    console.log('Market Buy Response:', buyResponse);

    const sellResponse = await sellCrypto('all', 'BTC', 'USDT', 'limit', 50000);
    console.log('Limit Sell Response:', sellResponse);
  } catch (error) {
    console.error('Trade Error:', error);
  }
})();
