// Trois protections de l'argent, prouvées sur le VRAI code de index.html.
//
// ⚠️ Ce test n'ouvre AUCUNE connexion : il extrait les fonctions du fichier et les
// fait tourner avec un faux serveur en mémoire. Il ne touche jamais Supabase.
//   (Règle de la maison : on ne teste jamais sur la base réelle — des essais
//    d'aperçu ont déjà DÉTRUIT de vrais virements, deux fois.)
//
// 1. DEUX APPAREILS SE DÉTRUISAIENT LES PAIEMENTS. La liste partait ENTIÈRE et
//    écrasait celle du serveur. PC et téléphone ouverts en même temps : le PC
//    ajoute un virement, le téléphone (chargé avant) en supprime un autre et
//    repousse SA liste — le virement du PC disparaît, sans un mot. Le tableau
//    « reste à envoyer » réclame alors de l'argent déjà versé : on paie deux fois.
//
// 2. LE MODE LECTURE SEULE N'EMPÊCHAIT RIEN. Ce n'était qu'une classe CSS qui
//    cachait des boutons — la touche Entrée, elle, écrivait toujours.
//
// 3. « ✓ SAUVEGARDÉ » S'AFFICHAIT SANS RIEN VÉRIFIER (couvert par les deux
//    précédents : `_pushSetting` rend maintenant false, et les appelants le lisent).
//
// Lancer : node test_paiements.js
'use strict';
const fs = require('fs');
const path = require('path');

// Un chemin en argument permet de rejouer ce banc sur un AUTRE fichier (l'autre
// site finance, ou une ancienne version) et de verifier qu'il y echoue bien.
const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8');

/** Découpe une fonction du fichier source par équilibrage des accolades. */
function extraire(nom, mot) {
  const tete = (mot || 'function ') + nom + '(';
  const i = SRC.indexOf(tete);
  if (i < 0) throw new Error('fonction introuvable : ' + nom);
  let prof = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') prof++;
    else if (SRC[k] === '}' && --prof === 0) return SRC.slice(i, k + 1);
  }
  throw new Error('fin introuvable : ' + nom);
}

const CODE = [
  extraire('ecritureInterdite'),
  extraire('_pushSetting'),
  extraire('_cleVirement'),
  extraire('_nouvelIdVirement'),
  extraire('_saveVirements', 'async function '),
].join('\n');

// --- Faux monde : un « serveur » qui n'est qu'un objet en mémoire.
// Tout vit sur `global` : le code extrait est évalué au niveau global (`new
// Function`), il ne verrait pas des `let` de module.
const SERVEUR = {};
const CLASSES = new Set();
global._dirty = {};
global.virements = [];
global._VIREMENTS_SUPPRIMES = new Set();

global.document = { body: { classList: { contains: (c) => CLASSES.has(c) } } };
global.showSaveStatus = () => {};
global.renderModelShare = () => {};
global.apiFetch = (url, o) => {
  if (!o) return Promise.resolve(Object.assign({}, SERVEUR));   // GET
  const b = JSON.parse(o.body);
  SERVEUR[b.key] = b.value;                                      // POST
  return Promise.resolve({ ok: true });
};

// On teste le VRAI code du fichier, pas une copie qui pourrait diverger.
Object.assign(global, new Function(
  CODE + ';return{ecritureInterdite,_pushSetting,_cleVirement,_nouvelIdVirement,_saveVirements};'
)());

const lireServeur = () => JSON.parse(SERVEUR.virements || '[]');
let n = 0;
function verifier(cond, quoi) {
  if (!cond) { console.error('  ECHEC  ' + quoi); process.exitCode = 1; }
}
function ok(quoi) { console.log('  OK  ' + quoi); n++; }

(async () => {
  const P1 = { id: 'p1', date: '2026-09-01', amount: 500, note: 'juin' };
  const P2 = { id: 'p2', date: '2026-09-02', amount: 300, note: 'juillet' };
  const P3 = { id: 'p3', date: '2026-09-03', amount: 700, note: 'aout' };

  // Départ : deux paiements déjà en base, vus par les deux appareils.
  SERVEUR.virements = JSON.stringify([P1, P2]);

  // --- APPAREIL A (le PC) ajoute P3.
  global.virements = [P1, P2, P3];
  await _saveVirements();
  verifier(lireServeur().length === 3, 'A : le serveur doit avoir 3 paiements');
  ok('appareil A ajoute un paiement -> serveur = ' + lireServeur().length);

  // --- APPAREIL B (le téléphone), chargé AVANT, supprime P1.
  //     Ancien code : il repoussait [P2] — P1 ET P3 détruits d'un coup.
  global.virements = [P2];
  global._VIREMENTS_SUPPRIMES = new Set([_cleVirement(P1)]);
  await _saveVirements();

  const fin = lireServeur().map((v) => v.id).sort();
  verifier(!fin.includes('p1'), 'B : la suppression demandée doit tenir');
  verifier(fin.includes('p3'), 'LE PAIEMENT DE A NE DOIT PAS ETRE DETRUIT');
  verifier(fin.includes('p2'), 'P2 doit rester');
  ok('appareil B supprime p1 sans detruire p3 -> serveur = [' + fin.join(', ') + ']');

  // --- Mode lecture seule : aucune écriture ne part.
  CLASSES.add('readonly');
  const avant = SERVEUR.virements;
  global.virements = [];
  const r = await _saveVirements();
  verifier(r === false, 'lecture seule : doit rendre false');
  verifier(SERVEUR.virements === avant, 'lecture seule : la base ne doit pas bouger');
  ok('lecture seule : la liste du serveur est intacte');
  CLASSES.delete('readonly');

  // --- Serveur injoignable : on n'écrase RIEN à l'aveugle.
  const avant2 = SERVEUR.virements;
  const vraiFetch = global.apiFetch;
  global.apiFetch = () => Promise.reject(new Error('hors ligne'));
  global.virements = [];
  const r2 = await _saveVirements();
  global.apiFetch = vraiFetch;
  verifier(r2 === false, 'hors ligne : doit rendre false');
  verifier(SERVEUR.virements === avant2, 'hors ligne : la base ne doit pas bouger');
  ok('serveur injoignable : on refuse plutot que d ecraser a l aveugle');

  console.log('\n' + n + ' verifications passees - deux appareils ne se detruisent '
              + 'plus les paiements.');
})();
