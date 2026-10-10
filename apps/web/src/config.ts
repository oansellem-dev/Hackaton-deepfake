import { createApi } from '@kyc/panel';

// Par défaut, même origine que le site : en dev, Vite relaie /api et /ws vers le serveur ;
// en mode partage, le serveur sert le site lui-même. Aucun réglage à faire derrière un tunnel.
export const API_BASE: string = import.meta.env.VITE_API_URL ?? window.location.origin;
export const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws';
export const api = createApi(API_BASE);
