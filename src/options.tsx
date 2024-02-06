import React from "react";
import ReactDOM from "react-dom/client";
import Options from "./pages/Options";

const root = document.createElement("div");
root.className = "container";
document.body.appendChild(root);
const rootDiv = ReactDOM.createRoot(root);
rootDiv.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
