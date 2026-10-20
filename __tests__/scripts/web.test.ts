import {
  callWebTool,
  resolveWebTool,
  setWebPermission,
  WEB_ENDPOINT,
  WEB_USER_AGENT,
} from "../../src/tools/web";

const config = {
  "Web Search": { enabled: true, prefix: "search:" },
  "Fetch Page": { enabled: true, prefix: "fetch:" },
};
const search = resolveWebTool("search: Ollama release notes", config)!;
const fetchPage = resolveWebTool("fetch: https://ollama.com/blog", config)!;
const requests: { url: string; init: RequestInit; rpc: Record<string, any> }[] =
  [];
const updateSessionRules = jest.fn().mockResolvedValue(undefined);
const contains = jest.fn().mockResolvedValue(true);
const toolText =
  "Ollama documentation: https://ollama.com/blog\nCurrent model and release information.";

beforeEach(() => {
  requests.length = 0;
  jest.clearAllMocks();
  contains.mockResolvedValue(true);
  (global as any).chrome = {
    runtime: { id: "lumos-extension-id" },
    permissions: { contains },
    declarativeNetRequest: {
      updateSessionRules,
      RuleActionType: { MODIFY_HEADERS: "modifyHeaders" },
      HeaderOperation: { SET: "set" },
      ResourceType: { XMLHTTPREQUEST: "xmlhttprequest" },
    },
  };
  global.fetch = jest.fn(async (url, init) => {
    const rpc = JSON.parse(init!.body as string);
    requests.push({ url: String(url), init: init!, rpc });
    const result =
      rpc.method === "initialize"
        ? { protocolVersion: "2025-03-26" }
        : rpc.method === "tools/list"
          ? { tools: [{ name: "web_search" }, { name: "web_fetch" }] }
          : { content: [{ type: "text", text: toolText }] };
    return new Response(
      rpc.id ? JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }) : null,
      {
        status: rpc.id ? 200 : 202,
        headers: {
          "Content-Type": "application/json",
          "Mcp-Session-Id": "transport-session",
        },
      },
    );
  }) as typeof fetch;
});

test("normal resolver honors prefixes, overrides, disabled tools and URL validation", () => {
  expect(resolveWebTool("unprefixed question", config)).toBeNull();
  expect(
    resolveWebTool("search: test", {
      ...config,
      "Web Search": { enabled: false, prefix: "search:" },
    }),
  ).toBeNull();
  expect(
    resolveWebTool("Find: test", {
      ...config,
      "Web Search": { enabled: true, prefix: "find:" },
    })?.name,
  ).toBe("web_search");
  expect(
    resolveWebTool("anything", { "Web Search": { enabled: true, prefix: "" } }),
  ).toBeNull();
  expect(() => resolveWebTool("fetch: javascript:alert(1)", config)).toThrow(
    "HTTP",
  );
  expect(() =>
    resolveWebTool("fetch: https://user:secret@example.com", config),
  ).toThrow("credentials");
  expect(() => resolveWebTool("search:", config)).toThrow("Enter");
});

test("permission denial prevents even MCP discovery", async () => {
  contains.mockResolvedValue(false);
  await expect(
    callWebTool(search, "conversation-a", new AbortController().signal),
  ).rejects.toThrow("Allow web access");
  expect(global.fetch).not.toHaveBeenCalled();
});

