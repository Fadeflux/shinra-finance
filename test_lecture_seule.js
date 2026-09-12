// Le mode LECTURE SEULE doit bloquer TOUTES les ecritures, pas une sur dix.
//
// ⚠️ Ce test n'ouvre AUCUNE connexion : il extrait les fonctions du VRAI
// index.html et les fait tourner avec un faux serveur en memoire. Il ne touche
// jamais Supabase. (Regle de la maison : on ne teste jamais sur la base reelle
// — des essais d'apercu ont deja DETRUIT de vrais virements, deux fois.)
//
// LE DEFAUT (11/09). Le commit qui a repare la lecture seule ecrivait, a raison :
//
//   « Une garde qui se contourne au clavier n'est pas une garde. On la met LA OU
//     L'ECRITURE PART, une seule fois, pour tous les chemins d'appel. »
//
// Elle n'a ete posee que sur `_pushSetting` (reglages + virements). Les NEUF
// autres endroits d'ou une ecriture part — entrees, VA, objectif, webhook,
// import, restauration de sauvegarde — n'avaient pour tout garde que
// `_apiConnected`. En lecture seule, la classe CSS cache des boutons ; la touche
// Entree, un `onclick` reste visible ou la console du navigateur passaient tout
// droit. C'est le motif des jumeaux : une regle ecrite une fois, appliquee a un
// chemin sur dix.
//
// METHODE. Chaque fonction est appelee DEUX FOIS :
//   1. hors lecture seule -> elle DOIT ecrire (sinon le controle ne prouve rien :
//      une fonction qui plante sur un bouchon manquant semblerait « bloquee ») ;
//   2. en lecture seule   -> elle ne doit RIEN ecrire.
// Le premier appel est le temoin. Sans lui, ce banc serait inerte.
//
// Lancer : node test_lecture_seule.js
'use strict';
const fs = require('fs');
const path = require('path');

// Un chemin en argument permet de rejouer ce banc sur une ANCIENNE version du
// fichier et de verifier qu'il y echoue bien (sinon il ne prouverait rien).
const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8');

/** Decoupe une fonction du fichier source par equilibrage des accolades. */
function extraire(nom) {
  let tete = 'async function ' + nom + '(';
  let i = SRC.indexOf(tete);
  if (i < 0) { tete = 'function ' + nom + '('; i = SRC.indexOf(tete); }
  if (i < 0) throw new Error('fonction introuvable : ' + nom);
  let prof = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') prof++;
    else if (SRC[k] === '}' && --prof === 0) return SRC.slice(i, k + 1);
  }
  throw new Error('fin introuvable : ' + nom);
}

// Les endroits d'ou une ecriture part, avec de quoi les appeler.
const ECRIVAINS = [
  ['saveEntry', () => global.saveEntry({ id: 'e1', amount: 10 })],
  ['updateEntryAPI', () => global.updateEntryAPI('e1', { id: 'e1', amount: 20 })],
  ['deleteEntryAPI', () => global.deleteEntryAPI('e1')],
  ['saveVA', () => global.saveVA({ name: 'Nael' }, null)],
  ['deleteVAAPI', () => global.deleteVAAPI('Nael')],
  ['saveMonthlyGoal', () => global.saveMonthlyGoal()],
  // ⚠️ Son ecriture part d'un `setTimeout(..., 1500)` : sans le bouchon de timer
  // ci-dessous, le temoin ne voyait rien partir et le controle se declarait
  // « bloque » alors qu'il n'avait simplement pas attendu. Un controle qui ne
  // peut pas echouer ne prouve rien.
  ['saveDiscordWebhook', () => global.saveDiscordWebhook()],
  ['importData', () => global.importData({ target: { files: [{}], value: 'x' } })],
  ['restaurerSnapshot', () => global.restaurerSnapshot(0)],
];

