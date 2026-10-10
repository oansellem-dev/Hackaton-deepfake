import { createApi } from '@kyc/panel';

export const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
export const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws';
export const api = createApi(API_BASE);
