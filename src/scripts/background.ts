import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { PromptTemplate } from "langchain/prompts";
import { Ollama } from "langchain/llms/ollama";
import { OllamaEmbeddings } from "langchain/embeddings/ollama";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { StringOutputParser } from "langchain/schema/output_parser";
import { RunnableSequence, RunnablePassthrough } from "langchain/schema/runnable";
import { formatDocumentsAsString } from "langchain/util/document";
import { contentConfig } from "../contentConfig";


const OLLAMA_BASE_URL = "http://localhost:11434";
const OLLAMA_MODEL = "llama2";
var context = "";

chrome.runtime.onMessage.addListener(async function (request) {
  if (request.prompt) {
    var prompt = request.prompt;
    console.log(`Received prompt: ${prompt}`);

    // get default content config
    const config = contentConfig["default"];
    const chunkSize = !!request.chunkSize ? request.chunkSize : config.chunkSize;
    const chunkOverlap = !!request.chunkOverlap ? request.chunkOverlap : config.chunkOverlap;
    console.log(`Received chunk size: ${chunkSize} and chunk overlap: ${chunkOverlap}`);

    // create model
    const model = new Ollama({ baseUrl: OLLAMA_BASE_URL, model: OLLAMA_MODEL });

    // create prompt template
    const template = `Use only the following context when answering the question. Don't use any other knowledge.\n\nBEGIN CONTEXT\n\n{filtered_context}\n\nEND CONTEXT\n\nQuestion: {question}\n\nAnswer: `;
    const formatted_prompt = new PromptTemplate({
      inputVariables: ["filtered_context", "question"],
      template,
    });

    // split page content into overlapping documents
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkSize,
      chunkOverlap: chunkOverlap,
    });
    const documents = await splitter.createDocuments([context]);

    // load documents into vector store
    const vectorStore = await MemoryVectorStore.fromDocuments(
      documents,
      new OllamaEmbeddings({
        baseUrl: OLLAMA_BASE_URL,
        model: OLLAMA_MODEL,
      }),
    );
    const retriever = vectorStore.asRetriever();

    // create chain
    const chain = RunnableSequence.from([
      {
        filtered_context: retriever.pipe(formatDocumentsAsString),
        question: new RunnablePassthrough(),
      },
      formatted_prompt,
      model,
      new StringOutputParser(),
    ]);
    
    // invoke chain and return response
    const result = await chain.invoke(prompt);
    chrome.runtime.sendMessage({ answer: result });
  }
  if (request.context) {
    context = request.context;
    console.log(`Received context: ${context}`);
  }
});
