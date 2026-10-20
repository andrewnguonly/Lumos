// Exercise the real service-worker listener, option resolver and MCP transport.
jest.mock("../../src/pages/Options.css", () => ({}));
jest.mock("../../src/document_loaders/util", () => ({}));
jest.mock("../../src/vectorstores/enhanced_memory", () => ({}));

let listener: (request: Record<string, unknown>) => Promise<void>;
const sent: Record<string, unknown>[] = [];
const outgoing: Record<string, any>[] = [];
const saved = {
  selectedModel: "local-test-model",
  toolConfig: { Calculator: { enabled: false, prefix: "calc:" } },
};

beforeAll(() => {
  (global as any).chrome = {
    runtime: {
      id: "lumos-extension-id",
      onMessage: {
        addListener: (fn: typeof listener) => {
          listener = fn;
        },
      },
      onStartup: { addListener: jest.fn() },
      sendMessage: jest.fn(async (msg) => {
        sent.push(msg);
      }),
    },
    storage: {
      local: {
        get: (_keys: unknown, callback: (data: unknown) => void) =>
          callback(saved),
      },
      sync: { set: jest.fn() },
      session: { set: jest.fn() },
    },
    permissions: { contains: jest.fn().mockResolvedValue(true) },
    declarativeNetRequest: {
      updateSessionRules: jest.fn().mockResolvedValue(undefined),
      RuleActionType: { MODIFY_HEADERS: "modifyHeaders" },
      HeaderOperation: { SET: "set" },
      ResourceType: { XMLHTTPREQUEST: "xmlhttprequest" },
    },
  };
  jest.spyOn(global, "setInterval").mockImplementation(() => 1 as any);
  require("../../src/scripts/background");
});

beforeEach(() => {
  sent.length = 0;
  outgoing.length = 0;
  global.fetch = jest.fn(async (_url, init) => {
    const rpc = JSON.parse(init!.body as string);
    outgoing.push(rpc);
    const result =
      rpc.method === "initialize"
        ? { protocolVersion: "2025-03-26" }
        : rpc.method === "tools/list"
          ? { tools: [{ name: "web_search" }, { name: "web_fetch" }] }
          : {
              content: [
                {
                  type: "text",
                  text: "Current Ollama documentation\nhttps://ollama.com/blog",
                },
              ],
            };
    return new Response(
      rpc.id ? JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }) : null,
      {
        status: rpc.id ? 200 : 202,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;
});

afterAll(() => jest.restoreAllMocks());

test("legacy saved options gain default web tools without changing a disabled Calculator", async () => {
  const { getLumosOptions } = require("../../src/pages/Options");
  const options = await getLumosOptions();
  expect(options.toolConfig.Calculator).toEqual({
    enabled: false,
    prefix: "calc:",
  });
  expect(options.toolConfig["Web Search"]).toEqual({
    enabled: true,
    prefix: "search:",
  });
  expect(saved.toolConfig).not.toHaveProperty("Web Search");
});

test.each([true, false])(
  "service-worker dispatch returns useful tool text with RAG skip=%s",
  async (skipRAG) => {
    await listener({
      prompt: "search: Ollama release notes",
      skipRAG,
      webConversationId: "opaque-conversation-a",
      context: "PRIVATE PAGE CONTENT",
    });
    expect(outgoing.find((rpc) => rpc.method === "tools/call")!.params).toEqual(
      {
        name: "web_search",
        arguments: {
          objective: "Ollama release notes",
          search_queries: ["Ollama release notes"],
          session_id: "opaque-conversation-a",
        },
      },
    );
    expect(JSON.stringify(outgoing)).not.toContain("PRIVATE PAGE CONTENT");
    expect(sent).toEqual([
      {
        completion: "Current Ollama documentation\nhttps://ollama.com/blog",
        sender: "tool",
        done: true,
        webConversationId: "opaque-conversation-a",
      },
    ]);
  },
);

test("URL errors are displayed through the ordinary tool message consumer", async () => {
  await listener({
    prompt: "fetch: file:///etc/passwd",
    skipRAG: true,
    webConversationId: "opaque-conversation-a",
  });
  expect(global.fetch).not.toHaveBeenCalled();
  expect(sent[0]).toMatchObject({ sender: "tool", done: true });
  expect(String(sent[0].completion)).toContain("HTTP");
});

export {};

test("closed-popup web replies retain tagged conversation context in local session storage", async () => {
  (chrome.runtime.sendMessage as jest.Mock).mockRejectedValueOnce(
    new Error("popup closed"),
  );
  await listener({
    prompt: "search: Ollama release notes",
    skipRAG: true,
    webConversationId: "opaque-conversation-a",
  });
  expect(chrome.storage.session.set).toHaveBeenCalledWith({
    webCompletion: {
      completion: "Current Ollama documentation\nhttps://ollama.com/blog",
      sender: "tool",
      done: true,
      webConversationId: "opaque-conversation-a",
    },
  });
  expect(chrome.storage.sync.set).not.toHaveBeenCalled();
});
