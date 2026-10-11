/** Petits événements globaux de l'interface. */
export interface Creneau { date: string; heure: string }
/** Ouvre la fenêtre « Nouvel entretien », éventuellement sur un créneau choisi dans le calendrier. */
export const ouvrirNouvelEntretien = (creneau?: Creneau | unknown) => {
  const ok = !!creneau && typeof creneau === "object" && "date" in creneau && "heure" in creneau ? (creneau as Creneau) : undefined;
  window.dispatchEvent(new CustomEvent<Creneau | undefined>("oval:nouvel-entretien", { detail: ok }));
};
