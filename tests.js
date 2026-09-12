#!/usr/bin/env node
// LANCE TOUS LES BANCS DE CE SITE, EN UNE COMMANDE.
//
//     node tests.js
//
// ⚠️ POURQUOI CE FICHIER EXISTE
// Ce dépôt avait SEPT bancs et aucun moyen de les lancer ensemble : pas de
// `package.json`, donc pas de `npm test`. Il fallait les appeler un par un, de
// mémoire, en connaissant leurs noms. Personne ne fait ça — et un contrôle
// qu'on ne lance pas ne contrôle rien. C'est le même défaut que les bancs
// surveillent ailleurs : quelque chose qui se décrit comme automatique et ne
// l'est pas.
//
// ⚠️ IL DÉCOUVRE LES BANCS, il n'en tient pas la liste. Une liste écrite à la
// main serait en retard sur le code dès le prochain banc ajouté — la leçon
// revenue sept fois le 12/09.
//
// ⚠️ RÈGLE DE LA MAISON RESPECTÉE : aucun de ces bancs ne touche à la base
// réelle. Ils extraient les fonctions du vrai `index.html` et les font tourner
// contre un faux serveur en mémoire. Un essai contre l'API a déjà détruit de
// vrais virements deux fois.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ICI = __dirname;
const bancs = fs.readdirSync(ICI)
  .filter((f) => /^test_.*\.js$/.test(f))
  .sort();

if (!bancs.length) {
  console.error('⛔ Aucun banc trouvé (test_*.js). Ce lanceur ne mesure rien.');
  process.exit(1);
}

// ⚠️ ON VÉRIFIE AVANT DE LANCER, pas après.
// La règle de la maison est absolue : aucun essai contre la base réelle -- un
// essai a déjà détruit de vrais virements deux fois. Ce lanceur refuse donc de
// démarrer un banc capable d'atteindre le réseau, au lieu de faire confiance.
// (J'ai lancé ces bancs une première fois AVANT de le vérifier. Ils étaient
//  hermétiques -- mais l'ordre était mauvais, et c'est l'ordre qui protège.)
const DANGER = /createClient\(|window\.supabase|require\(['"](node-fetch|axios|undici)|https?:\/\/[a-z0-9.-]+\.(supabase\.co|railway\.app)/;
const risques = [];
for (const b of bancs) {
  const brut = fs.readFileSync(path.join(ICI, b), 'utf8');
  const code = brut.split('\n').map((l) => l.split('//')[0]).join('\n');
  const m = code.match(DANGER);
  if (m) risques.push(b + ' -> ' + m[0].slice(0, 50));
}
if (risques.length) {
  console.error('\n⛔ Ces bancs peuvent atteindre un vrai service. RIEN n\u2019a été lancé :');
  risques.forEach((r) => console.error('   ' + r));
  console.error('\nUn banc doit remplacer le réseau par une fonction locale.');
  process.exit(2);
}

console.log('\n' + bancs.length + ' banc(s) à passer, tous vérifiés hermétiques.' + '\n');

let echecs = 0;
const detail = [];

for (const b of bancs) {
  process.stdout.write('  ' + b.padEnd(38));
  try {
    const sortie = execFileSync(process.execPath, [path.join(ICI, b)], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    // On compte ce qui est passé, pour que le vert dise COMBIEN.
    const ok = (sortie.match(/^\s*OK\s/gm) || []).length;
    console.log('vert' + (ok ? '  (' + ok + ' contrôles)' : ''));
  } catch (e) {
    echecs++;
    console.log('ROUGE');
    // On garde la sortie pour l'afficher À LA FIN : sinon le premier échec
    // noie les suivants et on croit n'avoir qu'un problème.
    detail.push([b, String((e.stdout || '') + (e.stderr || '')).trim()]);
  }
}

if (detail.length) {
  console.log('\n────────── détail des échecs ──────────');
  for (const [nom, sortie] of detail) {
    console.log('\n== ' + nom + ' ==');
    console.log(sortie.split('\n').filter((l) => /KO|ECHEC|Error|Assertion/.test(l)).join('\n')
      || sortie.slice(-1200));
  }
}

console.log('\n' + (echecs ? echecs + ' BANC(S) ROUGE(S)' : 'TOUT PASSE') + '\n');
process.exit(echecs ? 1 : 0);
