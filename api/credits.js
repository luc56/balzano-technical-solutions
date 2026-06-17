const { kv } = require("@vercel/kv");

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let searchKey = '';
  let type = '';

  // Retrieve parameters from GET query or POST body
  const method = req.method;
  let code = '';
  let deviceId = '';

  if (method === 'GET') {
    code = req.query.code;
    deviceId = req.query.deviceId;
  } else if (method === 'POST') {
    code = req.body ? req.body.code : '';
    deviceId = req.body ? req.body.deviceId : '';
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (code) {
    searchKey = `code:${code}`;
    type = 'code';
  } else if (deviceId) {
    searchKey = `device:${deviceId}:free_calls`;
    type = 'device';
  }

  if (!searchKey) {
    return res.status(400).json({ success: false, error: 'missing_parameters', message: 'Codice o ID dispositivo mancante.' });
  }

  try {
    const isKvConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
    if (!isKvConfigured) {
      return res.status(500).json({ success: false, error: 'kv_not_configured', message: 'Database KV non configurato.' });
    }

    const value = await kv.get(searchKey);

    if (type === 'code') {
      if (value === null || value === undefined) {
        return res.status(404).json({ success: false, error: 'code_not_found', message: 'Codice non trovato.' });
      }
      return res.status(200).json({
        success: true,
        type: 'code',
        key: code,
        credits: parseInt(value)
      });
    } else {
      // Device: free calls track (max 2 free)
      const freeCalls = value ? parseInt(value) : 0;
      const remainingFree = Math.max(0, 2 - freeCalls);
      return res.status(200).json({
        success: true,
        type: 'device',
        key: deviceId,
        credits: remainingFree
      });
    }
  } catch (error) {
    console.error("KV Credits Error:", error);
    return res.status(500).json({ success: false, error: 'database_error', message: error.message });
  }
};
