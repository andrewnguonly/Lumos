import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import CssBaseline from "@mui/material/CssBaseline";
import Options from "./pages/Options";

const root = document.createElement("div");
root.className = "container";
document.body.appendChild(root);
const rootDiv = ReactDOM.createRoot(root);
rootDiv.render(
  <React.StrictMode>
    <ThemeProvider>
      <CssBaseline />
      <Options />
    </ThemeProvider>
  </React.StrictMode>,
);
