import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FLASH_DEFAULTS,
  FLASH_REASON_TEXT,
  FLASH_THRESHOLDS,
  analyzeFlash,
  findVirtualCameras,
  makeFlashSequence,
  type FlashAnalysis,
  type FlashResult,
} from '@kyc/shared';
import { FlashLagCurve, FlashTimeline } from '../components/FlashChart.tsx';
import { FlashAborted, enterFullscreen, exitFullscreen, runFlash, secureRandom, type FlashRunResult } from '../lib/flash.ts';

// Espace de test de l'équipe (/lab/flash) : lancer le test du reflet sur une vraie caméra ou sur une attaque, voir
// pourquoi il conclut, et tenir le compte des 20 essais (taux de détection, taux de faux positifs) pour le jury.
// Aucun serveur : tout reste dans ce navigateur, y compris le journal des essais.

type SourceKind = 'camera' | 'replay' | 'file' | 'sim-react' | 'sim-static';
type Truth = 'real' | 'attack';

const SOURCES: { kind: SourceKind; label: string }[] = [
  { kind: 'camera', label: 'Caméra (vrai visage, ou caméra virtuelle)' },
  { kind: 'replay', label: 'Vidéo rejouée, enregistrée ici' },
  { kind: 'file', label: 'Fichier vidéo' },
  { kind: 'sim-react', label: 'Simulation : photo qui renvoie l’écran (contrôle technique)' },
  { kind: 'sim-static', label: 'Simulation : photo qui ne réagit pas (contrôle technique)' },
];

const ATTACKS = [
  'Vidéo rejouée',
  'Caméra virtuelle (OBS, ManyCam…)',
  'Photo ou écran tenu devant la caméra',
  'Filtre ou échange de visage',
  'Autre',
];

const RESULT_LABEL: Record<FlashResult, string> = { passed: 'Réussi', failed: 'Échec', inconclusive: 'Non concluant' };

interface LabRun {
  id: string;
  at: number;
  truth: Truth;
  attack?: string;
  source: string;
  result: FlashResult;
  reason: string;
  correlation: number;
  pValue: number;
  lagMs: number;
  amplitude: number;
  fps: number;
  faceCoverage: number;
  colors: number;
}

const STORAGE_KEY = 'kyc-flash-lab-v1';
const REPLAY_SECONDS = 6;
const SIM_LAG_MS = 100; // retard simulé de la caméra

function loadRuns(): LabRun[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as LabRun[];
  } catch {
    return [];
  }
}

