import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IcChevron } from "./icons";
import "./bouncy-accordion.css";

/**
 * Accordéon « bouncy » (recréation du Bouncy Accordion de Skiper UI, interaction inspirée de Yanis).
 * Une pile de lignes blanches ; la ligne ouverte se détache des autres avec une marge, les coins
 * se recalculent par groupe, et tout bouge sur un ressort. Un seul élément ouvert à la fois.
 */
export interface AccordeonItem { id: string; icone: ReactNode; titre: string; contenu: ReactNode }

const FERME = 45;     // hauteur d'une ligne fermée (px)
const ECART = 10;     // marge qui détache la ligne ouverte (px)
const RAYON = 20;     // rayon des coins (px)

export function BouncyAccordion({ items, ouvertParDefaut = null, className = "" }: { items: AccordeonItem[]; ouvertParDefaut?: string | null; className?: string }) {
  const [ouvert, setOuvert] = useState<string | null>(ouvertParDefaut);
  return (
    <ul className={`bacc ${className}`.trim()}>
      {items.map((it, i) => {
        const estOuvert = it.id === ouvert;
        // Coins : 20 px en haut si premier du groupe, en bas si dernier du groupe (un groupe = lignes contiguës fermées)
        const premier = i === 0 || items[i - 1].id === ouvert;
        const dernier = i === items.length - 1 || items[i + 1].id === ouvert;
        const r = estOuvert ? RAYON : 0;
        const rayon = `${premier || estOuvert ? RAYON : r}px ${premier || estOuvert ? RAYON : r}px ${dernier || estOuvert ? RAYON : r}px ${dernier || estOuvert ? RAYON : r}px`;
        return <Ligne key={it.id} item={it} ouvert={estOuvert} rayon={rayon} onToggle={() => setOuvert(estOuvert ? null : it.id)} />;
      })}
    </ul>
  );
}

function Ligne({ item, ouvert, rayon, onToggle }: { item: AccordeonItem; ouvert: boolean; rayon: string; onToggle: () => void }) {
  const corps = useRef<HTMLDivElement>(null);
  const [hauteur, setHauteur] = useState(FERME);
  // Hauteur cible mesurée sur le contenu réel, pour que la transition CSS ait une valeur numérique
  useLayoutEffect(() => {
    const mesurer = () => setHauteur(ouvert ? FERME + (corps.current?.scrollHeight ?? 0) : FERME);
    mesurer();
    if (!ouvert || !corps.current) return;
    const ro = new ResizeObserver(mesurer); ro.observe(corps.current);
    return () => ro.disconnect();
  }, [ouvert, item.contenu]);
  return (
    <li className={`bacc__item${ouvert ? " bacc__item--ouvert" : ""}`} style={{ height: hauteur, marginBlock: ouvert ? ECART : 0, borderRadius: rayon }}>
      <button type="button" className="bacc__tete" aria-expanded={ouvert} onClick={onToggle}>
        <span className="bacc__icone">{item.icone}</span>
        <span className="bacc__titre">{item.titre}</span>
        <IcChevron className="bacc__chevron" />
      </button>
      <div ref={corps} className="bacc__corps" aria-hidden={!ouvert}>{item.contenu}</div>
    </li>
  );
}
