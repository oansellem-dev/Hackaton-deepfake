import { useEffect, useRef, useState } from 'react';
import {
  MIN_PROFILE_SAMPLES,
  boundingBox,
  computeRatios,
  estimateYawDeg,
  handPointsOverFace,
  medianRatios,
  type FaceIdPlan,
  type FaceIdStep,
  type FaceIdStepResult,
} from '@kyc/shared';
import { api } from '../config.ts';
import { detect, loadTracker } from '../lib/tracker.ts';

const STEP_TEXT: Record<FaceIdStep, string> = {
  center: 'Placez votre visage dans l’ovale, de face, bien éclairé.',
  turn_a: 'Tournez doucement la tête vers votre droite.',
  turn_b: 'Tournez doucement la tête vers votre gauche.',
  hand: 'Passez la main devant votre visage, puis retirez-la.',
};

const STEP_LABEL: Record<FaceIdStep, string> = {
  center: 'Visage de face',
  turn_a: 'Tête tournée (1)',
  turn_b: 'Tête tournée (2)',
  hand: 'Main devant le visage',
};

const FRAME_MS = 80; // ~12 analyses par seconde
const CENTER_HOLD = 12; // images consécutives bien cadrées avant de valider
const CENTER_SAMPLES = 16; // mesures de face collectées pour le profil
const TURN_YAW_DEG = 20;
const TURN_FRAMES = 4;
const HAND_POINTS = 8;
const HAND_FRAMES = 4;
const CENTER_TIMEOUT_MS = 25000;
const ACTION_TIMEOUT_MS = 12000;
const MAX_PASSIVE_FRAMES = 4;

interface Props {
  sessionId: string;
  onDone: (steps: { step: FaceIdStep; result: FaceIdStepResult['result'] }[], profileStored: boolean) => void;
}

type Phase = 'ready' | 'loading' | 'running' | 'sending' | 'error';

