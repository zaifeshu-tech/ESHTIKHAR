import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI client with required aistudio-build telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Multi-turn Gemini Chat endpoint for LPG Agency Operations Assistant
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, systemInstruction, model } = req.body;

    // Use requested model or default to gemini-3.8-flash per guidelines
    const selectedModel = model === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash';

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    // Convert client message format to @google/genai contents
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || m.text || '') }],
    }));

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        systemInstruction:
          systemInstruction ||
          `You are the dedicated LPG Operations & Deduplication AI Assistant for BharatGas Highway Distributors (Lucknow Circle, IST timezone).
You help agency staff and admins with:
1. Consumer number lookup, format verification (BH-0, CX, DX, and 10-digit formats).
2. Daily, 30-day, and monthly duplicate cylinder delivery checks and explanations.
3. Delivery man performance and delivery route allocation.
4. LPG cylinder technical and safety standards: 14.2 kg domestic cylinder, 15.8 kg tare weight, 30.0 kg gross weight, pressure relief valve, burst disc test, and O-ring inspection.
5. Gas science: Propane (C3H8), Butane (C4H10), Ethyl Mercaptan odorant (0.5 ppb detection threshold), combustion safety, and leakage emergency response.
Keep answers professional, accurate, concise, and helpful for LPG distributors.`,
      },
    });

    const reply = response.text || 'I processed your request, but received an empty response.';
    return res.json({ reply });
  } catch (error: any) {
    console.error('Gemini server error:', error);
    // Provide a helpful, informative response if API key is not configured or network error occurs
    return res.status(500).json({
      error: error.message || 'Gemini API call failed',
      fallback:
        'I am currently operating in offline mode. Please ensure GEMINI_API_KEY is configured in Settings > Secrets to unlock full live AI responses.',
    });
  }
});

// PubChem proxy for LPG molecular science and safety properties
app.get('/api/science/pubchem/:compound', async (req, res) => {
  try {
    const { compound } = req.params;
    const cidMap: Record<string, number> = {
      propane: 6334,
      butane: 7843,
      isobutane: 6336,
      mercaptan: 7824, // ethanethiol
      ethanethiol: 7824,
    };
    const cid = cidMap[compound.toLowerCase()] || 6334;
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES/JSON`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'Failed to fetch PubChem data' });
    }
    const data = await resp.json();
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LPG agency server running on http://localhost:${PORT}`);
  });
}

start();
