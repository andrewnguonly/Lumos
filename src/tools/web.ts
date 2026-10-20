// Parallel is the default web provider. Chrome permission gates every request.
export const WEB_ORIGIN = "https://search.parallel.ai/*";
export const WEB_ENDPOINT = "https://search.parallel.ai/mcp";
export const WEB_USER_AGENT =
  "Lumos/1.0.17 (https://github.com/andrewnguonly/Lumos)";
const HEADER_RULE_ID = 71001;
const TIMEOUT_MS = 30000;

export interface WebToolConfig {
  [name: string]: { enabled: boolean; prefix: string };
}

export interface WebRequest {
  name: "web_search" | "web_fetch";
  arguments: Record<string, unknown>;
}

export const resolveWebTool = (
  prompt: string,
  config: WebToolConfig,
): WebRequest | null => {
  for (const [tool, name] of [
    ["Web Search", "web_search"],
    ["Fetch Page", "web_fetch"],
  ] as const) {
    const option = config[tool];
    const prefix = option?.prefix.trim();
    if (
      option?.enabled &&
      prefix &&
      prompt.trim().toLowerCase().startsWith(prefix.toLowerCase())
    ) {
      const input = prompt.trim().slice(prefix.length).trim();
      if (!input) throw new Error("Enter a search query or page URL.");
      if (name === "web_fetch") {
        const url = new URL(input);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new Error(
            "Enter a public HTTP or HTTPS page URL without credentials.",
          );
        return { name, arguments: { urls: [url.href] } };
      }
      return {
        name,
        arguments: { objective: input, search_queries: [input] },
      };
    }
  }
  return null;
};

export const hasWebPermission = () =>
  chrome.permissions.contains({
    origins: [WEB_ORIGIN],
    permissions: ["declarativeNetRequestWithHostAccess"],
  });

export const setWebPermission = async (allow: boolean): Promise<boolean> => {
  if (allow) {
    // Called directly from a button click so Chrome can display its permission prompt.
    return chrome.permissions.request({
      origins: [WEB_ORIGIN],
    });
  }
  // Revoke consent first so every later RPC is blocked while rules are cleaned up.
  await chrome.permissions.remove({ origins: [WEB_ORIGIN] });
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [HEADER_RULE_ID],
  });
  return false;
};

const prepareWebRequests = async () => {
  if (!(await hasWebPermission()))
    throw new Error(
      "Allow web access in Lumos Options before using web tools.",
    );
  // Chromium strips fetch's User-Agent. Apply it only to this extension's MCP
  // requests, using the user's optional permission rather than broad host access.
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [HEADER_RULE_ID],
    addRules: [
      {
        id: HEADER_RULE_ID,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            {
              header: "User-Agent",
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: WEB_USER_AGENT,
            },
          ],
        },
        condition: {
          regexFilter: "^https://search\\.parallel\\.ai/mcp$",
          initiatorDomains: [chrome.runtime.id],
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          ],
        },
      },
    ],
  });
};

type RpcMessage = {
  id?: number;
  result?: Record<string, unknown>;
  error?: { message: string };
};

// Streamable HTTP permits JSON or SSE responses to POST. Stop reading as soon
// as this request's response arrives; notifications/progress are not its result.
const readResponse = async (
  response: Response,
  id: number,
): Promise<RpcMessage> => {
  if (response.headers.get("content-type")?.includes("application/json"))
    return response.json();
  if (
    !response.headers.get("content-type")?.includes("text/event-stream") ||
    !response.body
  )
    throw new Error("Unexpected web provider response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(
        /\r\n/g,
        "\n",
      );
      let end;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = event
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) {
          const message = JSON.parse(data) as RpcMessage;
          if (message.id === id) return message;
        }
      }
      if (done)
        throw new Error("Web provider closed before returning a result.");
    }
  } finally {
    await reader.cancel();
  }
};

