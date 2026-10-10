import React from "react";
import { createRoot } from "react-dom/client";
import "../styles/base.css";
import "./panel.css";
import { Panel } from "./Panel";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Panel />
  </React.StrictMode>,
);
