import { useEffect, useState } from "react";
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, ThemeProvider } from "@mui/material";
import AppTheme from "../themes/AppTheme";
import "./Options.css";


function Options() {

  const [model, setModel] = useState("");
  const [modelOptions, setModelOptions] = useState([]);

  const handleModelChange = (event: SelectChangeEvent) => {
    const selectedModel = event.target.value;
    setModel(selectedModel);
    chrome.storage.local.set({ selectedModel: selectedModel});
  };

  useEffect(() => {
    fetch("http://localhost:11434/api/tags")
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
        console.error("Error retrieving Ollama models: ", error);
      });
  }, []);

  return (
    <ThemeProvider theme={AppTheme}>
      <div className="options-popup">
        <FormControl fullWidth>
          <InputLabel id="ollama-model-select-label">Ollama Model</InputLabel>
          <Select
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
        </FormControl>
      </div>
    </ThemeProvider>
  );
}

export default Options;
