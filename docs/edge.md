# Steps to Install on Microsoft Edge

**Warning**: Lumos was originally developed as a Chrome extension. Some features may not be compatible with Microsoft Edge.

## Start Ollama Server

Example:
```
OLLAMA_ORIGINS=chrome-extension://* ollama serve
```

Note: The host protocol is still `chrome-extension://` despite the extension running on Microsoft Edge.

## Install Lumos

Follow instructions to [Sideload an extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading) on Microsoft Edge.
