import { useEffect, useRef, useState } from 'react';
import {
  FLASH_DEFAULTS,
  FLASH_MAX_ATTEMPTS,
  analyzeFlash,
  combineFlashAttempts,
  makeFlashSequence,
  summarizeFlash,
  type FlashAttemptSummary,
  type FlashResult,
} from '@kyc/shared';
import { api } from '../config.ts';
import { FlashAborted, enterFullscreen, exitFullscreen, runFlash, secureRandom, waitForFace } from '../lib/flash.ts';

export interface ScreenFlashOutcome {
  result: FlashResult | 'skipped';
  attempts: number;
}

interface Props {
  sessionId: string;
  deviceId?: string; // caméra de la vérification du visage
  onDone: (outcome: ScreenFlashOutcome) => void;
}

type Phase = 'intro' | 'starting' | 'running' | 'retry' | 'sending' | 'error' | 'blocked';

const SECONDS = Math.round(
  (FLASH_DEFAULTS.leadInMs + FLASH_DEFAULTS.segments * ((FLASH_DEFAULTS.minMs + FLASH_DEFAULTS.maxMs) / 2) + FLASH_DEFAULTS.tailMs) /
    1000,
);

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function openCamera(deviceId?: string): Promise<MediaStream> {
  const size = { width: { ideal: 640 }, height: { ideal: 480 } };
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId }, ...size }, audio: false });
    } catch {
      /* caméra débranchée entre-temps : caméra par défaut */
    }
  }
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', ...size }, audio: false });
}

// Étape 3 de la pré-vérification : l'écran affiche une suite de couleurs, la caméra doit en voir le reflet sur le
// visage. Analyse dans le navigateur ; seul le résumé de chaque essai est envoyé. Deux essais au plus.
export function ScreenFlash({ sessionId, deviceId, onDone }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const attemptsRef = useRef<FlashAttemptSummary[]>([]);
  const fullscreenRef = useRef(false);
  const [phase, setPhase] = useState<Phase>('intro');
  const [hud, setHud] = useState('');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  const stopAll = () => {
    abortRef.current?.abort();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    fullscreenRef.current = false;
    exitFullscreen();
  };

  useEffect(() => {
    // Sortie du plein écran (touche Échap) pendant le test : l'essai est annulé, sans effet.
    const onChange = () => {
      if (document.fullscreenElement === stageRef.current) fullscreenRef.current = true;
      else if (fullscreenRef.current) abortRef.current?.abort();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      stopAll();
    };
  }, []);

  const backToStart = (text: string) => {
    stopAll();
    setMessage(text);
    setPhase(attemptsRef.current.length ? 'retry' : 'intro');
  };

  async function start() {
    const stage = stageRef.current!;
    const video = videoRef.current!;
    void enterFullscreen(stage); // dans le clic : le navigateur l'exige
    const controller = new AbortController();
    abortRef.current = controller;
    setMessage('');
    setProgress(0);
    setPhase('starting');
    setHud('Préparation de la caméra…');
    try {
      const stream = await openCamera(deviceId);
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      setHud('Regardez l’écran, visage bien en face');
      if (!(await waitForFace(video, 6000, controller.signal))) {
        backToStart('Je ne vois pas votre visage. Placez-vous face à l’écran, bien éclairé, puis recommencez.');
        return;
      }

      setPhase('running');
      setHud('Ne bougez pas et gardez les yeux sur l’écran');
      const segments = makeFlashSequence(FLASH_DEFAULTS.segments, secureRandom);
      const run = await runFlash({ video, stage, segments, signal: controller.signal, onProgress: setProgress });
      stopAll();

      const attempt = summarizeFlash(analyzeFlash(run));
      const attempts = [...attemptsRef.current, attempt];
      attemptsRef.current = attempts;
      const final = attempt.result === 'passed' || attempts.length >= FLASH_MAX_ATTEMPTS;
      setPhase('sending');
      await api.sendFlash(sessionId, { attempt, final });
      if (final) onDone({ result: combineFlashAttempts(attempts).result, attempts: attempts.length });
      else {
        setMessage(
          'Le reflet n’était pas assez net. Montez la luminosité de votre écran au maximum, rapprochez-vous ' +
            '(environ 40 cm) et évitez d’avoir une lampe ou une fenêtre face à vous, puis réessayez.',
        );
        setPhase('retry');
      }
    } catch (e) {
      if (e instanceof FlashAborted) return backToStart(`${e.message}. Vous pouvez recommencer.`);
      stopAll();
      if (errorText(e).includes('déjà terminé')) {
        setPhase('blocked');
        setMessage('Ce test est déjà enregistré. Vous pouvez fermer cette page.');
        return;
      }
      setPhase('error');
      setMessage(`Impossible de lancer le test : ${errorText(e)}`);
    }
  }

  async function skip() {
    setPhase('sending');
    try {
      await api.sendFlash(sessionId, { skipped: true, final: true });
      onDone({ result: 'skipped', attempts: 0 });
    } catch (e) {
      setPhase('error');
      setMessage(`Envoi impossible : ${errorText(e)}`);
    }
  }

  const active = phase === 'starting' || phase === 'running';
  return (
    <div className="card">
      <h2>Test du reflet de l’écran</h2>
      <p>
        Votre écran va afficher des couleurs pendant environ {SECONDS} secondes. Votre caméra doit voir leur reflet sur
        votre visage : c’est ce qui distingue une vraie caméra d’une vidéo truquée. L’analyse se fait dans votre
        navigateur ; seul le résultat est envoyé, aucune image.
      </p>
      <ul className="flash-tips">
        <li>montez la luminosité de votre écran au maximum ;</li>
        <li>placez-vous à 40–60 cm de l’écran, visage bien en face ;</li>
        <li>évitez d’avoir une fenêtre ou une lampe forte face à vous.</li>
      </ul>
      <p className="flash-warning">
        L’écran va changer de couleur environ deux fois par seconde. Si vous êtes sensible aux lumières clignotantes
        (épilepsie photosensible), passez ce test : cela ne vous pénalise pas.
      </p>

      <div ref={stageRef} className={`flash-stage ${active ? 'flash-active' : ''}`}>
        <video ref={videoRef} playsInline muted />
        {!active && <p className="flash-placeholder">L’écran passera en plein écran pendant le test.</p>}
        {active && (
          <div className="flash-hud">
            {hud}
            {phase === 'running' && (
              <div className="flash-progress">
                <div style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
          </div>
        )}
      </div>

      {message && <p className="faceid-error">{message}</p>}
      {phase === 'intro' && (
        <div className="flash-actions">
          <button className="primary" onClick={start}>
            Commencer le test du reflet
          </button>
          <button className="link-button" onClick={skip}>
            Passer ce test
          </button>
        </div>
      )}
      {phase === 'retry' && (
        <button className="primary" onClick={start}>
          Réessayer le test ({attemptsRef.current.length + 1}/{FLASH_MAX_ATTEMPTS})
        </button>
      )}
      {phase === 'error' && (
        <button className="primary" onClick={() => setPhase(attemptsRef.current.length ? 'retry' : 'intro')}>
          Revenir au test
        </button>
      )}
      {phase === 'sending' && <p className="muted">Enregistrement du résultat…</p>}
    </div>
  );
}
