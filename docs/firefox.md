# Steps to Install on Firefox

**Warning**: Lumos was originally developed as a Chrome extension. Some features may not be compatible with Firefox. Only follow these instructions if you know what you're doing. Proceed with caution.

## Build Lumos

1. Update `manifest.json`. Modify the `background` configuration. Example:

    "background": {
        "scripts": ["js/background.js"]
    },

1. Rebuild the extension: `npm run build`

## Start Ollama Server

Example:
```
OLLAMA_ORIGINS=moz-extension://* ollama serve
```

## Install Lumos

1. Install [Firefox ESR](https://www.mozilla.org/en-US/firefox/enterprise/).
1. Navigate to `about:config`. A warning message will appear. Click `Accept the Risk and Continue`.
1. Search for the preference `extensions.backgroundServiceWorker.enabled` and set it to `true`.
1. Navigate to `about:debugging#/runtime/this-firefox` and load the extension as a Temporary Add-on. Click `Load Temporary Add-on...` and select `manifest.json`.

## Future

In the future, a dedicated Firefox compatible version of Lumos may be built.
