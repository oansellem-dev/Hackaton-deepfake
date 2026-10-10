/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** Adresse publique de la page candidat, utilisée dans le lien envoyé par e-mail. */
  readonly VITE_PUBLIC_URL?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
