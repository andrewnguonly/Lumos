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
import { RunnableSequence } from "@langchain/core/runnables";
import { ConsoleCallbackHandler } from "@langchain/core/tracers/console";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { formatDocumentsAsString } from "langchain/util/document";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { Ollama } from "@langchain/community/llms/ollama";
import { LumosMessage } from "../components/ChatBar";
import {
  Calculator,
  CLS_CALC_PROMPT,
  CLS_CALC_TYPE,
} from "../tools/calculator";
import { EnhancedMemoryVectorStore } from "../vectorstores/enhanced_memory";
import {
  DEFAULT_KEEP_ALIVE,
  getLumosOptions,
  isMultimodal,
  LumosOptions,
} from "../pages/Options";

interface VectorStoreMetadata {
  vectorStore: EnhancedMemoryVectorStore;
  createdAt: number;
}

// map of url to vector store metadata
const vectorStoreMap = new Map<string, VectorStoreMetadata>();

// global variables
let context = "";
let completion = "";

// prompt classification constants
const CLS_IMG_TYPE = "isImagePrompt";
const CLS_IMG_PROMPT =
  "Is the following prompt referring to an image or asking to describe an image?";
const CLS_IMG_TRIGGER = "based on the image";

const MAX_CHAT_HISTORY = 5;
const SYS_PROMPT_TEMPLATE = `Use the following context and the chat history when responding to the prompt.\n\nBEGIN CONTEXT\n\n{filtered_context}\n\nEND CONTEXT`;

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
  });
  const finalPrompt = `${classifcationPrompt} Answer with 'yes' or 'no'.\n\nPrompt: ${originalPrompt}`;
  return ollama.invoke(finalPrompt).then((response) => {
    console.log(`${type} classification response: ${response}`);
    const answer = response.trim().split(" ")[0].toLowerCase();
    return answer.includes("yes");
  });
};

const getChatModel = (options: LumosOptions): ChatOllama => {
  return new ChatOllama({
    baseUrl: options.ollamaHost,
    model: options.ollamaModel,
    keepAlive: DEFAULT_KEEP_ALIVE,
    callbacks: [new ConsoleCallbackHandler()],
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
          image_url: `data:image/*;base64,${image}`,
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
  for await (const chunk of stream) {
    completion += chunk;
    chrome.runtime
      .sendMessage({ completion: completion, sender: "assistant" })
      .catch(() => {
        console.log("Sending partial completion, but popup is closed...");
      });
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
    const base64EncodedImages: string[] = [];

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
          let base64String: string = await new Promise((resolve) => {
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

      // split page content into overlapping documents
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: chunkSize,
        chunkOverlap: chunkOverlap,
      });
      const documents = await splitter.createDocuments([context]);
      documentsCount = documents.length;

      // load documents into vector store
      vectorStore = new EnhancedMemoryVectorStore(
        new OllamaEmbeddings({
          baseUrl: options.ollamaHost,
          model: options.ollamaEmbeddingModel,
          keepAlive: DEFAULT_KEEP_ALIVE,
        }),
      );
      documents.forEach(async (doc, index) => {
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
      });

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
  if (request.context) {
    context = request.context;
    console.log(`Received context: ${context}`);
  }
});

const keepAlive = () => {
  setInterval(chrome.runtime.getPlatformInfo, 20e3);
  console.log("Keep alive...");
};
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();
