#!/usr/bin/env node
/**
 * Tunnels publics (HTTPS) vers le site du moteur (5173) et le dashboard (5174).
 * Les adresses obtenues sont écrites dans apps/oval/.env (VITE_MOTEUR_URL, VITE_PUBLIC_URL) : les liens de
 * pré-vérification envoyés par e-mail s'ouvrent alors depuis n'importe où. Le dashboard recharge son .env tout seul.
 *
 * Fournisseur choisi automatiquement :
 *   1. cloudflared, si le port 7844 de Cloudflare est joignable (le plus propre) ;
 *   2. ngrok, si NGROK_AUTHTOKEN est dans apps/oval/.env (connexion en 443 : passe sur les réseaux filtrés ;
 *      compte gratuit sur https://dashboard.ngrok.com ; le visiteur voit une page « Visit Site » une fois par navigateur) ;
 *   3. localtunnel, sinon (ports aléatoires : bloqué sur certains réseaux).
 *
 * Usage : npm run tunnel   (en plus de npm run dev ; Ctrl+C coupe les tunnels)
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:net';
import { createRequire } from 'node:module';

const ENV = new URL('../apps/oval/.env', import.meta.url);
const CIBLES = [
  { port: 5173, cle: 'VITE_MOTEUR_URL', nom: 'site du moteur (pages candidat, panneau)' },
  { port: 5174, cle: 'VITE_PUBLIC_URL', nom: 'dashboard Oval (page candidat de la démo)' },
];
const CLOUDFLARED = [join(homedir(), '.local/bin/cloudflared'), '/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared'].find(existsSync);
const urls = {};

function ecrireEnv() {
  let texte = existsSync(ENV) ? readFileSync(ENV, 'utf8') : '';
  for (const { cle } of CIBLES) {
    if (!urls[cle]) continue;
    const ligne = `${cle}=${urls[cle]}`;
    const re = new RegExp(`^#?\\s*${cle}=.*$`, 'm');
    texte = re.test(texte) ? texte.replace(re, ligne) : `${texte.replace(/\n*$/, '\n')}${ligne}\n`;
  }
  writeFileSync(ENV, texte);
}

function pret(cible, url) {
  if (urls[cible.cle]) return;
  urls[cible.cle] = url;
  ecrireEnv();
  console.log(`✓ ${cible.nom} → ${url}`);
  if (Object.keys(urls).length === 1) {
    console.log('\nAdresse écrite dans apps/oval/.env : les e-mails envoyés désormais contiennent ce lien public.');
    console.log('Laissez cette fenêtre ouverte pendant les entretiens ; Ctrl+C coupe les tunnels.\n');
  }
}

const portJoignable = (host, port, ms = 3000) => new Promise((res) => {
  const s = connect({ host, port });
  const fin = (ok) => { s.destroy(); res(ok); };
  s.setTimeout(ms, () => fin(false));
  s.once('connect', () => fin(true));
  s.once('error', () => fin(false));
});

async function viaCloudflared() {
  for (const cible of CIBLES) {
    const p = spawn(CLOUDFLARED, ['tunnel', '--url', `http://localhost:${cible.port}`, '--no-autoupdate', '--protocol', 'http2'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const lire = (buf) => { const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/); if (m) pret(cible, m[0]); };
    p.stdout.on('data', lire); p.stderr.on('data', lire);
    p.on('exit', (code) => { console.error(`tunnel ${cible.port} arrêté (code ${code})`); process.exit(code ?? 1); });
    process.on('exit', () => p.kill());
  }
}

function lireEnv() {
  return Object.fromEntries((existsSync(ENV) ? readFileSync(ENV, 'utf8') : '').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
}

async function viaNgrok(authtoken) {
  const ngrok = await import('@ngrok/ngrok');
  // Plan gratuit : un seul point d'entrée. Le site du moteur (vrai parcours candidat) passe en premier ;
  // si ngrok renvoie la même adresse pour le second, on ne garde que le premier et le dashboard reste local.
  let premiere = null;
  for (const cible of CIBLES) {
    const l = await ngrok.default.forward({ addr: cible.port, authtoken, request_header_add: ['ngrok-skip-browser-warning:1'] });
    if (premiere && l.url() === premiere) {
      await l.close().catch(() => {});
      console.log(`· ${cible.nom} : pas de second tunnel sur le plan gratuit ngrok, reste en local (utilisez le mode « Moteur » dans Réglages → Données).`);
      let texte = readFileSync(ENV, 'utf8');
      texte = texte.replace(new RegExp(`^${cible.cle}=.*$`, 'm'), `# ${cible.cle}=`);
      writeFileSync(ENV, texte);
      continue;
    }
    premiere ??= l.url();
    pret(cible, l.url());
  }
  console.log('Le visiteur voit une page ngrok « Visit Site » la première fois, puis plus jamais dans ce navigateur.\n');
  // Node s'arrête dès qu'aucune tâche n'est en attente : on garde le processus (et les tunnels) vivants.
  setInterval(() => {}, 60_000);
  process.on('exit', () => ngrok.default.disconnect().catch(() => {}));
}

async function viaLocaltunnel() {
  const require = createRequire(import.meta.url);
  const localtunnel = require('localtunnel');
  const ip = await fetch('https://loca.lt/mytunnelpassword').then((r) => r.text()).catch(() => '(voir https://loca.lt/mytunnelpassword)');
  for (const cible of CIBLES) {
    const t = await localtunnel({ port: cible.port });
    pret(cible, t.url);
    t.on('close', () => { console.error(`tunnel ${cible.port} fermé`); process.exit(1); });
    t.on('error', (e) => console.error(`tunnel ${cible.port} : ${e.message}`));
    process.on('exit', () => t.close());
  }
  console.log(`Mot de passe demandé au premier affichage d'une page (localtunnel) : ${String(ip).trim()}`);
  console.log('Le candidat le saisit une fois, puis plus jamais dans ce navigateur.\n');
}

console.log('Ouverture des tunnels…');
process.on('SIGINT', () => process.exit(0));
const env = lireEnv();
if (CLOUDFLARED && (await portJoignable('198.41.192.227', 7844))) {
  console.log('Fournisseur : Cloudflare Tunnel');
  await viaCloudflared();
} else if (env.NGROK_AUTHTOKEN) {
  console.log('Fournisseur : ngrok (port 443)');
  try { await viaNgrok(env.NGROK_AUTHTOKEN); } catch (e) { console.error(`ngrok : ${e.message}`); process.exit(1); }
} else {
  console.log(CLOUDFLARED ? 'Port 7844 bloqué sur ce réseau et pas de NGROK_AUTHTOKEN dans apps/oval/.env : essai avec localtunnel.' : 'cloudflared absent : essai avec localtunnel.');
  await viaLocaltunnel();
}