// --- Faux monde. Rien ne sort : `apiFetch` n'est qu'un carnet.
let ECRITURES = [];
const CLASSES = new Set();
global.document = {
  body: { classList: { contains: (c) => CLASSES.has(c) } },
  getElementById: () => ({ value: '42', checked: false, style: {}, classList: { add() {}, remove() {} } }),
  querySelector: () => null,
  querySelectorAll: () => [],
};
global.showSaveStatus = () => {};
global.renderModelShare = () => {};
global.render = () => {};
global.showConfirm = () => Promise.resolve(true);   // l'operateur dit « oui »
global.ents = [];
global.vas = [];
global.virements = [];
global.modeles = [];
global._apiConnected = true;
global._webhookTimer = null;
// Timers immediats : `saveDiscordWebhook` ecrit depuis un setTimeout de 1,5 s.
global.setTimeout = (fn) => { try { fn(); } catch (e) { } return 0; };
global.clearTimeout = () => {};
// Lecture d'un fichier d'import : on rend un JSON minimal, tout de suite.
global.FileReader = function () {
  this.readAsText = () => { try { this.onload({ target: { result: '{"ents":[{"id":"i1","amount":1}]}' } }); } catch (e) { } };
};
global._snapLire = () => ({ ts: Date.now(), ents: [{ id: 's1', amount: 5 }], virements: [], modeles: [] });
// ⚠️ Sans ces bouchons, `importData` et `restaurerSnapshot` levaient une
// ReferenceError que LEUR PROPRE `catch` avalait : le temoin paraissait muet et
// le banc allait declarer « bloque » une fonction qu'il n'avait jamais atteinte.
for (const n of ['rh', 'rc', 'uk', 'rv', 'renderVirements', 'renderModeles', 'renderSnapshots',
                 '_saveModeles', 'renderAll', 'refreshAll', '_snapEcrire', 'renderVaList']) {
  if (typeof global[n] !== 'function') global[n] = () => {};
}
global._saveVirements = () => Promise.resolve(true);
global.saveData = () => Promise.resolve(true);
global.apiFetch = (url, o) => {
  if (o && o.method && o.method !== 'GET') ECRITURES.push(o.method + ' ' + url);
  // ⚠️ Une LECTURE de /api/entries doit rendre un TABLEAU : le code fait
  // `ents = await apiFetch('/api/entries')` puis `ents.map(...)`. Rendre un objet
  // ici contaminait la fonction suivante, dont le temoin mourait sur un
  // « .map is not a function » sans rapport avec ce qu'on teste.
  if (!o || !o.method || o.method === 'GET') {
    return Promise.resolve(String(url).indexOf('/api/entries') === 0 ? [] : {});
  }
  return Promise.resolve({ ok: true, id: 'db1' });
};

/** Etat neuf avant chaque fonction : aucune ne doit dependre de la precedente. */
function remettreANeuf() {
  global.ents = [];
  global.vas = [];
  global.virements = [];
  global.modeles = [];
  global._apiConnected = true;
}

const noms = ECRIVAINS.map((e) => e[0]);
const CODE = [extraire('ecritureInterdite')].concat(noms.map(extraire)).join('\n');
Object.assign(global, new Function(
  CODE + ';return{ecritureInterdite,' + noms.join(',') + '};'
)());

let ko = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); }
  else { ko++; console.error('  KO  ' + quoi + (detail ? ' -> ' + detail : '')); }
}

// Certaines ecritures partent d'un callback asynchrone (FileReader.onload) que
// l'appel ne rend pas : on laisse tourner les promesses en attente avant de lire
// le carnet, sinon le temoin semble muet et le verdict ne vaut rien.
async function purger() {
  for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
}

(async function () {
  for (const [nom, appeler] of ECRIVAINS) {
    // 1) TEMOIN : hors lecture seule, elle doit vraiment ecrire.
    remettreANeuf();
    CLASSES.delete('readonly');
    ECRITURES = [];
    let bug = null;
    try { await appeler(); await purger(); } catch (e) { bug = e && e.message; }
    const temoin = ECRITURES.slice();

    // 2) LE CONTROLE : en lecture seule, plus rien ne doit partir.
    remettreANeuf();
    CLASSES.add('readonly');
    ECRITURES = [];
    try { await appeler(); await purger(); } catch (e) { }
    const enRo = ECRITURES.slice();

    if (!temoin.length) {
      V(false, nom + ' : le temoin n’ecrit pas',
        'ce controle ne prouve RIEN — repare le temoin avant de croire le verdict'
        + (bug ? ' (a leve : ' + bug + ')' : ' (aucune exception : sortie anticipee)'));
      continue;
    }
    V(enRo.length === 0, nom + ' : rien ne part en lecture seule',
      'ECRITURE PASSEE MALGRE LA LECTURE SEULE : ' + enRo.join(' ; '));
  }

  // Le garde lui-meme doit encore savoir dire non (sinon tout ce qui precede
  // passerait parce que la garde est cassee, pas parce qu'elle protege).
  CLASSES.add('readonly');
  V(global.ecritureInterdite('essai') === true, 'la garde repond bien « interdit » en lecture seule');
  CLASSES.delete('readonly');
  V(global.ecritureInterdite('essai') === false, '... et « autorise » en mode normal');

  console.log('\n' + (ko === 0 ? 'TOUT PASSE' : ko + ' ECHEC(S)'));
  process.exit(ko ? 1 : 0);
})();
