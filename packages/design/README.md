# @kyc/design — système de design d'Oval

- `src/tokens.css` : couleurs, reliefs, rayons, mouvement (variables CSS).
- `src/base.css` : réinitialisation minimale, typographie, matières (`.shell`, `.panel`, `.card`, `.inset`). Inclut `tokens.css` et `motion.css`.
- `src/Manta.tsx` + `manta.css` : la mascotte, six états (`neutre`, `defi`, `analyse`, `signal`, `verifie`, `lumiere`), 48 px au moins, `prefers-reduced-motion` respecté.

Utilisé par `apps/oval` (interface recruteur) et `apps/web` (pages caméra du moteur, via `src/oval-skin.css`).
