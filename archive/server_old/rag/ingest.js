import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import dotenv from "dotenv";

// Load environment variables. This is needed because this is a standalone script.
// It will look for the .env file in the current working directory (e.g., /server).
dotenv.config();

const dataPath = "./rag/data";
const vectorStorePath = "./rag/vector-store";

async function main() {
  console.log("Starting data ingestion process...");

  // 1. Load documents
  const loader = new DirectoryLoader(dataPath, {
    ".pdf": (path) => new PDFLoader(path),
  });
  const docs = await loader.load();
  console.log(`Loaded ${docs.length} documents.`);

  if (docs.length === 0) {
    console.log("No documents found in the data directory. Exiting.");
    return;
  }

  // 2. Split documents into chunks
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunks = await textSplitter.splitDocuments(docs);
  console.log(`Split documents into ${chunks.length} chunks.`);

  // 3. Initialize embeddings (using local Ollama)
  const embeddings = new OllamaEmbeddings({
    model: "nomic-embed-text",
    baseUrl: "http://localhost:11434", // Default Ollama API endpoint
  });

  // 4. Create and store embeddings in ChromaDB
  console.log("Creating and storing embeddings. This may take a while...");
  await Chroma.fromDocuments(chunks, embeddings, {
    collectionName: "gauteng-healthmed-docs",
    url: "http://localhost:8000", // Default ChromaDB server endpoint
    persist_directory: vectorStorePath,
  });

  console.log("Data ingestion complete!");
}

main().catch((error) => {
  console.error("Error during ingestion:", error);
});
