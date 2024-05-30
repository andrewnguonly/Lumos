import { StateGraph } from "@langchain/langgraph";

// GRAPH STATE
type GraphState = {
  /**
   * An object where each key is a string.
   */
  prompt: string;
  skipRAG: boolean;
};

const graphState = {
  prompt: {
    value: (x: string, y: string) => y,
    default: () => (""),
  },
  skipRAG: {
    value: (x: boolean, y: boolean) => y,
    default: () => (false),
  }
};

// GRAPH NODES


// GRAPH CONSTRUCTION
const workflow = new StateGraph<GraphState>({
  channels: graphState,
});

// GRAPH EXECUTION
chrome.runtime.onMessage.addListener(async (request: {prompt: string, skipRAG: boolean}) => {
  console.log("Running background v2 service worker...");
  // compiledGraph.invoke({prompt: request.prompt, skipRAG: request.skipRAG});
});

const keepAlive = () => {
  setInterval(chrome.runtime.getPlatformInfo, 20e3);
  console.log("Keep alive...");
};
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();
