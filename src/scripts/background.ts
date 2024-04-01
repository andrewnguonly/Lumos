import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { Ollama } from "@langchain/community/llms/ollama";
import { Document } from "@langchain/core/documents";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  MessageContent,
} from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { Runnable, RunnableSequence } from "@langchain/core/runnables";
import { ConsoleCallbackHandler } from "@langchain/core/tracers/console";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { formatDocumentsAsString } from "langchain/util/document";

import { Attachment, LumosMessage } from "../components/ChatBar";
import { getDocuments, getExtension } from "../document_loaders/util";
import {
  DEFAULT_KEEP_ALIVE,
  getLumosOptions,
  isMultimodal,
  LumosOptions,
  SUPPORTED_IMG_FORMATS,
} from "../pages/Options";
import {
  Calculator,
  CLS_CALC_PROMPT,
  CLS_CALC_TYPE,
} from "../tools/calculator";
import { EnhancedMemoryVectorStore } from "../vectorstores/enhanced_memory";

interface VectorStoreMetadata {
  vectorStore: EnhancedMemoryVectorStore;
  createdAt: number;
}

// map of url to vector store metadata
const vectorStoreMap = new Map<string, VectorStoreMetadata>();

// global variables
let context = "";
let attachments: Attachment[] = [];
let completion = "";
let controller = new AbortController();

// prompt classification constants
const CLS_IMG_TYPE = "isImagePrompt";
const CLS_IMG_PROMPT =
  "Is the following prompt referring to an image or asking to describe an image?";
const CLS_IMG_TRIGGER = "based on the image";

const MAX_CHAT_HISTORY = 3;
const SYS_PROMPT_TEMPLATE = `Use the following context when responding to the prompt.\n\nBEGIN CONTEXT\n\n{filtered_context}\n\nEND CONTEXT`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if a prompt is positively classified as described in the
 * classifcation prompt. If so, return true. Otherwise, return false.
 *
 * @param baseURL Ollama base URL
 * @param model Ollama model name
 * @param type Type of classification. Only used for logging.
 * @param originalPrompt Prompt to be classified
 * @param classifcationPrompt Prompt that will classify originalPrompt
 * @param prefixTrigger Prefix trigger that will override LLM classification
 * @returns True if originalPrompt is positively classified by the classificationPrompt. Otherwise, false.
 */
const classifyPrompt = async (
  options: LumosOptions,
  type: string,
  originalPrompt: string,
  classifcationPrompt: string,
  prefixTrigger?: string,
): Promise<boolean> => {
  // check for prefix trigger
  if (prefixTrigger) {
    if (originalPrompt.trim().toLowerCase().startsWith(prefixTrigger)) {
      return new Promise((resolve) => resolve(true));
    }
  }

  // otherwise, attempt to classify prompt
  const ollama = new Ollama({
    baseUrl: options.ollamaHost,
    model: options.ollamaModel,
    keepAlive: DEFAULT_KEEP_ALIVE,
    temperature: 0,
    stop: [".", ","],
  }).bind({
    signal: controller.signal,
  });
  const finalPrompt = `${classifcationPrompt} Answer with 'yes' or 'no'.\n\nPrompt: ${originalPrompt}`;
  return ollama.invoke(finalPrompt).then((response) => {
    console.log(`${type} classification response: ${response}`);
    const answer = response.trim().split(" ")[0].toLowerCase();
    return answer.includes("yes");
  });
};

const createDocuments = async (
  chunkSize: number,
  chunkOverlap: number,
): Promise<Document[]> => {
  const documents: Document[] = [];

  if (attachments.length > 0) {
    for (const attachment of attachments) {
      const extension = getExtension(attachment.name);
      if (!SUPPORTED_IMG_FORMATS.includes(extension)) {
        // only add non-image attachments
        documents.push(...(await getDocuments(attachment)));
      }
    }
  }

  if (context !== "") {
    // split page content into overlapping documents
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkSize,
      chunkOverlap: chunkOverlap,
    });
    documents.push(...(await splitter.createDocuments([context])));
  }

  return documents;
};

const downloadImages = async (imageURLs: string[]): Promise<string[]> => {
  const base64EncodedImages: string[] = [];
  let urls: string[] = imageURLs;

  // filter out unsupported image formats
  urls = urls.filter((url) => {
    const extension = url.split(".").pop() || "";
    return SUPPORTED_IMG_FORMATS.includes(extension);
  });

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
      const base64String: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
      });

      base64EncodedImages.push(base64String);
    } else {
      console.log(`Failed to download image: ${url}`);
    }
  }

  return base64EncodedImages;
};

