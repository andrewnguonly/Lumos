import { ChangeEvent, useEffect, useState } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  ThemeProvider,
} from "@mui/material";
import AppTheme from "../themes/AppTheme";
import {
  ContentConfig,
  defaultContentConfig,
  isContentConfig,
} from "../contentConfig";
import "./Options.css";

export const DEFAULT_MODEL = "llama2";
export const DEFAULT_EMBEDDING_MODEL = "";
export const DEFAULT_HOST = "http://localhost:11434";
export const DEFAULT_KEEP_ALIVE = "60m";
export const DEFAULT_CONTENT_CONFIG = JSON.stringify(
  defaultContentConfig,
  null,
  2,
);
export const DEFAULT_VECTOR_STORE_TTL_MINS = 60;
export const MULTIMODAL_MODELS = ["llava", "bakllava"];
export const EMBEDDING_MODELS = ["nomic-embed-text", "all-minilm"];
export const CHAT_CONTAINER_HEIGHT_MIN = 200;
export const CHAT_CONTAINER_HEIGHT_MAX = 500;

interface LumosOptions {
  ollamaModel: string;
  ollamaEmbeddingModel: string;
  ollamaHost: string;
  contentConfig: ContentConfig;
  vectorStoreTTLMins: number;
}

export const getLumosOptions = async (): Promise<LumosOptions> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      [
        "selectedModel",
        "selectedEmbeddingModel",
        "selectedHost",
        "selectedConfig",
        "selectedVectorStoreTTLMins",
      ],
      (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({
            ollamaModel: data.selectedModel || DEFAULT_MODEL,
            ollamaEmbeddingModel:
              data.selectedEmbeddingModel || DEFAULT_EMBEDDING_MODEL,
            ollamaHost: data.selectedHost || DEFAULT_HOST,
            contentConfig: JSON.parse(
              data.selectedConfig || DEFAULT_CONTENT_CONFIG,
            ) as ContentConfig,
            vectorStoreTTLMins:
              parseInt(data.selectedVectorStoreTTLMins, 10) ||
              DEFAULT_VECTOR_STORE_TTL_MINS,
          });
        }
      },
    );
  });
};

export const isMultimodal = (model: string): boolean => {
  return MULTIMODAL_MODELS.some((multimodalModel) =>
    model.includes(multimodalModel),
  );
};

