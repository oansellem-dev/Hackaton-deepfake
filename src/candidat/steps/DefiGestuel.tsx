import { useEffect, useRef, useState } from "react";

/** Défi gestuel. Le moteur de défis (brique B) remplace le bouton « C'est fait » par sa détection. */
export function DefiGestuel({ stream, onSuivant }: { stream: MediaStream | null; onSuivant: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [fait, setFait] = useState(false);
  useEffect(() => { if (video.current && stream) video.current.srcObject = stream; }, [stream]);
  return (
    <>
      <h1>Passez lentement la main devant votre visage</h1>
      <div className="cam">
        {stream ? <video ref={video} autoPlay muted playsInline /> : <span>Pas de caméra : vous pouvez passer cette étape.</span>}
        <div className={`cam__ovale ${fait ? "cam__ovale--ok" : ""}`} />
      </div>
      <div className="cand__actions">
        <button className="btn btn--secondary" onClick={onSuivant}>Passer cette étape</button>
        <button className="btn btn--primary" onClick={() => { setFait(true); window.setTimeout(onSuivant, 700); }}>{fait ? "Merci !" : "C'est fait"}</button>
      </div>
    </>
  );
}
