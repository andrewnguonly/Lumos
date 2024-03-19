import React from "react";

import CssBaseline from "@mui/material/CssBaseline";
import ReactDOM from "react-dom/client";

import App from "./App";
import { ThemeProvider } from "./contexts/ThemeContext";

const root = document.createElement("div");
root.className = "container";
document.body.appendChild(root);
const rootDiv = ReactDOM.createRoot(root);
rootDiv.render(
  <React.StrictMode>
    <ThemeProvider>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
