// LES DEUX SITES DE FINANCES NE SE MÉLANGENT PLUS DANS LE NAVIGATEUR.
//
// ⚠️ LE DÉFAUT (13/09). noctra-finance et shinra-finance sont servis par la MÊME
// adresse (fadeflux.github.io). Pour le navigateur, c'est un seul site : un seul
// localStorage. Et les deux écrivaient les mêmes clés — `crm_virements`,
// `crm_ents`, `crm_modeles`, `crm_vas`, `crm_snapshot_local`… Ouvrir l'un puis
// l'autre dans le même navigateur :
//   • la copie de secours de l'un devenait celle de l'autre ;
//   • au chargement, le site Shinra FUSIONNAIT les virements « récupérés depuis
//     ce navigateur » dans son cloud — ceux de Noctra compris — puis les
//     réécrivait ; le panneau de récupération proposait de restaurer ceux de
//     l'autre agence ;
//   • et une liste re-triée après une fusion n'était pas redessinée (le site
//     Shinra appelait `renderModelShare`, qui n'existe que chez Noctra) : les
//     boutons ✕ gardaient les anciennes positions, un clic supprimait UN AUTRE
//     virement que celui visé.
//
// Aucune connexion : les fonctions sont extraites du VRAI index.html et tournent
// sur une fausse mémoire partagée. (Règle de la maison : jamais la base réelle.)
//
//     node test_memoire_partagee.js [autre/index.html]

'use strict';
const fs = require('fs');
const path = require('path');

const PAGE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(PAGE, 'utf8');