export function FaceId({ sessionId, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<() => void>(() => undefined);
  const [phase, setPhase] = useState<Phase>('ready');
  const [plan, setPlan] = useState<FaceIdPlan | null>(null);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<FaceIdStepResult['result'][]>([]);
  const [centered, setCentered] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(
    () => () => {
      stopRef.current();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function start() {
    setPhase('loading');
    setMessage('');
    try {
      // Uniquement la caméra de l'appareil : pas de fichier, pas de vidéo importée.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const [tracker, newPlan] = await Promise.all([loadTracker(), api.startFaceId(sessionId)]);
      setPlan(newPlan);
      setPhase('running');
      run(newPlan, tracker);
    } catch (e) {
      setPhase('error');
      setMessage(`Impossible de démarrer : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function run(p: FaceIdPlan, tracker: Awaited<ReturnType<typeof loadTracker>>) {
    const video = videoRef.current!;
    const lumaCanvas = document.createElement('canvas');
    lumaCanvas.width = 32;
    lumaCanvas.height = 24;
    const lumaCtx = lumaCanvas.getContext('2d', { willReadFrequently: true })!;
    const jpegCanvas = document.createElement('canvas');

    const results: FaceIdStepResult[] = [];
    const ratioSamples: number[][] = [];
    const turnYaws: { step: FaceIdStep; yaw: number; at: number }[] = [];
    let step = 0;
    let stepStart = performance.now();
    let frames = 0;
    let tracked = 0;
    let goodStreak = 0;
    let actionStreak = 0;
    let passiveSent = 0;
    let lastFaceBox: ReturnType<typeof boundingBox> | null = null;
    let busy = false;
    let finished = false;

    const finishStep = (result: FaceIdStepResult['result'], yaw = 0) => {
      const current = p.steps[step];
      results.push({ step: current, result, durationMs: Math.round(performance.now() - stepStart) });
      if (current === 'turn_a' || current === 'turn_b') turnYaws.push({ step: current, yaw, at: results.length - 1 });
      setDone((d) => [...d, result]);
      step += 1;
      stepStart = performance.now();
      frames = tracked = goodStreak = actionStreak = 0;
      setIndex(step);
      if (step >= p.steps.length) void submit();
    };

    // Au temps écoulé : « failed » seulement si le suivi marchait bien (sinon c'est notre mesure qui est en cause).
    const timeoutResult = () => (frames > 10 && tracked / frames > 0.7 ? 'failed' : 'inconclusive');

    const sendPassiveFrame = () => {
      if (passiveSent >= MAX_PASSIVE_FRAMES || !video.videoWidth) return;
      passiveSent += 1;
      jpegCanvas.width = video.videoWidth;
      jpegCanvas.height = video.videoHeight;
      jpegCanvas.getContext('2d')!.drawImage(video, 0, 0);
      jpegCanvas.toBlob((blob) => blob && api.sendFrame(sessionId, blob).catch(() => undefined), 'image/jpeg', 0.85);
    };

    const tick = () => {
      if (busy || finished || step >= p.steps.length || video.readyState < 2) return;
      busy = true;
      try {
        const current = p.steps[step];
        const { face, hands } = detect(tracker, video);
        frames += 1;
        if (face) {
          tracked += 1;
          lastFaceBox = boundingBox(face);
        }

        if (current === 'center') {
          let luma = 0;
          lumaCtx.drawImage(video, 0, 0, 32, 24);
          const px = lumaCtx.getImageData(0, 0, 32, 24).data;
          for (let i = 0; i < px.length; i += 4) luma += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          luma /= px.length / 4;

          const box = face ? boundingBox(face) : null;
          const w = box ? box.maxX - box.minX : 0;
          const cx = box ? (box.minX + box.maxX) / 2 : 0;
          const cy = box ? (box.minY + box.maxY) / 2 : 0;
          const ok =
            !!face && w > 0.25 && w < 0.65 && Math.abs(cx - 0.5) < 0.12 && Math.abs(cy - 0.5) < 0.15 && luma > 50 &&
            Math.abs(estimateYawDeg(face, video.videoWidth)) < 8;
          setCentered(ok);
          setMessage(
            !face ? 'Je ne vois pas de visage.' : luma <= 50 ? 'Il fait trop sombre.' : w <= 0.25 ? 'Rapprochez-vous.' : w >= 0.65 ? 'Reculez un peu.' : !ok ? 'Centrez votre visage et regardez la caméra.' : 'Parfait, ne bougez plus…',
          );
          goodStreak = ok ? goodStreak + 1 : 0;
          if (ok && goodStreak >= CENTER_HOLD / 2) {
            const r = computeRatios(face!, video.videoWidth, video.videoHeight);
            if (r) ratioSamples.push(r);
            if (ratioSamples.length % 4 === 1) sendPassiveFrame();
          }
          if (ratioSamples.length >= CENTER_SAMPLES) {
            setMessage('');
            finishStep('passed');
          } else if (performance.now() - stepStart > CENTER_TIMEOUT_MS) finishStep(timeoutResult());
        } else if (current === 'turn_a' || current === 'turn_b') {
          const yaw = face ? estimateYawDeg(face, video.videoWidth) : 0;
          actionStreak = face && Math.abs(yaw) >= TURN_YAW_DEG ? actionStreak + 1 : 0;
          if (actionStreak >= TURN_FRAMES) finishStep('passed', yaw);
          else if (performance.now() - stepStart > ACTION_TIMEOUT_MS) finishStep(timeoutResult());
        } else {
          const box = face ? boundingBox(face) : lastFaceBox;
          const over = box ? Math.max(0, ...hands.map((h) => handPointsOverFace(h, box))) : 0;
          actionStreak = over >= HAND_POINTS ? actionStreak + 1 : 0;
          if (actionStreak >= HAND_FRAMES) finishStep('passed');
          else if (performance.now() - stepStart > ACTION_TIMEOUT_MS) finishStep(timeoutResult());
        }
      } catch (e) {
        setPhase('error');
        setMessage(`Analyse interrompue : ${e instanceof Error ? e.message : String(e)}`);
        finished = true;
      } finally {
        busy = false;
      }
    };

    // Les deux virages doivent aller dans des sens opposés (le sens exact dépend du miroir, pas besoin de le connaître).
    const checkTurns = () => {
      const a = turnYaws.filter((t) => t.step === 'turn_a' && t.yaw !== 0);
      const b = turnYaws.filter((t) => t.step === 'turn_b' && t.yaw !== 0);
      if (!a.length || !b.length) return;
      const signA = Math.sign(a[0].yaw);
      const bad = [...a.filter((t) => Math.sign(t.yaw) !== signA), ...b.filter((t) => Math.sign(t.yaw) === signA)];
      if (bad.length === 0) return;
      // Même côté deux fois : on ne conclut pas (jamais « failed » pour une consigne mal comprise).
      for (const t of bad) if (results[t.at].result === 'passed') results[t.at].result = 'inconclusive';
    };

    async function submit() {
      finished = true;
      clearInterval(timer);
      setPhase('sending');
      checkTurns();
      try {
        const profileOk = ratioSamples.length >= MIN_PROFILE_SAMPLES;
        const res = await api.submitFaceId(sessionId, {
          nonce: p.nonce,
          results,
          ratios: profileOk ? medianRatios(ratioSamples) : [],
          samples: ratioSamples.length,
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onDone(res.steps, res.profileStored);
      } catch (e) {
        setPhase('error');
        setMessage(`Envoi impossible : ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const timer = setInterval(tick, FRAME_MS);
    stopRef.current = () => {
      finished = true;
      clearInterval(timer);
    };
  }

  const currentStep = plan?.steps[index];
  return (
    <div className="card">
      <h2>Vérification du visage</h2>
      <p className="muted">
        Votre caméra analyse votre visage dans votre navigateur. Aucune image n’est enregistrée ; seules quelques
        proportions sont conservées, chiffrées, jusqu’à la fin de l’entretien. Utilisez la caméra de votre ordinateur ou
        de votre téléphone, rien d’autre.
      </p>

      <div className={`faceid-stage ${centered && currentStep === 'center' ? 'faceid-ok' : ''}`}>
        <video ref={videoRef} playsInline muted />
        <div className="faceid-oval" />
      </div>

      {phase === 'running' && currentStep && (
        <>
          <p className="faceid-instruction">{STEP_TEXT[currentStep]}</p>
          {message && <p className="muted">{message}</p>}
          <ol className="faceid-steps">
            {plan!.steps.map((s, i) => (
              <li key={`${s}-${i}`} className={i < index ? `faceid-${done[i]}` : i === index ? 'faceid-current' : ''}>
                {STEP_LABEL[s]}
              </li>
            ))}
          </ol>
          {plan!.hardened && <p className="muted">Quelques étapes de plus que d’habitude, merci de votre patience.</p>}
        </>
      )}

      {phase === 'ready' && (
        <button className="primary" onClick={start}>
          Activer la caméra et commencer
        </button>
      )}
      {phase === 'loading' && <p className="muted">Chargement de l’analyse…</p>}
      {phase === 'sending' && <p className="muted">Enregistrement du résultat…</p>}
      {phase === 'error' && (
        <>
          <p className="muted">{message}</p>
          <button className="primary" onClick={start}>
            Réessayer
          </button>
        </>
      )}
    </div>
  );
}
