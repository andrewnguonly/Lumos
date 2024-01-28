import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { PromptTemplate } from "langchain/prompts";
import { Ollama } from "langchain/llms/ollama";
import { OllamaEmbeddings } from "langchain/embeddings/ollama";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { StringOutputParser } from "langchain/schema/output_parser";
import { RunnableSequence, RunnablePassthrough } from "langchain/schema/runnable";
import { formatDocumentsAsString } from "langchain/util/document";
import { ContentConfig } from "../contentConfig";


var context = "";

chrome.runtime.onMessage.addListener(async function (request) {
  if (request.prompt) {
    var prompt = request.prompt;
    console.log(`Received prompt: ${prompt}`);

    // get Lumos options
    const lumosOptions: {
      ollamaModel: string,
      ollamaHost: string,
      contentConfig: ContentConfig,
    } = await new Promise((resolve, reject) => {
      chrome.storage.local.get(["selectedModel", "selectedHost", "selectedConfig"], (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({
            ollamaModel: data.selectedModel,
            ollamaHost: data.selectedHost,
            contentConfig: JSON.parse(data.selectedConfig) as ContentConfig,
          });
        }
      });
    });

    // get default content config
    const config = lumosOptions.contentConfig["default"];
    const chunkSize = !!request.chunkSize ? request.chunkSize : config.chunkSize;
    const chunkOverlap = !!request.chunkOverlap ? request.chunkOverlap : config.chunkOverlap;
    console.log(`Received chunk size: ${chunkSize} and chunk overlap: ${chunkOverlap}`);

    // create model
    const model = new Ollama({
      baseUrl: lumosOptions.ollamaHost,
      model: lumosOptions.ollamaModel,
    });

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
        baseUrl: lumosOptions.ollamaHost,
        model: lumosOptions.ollamaModel,
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
    
    // stream response chunks
    const stream = await chain.stream(prompt);
    for await (const chunk of stream) {
      chrome.runtime.sendMessage({ chunk: chunk });
    }
    chrome.runtime.sendMessage({ done: true });
  }
  if (request.context) {
    context = request.context;
    console.log(`Received context: ${context}`);
  }
});
