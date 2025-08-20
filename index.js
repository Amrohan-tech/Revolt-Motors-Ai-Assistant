const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));


// In-memory storage for conversation state
const conversations = new Map();

// System instructions for Revolt Motors
const SYSTEM_INSTRUCTIONS = `
You are "Rev", the voice assistant for Revolt Motors, an Indian electric motorcycle manufacturer.
Your role is to assist customers with information about Revolt Motors products and services.

Key information about Revolt Motors:
- Flagship product: RV400, an AI-enabled electric bike
- Other model: RV300
- Features: MyRevolt app, battery swapping stations, AI voice recognition
- Range: Up to 150 km on a single charge
- Top speed: 85 km/h
- Battery: Lithium-ion, removable for charging
- Price range: ₹1.25 - 1.5 lakhs (approx)

Only answer questions related to Revolt Motors, electric vehicles, and sustainable transportation.
Politely decline to answer questions on other topics by redirecting to Revolt Motors products.
Be conversational, friendly, and helpful.

Current offers:
- Test rides available at all experience centers
- Government subsidies under FAME II scheme
- Battery subscription model available

Keep responses concise for voice interaction.
`;

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Initialize conversation
app.post('/api/conversation', async (req, res) => {
  try {
    const conversationId = Date.now().toString();
    const model = 'gemini-1.5-flash-latest';
    
    const response = await axios.post(
      // CORRECTED URL HERE: generativelanguage, not generativelace
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTIONS }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: "Start the conversation with a friendly greeting and introduce yourself as Rev from Revolt Motors." }]
          }
        ]
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const responseText = response.data.candidates[0].content.parts[0].text;
    conversations.set(conversationId, {
      history: [
        { role: "user", parts: [{ text: "Start conversation" }] },
        { role: "model", parts: [{ text: responseText }] }
      ]
    });

    res.json({ conversationId, response: responseText });
  } catch (error) {
    console.error('Error initializing conversation:', error.response?.data || error.message);
    res.status(500).json({ 
        response: "Hi there! I'm Rev, but I'm having trouble connecting to my main systems. Please try again later." 
    });
  }
});

// Text endpoint (this will now be our main endpoint for chat)
app.post('/api/text', async (req, res) => {
  try {
    const { conversationId, text } = req.body;
    
    if (!conversationId || !conversations.has(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const conversation = conversations.get(conversationId);
    const model = 'gemini-1.5-flash-latest';
    const history = conversation.history;
    
    const response = await axios.post(
      // CORRECTED URL HERE: generativelanguage, not generativelace
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTIONS }]
        },
        contents: [
          ...history,
          { role: "user", parts: [{ text }] }
        ]
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const responseText = response.data.candidates[0].content.parts[0].text;
    history.push({ role: "user", parts: [{ text }] });
    history.push({ role: "model", parts: [{ text: responseText }] });
    
    conversations.set(conversationId, { history });

    res.json({ response: responseText });
  } catch (error) {
    console.error('Error processing text:', error.response?.data || error.message);
    res.status(500).json({ 
        response: "I'm having trouble connecting to the service. Please try again later. Did you know Revolt Motors offers swappable battery technology?" 
    });
  }
});

const upload = multer({ dest: 'uploads/' });
app.post('/api/audio', upload.single('audio'), async (req, res) => {
  if (req.file) fs.unlinkSync(req.file.path);
  res.status(501).json({
    response: "Audio processing is not implemented. Please use the text interface."
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});