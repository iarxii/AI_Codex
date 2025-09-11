import express from 'express';
import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../logger.js';
import { createConversation, createMessage, getConversations, getConversationById, getMessagesByConversationId } from '../database.js';
import { ragService } from '../rag/rag.service.js';

const router = express.Router();

// Initialize AI providers within the router's scope
// Note: The .env variables (OPENAI_API_KEY, GEMINI_API_KEY) are available globally
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Conversation Management Endpoints ---
// Mounted at /api/conversations
router.get('/conversations', async (req, res) => {
    try {
        const conversations = getConversations();
        res.json(conversations);
    } catch (error) {
        logger.error('Error fetching conversations:', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

router.get('/conversations/:id', async (req, res) => {
    try {
        const conversationId = parseInt(req.params.id, 10);
        if (isNaN(conversationId)) {
            return res.status(400).json({ error: 'Invalid conversation ID' });
        }

        const conversation = getConversationById(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const messages = getMessagesByConversationId(conversationId);
        res.json({
            conversation,
            messages,
        });
    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ error: 'Failed to fetch conversation' });
    }
});



// --- General Chat Endpoint ---
// Mounted at /api/chat
router.post('/chat', async (req, res) => {
    let { prompt, provider = 'openai', conversationId } = req.body;
    logger.info(`POST /api/chat - Received request for provider: ${provider}`, { conversationId, prompt: prompt.substring(0, 50) + '...' });

    if (!prompt) {
        logger.warn('POST /api/chat - Request rejected: Missing prompt');
        return res.status(400).json({ message: 'Missing prompt' });
    }
    try {
        if (!conversationId) {
            const title = prompt.substring(0, 50);
            conversationId = createConversation(title);
            logger.info(`Started new conversation with ID: ${conversationId}`);
        }

        createMessage({
            conversation_id: conversationId,
            sender: 'user',
            provider,
            content: prompt,
        });

        let result;
        if (provider === 'gemini') {
            logger.info('Calling Gemini API...');
            const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
            const geminiRes = await model.generateContent(prompt);
            result = geminiRes.response.text();
            logger.info('Successfully received response from Gemini');
        } else {
            logger.info('Calling OpenAI API...');
            const openaiRes = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-4o',
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

        createMessage({
            conversation_id: conversationId,
            sender: 'bot',
            provider,
            content: result,
        });

        res.status(200).json({ bot: result, conversationId });
    } catch (error) {
        logger.error('An error occurred in the POST /api/chat handler', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// --- RAG Query Endpoint ---
// Mounted at /api/rag/query
router.post('/rag/query', async (req, res) => {
    const { query } = req.body;

    if (!query) {
        logger.warn('POST /api/rag/query - Request rejected: Missing query');
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        logger.info(`POST /api/rag/query - Calling RAG service with query: ${query.substring(0, 50)}...`);
        const answer = await ragService.query(query);
        res.json({ answer });
    } catch (error) {
        logger.error('Error in RAG query endpoint:', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to process your request.' });
    }
});

export default router;