let ko = 0;
function V(titre, cond, detail = '') {
  if (cond) console.log('  OK  ' + titre);
  else { ko++; console.log('  KO  ' + titre + (detail ? '  -> ' + String(detail).slice(0, 200) : '')); }
}
function morceau(debut, fin) {
  const i = SRC.indexOf(debut);
  if (i < 0) return null;
  const j = SRC.indexOf(fin, i + debut.length);
  return j < 0 ? null : SRC.slice(i, j);
}
const ESTNOCTRA = /async function deleteModelPayment\(/.test(SRC);
const AUTRE = ESTNOCTRA ? 'shinra' : 'noctra';

(async () => {
  console.log('\n-- 1. chaque copie locale de données est rangée sous le nom du site --');
  {
    const CLES = ['virements', 'ents', 'vas', 'modeles', 'editlog', 'snapshot_local', 'pb_defaults'];
    const partagees = CLES.filter((k) => SRC.includes("'crm_" + k + "'"));
    V('plus aucune clé de données commune aux deux sites', partagees.length === 0, 'encore partagées : ' + partagees.join(', '));
    const site = /const SITE_FINANCES='(noctra|shinra)';/.exec(SRC);
    V('le site porte son nom', !!site && site[1] === (ESTNOCTRA ? 'noctra' : 'shinra'), site ? site[1] : 'absent');
  }

  const fCle = morceau("const SITE_FINANCES=", "\nlet _VIR_AFFICHES") || "";

  console.log('\n-- 2. au chargement, on ne fusionne QUE la copie de CE site --');
  {
    const bloc = morceau("      try{\n        const _lv=await window.storage.get(", "      // Modèles et journal");
    if (!bloc) {
      console.log('  --  (ce site ne fusionne pas les virements du navigateur au chargement : rien à vérifier ici)');
    } else {
      const memoire = new Map();
      const etranger = [{ id: 'x1', date: '2026-09-10', amount: 777, note: 'paiement de l’autre agence' }];
      memoire.set('crm_virements', JSON.stringify(etranger));                        // ancienne clé commune
      memoire.set('fin_' + AUTRE + '_virements', JSON.stringify(etranger));          // la copie de l'autre site
      let ecritures = 0;
      const f = new Function('window', 'virements', '_saveVirements', 'showSaveStatus', 'setTimeout',
        fCle + '\n return (async()=>{ ' + bloc + ' return virements; })();');
      const apres = await f({ storage: { get: async (k) => (memoire.has(k) ? { value: memoire.get(k) } : null) } },
        [{ id: 'a', date: '2026-09-01', amount: 100, note: '' }], () => { ecritures++; }, () => {}, () => {});
      V('les virements de l’autre agence ne sont PAS fusionnés dans ce cloud', apres.length === 1,
        apres.length + ' virement(s) après chargement : ' + JSON.stringify(apres.map((v) => v.amount)));
      V('... et rien n’est réécrit au serveur', ecritures === 0, ecritures + ' écriture(s)');
      // Mais la copie de CE site, elle, reste récupérable.
      memoire.clear();
      memoire.set('fin_' + (ESTNOCTRA ? 'noctra' : 'shinra') + '_virements', JSON.stringify([{ id: 'b', date: '2026-09-02', amount: 50, note: '' }]));
      const propre = await f({ storage: { get: async (k) => (memoire.has(k) ? { value: memoire.get(k) } : null) } },
        [{ id: 'a', date: '2026-09-01', amount: 100, note: '' }], () => { ecritures++; }, () => {}, () => {});
      V('la copie de CE site reste récupérée', propre.length === 2, JSON.stringify(propre.map((v) => v.amount)));
    }
  }

  console.log('\n-- 3. supprimer vise la ligne CLIQUÉE, même si la liste a bougé --');
  {
    const nom = ESTNOCTRA ? 'deleteModelPayment' : 'deleteVirement';
    const corps = morceau('async function ' + nom + '(i){', '\n}\n');
    V('la suppression est extraite', !!corps);
    if (corps) {
      const A = { id: 'A', date: '2026-09-01', amount: 100, note: '' };
      const B = { id: 'B', date: '2026-09-05', amount: 200, note: '' };
      const C = { id: 'C', date: '2026-09-09', amount: 300, note: '' };
      const D = { id: 'D', date: '2026-09-03', amount: 400, note: 'autre appareil' };
      const monde = { virements: [A, B, C], affiches: [A, B, C], bandeaux: [] };
      // Affiché : A, B, C. Puis une fusion ajoute D et RE-TRIE : l'écran n'a pas bougé.
      monde.virements = [C, B, D, A];
      const f = new Function('virements', '_VIR_AFFICHES', 'showConfirm', 'logEdit', '_VIREMENTS_SUPPRIMES', '_cleVirement',
        'renderVirements', 'renderModelShare', '_saveVirements', 'saveData', 'showSaveStatus', 'fmtR', 'dl',
        corps + '\n}\n; return { f: ' + nom + ', lire: () => virements };');
      const o = f(monde.virements, monde.affiches, async () => true, () => {}, new Set(), (v) => v.id,
        () => {}, () => {}, async () => true, () => {}, (t) => monde.bandeaux.push(t), (x) => x + ' $', (d) => d);
      await o.f(0);   // clic sur la 1re ligne affichée : A (100 $)
      const reste = o.lire().map((v) => v.id).sort().join(',');
      V('c’est A (la ligne cliquée) qui disparaît', reste === 'B,C,D', 'reste : ' + reste);
    }
  }

  console.log('\n-- 4. après une fusion, la liste affichée est redessinée --');
  {
    const corps = morceau('async function _saveVirements(){', '\n}\n');
    V('la sauvegarde des virements est extraite', !!corps);
    if (corps) {
      let dessins = 0;
      const seul = ESTNOCTRA ? 'renderModelShare' : 'renderVirements';
      const params = ['_dirty', 'ecritureInterdite', 'apiFetch', 'virements', '_cleVirement', '_VIREMENTS_SUPPRIMES', '_pushSetting', 'console', seul];
      const f = new Function(...params, corps + '\n}\n; return _saveVirements;');
      const sauver = f({}, () => false,
        async () => ({ virements: JSON.stringify([{ id: 'S', date: '2026-09-04', amount: 90, note: '' }]) }),
        [{ id: 'L', date: '2026-09-01', amount: 10, note: '' }], (v) => v.id, new Set(), async () => true,
        { info() {}, warn() {} }, () => { dessins++; });
      await sauver();
      V('la liste fusionnée est redessinée (sinon les ✕ visent de mauvaises lignes)', dessins >= 1, dessins + ' dessin(s)');
    }
  }

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
  process.exit(ko ? 1 : 0);
})();