const getChatModel = (options: LumosOptions): Runnable => {
  return new ChatOllama({
    baseUrl: options.ollamaHost,
    model: options.ollamaModel,
    keepAlive: DEFAULT_KEEP_ALIVE,
    callbacks: [new ConsoleCallbackHandler()],
  }).bind({
    signal: controller.signal,
  });
};

const getMessages = async (
  base64EncodedImages: string[],
): Promise<BaseMessage[]> => {
  let chatMsgs: BaseMessage[] = [];
  // the array of persisted messages includes the current prompt
  const data = await chrome.storage.session.get(["messages"]);

  if (data.messages) {
    const lumosMsgs = data.messages as LumosMessage[];
    chatMsgs = lumosMsgs
      .slice(-1 * MAX_CHAT_HISTORY)
      .map((msg: LumosMessage) => {
        return msg.sender === "user"
          ? new HumanMessage({
              content: msg.message,
            })
          : new AIMessage({
              content: msg.message,
            });
      });

    // add images to the content array
    if (base64EncodedImages.length > 0) {
      // get the last element (current user prompt) from chatMsgs
      const lastMsg = chatMsgs[chatMsgs.length - 1];

      // remove the last element from chatMsgs
      chatMsgs = chatMsgs.slice(0, chatMsgs.length - 1);

      const content: MessageContent = [
        {
          type: "text",
          text: lastMsg.content.toString(),
        },
      ];
      base64EncodedImages.forEach((image) => {
        content.push({
          type: "image_url",
          image_url: image,
        });
      });

      // replace the last element with a new HumanMessage that contains the image content
      chatMsgs.push(
        new HumanMessage({
          content: content,
        }),
      );
    }
  }
  return chatMsgs;
};

const computeK = (documentsCount: number): number => {
  return Math.ceil(Math.sqrt(documentsCount));
};

const executeCalculatorTool = async (prompt: string): Promise<void> => {
  const calculator = new Calculator();
  const answer = await calculator.invoke(prompt);

  await chrome.runtime
    .sendMessage({ completion: answer, sender: "tool" })
    .catch(() => {
      console.log("Sending partial completion, but popup is closed...");
    });
  await sleep(300); // hack to allow messages to be saved
  chrome.runtime.sendMessage({ done: true }).catch(() => {
    console.log("Sending done message, but popup is closed...");
    chrome.storage.sync.set({ completion: answer, sender: "tool" });
  });
};

const streamChunks = async (stream: IterableReadableStream<string>) => {
  completion = "";
  try {
    for await (const chunk of stream) {
      completion += chunk;
      chrome.runtime
        .sendMessage({ completion: completion, sender: "assistant" })
        .catch(() => {
          console.log("Sending partial completion, but popup is closed...");
        });
    }
  } catch (error) {
    console.log("Cancelling LLM request...");
    return;
  }
  chrome.runtime.sendMessage({ done: true }).catch(() => {
    console.log("Sending done message, but popup is closed...");
    chrome.storage.sync.set({ completion: completion, sender: "assistant" });
  });
};

