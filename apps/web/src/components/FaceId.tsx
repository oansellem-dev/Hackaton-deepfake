import { useEffect, useRef, useState } from 'react';
import {
  ANGLE_MAX_YAW_DEG,
  ANGLE_MIN_YAW_DEG,
  HAND_FRAMES,
  HAND_POINTS_OVER_FACE,
  MIN_PROFILE_SAMPLES,
  TURN_FRAMES,
  TURN_YAW_DEG,
  angleProfiles,
  boundingBox,
  computeRatios,
  estimateYawDeg,
  findVirtualCameras,
  handPointsOverFace,
  meanEmbedding,
  medianRatios,
  type FaceIdPlan,
  type FaceIdStep,
  type FaceIdStepResult,
  type Point,
  type SignalStatus,
} from '@kyc/shared';
import { api } from '../config.ts';
import { analyzeSnapshot, loadFaceModels, snapshotFace } from '../lib/faceModels.ts';
import { detect, loadTracker } from '../lib/tracker.ts';

const STEP_TEXT: Record<FaceIdStep, string> = {
  center: 'Placez votre visage dans l’ovale, de face, bien éclairé.',
  turn_a: 'Tournez doucement la tête vers votre droite.',
  turn_b: 'Tournez doucement la tête vers votre gauche.',
  hand: 'Passez la main devant votre visage, puis retirez-la.',
};

const STEP_LABEL: Record<FaceIdStep, string> = {
  center: 'Visage de face',
  turn_a: 'Tête à droite',
  turn_b: 'Tête à gauche',
  hand: 'Main devant le visage',
};

const FRAME_MS = 80; // ~12 analyses par seconde
const CENTER_HOLD = 6; // images bien cadrées d'affilée avant de commencer à mesurer
const CENTER_SAMPLES = 16; // mesures de face pour le profil
const CENTER_TIMEOUT_MS = 25000;
const ACTION_TIMEOUT_MS = 12000;
// Analyses faites dans le navigateur (aucune image envoyée) : l'empreinte sur des images de face, la probabilité de
// trucage aussi PENDANT les défis, là où un deepfake temps réel se dégrade (profil, main qui passe devant le visage).
const MAX_PASSIVE_FRAMES = 10;
const HAND_PASSIVE_FRAMES = 2;
const MIN_EMBEDDINGS = 3;
const MAX_EMBEDDINGS = 6;
const EMBEDDING_EXTRA_MS = 6000; // attente maximale de face pour obtenir assez d'empreintes

export type EnvResult = { label: string; status: SignalStatus; detail: string };

export interface FaceIdOutcome {
  steps: { step: FaceIdStep; result: FaceIdStepResult['result'] }[];
  profileStored: boolean;
  environment: EnvResult[];
}

interface Props {
  sessionId: string;
  declaredCountry: string;
  onDone: (outcome: FaceIdOutcome) => void;
}

type Phase = 'ready' | 'loading' | 'running' | 'sending' | 'blocked' | 'error';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function openCamera(deviceId?: string): Promise<MediaStream> {
  const size = { width: { ideal: 640 }, height: { ideal: 480 } };
  return navigator.mediaDevices.getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: 'user', ...size },
    audio: false,
  });
}

