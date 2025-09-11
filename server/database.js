import Database from 'better-sqlite3';
import path from 'path';
import logger from './logger.js';

const dbPath = path.resolve(process.cwd(), '..', 'db_lite', 'chat.db');
let db;

try {
  db = new Database(dbPath, { verbose: logger.info });
  logger.info('Successfully connected to the SQLite database.');
} catch (error) {
  logger.error('Failed to connect to the SQLite database.', { error: error.message });
  process.exit(1); // Exit if we can't connect to the DB
}


/**
 * Creates a new conversation.
 * @param {string} title - The title of the conversation.
 * @returns {number} The ID of the newly created conversation.
 */
export function createConversation(title) {
  try {
    const stmt = db.prepare('INSERT INTO Conversation (title) VALUES (?)');
    const info = stmt.run(title);
    logger.info(`Created new conversation with ID: ${info.lastInsertRowid}`);
    return info.lastInsertRowid;
  } catch (error) {
    logger.error('Failed to create conversation.', { error: error.message });
    throw error;
  }
}

/**
 * Retrieves all conversations from the database.
 * @returns {Array<object>} A list of all conversations.
 */
export function getConversations() {
  try {
    const stmt = db.prepare('SELECT * FROM Conversation ORDER BY created_at DESC');
    const conversations = stmt.all();
    logger.info(`Retrieved ${conversations.length} conversations.`);
    return conversations;
  } catch (error) {
    logger.error('Failed to retrieve conversations.', { error: error.message });
    throw error;
  }
}

/**
 * Creates a new message in a conversation.
 * @param {object} messageData - The message data.
 * @param {number} messageData.conversation_id - The ID of the conversation.
 * @param {string} messageData.sender - The sender of the message ('user' or 'bot').
 * @param {string} messageData.provider - The AI provider used.
 * @param {string} messageData.content - The content of the message.
 * @returns {number} The ID of the newly created message.
 */
export function createMessage({ conversation_id, sender, provider, content }) {
    try {
        const stmt = db.prepare('INSERT INTO Message (conversation_id, sender, provider, content) VALUES (?, ?, ?, ?)');
        const info = stmt.run(conversation_id, sender, provider, content);
        logger.info(`Created new message with ID: ${info.lastInsertRowid} in conversation ${conversation_id}`);
        return info.lastInsertRowid;
    } catch (error) {
        logger.error('Failed to create message.', { error: error.message });
        throw error;
    }
}

/**
 * Retrieves all messages for a specific conversation from the database.
 * @param {number} conversationId - The ID of the conversation.
 * @returns {Array<object>} A list of all messages in the conversation.
 */
export function getMessagesByConversationId(conversationId) {
  try {
    const stmt = db.prepare('SELECT * FROM Message WHERE conversation_id = ? ORDER BY timestamp ASC');
    const messages = stmt.all(conversationId);
    logger.info(`Retrieved ${messages.length} messages for conversation ID: ${conversationId}`);
    return messages;
  } catch (error) {
    logger.error('Failed to retrieve messages for conversation.', { error: error.message });
    throw error;
  }
}

/**
 * Retrieves a conversation by its ID.
 * @param {number} conversationId - The ID of the conversation to retrieve.
 * @returns {object|undefined} The conversation object, or undefined if not found.
 */
export function getConversationById(conversationId) {
  const stmt = db.prepare('SELECT * FROM Conversation WHERE id = ?');
  const conversation = stmt.get(conversationId);
  return conversation;
}


export default db;
