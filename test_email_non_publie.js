// L'adresse de connexion n'est plus écrite sur une page PUBLIQUE.
//
// ⚠️ LE DÉFAUT (12/09)
// Ce dépôt est ouvert. L'adresse du projet Supabase et sa clé « anon » y sont —
// et c'est normal, cette clé est faite pour être publique. L'EMAIL, lui, ne
// l'est pas : publié à côté, il donne la moitié de la clef et désigne exactement
// quel compte essayer. Le mot de passe devient alors la seule chose entre
// n'importe qui et tous les chiffres.
//
// C'est le même défaut que le champ d'identifiant qui nommait les comptes,
// retiré des tableaux de bord le même jour.
//
//     node test_email_non_publie.js

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const CLE = 'ccs_mail';

let ko = 0;
function V(titre, cond, detail = '') {
  if (cond) console.log('  OK  ' + titre);
  else { ko++; console.log('  KO  ' + titre + (detail ? '  -> ' + detail : '')); }
}

console.log('\n-- rien qui ressemble à une adresse n’est publié --');
// On cherche la FORME, pas une adresse en particulier : celle d'aujourd'hui
// n'est pas celle qu'on écrirait par accident demain.
const adresses = (SRC.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
  // Une adresse citée dans un commentaire d'explication n'est pas publiée
  // au sens utile ; mais ici on n'en veut aucune, pour ne pas avoir à juger.
  .filter((a) => !a.endsWith('.png') && !a.endsWith('.svg'));
V('aucune adresse e-mail dans le fichier servi', adresses.length === 0, adresses.join(', '));

console.log('\n-- la connexion demande l’adresse une fois, puis la retient --');
V('un champ e-mail existe', /id="login-mail"/.test(SRC));
V('... caché par défaut', /id="login-mail"[^>]*display:\s*none/.test(SRC),
  'il ne doit apparaître que lorsqu’on ne connaît pas encore l’adresse');
V('l’adresse est lue depuis le navigateur', /function mailRetenu\(\)/.test(SRC));
V('... et retenue après une connexion RÉUSSIE', /retenirMail\(_mail\)/.test(SRC),
  'sans ça, elle serait redemandée à chaque ouverture');
V('la connexion utilise cette adresse, pas une constante',
  /signInWithPassword\(\{\s*email:\s*_mail/.test(SRC),
  'la constante SUPA_EMAIL ne doit plus exister');
V('SUPA_EMAIL a disparu du code', !/const SUPA_EMAIL\s*=/.test(SRC));

console.log('\n-- on DIT pourquoi, au lieu de laisser deviner --');
V('le message explique la première connexion',
  /Première connexion sur cet appareil/.test(SRC),
  'un champ qui apparaît sans explication passe pour une panne');

console.log('\n-- la clé « anon », elle, reste (et c’est normal) --');
// Elle est faite pour être publique : la retirer donnerait l'illusion d'avoir
// corrigé quelque chose. Ce qui protège, c'est le mot de passe et les règles
// de ligne côté Supabase.
V('la clé anon est toujours là', /SUPABASE_ANON/.test(SRC),
  'la retirer serait du théâtre, pas une correction');

console.log('\n-- le contrôle sait échouer --');
{
  const avant = "const SUPA_EMAIL = 'quelquun@exemple.com';";
  V('la forme d’avant serait attrapée',
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(avant),
    'si ce n’est plus vrai, ce test ne mesure plus ce qu’il surveille');
}

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
