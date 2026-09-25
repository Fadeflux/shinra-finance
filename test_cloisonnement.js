// ⚠️ CE DÉPÔT EST PUBLIC, et il ne doit parler QUE de cette agence-ci.
//
// Le 25/09, un commentaire laissé par la refonte visuelle nommait l'autre agence
// dans `index.html` — des deux côtés. Un nom d'ailleurs dans un dépôt public, ça
// ne se voit pas à l'usage : la page s'affiche pareil. Ce banc le voit.
//
// Comment il est écrit :
//   • les mots interdits ne sont PAS dans ce fichier — seulement leur EMPREINTE
//     (sha256 tronqué). Écrire la liste en clair reviendrait à faire entrer ici
//     ce qu'on veut en sortir ;
//   • il se PROUVE d'abord sur un mot témoin (dont l'empreinte est dans la liste),
//     écrit dans un dossier temporaire hors du dépôt : un contrôle qui ne trouve
//     jamais rien ne prouve rien ;
//   • il relit les fichiers SUIVIS PAR GIT (html/js/json/md/txt) : ce sont ceux
//     qui partent en ligne.
//
// Lancer :  node test_cloisonnement.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const EMPREINTES = new Set([
  '593fe9329ec189ab', '88bf31488ddf9d2f', '9d017e2681b7f317',
  '5bba0e8ae667fb60',   // mot témoin : sert UNIQUEMENT à prouver que le contrôle mord
]);

const empreinte = (m) => crypto.createHash('sha256').update(m.toLowerCase()).digest('hex').slice(0, 16);
const motsInterdits = (texte) => [...new Set(
  (String(texte).match(/[A-Z]?[a-zà-ÿ]{3,}/g) || []).filter((m) => EMPREINTES.has(empreinte(m))))];

let ko = 0;
function V(titre, cond, detail = '') {
  if (cond) console.log('  OK  ' + titre);
  else { ko++; console.error('  KO  ' + titre + (detail ? '   -> ' + detail : '')); }
}

// 1. le contrôle mord-il ? (sinon un dépôt « propre » ne veut rien dire)
{
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cloison-'));
  const f = path.join(d, 'piege.txt');
  // en un seul mot, tout en minuscules : c'est ainsi qu'un nom apparaît dans un
  // commentaire ou un texte de page, et c'est ce que le repère sait extraire.
  fs.writeFileSync(f, 'une ligne avec le mot motdepreuveinterdit dedans\n', 'utf8');
  const vu = motsInterdits(fs.readFileSync(f, 'utf8'));
  V('le contrôle attrape vraiment un mot interdit (témoin planté)', vu.length === 1, JSON.stringify(vu));
  fs.writeFileSync(f, 'une ligne parfaitement normale, avec des chiffres 1234\n', 'utf8');
  V('... et ne crie pas sur du texte normal', motsInterdits(fs.readFileSync(f, 'utf8')).length === 0);
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
}

// 2. le dépôt lui-même
{
  let fichiers = [];
  try {
    fichiers = execSync('git ls-files', { cwd: __dirname, encoding: 'utf8' })
      .split('\n').filter((f) => f && /\.(html|js|json|md|txt)$/.test(f));
  } catch (e) {}
  V('les fichiers suivis par git sont lisibles', fichiers.length > 0, 'git ls-files n’a rien rendu');
  const trouves = [];
  for (const f of fichiers) {
    if (f === path.basename(__filename)) continue;        // ce banc porte l'empreinte du témoin
    const chemin = path.join(__dirname, f);
    if (!fs.existsSync(chemin)) continue;
    fs.readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n').split('\n')
      .forEach((l, n) => { if (motsInterdits(l).length) trouves.push(f + ':' + (n + 1)); });
  }
  V(fichiers.length + ' fichiers relus : aucun nom d’ailleurs', trouves.length === 0, trouves.join(', '));
}

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
