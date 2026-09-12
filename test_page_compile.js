// LA PAGE ENTIÈRE SE COMPILE, ET AUCUNE GARDE `typeof` NE PROTÈGE UN NOM INEXISTANT.
//
// ⚠️ POURQUOI (13/09). Tous les autres bancs extraient des MORCEAUX de la page.
// Une erreur de syntaxe ailleurs (un commentaire `//` collé au milieu d'une
// ligne, qui avale la fin de l'instruction) les laisse tous verts — alors que le
// navigateur refuse le script ENTIER : plus rien ne marche sur le site. Vécu le
// 13/09 en corrigeant le centre de contrôle, rattrapé avant publication.
//
// Et une garde `typeof X === 'function'` sur un nom qui n'existe nulle part évite
// l'erreur… en cachant que la fonctionnalité ne tourne JAMAIS. Vu le 13/09 : ce
// site appelait `renderModelShare` (qui n'existe que chez la jumelle Noctra)
// après avoir fusionné des virements — la liste n'était pas redessinée et les
// boutons ✕ visaient de mauvaises lignes.
//
//     node test_page_compile.js [autre/index.html]

'use strict';
const fs = require('fs');
const path = require('path');
const { Script } = require('vm');

const PAGE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(PAGE, 'utf8');

let ko = 0;
function V(titre, cond, detail = '') {
  if (cond) console.log('  OK  ' + titre);
  else { ko++; console.log('  KO  ' + titre + (detail ? '  -> ' + String(detail).slice(0, 300) : '')); }
}

console.log('\n-- la page se compile --');
{
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0; const erreurs = [];
  while ((m = re.exec(SRC))) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    n++;
    try { new Script(m[2]); } catch (e) { erreurs.push(e.message); }
  }
  V('chaque script de la page se compile', n > 0 && erreurs.length === 0, n + ' script(s) ; ' + erreurs.join(' | '));
}

console.log('\n-- aucune garde typeof vers un nom qui n’existe nulle part --');
{
  const NAVIGATEUR = new Set(['window', 'document', 'navigator', 'Notification', 'structuredClone', 'requestIdleCallback',
    'IntersectionObserver', 'ResizeObserver', 'BroadcastChannel', 'AbortController', 'fetch', 'Chart', 'supabase',
    'queueMicrotask', 'crypto', 'caches', 'PushManager', 'ClipboardItem', 'matchMedia', 'requestAnimationFrame']);
  // Gardes VOULUES, justifiées une par une.
  const TOLERES = {
    renderModelShare: 'code commun avec la jumelle Noctra ; ICI c’est renderVirements qui redessine, juste après (test_memoire_partagee le vérifie)',
    renderVirements: 'code commun avec la jumelle Shinra ; ICI c’est renderModelShare qui redessine, juste avant (test_memoire_partagee le vérifie)',
  };
  const morts = [];
  const re = /typeof\s+([A-Za-z_$][\w$]*)\s*===?\s*['"]function['"]/g;
  let m;
  while ((m = re.exec(SRC))) {
    const nom = m[1];
    if (NAVIGATEUR.has(nom) || TOLERES[nom]) continue;
    const e = nom.replace(/\$/g, '\\$');
    const defini = new RegExp('function\\s+' + e + '\\s*\\(|(?:const|let|var)\\s+' + e + '\\b|(?:const|let|var)\\s+[^;\\n]*[,{]\\s*' + e +
      '\\b|window\\.' + e + '\\s*=|[(,]\\s*' + e + '\\s*[,)=]|\\b' + e + '\\s*=>').test(SRC);
    if (!defini) morts.push(nom + ' (l.' + SRC.slice(0, m.index).split('\n').length + ')');
  }
  V('aucune garde morte', morts.length === 0, 'gardes mortes : ' + morts.join(', '));
}

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
