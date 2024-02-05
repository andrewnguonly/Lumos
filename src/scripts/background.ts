import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { formatDocumentsAsString } from "langchain/util/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { Ollama } from "@langchain/community/llms/ollama";
import {
  DEFAULT_CONTENT_CONFIG,
  DEFAULT_HOST,
  DEFAULT_MODEL,
  DEFAULT_VECTOR_STORE_TTL_MINS,
  MULTIMODAL_MODELS,
} from "../pages/Options";
import { ContentConfig } from "../contentConfig";


interface LumosOptions {
  ollamaModel: string,
  ollamaHost: string,
  contentConfig: ContentConfig,
  vectorStoreTTLMins: number,
}

interface VectorStoreMetadata {
  vectorStore: MemoryVectorStore
  createdAt: number
}

// map of url to vector store metadata
const vectorStoreMap = new Map<string, VectorStoreMetadata>();

 // global variable for storing parsed content from current tab
let context = "";

const getLumosOptions = async (): Promise<LumosOptions> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["selectedModel", "selectedHost", "selectedConfig", "selectedVectorStoreTTLMins"], (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve({
          ollamaModel: data.selectedModel || DEFAULT_MODEL,
          ollamaHost: data.selectedHost || DEFAULT_HOST,
          contentConfig: JSON.parse(data.selectedConfig || DEFAULT_CONTENT_CONFIG) as ContentConfig,
          vectorStoreTTLMins: parseInt(data.selectedVectorStoreTTLMins, 10) || DEFAULT_VECTOR_STORE_TTL_MINS,
        });
      }
    });
  });
}

/**
 * Determine if a prompt is asking about an image. If so, return true.
 * Otherwise, return false.
 * 
 * This function uses the Ollama model to determine if the prompt is
 * asking about an image or not. The classification approach is simplistic and
 * may generate false positives or false negatives. However, the approach
 * greatly simplifies the user exprience when using a multimodal model. With
 * this approach, a user is able to issue prompts that may or may not refer to
 * an image without having to switch models or download the images when the
 * current prompt does not refer to an image.
 * 
 * Additionally, the function checks for a hardcoded prefix trigger: "based on
 * the image". This is a simple mechanism to allow a user to override the
 * classifcation workflow and force the images to be downloaded and bound to
 * the model.
 * 
 * Example: "Based on the image, describe what's going on in the background"
 */
const isImagePrompt = async (baseURL: string, model: string, prompt: string): Promise<boolean> => {
  // check for prefix trigger
  if (prompt.trim().toLowerCase().startsWith("based on the image")) {
    return new Promise((resolve) => resolve(true));
  }

  // otherwise, attempt to classify prompt
  const ollama = new Ollama({ baseUrl: baseURL, model: model });
  const question = `Is the following prompt referring to an image or asking to describe an image? Answer with 'yes' or 'no'.\n\nPrompt: ${prompt}`;
  return ollama.invoke(question).then((response) => {
    console.log(`Prompt classification response: ${response}`);
    const answer = response.trim().split(" ")[0].toLowerCase();
    return answer.includes("yes");
  });
};

chrome.runtime.onMessage.addListener(async (request) => {
  // process prompt (RAG disabled)
  if (request.prompt && request.skipRAG) {
    const prompt = request.prompt;
    console.log(`Received prompt (RAG disabled): ${prompt}`);

    // create model
    const options = await getLumosOptions();
    const model = new Ollama({
      baseUrl: options.ollamaHost,
      model: options.ollamaModel,
    });

    // stream response chunks
    const stream = await model.stream(prompt);
    for await (const chunk of stream) {
      chrome.runtime.sendMessage({ chunk: chunk });
    }
    chrome.runtime.sendMessage({ done: true });
  }

  // process prompt (RAG enabled)
  if (request.prompt && !request.skipRAG) {
    const prompt = request.prompt;
    const url = request.url;
    const skipCache = Boolean(request.skipCache);
    console.log(`Received prompt (RAG enabled): ${prompt}`);
    console.log(`Received url: ${url}`);

    // get default content config
    const options = await getLumosOptions();
    const config = options.contentConfig["default"];
    const chunkSize = !!request.chunkSize ? request.chunkSize : config.chunkSize;
    const chunkOverlap = !!request.chunkOverlap ? request.chunkOverlap : config.chunkOverlap;
    console.log(`Received chunk size: ${chunkSize} and chunk overlap: ${chunkOverlap}`);

    // delete all vector stores that are expired
    vectorStoreMap.forEach((vectorStoreMetdata: VectorStoreMetadata, url: string) => {
      if (Date.now() - vectorStoreMetdata.createdAt! > options.vectorStoreTTLMins * 60 * 1000) {
        vectorStoreMap.delete(url);
        console.log(`Deleting vector store for url: ${url}`);
      }
    });

    // declare model
    let model;
    const base64EncodedImages: string[] = [];

    // download images
    if (
      MULTIMODAL_MODELS.includes(options.ollamaModel) &&
      await isImagePrompt(options.ollamaHost, options.ollamaModel, prompt)
    ) {
      const urls: string[] = request.imageURLs;

      // only download the first 10 images
      for (const url of urls.slice(0, 10)) {
        console.log(`Downloading image: ${url}`);
        let response;

        try {
          response = await fetch(url);
        } catch (error) {
          console.log(`Failed to download image: ${url}`);
          continue;
        }

        if (response.ok) {
          const blob = await response.blob();
          let base64String: string = await new Promise((resolve, reject) => {

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              resolve(reader.result as string);
            };
          });

          // remove leading data url prefix `data:*/*;base64,`
          base64String = base64String.split(",")[1];
          base64EncodedImages.push(base64String);
        } else {
          console.log(`Failed to download image: ${url}`);
        }
      }
    }

    // bind base64 encoded image data to model
    model = new Ollama({
      baseUrl: options.ollamaHost,
      model: options.ollamaModel,
    }).bind({
      images: base64EncodedImages
    });

    // create prompt template
    const template = `Use only the following context when answering the question. Don't use any other knowledge.\n\nBEGIN CONTEXT\n\n{filtered_context}\n\nEND CONTEXT\n\nQuestion: {question}\n\nAnswer: `;
    const formatted_prompt = new PromptTemplate({
      inputVariables: ["filtered_context", "question"],
      template,
    });

    // check if vector store already exists for url
    let vectorStore: MemoryVectorStore;

    if (!skipCache && vectorStoreMap.has(url)) {
      // retrieve existing vector store
      console.log(`Retrieving existing vector store for url: ${url}`);
      vectorStore = vectorStoreMap.get(url)?.vectorStore!;
    } else {
      // create new vector store
      console.log(`Creating ${skipCache ? "temporary" : "new"} vector store for url: ${url}`);

      // split page content into overlapping documents
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: chunkSize,
        chunkOverlap: chunkOverlap,
      });
      const documents = await splitter.createDocuments([context]);

      // load documents into vector store
      vectorStore = await MemoryVectorStore.fromDocuments(
        documents,
        new OllamaEmbeddings({
          baseUrl: options.ollamaHost,
          model: options.ollamaModel,
        }),
      );

      // store vector store in vector store map
      if (!skipCache) {
        vectorStoreMap.set(url, {
          vectorStore: vectorStore,
          createdAt: Date.now(),
        });
      }
    }

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

  // process parsed context
  if (request.context) {
    context = request.context;
    console.log(`Received context: ${context}`);
  }
});

const keepAlive = () => {
  setInterval(chrome.runtime.getPlatformInfo, 20e3);
  console.log("Keep alive...");
}
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();
