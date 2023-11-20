import { ChatRestModule } from "@mlc-ai/web-llm";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "langchain/document";
import { OllamaEmbeddings } from "langchain/embeddings/ollama";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";


const cm = new ChatRestModule();
var context = "";

// Set reponse callback for chat module
const generateProgressCallback = (step: number, message: string) => {
  // send the answer back to the content script
  console.log(`messsage (${step}): ${message}`);
  chrome.runtime.sendMessage({ answer: message });
};

chrome.runtime.onMessage.addListener(async function (request) {
  if (request.prompt) {
    var prompt = request.prompt;

    // split page content into overlapping documents
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 200,
    });
    const documents = await splitter.createDocuments([context]);

    // load documents into vector store
    const vectorStore = await MemoryVectorStore.fromDocuments(
      documents,
      new OllamaEmbeddings({
        model: "llama2", // default value
        baseUrl: "http://localhost:11434", // default value
      }),
    );

    // search for most similar document based on prompt
    const filtered_documents = await vectorStore.similaritySearch(prompt, 15);
    var filtered_context = "";
    filtered_documents.forEach((doc: Document) => {
      filtered_context += doc.pageContent + "\n\n";
    });

    if (filtered_context.length > 0) {
      prompt = "Use only the following context when answering the question at the end. Don't use any other knowledge.\n\nBEGIN CONTEXT\n\n" + filtered_context + "\n\nEND CONTEXT\n\nQuestion: " + request.prompt + "\n\nAnswer: ";
    }
    console.log(`Prompt: ${prompt}`);
    await cm.generate(prompt, generateProgressCallback);
  }
  if (request.context) {
    context = request.context;
    console.log(`Received context: ${context}`);
  }
});