chrome.runtime.onMessage.addListener(async (request) => {
  // process prompt (RAG disabled)
  if (request.prompt && request.skipRAG) {
    const prompt = request.prompt.trim();
    console.log(`Received prompt (RAG disabled): ${prompt}`);

    // get options
    const options = await getLumosOptions();

    // classify prompt and optionally execute tools
    if (
      options.toolConfig["Calculator"].enabled &&
      (await classifyPrompt(
        options,
        CLS_CALC_TYPE,
        prompt,
        CLS_CALC_PROMPT,
        options.toolConfig["Calculator"].prefix,
      ))
    ) {
      return executeCalculatorTool(prompt);
    }

    // create chain
    const chatPrompt = ChatPromptTemplate.fromMessages(await getMessages([]));
    const model = getChatModel(options);
    const chain = chatPrompt.pipe(model).pipe(new StringOutputParser());

    // stream response chunks
    const stream = await chain.stream({});
    streamChunks(stream);
  }

  // process prompt (RAG enabled)
  if (request.prompt && !request.skipRAG) {
    const prompt = request.prompt.trim();
    const url = request.url;
    const skipCache = Boolean(request.skipCache);
    console.log(`Received prompt (RAG enabled): ${prompt}`);
    console.log(`Received url: ${url}`);

    // get default content config
    const options = await getLumosOptions();
    const config = options.contentConfig["default"];
    const chunkSize = request.chunkSize ? request.chunkSize : config.chunkSize;
    const chunkOverlap = request.chunkOverlap
      ? request.chunkOverlap
      : config.chunkOverlap;
    console.log(
      `Received chunk size: ${chunkSize} and chunk overlap: ${chunkOverlap}`,
    );

    // delete all vector stores that are expired
    vectorStoreMap.forEach(
      (vectorStoreMetdata: VectorStoreMetadata, url: string) => {
        if (
          Date.now() - vectorStoreMetdata.createdAt >
          options.vectorStoreTTLMins * 60 * 1000
        ) {
          vectorStoreMap.delete(url);
          console.log(`Deleting vector store for url: ${url}`);
        }
      },
    );

    // define model bindings (e.g. images, functions)
    let base64EncodedImages: string[] = [];

    // classify prompt and optionally execute tools
    if (
      isMultimodal(options.ollamaModel) &&
      (await classifyPrompt(
        options,
        CLS_IMG_TYPE,
        prompt,
        CLS_IMG_PROMPT,
        CLS_IMG_TRIGGER,
      ))
    ) {
      // first, try to get images from attachments
      if (attachments.length > 0) {
        for (const attachment of attachments) {
          const extension = getExtension(attachment.name);
          if (SUPPORTED_IMG_FORMATS.includes(extension)) {
            base64EncodedImages.push(attachment.base64);
          }
        }
      }
      // then, try to download images from URLs
      if (base64EncodedImages.length === 0) {
        base64EncodedImages = await downloadImages(request.imageURLs);
      }
    } else if (
      options.toolConfig["Calculator"].enabled &&
      (await classifyPrompt(
        options,
        CLS_CALC_TYPE,
        prompt,
        CLS_CALC_PROMPT,
        options.toolConfig["Calculator"].prefix,
      ))
    ) {
      return executeCalculatorTool(prompt);
    }

    // check if vector store already exists for url
    let vectorStore: EnhancedMemoryVectorStore;
    let documentsCount: number;

    if (!skipCache && vectorStoreMap.has(url)) {
      // retrieve existing vector store
      console.log(`Retrieving existing vector store for url: ${url}`);
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain, @typescript-eslint/no-non-null-assertion
      vectorStore = vectorStoreMap.get(url)?.vectorStore!;
      documentsCount = vectorStore.memoryVectors.length;
    } else {
      // create new vector store
      console.log(
        `Creating ${skipCache ? "temporary" : "new"} vector store for url: ${url}`,
      );

      // create documents
      const documents = await createDocuments(chunkSize, chunkOverlap);
      documentsCount = documents.length;

      // load documents into vector store
      vectorStore = new EnhancedMemoryVectorStore(
        new OllamaEmbeddings({
          baseUrl: options.ollamaHost,
          model: options.ollamaEmbeddingModel,
          keepAlive: DEFAULT_KEEP_ALIVE,
        }),
      );
      for (let index = 0; index < documents.length; index++) {
        if (controller.signal.aborted) {
          console.log("Cancelling embeddings generation...");
          return;
        }

        const doc = documents[index];

        await vectorStore.addDocuments([
          new Document({
            pageContent: doc.pageContent,
            metadata: { ...doc.metadata, docId: index }, // add document ID
          }),
        ]);
        chrome.runtime
          .sendMessage({
            docNo: index + 1,
            docCount: documentsCount,
            skipCache: skipCache,
          })
          .catch(() => {
            console.log(
              "Sending document embedding message, but popup is closed...",
            );
          });
      }

      // store vector store in vector store map
      if (!skipCache) {
        vectorStoreMap.set(url, {
          vectorStore: vectorStore,
          createdAt: Date.now(),
        });
      }
    }

    // create chain
    const retriever = vectorStore.asRetriever({
      k: computeK(documentsCount),
      searchType: "hybrid",
      callbacks: [new ConsoleCallbackHandler()],
    });

    const chatPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(SYS_PROMPT_TEMPLATE),
      ...(await getMessages(base64EncodedImages)),
    ]);

    const model = getChatModel(options);
    const chain = RunnableSequence.from([
      {
        filtered_context: retriever.pipe(formatDocumentsAsString),
      },
      chatPrompt,
      model,
      new StringOutputParser(),
    ]);

    // stream response chunks
    const stream = await chain.stream(prompt);
    streamChunks(stream);
  }

  // process parsed context
  if (request.context || request.attachments) {
    context = request.context;
    attachments = request.attachments;
    console.log(`Received context: ${context}`);
    attachments.forEach((attachment) => {
      console.log(`Received attachment: ${attachment.name}`);
    });
  }

  // cancel request
  if (request.cancelRequest) {
    console.log("Cancelling request...");
    controller.abort();

    await sleep(300); // hack to allow embeddings generation to stop
    chrome.runtime.sendMessage({ done: true }).catch(() => {
      console.log("Sending done message, but popup is closed...");
      chrome.storage.sync.set({ completion: completion, sender: "assistant" });
    });

    // reset abort controller
    controller = new AbortController();
  }
});

const keepAlive = () => {
  setInterval(chrome.runtime.getPlatformInfo, 20e3);
  console.log("Keep alive...");
};
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();
