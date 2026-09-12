// Un point de restauration n'est ANNONCÉ que s'il a vraiment été enregistré.
//
// ⚠️ Aucune connexion : la fonction est extraite du VRAI index.html et tourne
// avec un faux serveur en mémoire. (Règle de la maison : on ne teste jamais sur
// la base réelle — un essai a déjà détruit de vrais virements deux fois.)
//
// LE DÉFAUT (12/09). `snapshotSiNecessaire`, le point AUTOMATIQUE, avait été
// corrigé : il attend la réponse du serveur avant de noter quoi que ce soit.
// `snapshotManuel` — celui qu'on CLIQUE, donc celui qu'on utilise quand on a
// justement peur de perdre quelque chose — ne l'avait pas été. Il :
//   1. posait le point dans `_settingsCache` AVANT l'envoi ;
//   2. lançait `_pushSetting` sans `await` et sans lire son résultat ;
//   3. affichait « ✓ Point de restauration créé » quoi qu'il arrive.
//
// CE QUE ÇA COÛTAIT. Si le serveur refusait (hors ligne, jeton expiré, lecture
// seule, 500), l'application croyait dur comme fer avoir une sauvegarde :
// `_snapTous()` lit ce même cache, et le garde-fou « pas plus d'un point toutes
// les 20 h » interdisait alors toute nouvelle tentative. Le jour où il aurait
// fallu restaurer, il n'y avait RIEN — et rien ne l'avait jamais dit.
//
//     node test_snapshot_honnete.js

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ko = 0;
function V(titre, cond, detail = '') {
  if (cond) console.log('  OK  ' + titre);
  else { ko++; console.log('  KO  ' + titre + (detail ? '  -> ' + detail : '')); }
}

// On extrait la VRAIE fonction : ce qui est mesuré est ce qui tourne.
const i = SRC.indexOf('async function snapshotManuel(');
const j = SRC.indexOf('\n}', i);
const corps = SRC.slice(i, j + 2);
V('la fonction est bien extraite du fichier servi', corps.length > 300, String(corps.length));

function monter(serveurAccepte) {
  const etat = { cache: {}, local: null, bandeaux: [], rendus: 0 };
  const f = new Function(
    '_snapTous', '_snapLire', '_SNAP_N', '_snapContenu', '_settingsCache',
    '_pushSetting', 'window', 'renderRecovery', 'showSaveStatus',
    corps + '; return snapshotManuel;')(
      () => [], () => null, 3, () => ({ ents: [1, 2] }), etat.cache,
      async () => serveurAccepte,
      { storage: { set: (k, v) => { etat.local = v; } } },
      () => { etat.rendus++; },
      (txt, couleur) => { etat.bandeaux.push([txt, couleur || 'vert']); });
  return { f, etat };
}

(async () => {
  console.log('\n-- le serveur accepte : le point existe, on le dit --');
  {
    const { f, etat } = monter(true);
    await f();
    const d = etat.bandeaux[etat.bandeaux.length - 1] || ['', ''];
    V('le point est annoncé', /cr[ée]{2}/i.test(d[0]), d[0]);
    V('... et gardé en cache', Object.keys(etat.cache).length === 1);
    V('... et écrit en local', etat.local !== null);
  }

  console.log('\n-- le serveur REFUSE : rien ne doit être annoncé ni noté --');
  {
    const { f, etat } = monter(false);
    await f();
    const d = etat.bandeaux[etat.bandeaux.length - 1] || ['', ''];
    V('le bandeau dit NON enregistré', /NON enregistr/i.test(d[0]), d[0]);
    V('... en rouge', d[1] === '#ef4444', String(d[1]));
    // LE contrôle qui compte : laisser le cache rempli bloquerait toute nouvelle
    // tentative pendant 20 h, derrière un point qui n'existe pas.
    V('... et le cache reste VIDE', Object.keys(etat.cache).length === 0,
      JSON.stringify(etat.cache));
    V('... et rien n\'est écrit en local', etat.local === null, String(etat.local));
  }

  console.log('\n-- le contrôle sait échouer --');
  // Sinon il est inerte. On rejoue la forme d'AVANT le correctif.
  const avant = "_settingsCache['x'] = t; _pushSetting('x', c); showSaveStatus('✓ créé');";
  V('l\'ancienne forme n\'attendait pas la réponse',
    !/await\s+_pushSetting/.test(avant),
    'si ce n\'est plus vrai, ce test ne mesure plus la faille qu\'il surveille');
  V('... et la forme actuelle, si', /await\s+_pushSetting/.test(corps));

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
  process.exit(ko ? 1 : 0);
})();
