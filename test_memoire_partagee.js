// LA MÉMOIRE DU NAVIGATEUR DE CE SITE N'EST PLUS MÉLANGÉE AVEC CELLE D'UN AUTRE OUTIL.
//
// ⚠️ LE DÉFAUT (13/09). Ce site est servi par une adresse partagée avec d'autres
// outils (fadeflux.github.io). Pour le navigateur, c'est un seul site : un seul
// localStorage. Et les clés de ce site — `crm_virements`, `crm_ents`,
// `crm_modeles`, `crm_vas`, `crm_snapshot_local`… — n'avaient rien de propre à
// lui :
//   • une copie de secours pouvait venir d'un AUTRE outil ;
//   • au chargement, les virements « récupérés depuis ce navigateur » étaient
//     FUSIONNÉS dans le cloud puis réécrits ; le panneau de récupération
//     proposait de les restaurer ;
//   • et une liste re-triée après une fusion n'était pas redessinée : les
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

(async () => {
  console.log('\n-- 1. chaque copie locale de données est rangée sous le nom du site --');
  {
    const CLES = ['virements', 'ents', 'vas', 'modeles', 'editlog', 'snapshot_local', 'pb_defaults'];
    const partagees = CLES.filter((k) => SRC.includes("'crm_" + k + "'"));
    V('plus aucune clé de données commune avec un autre outil', partagees.length === 0, 'encore communes : ' + partagees.join(', '));
    const site = /const SITE_FINANCES='([a-z]+)';/.exec(SRC);
    V('le site porte son nom', !!site && site[1] === 'shinra', site ? site[1] : 'absent');
  }

  const fCle = morceau("const SITE_FINANCES=", "\nlet _VIR_AFFICHES") || "";

  console.log('\n-- 2. au chargement, on ne fusionne QUE la copie de CE site --');
  {
    const bloc = morceau("      try{\n        const _lv=await window.storage.get(", "      // Modèles et journal");
    V('la fusion au chargement est extraite', !!bloc);
    if (bloc) {
      const memoire = new Map();
      const etranger = [{ id: 'x1', date: '2026-09-10', amount: 777, note: 'données d’un autre outil' }];
      memoire.set('crm_virements', JSON.stringify(etranger));                    // ancienne clé commune
      memoire.set('fin_autre_virements', JSON.stringify(etranger));              // la copie d'un autre outil
      let ecritures = 0;
      const f = new Function('window', 'virements', '_saveVirements', 'showSaveStatus', 'setTimeout',
        fCle + '\n return (async()=>{ ' + bloc + ' return virements; })();');
      const lire = (k) => (memoire.has(k) ? { value: memoire.get(k) } : null);
      const apres = await f({ storage: { get: async (k) => lire(k) } },
        [{ id: 'a', date: '2026-09-01', amount: 100, note: '' }], () => { ecritures++; }, () => {}, () => {});
      V('les virements d’un autre outil ne sont PAS fusionnés dans ce cloud', apres.length === 1,
        apres.length + ' virement(s) après chargement : ' + JSON.stringify(apres.map((v) => v.amount)));
      V('... et rien n’est réécrit au serveur', ecritures === 0, ecritures + ' écriture(s)');
      memoire.clear();
      memoire.set('fin_shinra_virements', JSON.stringify([{ id: 'b', date: '2026-09-02', amount: 50, note: '' }]));
      const propre = await f({ storage: { get: async (k) => lire(k) } },
        [{ id: 'a', date: '2026-09-01', amount: 100, note: '' }], () => { ecritures++; }, () => {}, () => {});
      V('la copie de CE site reste récupérée', propre.length === 2, JSON.stringify(propre.map((v) => v.amount)));
    }
  }

  console.log('\n-- 3. supprimer vise la ligne CLIQUÉE, même si la liste a bougé --');
  {
    const corps = morceau('async function deleteVirement(i){', '\n}\n');
    V('la suppression est extraite', !!corps);
    if (corps) {
      const A = { id: 'A', date: '2026-09-01', amount: 100, note: '' };
      const B = { id: 'B', date: '2026-09-05', amount: 200, note: '' };
      const C = { id: 'C', date: '2026-09-09', amount: 300, note: '' };
      const D = { id: 'D', date: '2026-09-03', amount: 400, note: 'autre appareil' };
      // Affiché : A, B, C. Puis une fusion ajoute D et RE-TRIE : l'écran n'a pas bougé.
      const virements = [C, B, D, A];
      const f = new Function('virements', '_VIR_AFFICHES', 'showConfirm', 'logEdit', '_VIREMENTS_SUPPRIMES', '_cleVirement',
        'renderVirements', '_saveVirements', 'saveData', 'showSaveStatus', 'fmtR', 'dl',
        corps + '\n}\n; return { f: deleteVirement, lire: () => virements };');
      const o = f(virements, [A, B, C], async () => true, () => {}, new Set(), (v) => v.id,
        () => {}, async () => true, () => {}, () => {}, (x) => x + ' $', (d) => d);
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
      const f = new Function('_dirty', 'ecritureInterdite', 'apiFetch', 'virements', '_cleVirement', '_VIREMENTS_SUPPRIMES',
        '_pushSetting', 'console', 'renderVirements', corps + '\n}\n; return _saveVirements;');
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
