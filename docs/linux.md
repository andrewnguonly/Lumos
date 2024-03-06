# Linux

## Add `OLLAMA_ORIGINS` Environment Variable to Ollama Startup Service

1. Follow [Ollama's instructions for adding it as a startup service](https://github.com/ollama/ollama/blob/main/docs/linux.md#adding-ollama-as-a-startup-service-recommended).
2. In the service file, set `Environment` to `"OLLAMA_ORIGINS=chrome-extension://*"`.

Example service file:
```
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
Environment="OLLAMA_ORIGINS=chrome-extension://*"
ExecStart=/usr/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```