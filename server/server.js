import express from 'express';
import * as dotenv from 'dotenv';
import cors from 'cors';
import { OpenAI } from 'openai';
import { GoogleGenAI } from '@google/genai';
import logger from './logger.js';
import { createConversation, createMessage } from './database.js';

// configure dotenv if ,env file exists outside of server root directory
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { dirname } from 'path';
// dotenv.config({ path: path.resolve(dirname(fileURLToPath(import.meta.url)), './.env') });

dotenv.config();



// deprecated - remove in production
// const configuration = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
// });


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });


const app = express();

// set app middleware

app.use(cors());
app.use(express.json());


app.get('/', async (req, res) => {
    logger.info('GET / - Health check endpoint hit');
    res.status(200).send({
        message: 'Hello from GP HealthMedAgentix! Choose your AI provider: "openai" or "gemini".'
    });
});


// POST /
// Body: { prompt: string, provider: 'openai' | 'gemini', conversationId?: number }
app.post('/', async (req, res) => {
    let { prompt, provider = 'openai', conversationId } = req.body;
    logger.info(`POST / - Received request for provider: ${provider}`, { conversationId, prompt: prompt.substring(0, 50) + '...' });

    if (!prompt) {
        logger.warn('POST / - Request rejected: Missing prompt');
        return res.status(400).json({ message: 'Missing prompt' });
    }
    try {
        // If no conversationId, create a new conversation
        if (!conversationId) {
            const title = prompt.substring(0, 50); // Use first 50 chars as title
            conversationId = createConversation(title);
            logger.info(`Started new conversation with ID: ${conversationId}`);
        }

        // Save user's message
        createMessage({
            conversation_id: conversationId,
            sender: 'user',
            provider,
            content: prompt,
        });

        let result;
        if (provider === 'gemini') {
            // Gemini 2.5 Flash (Google AI Studio) - latest @google/genai usage
            logger.info('Calling Gemini API...');
            const geminiRes = await gemini.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
                // Optionally add config: { thinkingConfig: { thinkingBudget: 0 } }
            });
            result = geminiRes.text || '';
            logger.info('Successfully received response from Gemini');
        } else {
            // OpenAI gpt-4o (modern, lower cost)
            logger.info('Calling OpenAI API...');
            const openaiRes = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 1000
            });
            result = openaiRes.choices?.[0]?.message?.content || '';
            logger.info('Successfully received response from OpenAI');
        }

        // Save bot's message
        createMessage({
            conversation_id: conversationId,
            sender: 'bot',
            provider,
            content: result,
        });

        res.status(200).json({ bot: result, conversationId });
    } catch (error) {
        logger.error('An error occurred in the POST / handler', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`Server running on port http://localhost:${PORT}`));
