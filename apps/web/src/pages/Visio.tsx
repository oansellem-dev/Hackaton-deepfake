import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { RecruiterPanel } from '@kyc/panel';
import { API_BASE, WS_URL } from '../config.ts';
import { createLiveDetector } from '../lib/liveDetector.ts';
import { sampleFace } from '../lib/tracker.ts';

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

// Plan B : notre propre visio en WebRTC pair à pair, à utiliser si l'extension ne marche pas.
// Côté recruteur, le flux distant du candidat alimente directement le panneau.
export function Visio() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const role = params.get('role') === 'recruiter' ? 'recruiter' : 'candidate';

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState('Connexion…');
  const detector = useMemo(() => createLiveDetector(id), [id]);

  useEffect(() => {
    let closed = false;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const ws = new WebSocket(WS_URL);
    const pendingIce: RTCIceCandidateInit[] = [];
    let local: MediaStream | null = null;

    const send = (msg: unknown) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));

    pc.onicecandidate = (e) => e.candidate && send({ type: 'ice', candidate: e.candidate });
    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0]);
      setStatus('Connecté');
    };

    async function makeOffer() {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: 'offer', sdp: offer });
    }

    async function flushIce() {
      for (const c of pendingIce.splice(0)) await pc.addIceCandidate(c);
    }

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'room-full':
          setStatus('Cette salle a déjà deux participants.');
          break;
        case 'peer-joined':
          send({ type: 'present', role });
          if (role === 'recruiter') await makeOffer();
          break;
        case 'present':
          if (role === 'recruiter') await makeOffer();
          break;
        case 'offer': {
          await pc.setRemoteDescription(msg.sdp);
          await flushIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ type: 'answer', sdp: answer });
          break;
        }
        case 'answer':
          await pc.setRemoteDescription(msg.sdp);
          await flushIce();
          break;
        case 'ice':
          if (pc.remoteDescription) await pc.addIceCandidate(msg.candidate);
          else pendingIce.push(msg.candidate);
          break;
        case 'peer-left':
          setRemoteStream(null);
          setStatus("L'autre participant est parti.");
          break;
      }
    };

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (closed) return stream.getTracks().forEach((t) => t.stop());
        local = stream;
        if (localRef.current) localRef.current.srcObject = stream;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const join = () => send({ type: 'join', room: id, role });
        if (ws.readyState === WebSocket.OPEN) join();
        else ws.addEventListener('open', join);
        setStatus("En attente de l'autre participant…");
      })
      .catch((e) => setStatus(`Caméra indisponible : ${e}`));

    return () => {
      closed = true;
      local?.getTracks().forEach((t) => t.stop());
      pc.close();
      ws.close();
    };
  }, [id, role]);

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  return (
    <div className={`visio ${role}`}>
      <div className="visio-stage">
        <video ref={remoteRef} className="remote" autoPlay playsInline />
        <video ref={localRef} className="local" autoPlay playsInline muted />
        <div className="visio-banner">
          {status}
          {role === 'candidate' &&
            " · Cet entretien utilise une vérification de présence. Aucune vidéo n'est enregistrée."}
        </div>
      </div>
      {role === 'recruiter' && (
        <aside className="visio-side">
          <RecruiterPanel
            sessionId={id}
            stream={remoteStream}
            apiBase={API_BASE}
            reportUrl={`/report/${id}`}
            faceSampler={sampleFace}
            detector={detector}
          />
        </aside>
      )}
    </div>
  );
}
