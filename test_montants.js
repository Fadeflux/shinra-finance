// « 1,000 » tape dans une case d'argent ne doit JAMAIS valoir 1 dollar.
//
// ⚠️ Aucune connexion : les fonctions sont extraites du VRAI index.html et
// tournent avec un faux serveur en memoire. (Regle de la maison : on ne teste
// jamais sur la base reelle.)
//
// LE DEFAUT (11/09). Le correctif du 05/09 avait cree la bonne regle —
// `lireMontant` : « de l'argent n'a jamais 3 decimales, donc 1.000 est un
// separateur de milliers mal lu, on REFUSE au lieu de deviner ». Mais il ne
// l'avait branchee que sur l'entree du jour (`se`) et le paiement modele.
//
// L'AJOUT RAPIDE et le formulaire VA lisaient encore leurs montants au
// `parseFloat` brut. Dans un champ `type="number"` en francais, taper « 1,000 »
// donne `.value === "1.000"` : l'ajout rapide enregistrait 1 $ et calculait le
// profit dessus. Une regle ecrite une fois, appliquee a un formulaire sur deux.
//
// `varate` est volontairement HORS de la regle : c'est un TAUX (0,5 $/abonne),
// pas un montant. Un taux a trois decimales est legitime.
//
// Lancer : node test_montants.js
// Sur l'ancienne version (doit ECHOUER) : node test_montants.js vieux.html
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8');

function extraire(nom) {
  for (const tete of ['async function ' + nom + '(', 'function ' + nom + '(',
                      'window.' + nom + ' = function', 'window.' + nom + '=function']) {
    const i = SRC.indexOf(tete);
    if (i < 0) continue;
    let prof = 0;
    for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
      if (SRC[k] === '{') prof++;
      else if (SRC[k] === '}' && --prof === 0) {
        const txt = SRC.slice(i, k + 1);
        // `window.addVA = function(){...}` -> en faire une declaration nommee.
        return txt.startsWith('window.') ? txt.replace(/^window\.\w+\s*=\s*function/, 'function ' + nom) : txt;
      }
    }
  }
  throw new Error('fonction introuvable : ' + nom);
}

// --- Faux monde ---
let CHAMPS = {};
let ENREGISTRE = [];
let MESSAGES = [];
global.document = {
  getElementById: (id) => (id in CHAMPS ? { value: CHAMPS[id] } : { value: '' }),
  querySelector: () => null,
};
global.flashMsg = (cible, texte) => MESSAGES.push(texte);
global.saveEntry = (e) => { ENREGISTRE.push(e); };
global.saveData = () => Promise.resolve(true);
global.logEdit = () => {};
global.ts = () => '2026-09-11';
global.fmt = (v) => String(v);
global.dl = (d) => String(d);
global.closeQuickAdd = () => {};
global.ents = [];
global.vas = [];
for (const n of ['rh', 'rc', 'uk', 'rv', 'renderVirements', 'renderModeles', 'renderVA',
                 'renderVaList', 'renderAll', 'saveVA', 'pp']) {
  if (typeof global[n] !== 'function') global[n] = () => {};
}

const CODE = ['lireMontant', 'gv', 'verifierMontants', 'quickAddSave']
  .map(extraire).join('\n');
Object.assign(global, new Function(
  CODE + ';return{lireMontant,gv,verifierMontants,quickAddSave};'
)());

let ko = 0;
function V(cond, quoi, detail) {
  if (cond) console.log('  OK  ' + quoi);
  else { ko++; console.error('  KO  ' + quoi + (detail ? ' -> ' + detail : '')); }
}

// --- 1) la regle elle-meme ---
V(global.lireMontant('1.000').ok === false, 'la regle refuse « 1.000 » (separateur de milliers)');
V(global.lireMontant('1000').ok === true && global.lireMontant('1000').valeur === 1000,
  '... et accepte « 1000 »');
V(global.lireMontant('12.50').ok === true, '... et accepte « 12.50 » (2 decimales : un vrai montant)');
V(global.lireMontant('-500').ok === false, '... et refuse un montant negatif');

// --- 2) L'AJOUT RAPIDE : le formulaire oublie ---
// TEMOIN : un montant propre doit bien s'enregistrer, sinon ce banc ne prouve rien.
CHAMPS = { 'qa-brut': '1000', 'qa-tg': '', 'qa-va': '', 'qa-mo': '', 'qa-al': '', 'qa-date': '2026-09-11' };
ENREGISTRE = []; MESSAGES = [];
try { global.quickAddSave(); } catch (e) { }
const temoin = ENREGISTRE.slice();
V(temoin.length === 1 && temoin[0].brut === 1000,
  'ajout rapide : « 1000 » enregistre bien 1000 $ (temoin)',
  'le temoin ne marche pas — le verdict suivant ne vaudrait rien : ' + JSON.stringify(temoin));

// LE CONTROLE : « 1,000 » (que le navigateur rend « 1.000 ») ne doit RIEN enregistrer.
CHAMPS['qa-brut'] = '1.000';
ENREGISTRE = []; MESSAGES = [];
try { global.quickAddSave(); } catch (e) { }
V(ENREGISTRE.length === 0,
  'ajout rapide : « 1,000 » n’enregistre RIEN',
  'a enregistre ' + JSON.stringify(ENREGISTRE.map((e) => e.brut)) + ' $ au lieu de refuser');
V(MESSAGES.some((m) => /3 d[ée]cimales/.test(String(m))),
  '... et l’operateur voit pourquoi',
  'refus muet : ' + JSON.stringify(MESSAGES));

// --- 3) `gv` ne fabrique plus un montant a partir d'une saisie refusee ---
CHAMPS = { 'qa-va': '10.000' };
V(global.gv('qa-va') !== 10, 'gv() ne rend plus 10 pour « 10,000 »', 'il rend ' + global.gv('qa-va'));

console.log('\n' + (ko === 0 ? 'TOUT PASSE' : ko + ' ECHEC(S)'));
process.exit(ko ? 1 : 0);
