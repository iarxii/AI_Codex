import { GoogleGenerativeAI } from "@google/generative-ai";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import logger from "../logger.js";

const vectorStorePath = "./rag/vector-store";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const generationModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Initialize Embeddings and Vector Store
const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: "http://localhost:11434",
});

const vectorStore = new Chroma(embeddings, {
    collectionName: "gauteng-healthmed-docs",
    url: "http://localhost:8000",
    persist_directory: vectorStorePath,
});

async function query(userQuery) {
  logger.info(`RAG service received query: ${userQuery}`);

  // 1. Retrieve relevant documents
  const retriever = vectorStore.asRetriever(4); // Retrieve top 4 documents
  const relevantDocs = await retriever.invoke(userQuery);

  const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n---\n\n");
  logger.info("Retrieved context from vector store for RAG query.");

  // 2. Build the prompt
  const prompt = `
    You are HealthMedAgentix, an AI assistant for Gauteng Health.
    Your task is to answer the user's query based *only* on the following context.
    If the context does not contain the answer, state that you cannot find the information in the provided documents.
    Do not use any external knowledge.

    CONTEXT:
    ${context}

    QUERY:
    ${userQuery}

    ANSWER:
  `;

  // 3. Generate response with Gemini
  logger.info("Sending prompt to Gemini for RAG generation...");
  const result = await generationModel.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  logger.info("Received response from Gemini for RAG query.");
  return text;
}

export const ragService = {
  query,
};