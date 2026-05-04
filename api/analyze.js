const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const { image, mode, description, language = 'it' } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required (base64)' });
    }

    // Set instructions based on requested language
    const languageMap = {
      'it': "Rispondi in ITALIANO. Usa un tono tecnico e professionale.",
      'en': "Respond in ENGLISH. Use a technical and professional tone.",
      'de': "Antworten Sie auf DEUTSCH. Verwenden Sie einen technischen und professionellen Ton."
    };

    const langContext = languageMap[language] || languageMap['en'];

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

    // Prepare image for OpenAI (needs data URI format if not already present)
    const formattedImage = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: fullPrompt },
            {
              type: "image_url",
              image_url: {
                "url": formattedImage,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const text = response.choices[0].message.content;

    return res.status(200).json({ 
      success: true, 
      analysis: text,
      mode: mode 
    });

  } catch (error) {
    console.error("OpenAI API Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Errore durante l'analisi dell'immagine.",
      details: error.message 
    });
  }
};
