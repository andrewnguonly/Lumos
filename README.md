# Lumos

A RAG LLM co-pilot for browsing the web, powered by local LLMs.

This Chrome extension is powered by [Web LLM](https://webllm.mlc.ai/) and [Ollama](https://ollama.ai/). Inference is done on your local machine without any _external_ server support. However, due to security constraints in the Chrome extension platform, the app does rely on _local_ server support to run the LLM. This app is inspired by the [Chrome extension example](https://github.com/mlc-ai/web-llm/tree/main/examples/chrome-extension) provided by the Web LLM project and the [local LLMs (Ollama) examples](https://js.langchain.com/docs/use_cases/question_answering/local_retrieval_qa) provided by LangChain.

- [Web LLM (Home)](https://webllm.mlc.ai/)
- [Web LLM (GitHub)](https://github.com/mlc-ai/web-llm/tree/main)
- [Ollama (Home)](https://ollama.ai/)
- [Ollama (GitHub)](https://github.com/jmorganca/ollama)

_Lumos. Nox. Lumos. Nox._

## Web LLM Server

A local Web LLM server is needed to run the LLM. Follow the [Web LLM REST API documentation](https://llm.mlc.ai/docs/deploy/rest.html) to set up the server.

### Download Prebuilt Models and Weights

[This example notebook](https://github.com/mlc-ai/notebooks/blob/main/mlc-llm/tutorial_chat_module_getting_started.ipynb) demonstrates the steps to install the MLC-Chat Python package and download prebuilt models and weights. Models and weights are saved to the local machine.

Example directory structure:
```
/models
  /prebuilt
    /lib
      Llama-2-7b-chat-hf-q4f16_1-metal.so
      <model_name_2>
    /mlc-chat-Llama-2-7b-chat-hf-q4f16_1
      ...
    /mlc-chat-<model_name_2>
```

### Start Server

Example:
```
python -m mlc_chat.rest --model=./models/prebuilt/mlc-chat-Llama-2-7b-chat-hf-q4f16_1 --lib-path=./models/prebuilt/lib/Llama-2-7b-chat-hf-q4f16_1-metal.so
```

Terminal output:
```
INFO:     Started server process [91509]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### Update `max_window_size`

The following error may occur if the `max_window_size` is too small:

```
[12:22:30] /Users/catalyst/Workspace/mlc-ai-package-self-runner/_work/package/package/mlc-llm/cpp/llm_chat.cc:648: Warning: The prompt tokens are more than `max_window_size`, the input will be truncated.
```

Update the `max_window_size` configuration in the model's `mlc-chat-config.json` configuration file (located at `./models/prebuilt/mlc-chat-Llama-2-7b-chat-hf-q4f16_1/mlc-chat-config.json`).

```
{
    "model_lib": "Llama-2-7b-chat-hf-q4f16_1",
    "local_id": "Llama-2-7b-chat-hf-q4f16_1",
    "conv_template": "llama-2",
    "temperature": 0.7,
    "repetition_penalty": 1.0,
    "top_p": 0.95,
    "mean_gen_len": 128,
    "max_gen_len": 512,
    "shift_fill_factor": 0.3,
    "tokenizer_files": [
        "added_tokens.json",
        "tokenizer.json",
        "tokenizer.model"
    ],
    "model_category": "llama",
    "model_name": "Llama-2-7b-chat-hf",
    "max_window_size": 8192,
    "vocab_size": 32000
}
```

## Ollama Server

A local Ollama server is needed for the embedding database. Download and install Ollama and the CLI [here](https://ollama.ai/).

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

## Use Cases
- Summarize long threads on issue tracking sites, forums, and social media sites.
- Summarize news articles.
- Ask questions about reviews on business and product pages.
- Ask questions about long, technical documentation.
- ... what else?