test("production transport discovers, searches and fetches anonymously with separate conversation context", async () => {
  const signal = new AbortController().signal;
  const values = await Promise.all([
    callWebTool(search, "conversation-a", signal),
    callWebTool(fetchPage, "conversation-b", signal),
  ]);
  expect(values).toEqual([toolText, toolText]);
  await callWebTool(fetchPage, "conversation-a", signal);
  await callWebTool(search, "conversation-a", signal);
  const calls = requests.filter((r) => r.rpc.method === "tools/call");
  expect(calls.map((r) => r.rpc.params.arguments.session_id)).toEqual([
    "conversation-a",
    "conversation-b",
    "conversation-a",
    "conversation-a",
  ]);
  for (const r of requests) {
    expect(r.url).toBe(WEB_ENDPOINT);
    expect(r.init.credentials).toBe("omit");
    expect(r.init.redirect).toBe("error");
    expect(r.init.headers).not.toHaveProperty("Authorization");
    if (r.rpc.method !== "initialize")
      expect(r.init.headers).toHaveProperty(
        "Mcp-Session-Id",
        "transport-session",
      );
  }
  expect(updateSessionRules).toHaveBeenCalledWith(
    expect.objectContaining({
      addRules: [
        expect.objectContaining({
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              { header: "User-Agent", operation: "set", value: WEB_USER_AGENT },
            ],
          },
          condition: {
            regexFilter: "^https://search\\.parallel\\.ai/mcp$",
            initiatorDomains: ["lumos-extension-id"],
            resourceTypes: ["xmlhttprequest"],
          },
        }),
      ],
    }),
  );
});

test("timeout and cancellation abort the actual request", async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  ) as typeof fetch;
  const controller = new AbortController();
  const timed = expect(
    callWebTool(search, "conversation-a", controller.signal),
  ).rejects.toThrow("timed out");
  for (let i = 0; i < 10; i++) await Promise.resolve();
  jest.advanceTimersByTime(30001);
  await timed;
  const cancelled = expect(
    callWebTool(search, "conversation-a", controller.signal),
  ).rejects.toThrow("cancelled");
  for (let i = 0; i < 10; i++) await Promise.resolve();
  controller.abort();
  await cancelled;
  jest.useRealTimers();
});

test.each([401, 429, 500])(
  "HTTP %s is surfaced without fallback or retries",
  async (status) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("failure", { status }));
    await expect(
      callWebTool(search, "conversation-a", new AbortController().signal),
    ).rejects.toThrow(`HTTP ${status}`);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  },
);

