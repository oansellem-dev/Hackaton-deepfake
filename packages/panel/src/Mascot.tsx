// La mascotte ne parle qu'au recruteur, suggère sans ordonner, et n'accuse jamais.
export function Mascot({ message, busy }: { message: string; busy?: boolean }) {
  return (
    <div className="kyc-mascot">
      <svg className={busy ? 'kyc-mascot-face kyc-busy' : 'kyc-mascot-face'} viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="34" r="26" fill="#6c5ce7" />
        <circle cx="23" cy="30" r="8" fill="#fff" />
        <circle cx="41" cy="30" r="8" fill="#fff" />
        <circle cx="24" cy="31" r="3.5" fill="#1e1e2e" />
        <circle cx="42" cy="31" r="3.5" fill="#1e1e2e" />
        <path d="M24 45 Q32 51 40 45" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M14 14 L20 22 M50 14 L44 22" stroke="#6c5ce7" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <p className="kyc-bubble">{message}</p>
    </div>
  );
}
