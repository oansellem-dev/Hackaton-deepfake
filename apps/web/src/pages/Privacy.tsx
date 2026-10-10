import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CandidateLinkInfo } from '@kyc/shared';
import { api } from '../config.ts';

// Mentions d'information (RGPD art. 13), rédigées à partir de ce que fait réellement le produit.
// Les passages entre crochets sont des choix du responsable du traitement, à faire valider juridiquement.
export function Privacy() {
  const { token } = useParams();
  const [info, setInfo] = useState<CandidateLinkInfo | null>(null);

  useEffect(() => {
    if (token) api.getLink(token).then(setInfo).catch(() => undefined);
  }, [token]);

  const controller = info?.controller;
  const hours = info?.biometricRetentionHours ?? 24;
  const contact = controller?.contact || '[adresse de contact du responsable du traitement]';

  return (
    <div className="page privacy">
      <h1>Mentions d’information</h1>
      <p className="muted">Vérification de présence avant et pendant un entretien de recrutement en visio.</p>

      <div className="card">
        <h2>Qui traite vos données</h2>
        <p>
          Responsable du traitement : <strong>{controller?.name ?? '[entreprise qui recrute]'}</strong>, contact : {contact}.
          Délégué à la protection des données : [à compléter].
        </p>

        <h2>Pourquoi</h2>
        <ul>
          <li>Vérifier les informations que vous déclarez (sources publiques, cohérence entre elles).</li>
          <li>
            Vérifier que la personne présente à l’entretien est celle qui a fait la pré-vérification (comparaison avec
            vous-même uniquement, jamais avec une base de visages), et détecter une vidéo truquée.
          </li>
          <li>Garder une trace des vérifications et des suppressions (journal, sans donnée biométrique).</li>
        </ul>
        <p>
          Base légale : votre consentement, et votre consentement explicite pour la donnée biométrique (articles 6.1.a et
          9.2.a du RGPD) [à valider par le responsable du traitement].
        </p>

        <h2>Quelles données</h2>
        <ul>
          <li>Votre identité et les informations que vous déclarez (coordonnées, poste, profils).</li>
          <li>Des éléments techniques : nom des caméras, fuseau horaire, adresse IP.</li>
          <li>
            Une empreinte de votre visage (128 nombres) et ses proportions, calculées <strong>dans votre navigateur</strong>.
            Aucune image ni vidéo n’est envoyée au serveur ni enregistrée.
          </li>
          <li>Les résultats des vérifications (défis réussis ou non, cohérences, score indicatif).</li>
          <li>Si vous associez votre appareil : une clé publique. Votre empreinte digitale ou votre visage restent dans l’appareil.</li>
        </ul>

        <h2>Combien de temps</h2>
        <ul>
          <li>Empreinte du visage : jusqu’à la décision du recruteur, et au plus {hours} heures. Supprimée aussitôt si vous retirez votre accord.</li>
          <li>Lien de pré-vérification : valable peu de temps, utilisable une seule fois.</li>
          <li>Autres données de l’entretien : [durée à fixer par le responsable du traitement].</li>
        </ul>

        <h2>Qui y a accès</h2>
        <p>
          Le recruteur seulement. Hébergeur : [à compléter]. Aucun transfert hors de l’Union européenne [à confirmer selon
          l’hébergement].
        </p>

        <h2>Décision</h2>
        <p>
          Aucune décision n’est prise automatiquement : un score indicatif aide le recruteur, qui décide seul (article 22
          du RGPD). Aucune analyse de vos émotions n’est faite.
        </p>

        <h2>Vos droits</h2>
        <p>
          Accès, rectification, effacement, limitation, opposition, et retrait de votre consentement à tout moment (depuis
          la page de pré-vérification ou en écrivant à {contact}). Le retrait supprime votre empreinte. Vous pouvez aussi
          saisir la CNIL (cnil.fr).
        </p>
        <p>
          Vous pouvez refuser la vérification du visage : aucune pénalité, le recruteur vérifie lui-même pendant
          l’entretien.
        </p>

        <h2>Sécurité</h2>
        <p>
          Connexion chiffrée (HTTPS), empreinte chiffrée sur le serveur (AES-256) sous un identifiant sans lien avec votre
          nom, accès réservé au recruteur, journal des vérifications et des suppressions.
        </p>
      </div>
    </div>
  );
}
