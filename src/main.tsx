import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./ui/App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
