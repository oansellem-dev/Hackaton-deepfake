import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { api } from '../config.ts';

type State = 'loading' | 'ready' | 'running' | 'ok' | 'failed' | 'expired';

// Lien collé par le recruteur dans la discussion de la visio : le candidat confirme, avec la clé d'accès créée à la
// pré-vérification, qu'il utilise le même appareil. Rien de biométrique ne quitte l'appareil.
export function Presence() {
  const { token = '' } = useParams();
  const [state, setState] = useState<State>('loading');
  const [controller, setController] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPresence(token)
      .then((p) => {
        setController(p.controller);
        setState('ready');
      })
      .catch(() => setState('expired'));
  }, [token]);

  async function confirm() {
    setState('running');
    try {
      const optionsJSON = await api.presenceOptions(token);
      const response = await startAuthentication({ optionsJSON: optionsJSON as never });
      const { verified } = await api.confirmPresence(token, response);
      setState(verified ? 'ok' : 'failed');
    } catch {
      setState('failed');
    }
  }

  return (
    <div className="page">
      <h1>Confirmer votre appareil</h1>
      <div className="card">
        {state === 'loading' && <p>Chargement…</p>}
        {state === 'expired' && <p>Ce lien a expiré ou a déjà servi. Demandez-en un nouveau au recruteur.</p>}
        {(state === 'ready' || state === 'running') && (
          <>
            <p>
              {controller ? `${controller} vous demande` : 'Le recruteur vous demande'} de confirmer que vous utilisez le
              même appareil que pour la pré-vérification. Votre appareil vous demandera peut-être votre code, votre
              empreinte digitale ou votre visage : ils restent dans l’appareil.
            </p>
            <button className="primary" disabled={state === 'running'} onClick={confirm}>
              {state === 'running' ? 'Confirmation…' : 'Confirmer avec ma clé d’accès'}
            </button>
          </>
        )}
        {state === 'ok' && <p><strong>Merci, c’est confirmé.</strong> Vous pouvez revenir à l’entretien.</p>}
        {state === 'failed' && (
          <p>
            La confirmation n’a pas abouti (autre appareil, ou clé absente). Ce n’est pas grave : dites-le simplement au
            recruteur.
          </p>
        )}
      </div>
    </div>
  );
}
