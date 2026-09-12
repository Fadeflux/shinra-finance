// « ✓ Entrée ajoutée » ne s'affiche que si l'entrée est vraiment partie.
//
// ⚠️ Aucune connexion : les fonctions sont extraites du VRAI index.html et
// tournent avec un faux serveur en mémoire. (Règle de la maison : on ne teste
// jamais sur la base réelle — un essai a déjà détruit de vrais virements.)
//
// LE DÉFAUT (12/09). `quickAddSave` — par où l'opérateur saisit son CA, donc
// l'endroit du site où se tromper coûte le plus cher — lançait `saveEntry()` et
// `saveData()` SANS les attendre, puis affichait le bandeau vert tout de suite.
// Les deux écritures répondaient plus tard ; leur échec remplaçait alors le vert
// par un rouge. On lisait « c'est fait », puis « ce n'est pas fait ». Et si on
// avait fermé l'écran entre les deux, on repartait en croyant son chiffre
// enregistré — il n'existait que sur l'écran.
//
// Et `saveEntry` SAVAIT que ça avait raté (elle affiche un message d'échec)
// mais ne le DISAIT à personne : elle rendait `undefined` dans tous les cas.
//
//     node test_accuse_reception.js

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ko = 0;
function V(titre, cond, detail = '') {
  if (cond) console.log('  OK  ' + titre);
  else { ko++; console.log('  KO  ' + titre + (detail ? '  -> ' + detail : '')); }
}

function morceau(debut) {
  const i = SRC.indexOf(debut);
  if (i < 0) return null;
  const j = SRC.indexOf('\n}', i);
  return SRC.slice(i, j + 2);
}

// ── 1. saveEntry dit enfin si ça a marché ────────────────────────────────────
console.log('\n-- saveEntry rend un verdict, au lieu de le garder pour elle --');
{
  const corps = morceau('async function saveEntry(');
  V('la fonction est extraite', !!corps && corps.length > 200);

  const monter = (opts) => {
    const vus = [];
    const f = new Function(
      'ecritureInterdite', '_apiConnected', 'showSaveStatus', 'apiFetch', 'ents', 'console',
      corps + '; return saveEntry;')(
        () => opts.lectureSeule, opts.enLigne,
        (t, c) => vus.push([t, c]),
        async () => { if (opts.reseauKo) throw new Error('reseau'); return { id: 'db1' }; },
        [], { warn() {} });
    return { f, vus };
  };

  return_test();
  async function return_test() {
    {
      const { f } = monter({ lectureSeule: false, enLigne: true, reseauKo: false });
      V('succès -> true', (await f({})) === true);
    }
    {
      const { f, vus } = monter({ lectureSeule: false, enLigne: false, reseauKo: false });
      V('hors ligne -> false', (await f({})) === false);
      V('... et ça se voit à l’écran', vus.some(v => /NON SAUVEGARD/.test(v[0])));
    }
    {
      const { f } = monter({ lectureSeule: true, enLigne: true, reseauKo: false });
      V('lecture seule -> false', (await f({})) === false);
    }
    {
      const { f, vus } = monter({ lectureSeule: false, enLigne: true, reseauKo: true });
      V('réseau coupé -> false', (await f({})) === false);
      V('... et ça se voit aussi', vus.some(v => /NON SAUVEGARD/.test(v[0])));
    }

    // ── 2. quickAddSave attend, et n'annonce que ce qui a eu lieu ────────────
    console.log('\n-- quickAddSave n’annonce plus avant de savoir --');
    const q = morceau('async function quickAddSave(');
    V('la fonction est extraite et ATTEND', !!q && /await\s+saveEntry/.test(q) && /await\s+saveData/.test(q),
      q ? q.slice(0, 60) : 'introuvable');
    V('... et le vert est CONDITIONNEL',
      !!q && /if\s*\([^)]*ok[^)]*\)\s*showSaveStatus\(/.test(q),
      'le bandeau vert doit dépendre du résultat');

    // ── 3. le contrôle sait échouer ─────────────────────────────────────────
    console.log('\n-- le contrôle sait échouer --');
    const avant = "saveEntry(entry); saveData(); showSaveStatus('✓ Entrée ajoutée');";
    V('la forme d’avant n’attendait rien', !/await/.test(avant),
      'si ce n’est plus vrai, ce test ne mesure plus la faille qu’il surveille');
    V('... et le vert y était inconditionnel', !/if\s*\(/.test(avant));

    console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
    process.exit(ko ? 1 : 0);
  }
}