const Options: React.FC = () => {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [embeddingModel, setEmbeddingModel] = useState(DEFAULT_EMBEDDING_MODEL);
  const [modelOptions, setModelOptions] = useState([]);
  const [host, setHost] = useState(DEFAULT_HOST);
  const [hostError, setHostError] = useState(false);
  const [hostHelpText, setHostHelpText] = useState("");
  const [contentConfig, setContentConfig] = useState(DEFAULT_CONTENT_CONFIG);
  const [contentConfigError, setContentConfigError] = useState(false);
  const [contentConfigHelpText, setContentConfigHelpText] = useState("");
  const [vectorStoreTTLMins, setVectorStoreTTLMins] = useState(
    DEFAULT_VECTOR_STORE_TTL_MINS,
  );
  const [vectorStoreTTLMinsError, setVectorStoreTTLMinsError] = useState(false);

  const handleModelChange = (event: SelectChangeEvent) => {
    const selectedModel = event.target.value;
    setModel(selectedModel);
    chrome.storage.local.set({ selectedModel: selectedModel });
  };

  const handleEmbeddingModelChange = (event: SelectChangeEvent) => {
    const selectedEmbeddingModel = event.target.value;
    setEmbeddingModel(selectedEmbeddingModel);
    chrome.storage.local.set({
      selectedEmbeddingModel: selectedEmbeddingModel,
    });
  };

  const handleHostChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedHost = event.target.value;
    setHost(selectedHost);
    chrome.storage.local.set({ selectedHost: selectedHost });
  };

  const handleContentConfigChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedConfig = event.target.value;
    setContentConfig(selectedConfig);
    chrome.storage.local.set({ selectedConfig: selectedConfig });

    if (isContentConfig(selectedConfig)) {
      setContentConfigError(false);
      setContentConfigHelpText("");
    } else {
      setContentConfigError(true);
      setContentConfigHelpText(
        "Invalid JSON or content config. Please check the syntax and update the config.",
      );
    }
  };

  const handleVectorStoreTTLMinsChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    let selectedVectorStoreTTLMins = parseInt(event.target.value, 10);

    if (isNaN(selectedVectorStoreTTLMins)) {
      selectedVectorStoreTTLMins = 0;
    }

    if (selectedVectorStoreTTLMins < 1) {
      setVectorStoreTTLMinsError(true);
    } else {
      setVectorStoreTTLMinsError(false);
    }

    setVectorStoreTTLMins(selectedVectorStoreTTLMins);
    chrome.storage.local.set({
      selectedVectorStoreTTLMins: selectedVectorStoreTTLMins,
    });
  };

  useEffect(() => {
    chrome.storage.local
      .get(["selectedHost", "selectedConfig", "selectedVectorStoreTTLMins"])
      .then((data) => {
        if (data.selectedConfig) {
          setContentConfig(data.selectedConfig);
        }
        if (data.selectedVectorStoreTTLMins) {
          setVectorStoreTTLMins(parseInt(data.selectedVectorStoreTTLMins, 10));
        }

        // API connectivity check
        const selectedHost = data.selectedHost || DEFAULT_HOST;
        fetch(`${selectedHost}/api/tags`)
          .then((response) => response.json())
          .then((data) => {
            const modelOptions = data.models.map(
              (model: { name: string }) => model.name,
            );
            setModelOptions(modelOptions);
            chrome.storage.local
              .get(["selectedModel", "selectedEmbeddingModel"])
              .then((data) => {
                if (data.selectedModel) {
                  setModel(data.selectedModel);
                } else {
                  setModel(modelOptions[0]);
                }
                if (data.selectedEmbeddingModel) {
                  setEmbeddingModel(data.selectedEmbeddingModel);
                } else {
                  setEmbeddingModel(DEFAULT_EMBEDDING_MODEL);
                }
              });
            setHostError(false);
            setHostHelpText("");
          })
          .catch(() => {
            setHostError(true);
            setHostHelpText("Error connecting to Ollama host");
          });
        setHost(selectedHost);
      });
  }, []);

  return (
    <ThemeProvider theme={AppTheme}>
      <Box className="options-popup">
        <FormControl className="options-input">
          <InputLabel id="ollama-model-select-label">Ollama Model</InputLabel>
          <Select
            labelId="ollama-model-select-label"
            label="Ollama Model"
            value={model}
            onChange={handleModelChange}
          >
            {modelOptions
              .filter(
                (model: string) =>
                  !EMBEDDING_MODELS.includes(model.split(":")[0]),
              )
              .map((modelName: string, index) => (
                <MenuItem key={index} value={modelName}>
                  {`${modelName.split(":")[0]} (${modelName.split(":")[1]})`}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
        <FormControl className="options-input">
          <InputLabel id="ollama-embedding-select-label" shrink>
            Ollama Embedding Model
          </InputLabel>
          <Select
            labelId="ollama-embedding-select-label"
            label="Ollama Embedding Model"
            value={embeddingModel}
            onChange={handleEmbeddingModelChange}
          >
            <MenuItem value={DEFAULT_EMBEDDING_MODEL}>
              <em>None</em>
            </MenuItem>
            {modelOptions
              .filter((model: string) =>
                EMBEDDING_MODELS.includes(model.split(":")[0]),
              )
              .map((modelName: string, index) => (
                <MenuItem key={index} value={modelName}>
                  {`${modelName.split(":")[0]} (${modelName.split(":")[1]})`}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
        <TextField
          className="options-input"
          label="Ollama Host"
          value={host}
          error={hostError}
          helperText={hostHelpText}
          onChange={handleHostChange}
        />
        <TextField
          className="options-input"
          type="number"
          label="Vector Store TTL (minutes)"
          value={vectorStoreTTLMins}
          error={vectorStoreTTLMinsError}
          onChange={handleVectorStoreTTLMinsChange}
        />
        <TextField
          className="options-input"
          label="Content Parser Config"
          multiline
          rows={10}
          value={contentConfig}
          error={contentConfigError}
          helperText={contentConfigHelpText}
          onChange={handleContentConfigChange}
        />
      </Box>
    </ThemeProvider>
  );
};

export default Options;
