# Tools (Experimental)

The integration of [LangChain Tools](https://js.langchain.com/docs/modules/agents/tools/) into Lumos is an experimental feature. Lumos is not an [Agent](https://js.langchain.com/docs/modules/agents/) per se. However, the implementation automatically invokes tools when appropriate.

Messages from tools will be in light blue with a hammer avatar.
![Tool Message](../screenshots/tool_message.png)

## Calculator

The `Calculator` tool evaluates arithmetic expressions. For example, the prompt `What's 45*6+7=?` will return `277`. To manually trigger, the `Calculator` tool, prefix the prompt with `calculate:` (e.g. `calculate: 1+1`).

Not all arithmetic expressions are supported. In some cases, unsupported expressions may produce a false positive result. The implementation of the tool has a "loose" approach towards parsing expressions. This means that non-arithmetic characters (e.g. letters, symbols) are accepted as part of the expression, but are parsed out and ignored. This may result in a valid arithmetic expression, but an unintended one that produces a false positive result. A "loose" approach is favored over a "strict" approach to allow expressions that may contain conversational context (e.g. `"What's 1+1?"`), whitespace (e.g. `"2 + 2"`), and the trigger prefix (`calculate:`). In the future, the implementation for parsing expressions may become more strict.

**Warning: Double-check all calculations.**

## Web search and page fetching

Lumos includes [Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp) as its web-search provider. Search uses Fast mode and needs no account or API key. Open Lumos Options and select **Allow web access** to grant the optional Chrome permission. Until you grant it, web tools make no network requests and chat continues to use your Ollama server.

- `search: Ollama model context window` searches the web and displays source URLs and relevant excerpts.
- `fetch: https://ollama.com/blog` retrieves text from an HTTP or HTTPS page.

Web tools run only with their prefix, never by automatic prompt classification. Customize each prefix or disable **Web Search** and **Fetch Page** independently under **Enable/Disable Tools**. Prefixes must be nonempty. Existing Calculator and model settings are preserved. Select **Revoke web access** to prevent all web-tool requests.

Only the search query or requested URL is sent to Parallel, along with a random conversation identifier. Web tools do not send page content, attachments or chat history to Parallel. Clearing the chat starts a new identifier; retries and follow-up requests keep the current one. Inference continues to use your configured Ollama server. See Parallel's [privacy policy](https://parallel.ai/privacy-policy).

Results appear as tool messages with source excerpts and URLs. Access failures and rate limits appear as tool errors, without silently switching providers. Requests time out after 30 seconds and can be cancelled with `ctrl + c`. The anonymous service is intended for light use and has usage limits.
