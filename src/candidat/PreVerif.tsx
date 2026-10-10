import { useEffect, useState } from "react";
import { Accord } from "./steps/Accord";
import { Signaux } from "./steps/Signaux";
import { TestLumiere } from "./steps/TestLumiere";
import { DefiGestuel } from "./steps/DefiGestuel";
import { Fin } from "./steps/Fin";
import "./candidat.css";

/**
 * Parcours candidat. Il ne voit jamais de score.
 * Les résultats sont à envoyer au serveur de score (voir api.ts) :
 *   - signaux techniques (caméras, fuseau, langue), pas d'IP côté navigateur ;
 *   - test de lumière : séquence jouée + horodatages (l'analyse se fait dans le navigateur, brique B) ;
 *   - défi gestuel : résultat du moteur de défis.
 */
export type Etape = 0 | 1 | 2 | 3 | 4;
const TITRES = ["Avant de commencer", "Signaux techniques", "Test de lumière", "Un geste simple", "C'est terminé"];

export function PreVerif({ token }: { token: string }) {
  const [etape, setEtape] = useState<Etape>(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const suivant = () => setEtape((e) => Math.min(4, e + 1) as Etape);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const demanderCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      setStream(s);
    } catch {
      setStream(null); // sans caméra, on continue : ce n'est pas un signal
    }
    suivant();
  };

  return (
    <div className="surface">
      <div className="cand">
        <div className="cand__top">
          <span className="logo"><span className="logo__o" aria-hidden />val</span>
          <div className="cand__steps" aria-label={`Étape ${etape + 1} sur 5`}>
            {TITRES.map((_, i) => <span key={i} className={`cand__step ${i < etape ? "cand__step--done" : i === etape ? "cand__step--now" : ""}`} />)}
          </div>
        </div>
        <div className="page" key={etape} style={{ display: "contents" }}>
          {etape === 0 && <Accord onAccepter={demanderCamera} />}
          {etape === 1 && <Signaux stream={stream} onSuivant={suivant} />}
          {etape === 2 && <TestLumiere stream={stream} onFin={suivant} />}
          {etape === 3 && <DefiGestuel stream={stream} onSuivant={suivant} />}
          {etape === 4 && <Fin token={token} />}
        </div>
      </div>
    </div>
  );
}