export function FaceId({ sessionId, declaredCountry, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<() => void>(() => undefined);
  const envRef = useRef<EnvResult[]>([]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [plan, setPlan] = useState<FaceIdPlan | null>(null);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<FaceIdStepResult['result'][]>([]);
  const [centered, setCentered] = useState(false);
  const [message, setMessage] = useState('');

  const stopCamera = () => {
    stopRef.current();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => stopCamera, []);

  async function start() {
    setPhase('loading');
    setMessage('');
    setDone([]);
    setIndex(0);
    try {
      // Uniquement une caméra de l'appareil : pas de fichier, pas de vidéo importée.
      let stream = await openCamera();
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      let label = stream.getVideoTracks()[0]?.label ?? '';
      // Si la caméra par défaut est virtuelle (OBS, ManyCam…), on passe sur une vraie caméra quand il y en a une.
      if (findVirtualCameras([label]).length > 0) {
        const real = devices.find((d) => d.label && findVirtualCameras([d.label]).length === 0);
        if (real) {
          stream.getTracks().forEach((t) => t.stop());
          stream = await openCamera(real.deviceId);
          label = stream.getVideoTracks()[0]?.label ?? real.label;
        }
      }
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      // Vérification de l'environnement en même temps : caméras, fuseau horaire, adresse IP.
      const env = await api.sendPrecheck(sessionId, {
        cameras: devices.map((d) => d.label),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        languages: [...navigator.languages],
        declaredCountry,
      });
      envRef.current = env.signals;

      let newPlan: FaceIdPlan;
      try {
        newPlan = await api.startFaceId(sessionId, label);
      } catch (e) {
        if (errorText(e).includes('déjà terminée')) {
          stopCamera();
          setPhase('blocked');
          setMessage('Votre vérification du visage est déjà enregistrée. Vous pouvez fermer cette page.');
          return;
        }
        if (errorText(e).includes('camera-virtuelle')) {
          stopCamera();
          setPhase('blocked');
          setMessage(
            `La caméra « ${label} » est une caméra virtuelle. Merci d’utiliser la caméra de votre ordinateur ou de votre ` +
              'téléphone (désactivez OBS, ManyCam ou tout logiciel de ce type), puis réessayez.',
          );
          return;
        }
        throw e;
      }
      // Si les modèles d'empreinte ne se chargent pas, la vérification continue avec les proportions seules.
      const [tracker, models] = await Promise.all([loadTracker(), loadFaceModels().catch(() => null)]);
      setPlan(newPlan);
      setPhase('running');
      run(newPlan, tracker, models !== null);
    } catch (e) {
      stopCamera();
      setPhase('error');
      setMessage(`Impossible de démarrer : ${errorText(e)}`);
    }
  }

  function run(p: FaceIdPlan, tracker: Awaited<ReturnType<typeof loadTracker>>, modelsReady: boolean) {
    const video = videoRef.current!;
    const lumaCanvas = document.createElement('canvas');
    lumaCanvas.width = 32;
    lumaCanvas.height = 24;
    const lumaCtx = lumaCanvas.getContext('2d', { willReadFrequently: true })!;

    const results: FaceIdStepResult[] = [];
    const ratioSamples: number[][] = [];
    const angleSamples: { yawDeg: number; ratios: number[] }[] = [];
    const turnYaws: { step: FaceIdStep; yaw: number; at: number }[] = [];
    let step = 0;
    let stepStart = performance.now();
    let frames = 0;
    let tracked = 0;
    let goodStreak = 0;
    let actionStreak = 0;
    let stepFrames = 0; // analyses lancées pendant l'étape en cours
    let ratiosDoneAt = 0;
    const embeddings: number[][] = [];
    const passive: number[] = [];
    const pending = new Set<Promise<void>>();
    // Une rotation ne compte qu'après être revenu de face (sinon l'étape suivante validerait la même rotation),
    // et la seconde doit aller dans l'autre sens que la première.
    let armed = false;
    let turnedAny = false;
    const signFor: Partial<Record<FaceIdStep, number>> = {};
    let lastFaceBox: ReturnType<typeof boundingBox> | null = null;
    let busy = false;
    let finished = false;

    // Analyse d'une image, ici même : empreinte (si le visage est de face) et probabilité de trucage.
    // Une analyse à la fois (~0,5 s) ; rien n'est envoyé avant la fin du parcours, et jamais d'image.
    const measure = (face: Point[], frontal: boolean) => {
      if (!modelsReady || pending.size > 0) return;
      if (passive.length >= MAX_PASSIVE_FRAMES && (!frontal || embeddings.length >= MAX_EMBEDDINGS)) return;
      stepFrames += 1;
      const job: Promise<void> = analyzeSnapshot(snapshotFace(video, face))
        .then((r) => {
          if (passive.length < MAX_PASSIVE_FRAMES) passive.push(r.fakeProbability);
          if (frontal && embeddings.length < MAX_EMBEDDINGS) embeddings.push(r.embedding);
        })
        .catch(() => undefined)
        .finally(() => pending.delete(job));
      pending.add(job);
    };

    const finishStep = (result: FaceIdStepResult['result'], yaw = 0) => {
      const current = p.steps[step];
      results.push({ step: current, result, durationMs: Math.round(performance.now() - stepStart) });
      if ((current === 'turn_a' || current === 'turn_b') && result === 'passed') {
        turnYaws.push({ step: current, yaw, at: results.length - 1 });
      }
      setDone((d) => [...d, result]);
      step += 1;
      stepStart = performance.now();
      frames = tracked = goodStreak = actionStreak = stepFrames = 0;
      armed = turnedAny = false;
      setIndex(step);
      setMessage('');
      if (step >= p.steps.length) void submit();
    };

    // Au temps écoulé : « failed » seulement si le visage était bien suivi (sinon c'est notre mesure qui est en cause).
    const timeoutResult = (): FaceIdStepResult['result'] => (frames > 10 && tracked / frames > 0.7 ? 'failed' : 'inconclusive');

    const tick = () => {
      if (busy || finished || step >= p.steps.length || video.readyState < 2) return;
      busy = true;
      try {
        const current = p.steps[step];
        const { face, hands } = detect(tracker, video, current === 'hand');
        frames += 1;
        if (face) {
          tracked += 1;
          lastFaceBox = boundingBox(face);
        }
        const yaw = face ? estimateYawDeg(face, video.videoWidth) : 0;

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
          const framed = w > 0.25 && w < 0.65 && Math.abs(cx - 0.5) < 0.12 && Math.abs(cy - 0.5) < 0.15;
          const ok = !!face && framed && luma > 50 && Math.abs(yaw) < 8;
          setCentered(ok);
          setMessage(
            !face
              ? 'Je ne vois pas de visage.'
              : luma <= 50
                ? 'Il fait trop sombre : éclairez votre visage.'
                : w <= 0.25
                  ? 'Rapprochez-vous un peu.'
                  : w >= 0.65
                    ? 'Reculez un peu.'
                    : !framed
                      ? 'Centrez votre visage dans l’ovale.'
                      : !ok
                        ? 'Regardez la caméra, de face.'
                        : 'Parfait, ne bougez plus…',
          );
          goodStreak = ok ? goodStreak + 1 : 0;
          if (ok && goodStreak >= CENTER_HOLD) {
            const r = computeRatios(face!, video.videoWidth, video.videoHeight);
            if (r && ratioSamples.length < CENTER_SAMPLES) ratioSamples.push(r);
            measure(face!, true);
          }
          if (ratioSamples.length >= CENTER_SAMPLES && !ratiosDoneAt) ratiosDoneAt = performance.now();
          // Fin de l'étape quand les proportions ET quelques empreintes sont prises (ou si l'empreinte tarde trop).
          const enoughEmbeddings =
            !modelsReady || embeddings.length >= MIN_EMBEDDINGS || performance.now() - ratiosDoneAt > EMBEDDING_EXTRA_MS;
          if (ratiosDoneAt && enoughEmbeddings) finishStep('passed');
          else if (performance.now() - stepStart > CENTER_TIMEOUT_MS) {
            finishStep(ratioSamples.length >= CENTER_SAMPLES ? 'passed' : timeoutResult());
          }
        } else if (current === 'turn_a' || current === 'turn_b') {
          // Proportions sous plusieurs angles, pour comparer la visio même quand la tête n'est pas de face.
          if (face && Math.abs(yaw) >= ANGLE_MIN_YAW_DEG && Math.abs(yaw) <= ANGLE_MAX_YAW_DEG) {
            const r = computeRatios(face, video.videoWidth, video.videoHeight);
            if (r) angleSamples.push({ yawDeg: yaw, ratios: r });
          }
          if (face && Math.abs(yaw) < 8) armed = true;
          const other = current === 'turn_a' ? 'turn_b' : 'turn_a';
          const expected = signFor[current] ?? (signFor[other] !== undefined ? -signFor[other]! : undefined);
          const turnedEnough = !!face && Math.abs(yaw) >= TURN_YAW_DEG;
          const wrongWay = turnedEnough && expected !== undefined && Math.sign(yaw) !== expected;
          if (turnedEnough) turnedAny = true;
          setMessage(
            wrongWay
              ? 'Dans l’autre sens, s’il vous plaît.'
              : !armed && turnedEnough
                ? 'Revenez de face, puis tournez la tête.'
                : '',
          );
          actionStreak = armed && turnedEnough && !wrongWay ? actionStreak + 1 : 0;
          if (actionStreak === 2 && stepFrames === 0) measure(face!, false);
          if (actionStreak >= TURN_FRAMES) {
            signFor[current] = Math.sign(yaw);
            finishStep('passed', yaw);
          } else if (performance.now() - stepStart > ACTION_TIMEOUT_MS) {
            // A tourné la tête, mais pas dans le sens demandé : consigne mal comprise, jamais « failed ».
            finishStep(turnedAny ? 'inconclusive' : timeoutResult());
          }
        } else {
          const box = face ? boundingBox(face) : lastFaceBox;
          const over = box ? Math.max(0, ...hands.map((h) => handPointsOverFace(h, box))) : 0;
          // Main qui commence à couvrir le visage : c'est là que le mélange d'un face-swap se trahit.
          if (face && over > 0 && over < HAND_POINTS_OVER_FACE && stepFrames < HAND_PASSIVE_FRAMES) measure(face, false);
          actionStreak = over >= HAND_POINTS_OVER_FACE ? actionStreak + 1 : 0;
          if (actionStreak >= HAND_FRAMES) finishStep('passed');
          else if (performance.now() - stepStart > ACTION_TIMEOUT_MS) finishStep(timeoutResult());
        }
      } catch (e) {
        finished = true;
        clearInterval(timer);
        stopCamera();
        setPhase('error');
        setMessage(`Analyse interrompue : ${errorText(e)}`);
      } finally {
        busy = false;
      }
    };

    // Les deux virages doivent aller dans des sens opposés. Même côté deux fois : on ne conclut pas
    // (jamais « failed » pour une consigne mal comprise).
    const checkTurns = () => {
      const a = turnYaws.filter((t) => t.step === 'turn_a');
      const b = turnYaws.filter((t) => t.step === 'turn_b');
      if (!a.length || !b.length) return;
      const signA = Math.sign(a[0].yaw);
      const bad = [...a.filter((t) => Math.sign(t.yaw) !== signA), ...b.filter((t) => Math.sign(t.yaw) === signA)];
      for (const t of bad) results[t.at].result = 'inconclusive';
    };

    async function submit() {
      finished = true;
      clearInterval(timer);
      setPhase('sending');
      checkTurns();
      try {
        await Promise.all([...pending]); // dernières analyses en cours
        const profileOk = ratioSamples.length >= MIN_PROFILE_SAMPLES;
        const res = await api.submitFaceId(sessionId, {
          nonce: p.nonce,
          results,
          ratios: profileOk ? medianRatios(ratioSamples) : [],
          samples: ratioSamples.length,
          angles: profileOk ? angleProfiles(angleSamples) : [],
          embedding: profileOk && embeddings.length ? meanEmbedding(embeddings) : undefined,
          passive,
        });
        stopCamera();
        onDone({ steps: res.steps, profileStored: res.profileStored, environment: envRef.current });
      } catch (e) {
        stopCamera();
        setPhase('error');
        setMessage(`Envoi impossible : ${errorText(e)}`);
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
        Votre visage est analysé uniquement dans votre navigateur : aucune image n’est envoyée ni enregistrée. Seule
        une empreinte numérique de votre visage (des mesures) est conservée, chiffrée, jusqu’à la fin de l’entretien.
        Utilisez la caméra de votre ordinateur ou de votre téléphone, rien d’autre. Cette étape vérifie aussi votre fuseau
        horaire et votre adresse IP.
      </p>

      <div className={`faceid-stage ${centered && currentStep === 'center' ? 'faceid-ok' : ''}`}>
        <video ref={videoRef} playsInline muted />
        <div className="faceid-oval" />
      </div>

      {phase === 'running' && currentStep && (
        <>
          <p className="faceid-instruction">{STEP_TEXT[currentStep]}</p>
          <p className="muted faceid-hint">{message || ' '}</p>
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
      {phase === 'loading' && <p className="muted">Préparation de la caméra et de l’analyse…</p>}
      {phase === 'sending' && <p className="muted">Enregistrement du résultat…</p>}
      {(phase === 'error' || phase === 'blocked') && (
        <>
          <p className="faceid-error">{message}</p>
          <button className="primary" onClick={start}>
            Réessayer
          </button>
        </>
      )}
    </div>
  );
}