const formatWebResult = (
  result: Record<string, unknown>,
  text: string,
): string => {
  let data = result.structuredContent;
  if (!data) {
    try {
      data = JSON.parse(text);
    } catch {
      return text;
    }
  }
  if (
    !data ||
    typeof data !== "object" ||
    !("results" in data) ||
    !Array.isArray(data.results)
  )
    return text;
  const pages: string[] = [];
  for (const page of data.results) {
    try {
      const url = new URL(page.url);
      if (!["http:", "https:"].includes(url.protocol)) continue;
      const title = String(page.title || url.hostname).replace(
        /[\\`*_[\]<>]/g,
        "\\$&",
      );
      const excerpts = Array.isArray(page.excerpts)
        ? page.excerpts
            .filter((excerpt: unknown) => typeof excerpt === "string")
            .join("\n\n")
        : "";
      pages.push(`### [${title}](<${url.href}>)\n\n${excerpts}`);
    } catch {
      // An invalid source URL must not become a clickable tool result.
    }
  }
  if ("errors" in data && Array.isArray(data.errors) && data.errors.length) {
    for (const error of data.errors) {
      let source = "A requested page";
      try {
        const url = new URL(error.url);
        if (["http:", "https:"].includes(url.protocol)) source = url.href;
      } catch {
        // Do not turn malformed provider URLs into links.
      }
      const status = Number.isInteger(error.http_status_code)
        ? ` (HTTP ${error.http_status_code})`
        : "";
      pages.push(`Could not fetch ${source}${status}.`);
    }
  }
  return pages.join("\n\n") || "No web results found.";
};

export const callWebTool = async (
  request: WebRequest,
  conversationId: string,
  signal: AbortSignal,
): Promise<string> => {
  if (!conversationId) throw new Error("Missing web conversation identifier.");
  if (signal.aborted) throw new Error("Web request cancelled.");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(cancel, TIMEOUT_MS);
  let session: string | null = null;
  let id = 0;
  const rpc = async (
    method: string,
    params: Record<string, unknown>,
    notification = false,
  ) => {
    const requestId = ++id;
    // The endpoint permits cross-origin requests, so Chrome host revocation
    // alone cannot enforce consent between handshake and the tool call.
    if (!(await hasWebPermission()))
      throw new Error(
        "Allow web access in Lumos Options before using web tools.",
      );
    const response = await fetch(WEB_ENDPOINT, {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2025-03-26",
        ...(session ? { "Mcp-Session-Id": session } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        ...(notification ? {} : { id: requestId }),
        method,
        params,
      }),
    });
    if (!response.ok)
      throw new Error(`Web provider returned HTTP ${response.status}.`);
    session = response.headers.get("Mcp-Session-Id") || session;
    if (notification) {
      await response.body?.cancel();
      return {};
    }
    const message = await readResponse(response, requestId);
    if (message.id !== requestId || message.error || !message.result)
      throw new Error(
        message.error?.message || "Invalid web provider response.",
      );
    return message.result;
  };
  // Native Chrome APIs cannot be aborted. Bound the whole operation as well
  // as fetch, including preparation and per-request consent checks.
  let abortOperation!: () => void;
  const interrupted = new Promise<never>((_resolve, reject) => {
    abortOperation = () => reject(new Error("Web operation aborted."));
    controller.signal.addEventListener("abort", abortOperation, { once: true });
    if (controller.signal.aborted) abortOperation();
  });
  try {
    return await Promise.race([
      (async () => {
        if (controller.signal.aborted)
          throw new Error("Web operation aborted.");
        await prepareWebRequests();
        const initialized = await rpc("initialize", {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "Lumos", version: "1.0.17" },
        });
        if (initialized.protocolVersion !== "2025-03-26")
          throw new Error("Unsupported web provider protocol version.");
        await rpc("notifications/initialized", {}, true);
        const discovery = await rpc("tools/list", {});
        const tools = discovery.tools as { name: string }[];
        if (
          !Array.isArray(tools) ||
          !tools.some((tool) => tool.name === request.name)
        )
          throw new Error("The requested web tool is unavailable.");
        const result = await rpc("tools/call", {
          name: request.name,
          arguments: { ...request.arguments, session_id: conversationId },
        });
        if (result.isError)
          throw new Error("Web provider could not complete the request.");
        const content = result.content as { type: string; text?: string }[];
        const text = Array.isArray(content)
          ? content
              .filter((item) => item.type === "text")
              .map((item) => item.text || "")
              .join("\n")
          : "";
        if (!text) throw new Error("Web provider returned no text.");
        // The provider returns answer-ready excerpts and source URLs as tool text.
        return formatWebResult(result, text);
      })(),
      interrupted,
    ]);
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        signal.aborted ? "Web request cancelled." : "Web request timed out.",
      );
    throw error;
  } finally {
    controller.signal.removeEventListener("abort", abortOperation);
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
};
