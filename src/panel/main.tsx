import React from "react";
import { createRoot } from "react-dom/client";
import "../styles/base.css";
import { PanelOval } from "./PanelOval";
import { Toaster } from "../ui/ui";
import { aujourdhui, getEtat, memeJour } from "../store/store";

// Entretien affiché : ?e=<id>, sinon le prochain du jour, sinon le prochain à venir.
function choisir(): string {
  const e = getEtat();
  const ref = aujourdhui(e);
  const avenir = e.entretiens.filter((x) => x.statut !== "termine").sort((a, b) => +new Date(a.date) - +new Date(b.date));
  return new URLSearchParams(location.search).get("e") ?? avenir.find((x) => memeJour(new Date(x.date), ref))?.id ?? avenir[0]?.id ?? e.entretiens[0].id;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><PanelOval entretienId={choisir()} /><Toaster /></React.StrictMode>);
