// Logo Oval : deux disques réunis par un col fin. Même tracé que dans le dashboard et l'extension.
export const LOGO_PATH = 'M120 4A116 116 0 0 1 208.9 194.6C192.8 213.8 154 218 154 240C154 262 192.8 266.2 208.9 285.4A116 116 0 0 1 120 476A116 116 0 0 1 31.1 285.4C47.2 266.2 86 262 86 240C86 218 47.2 213.8 31.1 194.6A116 116 0 0 1 120 4Z';

export function LogoMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size / 2} height={size} viewBox="0 0 240 480" aria-hidden>
      <path d={LOGO_PATH} fill="currentColor" />
    </svg>
  );
}

/** Logo animé de l'intro : les deux disques glissent l'un vers l'autre, puis le col les réunit. */
export function LogoIntro() {
  return (
    <svg className="pc-logo" viewBox="0 0 240 480" aria-hidden>
      <circle className="pc-logo__c1" cx="120" cy="120" r="116" />
      <circle className="pc-logo__c2" cx="120" cy="360" r="116" />
      <path className="pc-logo__full" d={LOGO_PATH} />
    </svg>
  );
}
