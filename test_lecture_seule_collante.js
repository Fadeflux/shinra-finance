// Le mode lecture seule ne s'efface plus en retirant `?ro=1` de l'URL.
//
// ⚠️ LE DÉFAUT (12/09)
// Il s'activait sur `?ro=1` et RIEN d'autre. La personne qu'il restreint n'avait
// qu'à effacer six caractères de la barre d'adresse pour retrouver l'écriture.
// Une restriction que son destinataire peut retirer n'est pas une restriction.
//
// ⚠️⚠️ ET CE N'EST TOUJOURS PAS UNE FRONTIÈRE DE SÉCURITÉ — le test le dit au
// lieu de le taire. Tout le monde se connecte ici avec LE MÊME compte Supabase :
// la base ne peut pas savoir QUI écrit. Ce garde empêche les accidents et le
// contournement facile ; il ne tient pas contre quelqu'un qui vide le stockage
// du navigateur. La seule vraie séparation serait un SECOND compte Supabase avec
// des règles de ligne en lecture seule — ça se configure côté Supabase.
//
//     node test_lecture_seule_collante.js

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

let ko = 0;
function V(titre, cond, detail = '') {
  if (cond) console.log('  OK  ' + titre);
  else { ko++; console.log('  KO  ' + titre + (detail ? '  -> ' + detail : '')); }
}

// On extrait le VRAI bloc de décision et on l'exécute avec un faux navigateur.
const i = SRC.indexOf('(function(){\n  var p = new URLSearchParams');
const j = SRC.indexOf('})();', i) + 5;
const bloc = SRC.slice(i, j);
V('le bloc de décision est bien extrait', i > 0 && bloc.length > 200, String(bloc.length));

function jouer(url, stockeAvant, stockageCasse) {
  const sac = Object.assign({}, stockeAvant || {});
  const classes = new Set();
  const faux = {
    URLSearchParams: URLSearchParams,
    location: { search: url },
    localStorage: {
      getItem(k) { if (stockageCasse) throw new Error('refusé'); return k in sac ? sac[k] : null; },
      setItem(k, v) { if (stockageCasse) throw new Error('refusé'); sac[k] = String(v); },
      removeItem(k) { if (stockageCasse) throw new Error('refusé'); delete sac[k]; },
    },
    document: { body: { classList: { add: (c) => classes.add(c) } } },
  };
  new Function('URLSearchParams', 'location', 'localStorage', 'document', bloc)(
    faux.URLSearchParams, faux.location, faux.localStorage, faux.document);
  return { lectureSeule: classes.has('readonly'), sac };
}

console.log('\n-- le paramètre allume le mode, et le RETIENT --');
{
  const r = jouer('?ro=1', {});
  V('`?ro=1` allume la lecture seule', r.lectureSeule === true);
  V('... et il est retenu dans le navigateur', r.sac.fin_shinra_ro === '1', JSON.stringify(r.sac));
}

console.log('\n-- effacer le paramètre ne suffit plus --');
{
  // LE contrôle qui compte : c'est exactement le contournement d'avant.
  const r = jouer('', { fin_shinra_ro: '1' });
  V('sans paramètre, le mode retenu s’applique quand même', r.lectureSeule === true);
  const r2 = jouer('?autre=1', { fin_shinra_ro: '1' });
  V('un autre paramètre ne l’efface pas non plus', r2.lectureSeule === true);
}

console.log('\n-- on peut en sortir volontairement --');
{
  // Sinon l'opérateur qui ouvre une fois un lien `?ro=1` resterait coincé dans
  // son propre outil — un garde qui enferme celui qu'il protège est une panne.
  const r = jouer('?ro=0', { fin_shinra_ro: '1' });
  V('`?ro=0` rend l’écriture', r.lectureSeule === false);
  V('... et oublie le mode pour la suite', r.sac.fin_shinra_ro === undefined, JSON.stringify(r.sac));
}

console.log('\n-- rien ne tombe si le stockage est refusé --');
{
  // Navigation privée, réglages stricts : `localStorage` peut LEVER.
  const r = jouer('?ro=1', {}, true);
  V('le paramètre marche encore sans stockage', r.lectureSeule === true);
  const r2 = jouer('', {}, true);
  V('et sans rien du tout, l’écriture reste possible', r2.lectureSeule === false,
    'c’est le comportement d’avant : on ne bloque pas un opérateur par défaut');
}

console.log('\n-- la vérité est écrite dans le code --');
{
  // Un garde qu'on croit plus fort qu'il n'est, c'est pire qu'un garde absent.
  V('le code dit que ce n’est PAS une frontière de sécurité',
    /N'EST PAS UNE FRONTIERE DE SECURITE|n’est pas une frontière/i.test(SRC));
  V('... et nomme la vraie solution (second compte + RLS)',
    /RLS/.test(SRC) && /SECOND compte|second compte/i.test(SRC));
}

console.log('\n-- le contrôle sait échouer --');
{
  const avant = "if(new URLSearchParams(location.search).get('ro')==='1')document.body.classList.add('readonly');";
  V('la forme d’avant ne consultait aucun stockage', !/localStorage/.test(avant),
    'si ce n’est plus vrai, ce test ne mesure plus la faille qu’il surveille');
}

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
