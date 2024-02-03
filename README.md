# Lumos

A RAG LLM co-pilot for browsing the web, powered by local LLMs.

![Screenshot of Lumos](./screenshots/lumos_screenshot_2.png)

This Chrome extension is powered by [Ollama](https://ollama.ai/). Inference is done on your local machine without any _external_ server support. However, due to security constraints in the Chrome extension platform, the app does rely on _local_ server support to run the LLM. This app is inspired by the [Chrome extension example](https://github.com/mlc-ai/web-llm/tree/main/examples/chrome-extension) provided by the [Web LLM project](https://webllm.mlc.ai/) and the [local LLM examples](https://js.langchain.com/docs/use_cases/question_answering/local_retrieval_qa) provided by [LangChain](https://github.com/langchain-ai/langchainjs).

- [Ollama (Home)](https://ollama.ai/)
- [Ollama (GitHub)](https://github.com/jmorganca/ollama)

_Lumos. Nox. Lumos. Nox._

## Use Cases
- Summarize long threads on issue tracking sites, forums, and social media sites.
- Summarize news articles.
- Ask questions about reviews on business and product pages.
- Ask questions about long, technical documentation.
- ... what else?

## Ollama Server

A local Ollama server is needed for the embedding database and LLM inference. Download and install Ollama and the CLI [here](https://ollama.ai/).

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

### Releases

If you don't have `npm` installed, you can download the pre-built extension package from the [Releases](https://github.com/andrewnguonly/Lumos/releases) page.

## Lumos Options

Right-click on the extension icon to and select `Options` to access the extension's [Options page](https://developer.chrome.com/docs/extensions/develop/ui/options-page).

- **Ollama Model**: Select desired model (e.g. `llama2`)
- **Ollama Host**: Select desired host (defaults to `http://0.0.0.0:11434`)
- **Vector Store TTL (minutes)**: Number of minutes to store a URL's content in the vector store cache.
- **Content Parser Config**: Lumos's default content parser will extract all text content between a page's `<body></body>` tag. To customize the content parser, add an entry to the configuration.

### Content Parser Config

Each domain can have its own content parser.

- **chunkSize**: Number of characters to chunk page content into for indexing into RAG vectorstore
- **chunkOverlap**: Number of characters to overlap in chunks for indexing into RAG vectorstore
- **selectors**: `document.querySelector()` queries to perform to retrieve page content
- **selectorsAll**: `document.querySelectorAll()` queries to perform to retrieve page content

See documentation for [`querySelector()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector) and [`querySelectorAll()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll) to confirm all querying capabilities.

Example:
```json
{
  "default": {
    "chunkSize": 500,
    "chunkOverlap": 0,
    "selectors": [
      "body"
    ],
    "selectorsAll": []
  },
  "medium.com": {
    "chunkSize": 500,
    "chunkOverlap": 0,
    "selectors": [
      "article"
    ],
    "selectorsAll": []
  },
  "reddit.com": {
    "chunkSize": 500,
    "chunkOverlap": 0,
    "selectors": [],
    "selectorsAll": [
      "shreddit-comment"
    ]
  },
  "stackoverflow.com": {
    "chunkSize": 500,
    "chunkOverlap": 0,
    "selectors": [
      "#question-header",
      "#mainbar"
    ],
    "selectorsAll": []
  },
  "substack.com": {
    "chunkSize": 500,
    "chunkOverlap": 0,
    "selectors": [
      "article"
    ],
    "selectorsAll": []
  },
  "wikipedia.org": {
    "chunkSize": 2000,
    "chunkOverlap": 500,
    "selectors": [
      "#bodyContent"
    ],
    "selectorsAll": []
  },
  "yelp.com": {
    "chunkSize": 500,
    "chunkOverlap": 0,
    "selectors": [
      "#location-and-hours",
      "#reviews"
    ],
    "selectorsAll": []
  }
}
```
### Highlighted Content

Alternatively, if content is highlighted on a page (e.g. highlighted text), that content will be parsed instead of the content produced from the content parser configuration.

## Multimodal

Lumos supports multimodal models! Images that are present on the current page will be downloaded and bound to the model for querying. See examples [here](./docs/multimodal.md).

## Reading
- [Local LLM in the Browser Powered by Ollama](https://medium.com/@andrewnguonly/local-llm-in-the-browser-powered-by-ollama-236817f335da)
- [Local LLM in the Browser Powered by Ollama (Part 2)](https://medium.com/@andrewnguonly/local-llm-in-the-browser-powered-by-ollama-part-2-6eb10caf39a1)
