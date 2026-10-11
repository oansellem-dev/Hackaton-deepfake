import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CandidateLinkInfo } from '@kyc/shared';
import { api } from '../config.ts';
import { t } from '../i18n.ts';

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
  const contact = controller?.contact || t('[adresse de contact du responsable du traitement]');

  return (
    <div className="page privacy">
      <h1>{t('Mentions d’information')}</h1>
      <p className="muted">{t('Vérification de présence avant et pendant un entretien de recrutement en visio.')}</p>

      <div className="card">
        <h2>{t('Qui traite vos données')}</h2>
        <p>
          {t('Responsable du traitement :')} <strong>{controller?.name ?? t('[entreprise qui recrute]')}</strong>{t(', contact : {contact}.', { contact })}
          {' '}{t('Délégué à la protection des données : [à compléter].')}
        </p>

        <h2>{t('Pourquoi')}</h2>
        <ul>
          <li>{t('Vérifier les informations que vous déclarez (sources publiques, cohérence entre elles).')}</li>
          <li>
            {t('Vérifier que la personne présente à l’entretien est celle qui a fait la pré-vérification (comparaison avec vous-même uniquement, jamais avec une base de visages), et détecter une vidéo truquée.')}
          </li>
          <li>{t('Garder une trace des vérifications et des suppressions (journal, sans donnée biométrique).')}</li>
        </ul>
        <p>
          {t('Base légale : votre consentement, et votre consentement explicite pour la donnée biométrique (articles 6.1.a et 9.2.a du RGPD) [à valider par le responsable du traitement].')}
        </p>

        <h2>{t('Quelles données')}</h2>
        <ul>
          <li>{t('Votre identité et les informations que vous déclarez (coordonnées, poste, profils).')}</li>
          <li>{t('Des éléments techniques : nom des caméras, fuseau horaire, adresse IP.')}</li>
          <li>
            {t('Une empreinte de votre visage (128 nombres) et ses proportions, calculées')} <strong>{t('dans votre navigateur')}</strong>.
            {' '}{t('Aucune image ni vidéo n’est envoyée au serveur ni enregistrée.')}
          </li>
          <li>{t('Les résultats des vérifications (défis réussis ou non, cohérences, score indicatif).')}</li>
          <li>{t('Si vous associez votre appareil : une clé publique. Votre empreinte digitale ou votre visage restent dans l’appareil.')}</li>
        </ul>

        <h2>{t('Combien de temps')}</h2>
        <ul>
          <li>{t('Empreinte du visage : jusqu’à la décision du recruteur, et au plus {heures} heures. Supprimée aussitôt si vous retirez votre accord.', { heures: hours })}</li>
          <li>{t('Lien de pré-vérification : valable peu de temps, utilisable une seule fois.')}</li>
          <li>{t('Autres données de l’entretien : [durée à fixer par le responsable du traitement].')}</li>
        </ul>

        <h2>{t('Qui y a accès')}</h2>
        <p>
          {t('Le recruteur seulement. Hébergeur : [à compléter]. Aucun transfert hors de l’Union européenne [à confirmer selon l’hébergement].')}
        </p>

        <h2>{t('Décision')}</h2>
        <p>
          {t('Aucune décision n’est prise automatiquement : un score indicatif aide le recruteur, qui décide seul (article 22 du RGPD). Aucune analyse de vos émotions n’est faite.')}
        </p>

        <h2>{t('Vos droits')}</h2>
        <p>
          {t('Accès, rectification, effacement, limitation, opposition, et retrait de votre consentement à tout moment (depuis la page de pré-vérification ou en écrivant à {contact}). Le retrait supprime votre empreinte. Vous pouvez aussi saisir la CNIL (cnil.fr).', { contact })}
        </p>
        <p>
          {t('Vous pouvez refuser la vérification du visage : aucune pénalité, le recruteur vérifie lui-même pendant l’entretien.')}
        </p>

        <h2>{t('Sécurité')}</h2>
        <p>
          {t('Connexion chiffrée (HTTPS), empreinte chiffrée sur le serveur (AES-256) sous un identifiant sans lien avec votre nom, accès réservé au recruteur, journal des vérifications et des suppressions.')}
        </p>
      </div>
    </div>
  );
}
