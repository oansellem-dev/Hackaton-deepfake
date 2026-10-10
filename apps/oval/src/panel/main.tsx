import React from "react";
import { createRoot } from "react-dom/client";
import "../styles/base.css";
import "./panel.css";
import { Panel } from "./Panel";
import { Toaster } from "../ui/ui";

createRoot(document.getElementById("root")!).render(<React.StrictMode><Panel /><Toaster /></React.StrictMode>);
