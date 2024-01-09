# Lumos

A RAG LLM co-pilot for browsing the web, powered by local LLMs.

![Screenshot of Lumos](lumos_screenshot.png)

This Chrome extension is powered by [Ollama](https://ollama.ai/). Inference is done on your local machine without any _external_ server support. However, due to security constraints in the Chrome extension platform, the app does rely on _local_ server support to run the LLM. This app is inspired by the [Chrome extension example](https://github.com/mlc-ai/web-llm/tree/main/examples/chrome-extension) provided by the [Web LLM project](https://webllm.mlc.ai/) and the [local LLM examples](https://js.langchain.com/docs/use_cases/question_answering/local_retrieval_qa) provided by LangChain.

- [Ollama (Home)](https://ollama.ai/)
- [Ollama (GitHub)](https://github.com/jmorganca/ollama)

_Lumos. Nox. Lumos. Nox._

## Ollama Server

A local Ollama server is needed for the embedding database and LLM inference. Download and install Ollama and the CLI [here](https://ollama.ai/).

### Pull Model

`llama2` model is required. The implementation of Lumos is [hardcoded](https://github.com/andrewnguonly/Lumos/blob/main/src/scripts/background.ts#L12) to use `llama2`.
```
ollama pull llama2
```

To change models, pull the desired model and update the hardcoded model value.
```
ollama pull mistral
```

Update `src/scripts/background.ts`.
```typescript
const OLLAMA_MODEL = "mistral"; // change model name here
```

### Start Server

Example:
```
OLLAMA_ORIGINS=chrome-extension://* ollama serve
```

Terminal output:
```
2023/11/19 20:55:16 images.go:799: total blobs: 6
2023/11/19 20:55:16 images.go:806: total unused blobs removed: 0
2023/11/19 20:55:16 routes.go:777: Listening on 127.0.0.1:11434 (version 0.1.10)
```

Note: The environment variable `OLLAMA_ORIGINS` must be set to `chrome-extension://*` to allow requests originating from the Chrome extension.

### Docker

The Ollama server can also be [run in a Docker container](https://hub.docker.com/r/ollama/ollama). The container should have the `OLLAMA_ORIGINS` environment variable set to `chrome-extension://*`.

Run `docker run` with the `-e` flag to set the `OLLAMA_ORIGINS` environment variable:
```
docker run -e OLLAMA_ORIGINS="chrome-extension://*" -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

Update the host and port as needed (`src/scripts/background.ts`):
```typescript
const OLLAMA_BASE_URL = "http://0.0.0.0:11434";
```

## Chrome Extension

In the project directory, you can run:

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `dist` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### Load Unpacked Extension (Install)

https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked

## Custom Content Parser

Lumos's default content parser will extract all text content between a page's `<body></body>` tag. To customize the content parser, add an entry to the file `contentConfig.ts`.

Example:
```typescript
export const contentConfig: ContentConfig = {
  // each domain can have its own content parser
  "domain.com": {
    // number of characters to chunk page content into for indexing into RAG vectorstore
    chunkSize: 500, 
    // number of characters to overlap in chunks for indexing into RAG vectorstore
    chunkOverlap: 100,
    // document.querySelector() queries to perform to retrieve page content
    selectors: [
      "body",
    ],
    // document.querySelectorAll() queries to perform to retrieve page content
    selectorsAll: [
      "comment",
    ],
  },
}
```

See documentation for [`querySelector()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector) and [`querySelectorAll()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll) to confirm all querying capabilities.

## Use Cases
- Summarize long threads on issue tracking sites, forums, and social media sites.
- Summarize news articles.
- Ask questions about reviews on business and product pages.
- Ask questions about long, technical documentation.
- ... what else?