test("SSE result ignores progress and decodes chunk boundaries", async () => {
  const normalFetch = global.fetch;
  global.fetch = jest.fn(async (url, init) => {
    const rpc = JSON.parse(init!.body as string);
    if (rpc.method !== "tools/call") return normalFetch(url, init);
    const data = `event: message\r\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\r\n\r\nevent: message\r\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: { content: [{ type: "text", text: toolText }] } })}\r\n\r\n`;
    const chunks = Array.from(new TextEncoder().encode(data));
    return new Response(
      new ReadableStream({
        pull(controller) {
          const byte = chunks.shift();
          if (byte === undefined) controller.close();
          else controller.enqueue(new Uint8Array([byte]));
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  }) as typeof fetch;
  await expect(
    callWebTool(search, "conversation-a", new AbortController().signal),
  ).resolves.toBe(toolText);
});

test.each(["tool-error", "malformed", "mismatched-id"])(
  "%s is surfaced without fallback",
  async (kind) => {
    const normalFetch = global.fetch;
    global.fetch = jest.fn(async (url, init) => {
      const rpc = JSON.parse(init!.body as string);
      if (rpc.method !== "tools/call") return normalFetch(url, init);
      return new Response(
        kind === "malformed"
          ? "invalid json"
          : JSON.stringify({
              jsonrpc: "2.0",
              id: kind === "mismatched-id" ? 999 : rpc.id,
              result: {
                isError: kind === "tool-error",
                content: [{ type: "text", text: "provider error" }],
              },
            }),
        { headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    await expect(
      callWebTool(search, "conversation-a", new AbortController().signal),
    ).rejects.toThrow();
  },
);

test("tool results show excerpts and safe source links without protocol metadata", async () => {
  const normalFetch = global.fetch;
  global.fetch = jest.fn(async (url, init) => {
    const rpc = JSON.parse(init!.body as string);
    if (rpc.method !== "tools/call") return normalFetch(url, init);
    const data = {
      search_id: "internal-id",
      results: [
        {
          title: "Ollama [docs]",
          url: "https://ollama.com/blog",
          excerpts: ["Useful release notes."],
        },
        { title: "unsafe", url: "javascript:alert(1)", excerpts: ["ignore"] },
      ],
      usage: [{ name: "sku_search", count: 1 }],
    };
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: rpc.id,
        result: {
          structuredContent: data,
          content: [{ type: "text", text: JSON.stringify(data) }],
        },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  const output = await callWebTool(
    search,
    "conversation-a",
    new AbortController().signal,
  );
  expect(output).toContain("https://ollama.com/blog");
  expect(output).toContain("Useful release notes.");
  expect(output).not.toMatch(/internal-id|sku_search|javascript:/);
});

test.each([false, true])(
  "fetch access errors remain visible with partial success=%s",
  async (partial) => {
    const normalFetch = global.fetch;
    global.fetch = jest.fn(async (url, init) => {
      const rpc = JSON.parse(init!.body as string);
      if (rpc.method !== "tools/call") return normalFetch(url, init);
      const data = {
        results: partial
          ? [
              {
                title: "Public page",
                url: "https://example.org",
                excerpts: ["Useful public excerpt."],
              },
            ]
          : [],
        errors: [
          {
            url: "https://example.org/private",
            error_type: "HTTP_ERROR",
            http_status_code: 403,
            content: null,
          },
        ],
      };
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: rpc.id,
          result: {
            content: [{ type: "text", text: JSON.stringify(data) }],
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    const result = await callWebTool(
      fetchPage,
      "conversation-a",
      new AbortController().signal,
    );
    expect(result).toContain(
      "Could not fetch https://example.org/private (HTTP 403).",
    );
    expect(result).not.toContain("No web results found.");
    if (partial) expect(result).toContain("Useful public excerpt.");
  },
);

test.each(["initialize", "tools/list"])(
  "revocation after %s prevents any subsequent request",
  async (stage) => {
    const normalFetch = global.fetch;
    global.fetch = jest.fn(async (url, init) => {
      const response = await normalFetch(url, init);
      const rpc = JSON.parse(init!.body as string);
      if (rpc.method === stage) contains.mockResolvedValue(false);
      return response;
    }) as typeof fetch;
    await expect(
      callWebTool(search, "conversation-a", new AbortController().signal),
    ).rejects.toThrow("Allow web access");
    expect(requests.at(-1)!.rpc.method).toBe(stage);
    expect(requests.some((r) => r.rpc.method === "tools/call")).toBe(false);
  },
);

test("revoking host consent blocks requests while header cleanup is pending", async () => {
  let finishCleanup!: () => void;
  const cleanup = new Promise<void>((resolve) => {
    finishCleanup = resolve;
  });
  chrome.permissions.remove = jest.fn().mockImplementation(async () => {
    contains.mockResolvedValue(false);
    return true;
  });
  updateSessionRules.mockImplementationOnce(() => cleanup);
  const revoking = setWebPermission(false);
  await Promise.resolve();
  await expect(
    callWebTool(search, "conversation-a", new AbortController().signal),
  ).rejects.toThrow("Allow web access");
  expect(global.fetch).not.toHaveBeenCalled();
  finishCleanup();
  await expect(revoking).resolves.toBe(false);
});

test("timeout and cancellation cover a stalled native Chrome preparation call", async () => {
  jest.useFakeTimers();
  updateSessionRules.mockImplementationOnce(() => new Promise(() => undefined));
  const controller = new AbortController();
  const timed = expect(
    callWebTool(search, "conversation-a", controller.signal),
  ).rejects.toThrow("timed out");
  for (let i = 0; i < 10; i++) await Promise.resolve();
  jest.advanceTimersByTime(30001);
  await timed;
  updateSessionRules.mockImplementationOnce(() => new Promise(() => undefined));
  const cancelled = expect(
    callWebTool(search, "conversation-a", controller.signal),
  ).rejects.toThrow("cancelled");
  for (let i = 0; i < 10; i++) await Promise.resolve();
  controller.abort();
  await cancelled;
  expect(global.fetch).not.toHaveBeenCalled();
  jest.useRealTimers();
});
