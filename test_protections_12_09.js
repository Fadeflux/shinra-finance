// Cinq protections qui manquaient ici (12/09), trouvées en relisant la page
// fonction par fonction.
//
// ⚠️ Ce test n'ouvre AUCUNE connexion : il extrait les fonctions du vrai
// index.html et les fait tourner contre un faux serveur en mémoire. Il ne touche
// jamais Supabase (règle de la maison : des essais ont déjà détruit de vrais
// virements, deux fois).
//
// 1. POINT DE RESTAURATION AUTOMATIQUE : noté « écrit » AVANT la réponse du
//    serveur. S'il refusait, l'application croyait avoir une sauvegarde, et le
//    garde-fou « pas plus d'un point toutes les 20 h » bloquait toute nouvelle
//    tentative. Le jour où il faut restaurer : rien.
// 2. UN « ⚠ NON SAUVEGARDÉ » EFFACÉ DANS LA MÊME SECONDE par un « ✓ Sauvegardé »
//    (la saisie échoue, puis le journal appelle saveData qui affiche le vert).
// 3. LA SAUVEGARDE GÉNÉRALE CONTOURNAIT LA RELECTURE DES VIREMENTS : dès qu'un
//    virement avait été touché dans la session, chaque saisie renvoyait la liste
//    locale telle quelle — et effaçait les virements ajoutés entre-temps par
//    l'autre associé.
// 4. UN VIREMENT AJOUTÉ OU SUPPRIMÉ NE DISAIT JAMAIS S'IL ÉTAIT ENREGISTRÉ.
// 5. UN VIREMENT SANS IDENTIFIANT : deux virements identiques le même jour
//    (même montant, sans note) se confondaient à la fusion — l'un disparaissait.
// (+) Le « reste à payer » du bandeau et celui des fiches se contredisent quand
//    des paiements ont été saisis dans les entrées du jour : on dit lequel fait foi.
//
// Lancer : node test_protections_12_09.js [autre/index.html]
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');

function extraire(nom, mot) {
  const tete = (mot || 'function ') + nom + '(';
  const i = SRC.indexOf(tete);
  if (i < 0) return null;
  let prof = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') prof++;
    else if (SRC[k] === '}' && --prof === 0) return SRC.slice(i, k + 1);
  }
  return null;
}

let ko = 0, n = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); n++; }
  else { console.error('  ECHEC  ' + quoi + (detail ? '   -> ' + detail : '')); ko++; }
}
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ── 2. un échec ne se fait pas recouvrir ────────────────────────────────────
  {
    const f = extraire('showSaveStatus');
    const el = { textContent: '', style: {} };
    global._echecAffiche = 0;
    global.document = { getElementById: () => el, body: { classList: { contains: () => false } } };
    const showSaveStatus = new Function(f + ';return showSaveStatus;')();
    showSaveStatus('⚠ NON SAUVEGARDÉ — hors ligne', '#ef4444');
    showSaveStatus('✓ Sauvegardé');
    V(/NON SAUVEGARD/.test(el.textContent), 'un « ⚠ NON SAUVEGARDÉ » reste affiché malgré le « ✓ » qui suit',
      'affiché : « ' + el.textContent + ' »');
  }

  // ── 1. point de restauration automatique honnête ────────────────────────────
  {
    const f = extraire('snapshotSiNecessaire', 'async function ');
    V(!!f, 'la sauvegarde automatique est bien là');
    if (f) {
      const monde = (refuse) => {
        global._apiConnected = true;
        global.ents = [{ date: '2026-09-12', brut: 100 }];
        global.virements = [];
        global._snapTous = () => [];
        global._SNAP_MS = 20 * 3600 * 1000;
        global._SNAP_N = 3;
        global._snapLire = () => null;
        global._snapContenu = () => ({ ents: global.ents });
        global._settingsCache = {};
        global.window = { storage: { set() {} } };
        global._pushSetting = async () => !refuse;
        global.showSaveStatus = () => {};
      };
      monde(true);
      const snap = new Function(f + ';return snapshotSiNecessaire;')();
      await snap();
      V(global._settingsCache.snapshot_1 === undefined,
        'serveur qui refuse : le point n’est PAS noté (sinon 20 h sans nouvelle tentative)',
        'noté alors que rien n’est écrit');
      monde(false);
      await snap();
      V(typeof global._settingsCache.snapshot_1 === 'string', 'serveur qui accepte : le point est noté');
    }
  }

  // ── 3. la sauvegarde générale relit les virements ───────────────────────────
  {
    const f = extraire('saveData', 'async function ') || '';
    V(/_dirty\.virements\s*\?\s*_saveVirements\(\)/.test(f) && !/_pushSetting\(\s*'virements'/.test(f),
      'saveData repasse par _saveVirements (relecture du serveur), pas par un envoi brut');
  }

  // ── 4. et 5. ajouter / supprimer un virement ────────────────────────────────
  {
    // La forme `async` d'abord : chercher « function addVirement( » la trouverait
    // aussi DANS « async function addVirement( », en perdant le mot-clé.
    const fAdd = extraire('addVirement', 'async function ') || extraire('addVirement');
    const code = [fAdd, extraire('lireMontant'), extraire('_nouvelIdVirement'), extraire('_cleVirement'),
      extraire('deleteVirement', 'async function ')].filter(Boolean).join('\n');
    const champs = { 'vir-date': { value: '2026-09-12' }, 'vir-amount': { value: '500' }, 'vir-note': { value: '' } };
    const messages = [];
    global.document = { getElementById: (id) => champs[id] || { value: '', textContent: '', style: {} },
      body: { classList: { contains: () => false } } };
    global.virements = [];
    global._VIREMENTS_SUPPRIMES = new Set();
    global.renderVirements = () => {};
    global.logEdit = () => {};
    global.dl = (d) => d;
    global.fmtR = (x) => '$' + x;
    global.showConfirm = async () => true;
    global.saveData = async () => true;
    global.flashMsg = (id, m) => messages.push(m);
    global.showSaveStatus = (m) => messages.push(m);
    let reponse = false;
    global._saveVirements = async () => reponse;
    const api = new Function(code + ';return{addVirement,deleteVirement,_cleVirement};')();

    await api.addVirement(); await attendre(5);
    V(messages.some((m) => /NON|pas enregistr|échec/i.test(m)),
      'virement refusé par le serveur : l’écran le DIT', 'messages : ' + JSON.stringify(messages));
    V(!!(global.virements[0] && global.virements[0].id), 'un virement ajouté porte un identifiant',
      JSON.stringify(global.virements[0]));

    champs['vir-amount'].value = '500';
    reponse = true; messages.length = 0;
    await api.addVirement(); await attendre(5);
    V(global.virements.length === 2 && api._cleVirement(global.virements[0]) !== api._cleVirement(global.virements[1]),
      'deux virements identiques le même jour restent DEUX virements à la fusion',
      JSON.stringify(global.virements));

    reponse = false; messages.length = 0;
    await api.deleteVirement(0); await attendre(5);
    V(messages.some((m) => /NON|pas enregistr|échec/i.test(m)),
      'suppression refusée par le serveur : l’écran le DIT', 'messages : ' + JSON.stringify(messages));
  }

  // ── (+) le reste à payer qui fait foi ───────────────────────────────────────
  V(/reste à payer \(chiffre qui fait foi\)/.test(SRC) && /ne compte que les paiements loggés sur CETTE fiche/.test(SRC),
    'le bandeau dit qu’il fait foi, et la fiche prévient quand elle ne compte pas tout');

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '  (' + n + ' OK)');
  process.exitCode = ko ? 1 : 0;
})();