function saveRuns(runs: LabRun[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch {
    /* stockage indisponible : le journal reste affiché jusqu'à la fermeture de la page */
  }
}

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const pct = (part: number, total: number) => (total ? `${Math.round((100 * part) / total)} %` : '—');
const fr = (x: number, digits = 2) => x.toFixed(digits).replace('.', ',');

// Caméra simulée pour vérifier toute la chaîne dans le navigateur (affichage, mesure, analyse) sans montage physique :
// une photo, avec ou sans le reflet de la couleur affichée par `stage` (retardé comme une vraie caméra).
function simulatedCamera(img: HTMLImageElement, stage: HTMLElement, reactive: boolean) {
  const W = 640;
  const H = 480;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const history: { t: number; color: string }[] = [];
  const timer = setInterval(() => {
    const now = performance.now();
    history.push({ t: now, color: getComputedStyle(stage).backgroundColor });
    while (history.length > 1 && history[1].t <= now - SIM_LAG_MS) history.shift();
    const jitter = () => (Math.random() - 0.5) * 2; // micro-mouvements de la tête
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(
      img,
      (W - img.naturalWidth * scale) / 2 + jitter(),
      (H - img.naturalHeight * scale) / 2 + jitter(),
      img.naturalWidth * scale,
      img.naturalHeight * scale,
    );
    if (reactive) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = history[0].color;
      ctx.fillRect(0, 0, W, H);
    }
  }, 1000 / 30);
  const stream = canvas.captureStream(30);
  return {
    stream,
    stop: () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

export function FlashLab() {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const detachRef = useRef<() => void>(() => undefined);
  const abortRef = useRef<AbortController | null>(null);
  const fullscreenRef = useRef(false);

  const [kind, setKind] = useState<SourceKind>('camera');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [replayUrl, setReplayUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(0); // secondes restantes
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [simImage, setSimImage] = useState<HTMLImageElement | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const [truth, setTruth] = useState<Truth>('real');
  const [attack, setAttack] = useState(ATTACKS[0]);
  const [colors, setColors] = useState(FLASH_DEFAULTS.segments);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);
  const [last, setLast] = useState<{ run: FlashRunResult; analysis: FlashAnalysis; source: string } | null>(null);
  const [runs, setRuns] = useState<LabRun[]>(loadRuns);

  const isSim = kind === 'sim-react' || kind === 'sim-static';
  const cameraLabel = cameras.find((c) => c.deviceId === cameraId)?.label ?? '';

  // Sortie du plein écran (Échap) pendant un essai : l'essai est annulé.
  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement === stageRef.current) fullscreenRef.current = true;
      else if (fullscreenRef.current) abortRef.current?.abort();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      abortRef.current?.abort();
      detachRef.current();
    };
  }, []);

  // Liste des caméras (les noms n'apparaissent qu'après une autorisation).
  useEffect(() => {
    if (kind !== 'camera' || cameras.length) return;
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(async (s) => {
        const current = s.getVideoTracks()[0]?.getSettings().deviceId ?? '';
        s.getTracks().forEach((t) => t.stop());
        const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        setCameras(list);
        setCameraId((id) => id || current || list[0]?.deviceId || '');
      })
      .catch((e) => setSourceError(`Caméra indisponible : ${e}`));
  }, [kind, cameras.length]);

  // Branche la source choisie sur la vidéo de la scène.
  useEffect(() => {
    const video = videoRef.current!;
    const stage = stageRef.current!;
    detachRef.current();
    detachRef.current = () => undefined;
    video.srcObject = null;
    video.removeAttribute('src');
    video.loop = false;
    setSourceError(null);

    const playStream = (stream: MediaStream, stop: () => void) => {
      video.srcObject = stream;
      video.play().catch(() => undefined);
      detachRef.current = stop;
    };
    const playUrl = (url: string) => {
      video.src = url;
      video.loop = true;
      video.play().catch(() => undefined);
    };

    let cancelled = false;
    if (kind === 'camera' && cameraId) {
      navigator.mediaDevices
        .getUserMedia({ video: { deviceId: { exact: cameraId }, width: { ideal: 640 }, height: { ideal: 480 } } })
        .then((s) => (cancelled ? s.getTracks().forEach((t) => t.stop()) : playStream(s, () => s.getTracks().forEach((t) => t.stop()))))
        .catch((e) => setSourceError(`Caméra indisponible : ${e}`));
    } else if (kind === 'replay' && replayUrl) playUrl(replayUrl);
    else if (kind === 'file' && fileUrl) playUrl(fileUrl);
    else if (isSim && simImage) {
      const sim = simulatedCamera(simImage, stage, kind === 'sim-react');
      playStream(sim.stream, sim.stop);
    }
    return () => {
      cancelled = true;
    };
  }, [kind, cameraId, replayUrl, fileUrl, simImage, isSim]);

  // Classement proposé selon la source (modifiable avant de lancer).
  useEffect(() => {
    if (kind === 'camera') {
      const virtual = findVirtualCameras([cameraLabel]).length > 0;
      setTruth(virtual ? 'attack' : 'real');
      if (virtual) setAttack(ATTACKS[1]);
    } else if (kind === 'replay' || kind === 'file') {
      setTruth('attack');
      setAttack(ATTACKS[0]);
    }
  }, [kind, cameraLabel]);

  async function recordReplay() {
    setSourceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraId ? { deviceId: { exact: cameraId } } : true,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      video.play().catch(() => undefined);
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise<void>((r) => (recorder.onstop = () => r()));
      recorder.start();
      for (let s = REPLAY_SECONDS; s > 0; s--) {
        setRecording(s);
        await new Promise((r) => setTimeout(r, 1000));
      }
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
      if (replayUrl) URL.revokeObjectURL(replayUrl);
      setReplayUrl(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType })));
    } catch (e) {
      setSourceError(`Enregistrement impossible : ${e}`);
    } finally {
      setRecording(0);
    }
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(URL.createObjectURL(file));
  }

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => setSimImage(img);
    img.src = URL.createObjectURL(file);
  }

  const sourceName = () =>
    kind === 'camera' ? cameraLabel || 'caméra' : SOURCES.find((s) => s.kind === kind)!.label.split(' (')[0];

  async function run() {
    const stage = stageRef.current!;
    const video = videoRef.current!;
    void enterFullscreen(stage); // dans le clic : le navigateur l'exige
    const controller = new AbortController();
    abortRef.current = controller;
    setRunError(null);
    setProgress(0);
    setRunning(true);
    try {
      if (video.paused) await video.play();
      const segments = makeFlashSequence(colors, secureRandom);
      const result = await runFlash({ video, stage, segments, signal: controller.signal, onProgress: setProgress });
      const analysis = analyzeFlash(result);
      const source = sourceName();
      setLast({ run: result, analysis, source });
      if (!isSim) {
        const entry: LabRun = {
          id: crypto.randomUUID(),
          at: Date.now(),
          truth,
          attack: truth === 'attack' ? attack : undefined,
          source,
          result: analysis.result,
          reason: analysis.reason,
          correlation: analysis.correlation,
          pValue: analysis.pValue,
          lagMs: analysis.lagMs,
          amplitude: analysis.amplitude,
          fps: analysis.fps,
          faceCoverage: analysis.faceCoverage,
          colors,
        };
        setRuns((list) => {
          const next = [entry, ...list];
          saveRuns(next);
          return next;
        });
      }
    } catch (e) {
      setRunError(e instanceof FlashAborted ? `${e.message}.` : `Essai impossible : ${e}`);
    } finally {
      fullscreenRef.current = false;
      exitFullscreen();
      setRunning(false);
    }
  }

  function removeRun(id: string) {
    setRuns((list) => {
      const next = list.filter((r) => r.id !== id);
      saveRuns(next);
      return next;
    });
  }

  function clearRuns() {
    if (!window.confirm('Effacer tout le journal des essais de ce navigateur ?')) return;
    setRuns([]);
    saveRuns([]);
  }

  function exportCsv() {
    const head = ['date', 'classement', 'attaque', 'source', 'verdict', 'raison', 'accord', 'p', 'retard_ms', 'ampleur_pct', 'images_par_s', 'visage_suivi', 'couleurs'];
    const rows = runs.map((r) =>
      [
        new Date(r.at).toISOString(),
        r.truth === 'real' ? 'vrai visage' : 'attaque',
        r.attack ?? '',
        r.source,
        RESULT_LABEL[r.result],
        r.reason,
        r.correlation.toFixed(3),
        r.pValue.toFixed(4),
        r.lagMs,
        r.amplitude.toFixed(3),
        r.fps.toFixed(1),
        r.faceCoverage.toFixed(2),
        r.colors,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    download('essais-reflet-ecran.csv', 'text/csv', [head.join(','), ...rows].join('\n'));
  }

  const real = runs.filter((r) => r.truth === 'real');
  const attacks = runs.filter((r) => r.truth === 'attack');
  const count = (list: LabRun[], result: FlashResult) => list.filter((r) => r.result === result).length;
  const ready = !running && !recording && (kind === 'camera' ? !!cameraId : kind === 'replay' ? !!replayUrl : kind === 'file' ? !!fileUrl : !!simImage);
  const active = running;

  return (
    <div className="page lab">
      <p className="muted">
        <Link to="/">← Accueil</Link>
      </p>
      <h1>Espace de test : reflet de l’écran</h1>
      <p className="muted">
        Chaque essai affiche une suite de couleurs en plein écran et vérifie que l’image en renvoie le reflet. Classez
        chaque essai (vrai visage ou attaque) : la page calcule le taux de détection et le taux de faux positifs pour le
        jury. Tout reste dans ce navigateur.
      </p>

      <div className="card">
        <h2>1. Source de l’image</h2>
        <label>
          Ce que voit le test
          <select value={kind} onChange={(e) => setKind(e.target.value as SourceKind)} disabled={running}>
            {SOURCES.map((s) => (
              <option key={s.kind} value={s.kind}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {kind === 'camera' && (
          <label>
            Caméra
            <select value={cameraId} onChange={(e) => setCameraId(e.target.value)} disabled={running}>
              {cameras.map((c) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label || 'Caméra sans nom'}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === 'replay' && (
          <div className="lab-row">
            <button className="secondary-button" onClick={recordReplay} disabled={!!recording || running}>
              {recording ? `Enregistrement… ${recording} s` : replayUrl ? 'Réenregistrer' : `Enregistrer ${REPLAY_SECONDS} s de la caméra`}
            </button>
            <span className="muted">
              {replayUrl
                ? 'Vidéo prête, lue en boucle : elle joue le rôle d’une caméra truquée.'
                : 'Restez face à la caméra pendant l’enregistrement.'}{' '}
              Elle reste en mémoire dans cet onglet, rien n’est envoyé.
            </span>
          </div>
        )}
        {kind === 'file' && (
          <label>
            Vidéo d’un visage (lue en boucle)
            <input type="file" accept="video/*" onChange={pickFile} disabled={running} />
          </label>
        )}
        {isSim && (
          <label>
            Photo d’un visage (pour vérifier la chaîne technique, pas comptée dans les chiffres)
            <input type="file" accept="image/*" onChange={pickImage} disabled={running} />
          </label>
        )}
        {sourceError && <p className="faceid-error">{sourceError}</p>}

        <div ref={stageRef} className={`flash-stage ${active ? 'flash-active' : ''} ${kind === 'camera' ? '' : 'no-mirror'}`}>
          <video ref={videoRef} playsInline muted />
          {active && (
            <div className="flash-hud">
              Ne bougez pas, regardez l’écran
              <div className="flash-progress">
                <div style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>2. Essai</h2>
        {!isSim && (
          <div className="lab-row">
            <label className="inline">
              <input type="radio" checked={truth === 'real'} onChange={() => setTruth('real')} /> Vrai visage
            </label>
            <label className="inline">
              <input type="radio" checked={truth === 'attack'} onChange={() => setTruth('attack')} /> Attaque
            </label>
            {truth === 'attack' && (
              <select value={attack} onChange={(e) => setAttack(e.target.value)}>
                {ATTACKS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            )}
          </div>
        )}
        <label>
          Nombre de couleurs (8 à 20, {FLASH_DEFAULTS.minMs}–{FLASH_DEFAULTS.maxMs} ms chacune)
          <input
            type="number"
            min={8}
            max={20}
            value={colors}
            onChange={(e) => setColors(Math.min(20, Math.max(8, Number(e.target.value) || FLASH_DEFAULTS.segments)))}
          />
        </label>
        <p className="flash-warning">
          Écran clignotant, environ deux changements par seconde. À éviter en cas de sensibilité aux lumières
          clignotantes. Échap annule l’essai.
        </p>
        <button className="primary" onClick={run} disabled={!ready}>
          Lancer l’essai
        </button>
        {runError && <p className="faceid-error">{runError}</p>}
      </div>

      {last && (
        <div className="card">
          <h2>
            Résultat : <span className={`lab-verdict lab-${last.analysis.result}`}>{RESULT_LABEL[last.analysis.result]}</span>
          </h2>
          <p>{FLASH_REASON_TEXT[last.analysis.reason].replace(/^./, (c) => c.toUpperCase())}.</p>
          <table className="facts">
            <tbody>
              <tr><th>Source</th><td>{last.source}</td></tr>
              <tr>
                <th>Accord</th>
                <td>
                  {fr(last.analysis.correlation)} (réussi au-dessus de {fr(FLASH_THRESHOLDS.passMinCorrelation, 1)}, échec
                  sous {fr(FLASH_THRESHOLDS.failMaxCorrelation, 1)})
                </td>
              </tr>
              <tr>
                <th>Hasard (p)</th>
                <td>
                  {fr(last.analysis.pValue, 3)} : part des suites prises au hasard qui font aussi bien (réussi sous{' '}
                  {fr(FLASH_THRESHOLDS.passMaxP)})
                </td>
              </tr>
              <tr><th>Retard de la caméra</th><td>{last.analysis.lagMs} ms</td></tr>
              <tr><th>Ampleur du reflet</th><td>{fr(last.analysis.amplitude, 2)} point(s) de teinte</td></tr>
              <tr>
                <th>Images</th>
                <td>
                  {last.analysis.frames} ({fr(last.analysis.fps, 0)} par seconde, horloge : {last.run.clock}) · visage suivi{' '}
                  {Math.round(last.analysis.faceCoverage * 100)} % du temps
                </td>
              </tr>
            </tbody>
          </table>
          <FlashTimeline run={last.run} analysis={last.analysis} />
          <FlashLagCurve analysis={last.analysis} />
        </div>
      )}

      <div className="card">
        <h2>3. Nos chiffres</h2>
        <p className="muted">Objectif du plan : 10 vrais visages et 10 attaques, dans des conditions variées.</p>
        <table className="facts lab-summary">
          <tbody>
            <tr>
              <th>Vrais visages</th>
              <td>
                {real.length} essai(s) · réussis {count(real, 'passed')} · non concluants {count(real, 'inconclusive')} · échecs{' '}
                {count(real, 'failed')} → <strong>faux positifs : {pct(count(real, 'failed'), real.length)}</strong>
              </td>
            </tr>
            <tr>
              <th>Attaques</th>
              <td>
                {attacks.length} essai(s) · détectées (échec) {count(attacks, 'failed')} · non concluantes{' '}
                {count(attacks, 'inconclusive')} · passées {count(attacks, 'passed')} →{' '}
                <strong>taux de détection : {pct(count(attacks, 'failed'), attacks.length)}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        {runs.length > 0 && (
          <>
            <div className="lab-table-wrap">
              <table className="lab-runs">
                <thead>
                  <tr>
                    <th>Heure</th>
                    <th>Classement</th>
                    <th>Source</th>
                    <th>Verdict</th>
                    <th>Accord</th>
                    <th>p</th>
                    <th>Retard</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{r.truth === 'real' ? 'Vrai visage' : `Attaque : ${r.attack}`}</td>
                      <td>{r.source}</td>
                      <td className={`lab-${r.result}`}>{RESULT_LABEL[r.result]}</td>
                      <td>{fr(r.correlation)}</td>
                      <td>{fr(r.pValue, 3)}</td>
                      <td>{r.lagMs} ms</td>
                      <td>
                        <button className="link-button" onClick={() => removeRun(r.id)} aria-label="Supprimer cet essai">
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lab-row">
              <button className="secondary-button" onClick={exportCsv}>
                Exporter en CSV
              </button>
              <button
                className="secondary-button"
                onClick={() => download('essais-reflet-ecran.json', 'application/json', JSON.stringify(runs, null, 2))}
              >
                Exporter en JSON
              </button>
              <button className="link-button" onClick={clearRuns}>
                Tout effacer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
