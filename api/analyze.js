const OpenAI = require("openai");
const { kv } = require("@vercel/kv");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const errorMessages = {
  it: {
    insufficient_quota: "Credito OpenAI esaurito o piano non attivo. Per favore, acquista dei token su OpenAI per procedere.",
    rate_limit_exceeded: "Troppe richieste in breve tempo. Riprova tra poco.",
    model_not_found: "Modello AI non disponibile al momento.",
    invalid_api_key: "Chiave API OpenAI non valida. Controlla la configurazione su Vercel.",
    default: "Errore durante l'analisi dell'immagine.",
    timeout: "La richiesta ha impiegato troppo tempo. Riprova con un'immagine più piccola.",
    unknown: "Errore imprevisto",
    config_missing: "Configurazione Server Errata (Chiave API mancante).",
    quota_exceeded: "Quota gratuita esaurita. Inserisci un codice di attivazione per continuare.",
    invalid_code: "Codice di attivazione non valido o errato.",
    code_depleted: "Questo codice di attivazione ha esaurito i crediti disponibili."
  },
  en: {
    insufficient_quota: "OpenAI credit exhausted or plan not active. Please purchase tokens on OpenAI to proceed.",
    rate_limit_exceeded: "Too many requests in a short time. Please try again later.",
    model_not_found: "AI model currently unavailable.",
    invalid_api_key: "Invalid OpenAI API key. Check the configuration on Vercel.",
    default: "Error during image analysis.",
    timeout: "The request took too long. Try again with a smaller image.",
    unknown: "Unexpected error",
    config_missing: "Server Configuration Error (Missing API Key).",
    quota_exceeded: "Free quota exhausted. Enter an activation code to continue.",
    invalid_code: "Invalid or incorrect activation code.",
    code_depleted: "This activation code has run out of available credits."
  },
  de: {
    insufficient_quota: "OpenAI-Guthaben erschöpft oder Plan nicht aktiv. Bitte kaufen Sie Token auf OpenAI, um fortzufahren.",
    rate_limit_exceeded: "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es später noch einmal.",
    model_not_found: "KI-Modell derzeit nicht verfügbar.",
    invalid_api_key: "Ungültiger OpenAI-API-Schlüssel. Überprüfen Sie die Konfiguration auf Vercel.",
    default: "Fehler bei der Bildanalyse.",
    timeout: "Die Anfrage hat zu lange gedauert. Versuchen Sie es mit einem kleineren Bild erneut.",
    unknown: "Unerwarteter Fehler",
    config_missing: "Serverkonfigurationsfehler (Fehlender API-Schlüssel).",
    quota_exceeded: "Freies Kontingent erschöpft. Geben Sie einen Aktivierungscode ein, um fortzufahren.",
    invalid_code: "Ungültiger oder falscher Aktivierungscode.",
    code_depleted: "Dieser Aktivierungscode hat keine verfügbaren Credits mehr."
  }
};

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      const lang = req.body.language || 'it';
      const msg = (errorMessages[lang] || errorMessages['en']).config_missing;
      return res.status(500).json({ 
        success: false, 
        error: msg,
        message: msg,
        details: "OPENAI_API_KEY is not defined in environment variables."
      });
    }

    const { image, mode, description, language = 'it', deviceId, code } = req.body;
    const lang = language; // Helper for error messages

    // Check if KV is configured
    const isKvConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
    if (!isKvConfigured) {
      return res.status(500).json({
        success: false,
        error: lang === 'it' ? 'Database KV non configurato su Vercel.' : 'KV Database not configured on Vercel.',
        code: 'kv_not_configured'
      });
    }

    if (!image && !description) {
      return res.status(400).json({ error: 'Image or description is required.' });
    }

    // 1. Quota & Code Check using Vercel KV
    const clientDevice = deviceId || req.headers['x-forwarded-for'] || 'unknown_device';
    let isFreeCall = false;
    let currentFreeCalls = 0;
    let remainingCredits = 0;
    let codeCredits = 0;

    const freeCallsKey = `device:${clientDevice}:free_calls`;
    const rawFreeCalls = await kv.get(freeCallsKey);
    currentFreeCalls = rawFreeCalls ? parseInt(rawFreeCalls) : 0;

    if (currentFreeCalls < 2) {
      isFreeCall = true;
      remainingCredits = 2 - (currentFreeCalls + 1); // how many free calls are left after this one
    } else {
      // Free quota exceeded, check for activation code
      if (!code) {
        const msg = (errorMessages[lang] || errorMessages['en']).quota_exceeded;
        return res.status(403).json({
          success: false,
          error: msg,
          code: "quota_exceeded",
          needCode: true
        });
      }

      const codeKey = `code:${code}`;
      const rawCodeCredits = await kv.get(codeKey);

      if (rawCodeCredits === null || rawCodeCredits === undefined) {
        const msg = (errorMessages[lang] || errorMessages['en']).invalid_code;
        return res.status(403).json({
          success: false,
          error: msg,
          code: "invalid_code"
        });
      }

      codeCredits = parseInt(rawCodeCredits);
      if (codeCredits <= 0) {
        const msg = (errorMessages[lang] || errorMessages['en']).code_depleted;
        return res.status(403).json({
          success: false,
          error: msg,
          code: "code_depleted"
        });
      }

      remainingCredits = codeCredits - 1;
    }

    // Set instructions based on requested language
    const languageMap = {
      'it': "Rispondi in ITALIANO. Usa un tono tecnico e professionale.",
      'en': "Respond in ENGLISH. Use a technical and professional tone.",
      'de': "Antworten Sie auf DEUTSCH. Verwenden Sie einen technischen und professionellen Ton."
    };

    const langContext = languageMap[lang] || languageMap['en'];

    // Define Prompts based on mode
    let taskInstructions = "";
    switch (mode) {
      case 'info':
        taskInstructions = "Identify the electrical component or part of the electrical cabinet. Provide technical details, brand, and main functions.";
        break;
      case 'faults':
        taskInstructions = `Analyze the image for visible faults (burn marks, loose wires, oxidation). Consider user symptoms: "${description || 'none'}". List potential issues.`;
        break;
      case 'suggestions':
        taskInstructions = `Provide technical maintenance or troubleshooting suggestions. If a problem was described ("${description || 'none'}"), suggest safety-first troubleshooting steps.`;
        break;
      default:
        taskInstructions = "Provide a general technical analysis of the visible component.";
    }

    const fullPrompt = `${langContext} ${taskInstructions}`;

    const userContent = [{ type: "text", text: fullPrompt }];
    
    if (image) {
      const formattedImage = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
      userContent.push({
        type: "image_url",
        image_url: { "url": formattedImage }
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
      max_tokens: 1000,
    });

    const text = response.choices[0].message.content;

    // Update KV after successful OpenAI response
    if (isFreeCall) {
      await kv.set(freeCallsKey, currentFreeCalls + 1);
    } else {
      await kv.set(`code:${code}`, remainingCredits);
    }

    return res.status(200).json({ 
      success: true, 
      analysis: text,
      usage: response.usage,
      mode: mode,
      isFree: isFreeCall,
      remainingCredits: remainingCredits
    });

  } catch (error) {
    console.error("OpenAI API Error:", error);
    
    const lang = req.body.language || 'it';
    const dict = errorMessages[lang] || errorMessages['en'];
    let userMessage = dict.default;
    let statusCode = 500;

    if (error instanceof OpenAI.APIError) {
      statusCode = error.status || 500;
      switch (error.code) {
        case 'insufficient_quota':
          userMessage = dict.insufficient_quota;
          break;
        case 'rate_limit_exceeded':
          userMessage = dict.rate_limit_exceeded;
          break;
        case 'model_not_found':
          userMessage = dict.model_not_found;
          break;
        case 'invalid_api_key':
          userMessage = dict.invalid_api_key;
          break;
        default:
          userMessage = `Errore AI (${error.code || 'unknown'}): ${error.message}`;
      }
    } else if (error.message && error.message.includes('timeout')) {
      statusCode = 504;
      userMessage = dict.timeout;
    } else {
      userMessage = `${dict.unknown}: ${error.message}`;
    }

    return res.status(statusCode).json({ 
      success: false, 
      error: userMessage,
      message: userMessage, // Aggiunto per compatibilità app
      details: error.message,
      code: error.code || 'internal_error'
    });
  }

};
