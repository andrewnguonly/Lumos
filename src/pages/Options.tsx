import { ChangeEvent, useEffect, useState } from "react";
import {
  FormControl,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  ThemeProvider,
} from "@mui/material";
import AppTheme from "../themes/AppTheme";
import "./Options.css";


function Options() {

  const [model, setModel] = useState("");
  const [modelOptions, setModelOptions] = useState([]);
  const [host, setHost] = useState("http://localhost:11434");

  const handleModelChange = (event: SelectChangeEvent) => {
    const selectedModel = event.target.value;
    setModel(selectedModel);
    chrome.storage.local.set({ selectedModel: selectedModel});
  };

  const handleHostChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedHost = event.target.value;
    setHost(selectedHost);
    chrome.storage.local.set({ selectedHost: selectedHost});
  }

  useEffect(() => {
    chrome.storage.local.get(["selectedHost"]).then((data) => {
      if (data.selectedHost) {
        setHost(data.selectedHost);
      } else {
        setHost("http://localhost:11434");
      }
    });
  }, []);

  useEffect(() => {
    fetch(`${host}/api/tags`)
      .then((response) => response.json())
      .then((data) => {
        const modelOptions = data.models.map((model: any) => {
          return model.name.split(":")[0];
        })
        setModelOptions(modelOptions);
        chrome.storage.local.get(["selectedModel"]).then((data) => {
          if (data.selectedModel) {
            setModel(data.selectedModel);
          } else {
            setModel(modelOptions[0]);
          }
        });
      })
      .catch((error) => {
        console.warn("Error retrieving Ollama models: ", error);
      });
  }, [host]);

  return (
    <ThemeProvider theme={AppTheme}>
      <div className="options-popup">
        <FormControl fullWidth>
          <FormGroup>
            <InputLabel id="ollama-model-select-label">Ollama Model</InputLabel>
            <Select
              className="options-form-input"
              labelId="ollama-model-select-label"
              label="Ollama Model"
              value={model}
              onChange={handleModelChange}
            >
              {modelOptions.map((modelName, index) => (
                <MenuItem key={index} value={modelName}>
                  {modelName}
                </MenuItem>
              ))}
            </Select>
            <TextField
              className="options-form-input"
              label="Ollama Host"
              value={host}
              onChange={handleHostChange}
            />
          </FormGroup>
        </FormControl>
      </div>
    </ThemeProvider>
  );
}

export default Options;
