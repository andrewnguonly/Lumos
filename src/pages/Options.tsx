import { ChangeEvent, useEffect, useState } from "react";
import {
  Box,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Switch,
  TextField,
  ThemeProvider,
} from "@mui/material";
import {
  ContentConfig,
  defaultContentConfig,
  isContentConfig,
} from "../contentConfig";
import { useThemeContext } from "../contexts/ThemeContext";
import "./Options.css";

export interface ToolConfig {
  [key: string]: {
    enabled: boolean;
    prefix: string;
  };
}

export const DEFAULT_HOST = "http://localhost:11434";
export const DEFAULT_KEEP_ALIVE = "60m";
export const DEFAULT_CONTENT_CONFIG = JSON.stringify(
  defaultContentConfig,
  null,
  2,
);
export const DEFAULT_VECTOR_STORE_TTL_MINS = 60;
export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  Calculator: {
    enabled: true,
    prefix: "calculate:",
  },
};
export const MULTIMODAL_MODELS = ["llava", "bakllava"];
export const EMBEDDING_MODELS = ["nomic-embed-text", "all-minilm"];
export const CHAT_CONTAINER_HEIGHT_MIN = 200;
export const CHAT_CONTAINER_HEIGHT_MAX = 500;

export interface LumosOptions {
  ollamaModel: string;
  ollamaEmbeddingModel: string;
  ollamaHost: string;
  contentConfig: ContentConfig;
  vectorStoreTTLMins: number;
  toolConfig: ToolConfig;
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
        "toolConfig",
      ],
      (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({
            ollamaModel: data.selectedModel,
            ollamaEmbeddingModel:
              data.selectedEmbeddingModel || data.selectedModel,
            ollamaHost: data.selectedHost || DEFAULT_HOST,
            contentConfig: JSON.parse(
              data.selectedConfig || DEFAULT_CONTENT_CONFIG,
            ) as ContentConfig,
            vectorStoreTTLMins:
              parseInt(data.selectedVectorStoreTTLMins, 10) ||
              DEFAULT_VECTOR_STORE_TTL_MINS,
            toolConfig: data.toolConfig || DEFAULT_TOOL_CONFIG,
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

/**
 * Ollama API connectivity check.
 *
 * @param {string} host Ollama host.
 * @return {[boolean, string[], string]} Tuple of connected status, available models, and an optional error message.
 */
export const apiConnected = async (
  host: string,
): Promise<[boolean, string[], string]> => {
  let resp;
  const errMsg = "Unable to connect to Ollama API. Check Ollama server.";

  try {
    resp = await fetch(`${host}/api/tags`);
  } catch (e) {
    return [false, [], errMsg];
  }

  if (resp.ok) {
    const data = await resp.json();
    const modelOptions = data.models.map(
      (model: { name: string }) => model.name,
    );
    // successfully connected
    return [true, modelOptions, ""];
  }

  return [false, [], errMsg];
};

const Options: React.FC = () => {
  const [model, setModel] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [modelOptions, setModelOptions] = useState<string[]>([]);
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
  const [toolConfig, setToolConfig] = useState(DEFAULT_TOOL_CONFIG);
  const { theme, toggleDarkMode } = useThemeContext();
  const isDarkMode = theme.palette.mode === "dark";

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

  const handleToolEnabledChange = (tool: string, enabled: boolean) => {
    const newToolConfig = { ...toolConfig };
    newToolConfig[tool].enabled = enabled;
    setToolConfig(newToolConfig);
    chrome.storage.local.set({ toolConfig: newToolConfig });
  };

  const handleToolPrefixChange = (tool: string, prefix: string) => {
    const newToolConfig = { ...toolConfig };
    newToolConfig[tool].prefix = prefix;
    setToolConfig(newToolConfig);
    chrome.storage.local.set({ toolConfig: newToolConfig });
  };

  useEffect(() => {
    chrome.storage.local
      .get([
        "selectedModel",
        "selectedEmbeddingModel",
        "selectedHost",
        "selectedConfig",
        "selectedVectorStoreTTLMins",
        "toolConfig",
      ])
      .then(async (data) => {
        if (data.selectedConfig) {
          setContentConfig(data.selectedConfig);
        }
        if (data.selectedVectorStoreTTLMins) {
          setVectorStoreTTLMins(parseInt(data.selectedVectorStoreTTLMins, 10));
        }
        if (data.toolConfig) {
          // This logic is needed so tools can be added and removed from
          // DEFAULT_TOOL_CONFIG and the toolConfig local storage.
          Object.keys(DEFAULT_TOOL_CONFIG).forEach((tool) => {
            if (!data.toolConfig[tool]) {
              // add new tool
              data.toolConfig[tool] = DEFAULT_TOOL_CONFIG[tool];
            }
          });
          Object.keys(data.toolConfig).forEach((tool) => {
            if (!DEFAULT_TOOL_CONFIG[tool]) {
              // remove deleted tool
              delete data.toolConfig[tool];
            }
          });
          setToolConfig(data.toolConfig);
          chrome.storage.local.set({ toolConfig: data.toolConfig });
        }

        // API connectivity check
        const selectedHost = data.selectedHost || DEFAULT_HOST;
        setHost(selectedHost);

        const [connected, models, errMsg] = await apiConnected(selectedHost);
        if (connected) {
          setHostError(false);
          setHostHelpText("");
          setModelOptions(models);

          if (data.selectedModel) {
            setModel(data.selectedModel);
          } else {
            setModel(models[0]);
            chrome.storage.local.set({ selectedModel: models[0] });
          }
          if (data.selectedEmbeddingModel) {
            setEmbeddingModel(data.selectedEmbeddingModel);
          }
        } else {
          setHostError(true);
          setHostHelpText(errMsg);
        }
      });
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <Box className="options-popup">
        <FormControl className="options-input" size="small">
          <InputLabel id="ollama-model-select-label">Ollama Model</InputLabel>
          <Select
            sx={{ "margin-bottom": "15px" }}
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
        <FormControl className="options-input" size="small">
          <InputLabel id="ollama-embedding-select-label">
            Ollama Embedding Model
          </InputLabel>
          <Select
            sx={{ "margin-bottom": "15px" }}
            labelId="ollama-embedding-select-label"
            label="Ollama Embedding Model"
            value={embeddingModel}
            onChange={handleEmbeddingModelChange}
          >
            <MenuItem value="">
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
          sx={{ "margin-bottom": "15px" }}
          label="Ollama Host"
          value={host}
          error={hostError}
          helperText={hostHelpText}
          onChange={handleHostChange}
        />
        <TextField
          className="options-input"
          sx={{ "margin-bottom": "15px" }}
          type="number"
          label="Vector Store TTL (minutes)"
          value={vectorStoreTTLMins}
          error={vectorStoreTTLMinsError}
          onChange={handleVectorStoreTTLMinsChange}
        />
        <TextField
          className="options-input"
          sx={{ "margin-bottom": "15px" }}
          label="Content Parser Config"
          multiline
          rows={10}
          value={contentConfig}
          error={contentConfigError}
          helperText={contentConfigHelpText}
          onChange={handleContentConfigChange}
        />
        <Box sx={{ mb: "5px" }}>Enable/Disable Tools</Box>
        <Box sx={{ ml: "10px" }}>
          {Object.entries(toolConfig).map(([key, value]) => (
            <Box key={key} sx={{ display: "flex", alignItems: "center" }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={value.enabled}
                    onChange={() =>
                      handleToolEnabledChange(key, !value.enabled)
                    }
                  />
                }
                label={key}
              />
              <div style={{ flex: 1 }}></div>
              <TextField
                sx={{ width: "50%" }}
                label="Prefix trigger"
                disabled={!value.enabled}
                value={value.prefix}
                onChange={(event) =>
                  handleToolPrefixChange(key, event.target.value)
                }
              />
            </Box>
          ))}
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={theme.palette.mode === "dark"}
                  onChange={toggleDarkMode}
                  name="darkModeToggle"
                />
              }
              label={`Dark Arts${isDarkMode ? " 😈" : ""}`}
            />
          </FormGroup>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default Options;
