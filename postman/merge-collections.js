#!/usr/bin/env node
/**
 * Fusionne les collections Postman des 4 membres en une seule.
 *
 *   node merge-collections.js [dossier] [sortie]
 *   (par défaut : ./collections → ./plateforme-analyse.postman_collection.json)
 *
 * Chaque fichier *.postman_collection.json du dossier devient un dossier de
 * premier niveau (sauf s'il ne contient déjà qu'un seul dossier, qui est
 * repris tel quel). Ordre : Auth, Datasets, Analytics, Dashboards, puis le
 * reste par ordre alphabétique — pour que le login (P1) s'exécute en premier.
 *
 * Variables : union des variables de toutes les collections. En cas de
 * conflit de valeur, la première est gardée et un avertissement s'affiche.
 * L'authentification Bearer {{token}} est posée au niveau de la collection ;
 * les requêtes qui définissent leur propre auth (ou noauth) la conservent.
 */
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || path.join(__dirname, 'collections'));
const output = path.resolve(process.argv[3] || path.join(__dirname, 'plateforme-analyse.postman_collection.json'));
const ORDER = ['auth', 'dataset', 'analytic', 'dashboard'];

const rank = (name) => {
  const i = ORDER.findIndex((k) => name.toLowerCase().includes(k));
  return i === -1 ? ORDER.length : i;
};

const files = fs.readdirSync(dir)
  .filter((f) => f.endsWith('.postman_collection.json') && path.resolve(dir, f) !== output)
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

if (!files.length) {
  console.error(`Aucune collection *.postman_collection.json dans ${dir}`);
  process.exit(1);
}

const variables = new Map();
const items = [];
const events = [];

for (const file of files) {
  const col = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const name = col.info?.name || path.basename(file, '.postman_collection.json');

  for (const v of col.variable || []) {
    if (!variables.has(v.key)) variables.set(v.key, { key: v.key, value: v.value ?? '' });
    else if (v.value && variables.get(v.key).value && variables.get(v.key).value !== v.value) {
      console.warn(`⚠ Variable « ${v.key} » : « ${variables.get(v.key).value} » conservée, « ${v.value} » (${name}) ignorée.`);
    }
  }
  // Une auth propre à une collection est recopiée sur son dossier
  const folderAuth = col.auth && !(col.auth.type === 'bearer' && JSON.stringify(col.auth).includes('{{token}}')) ? { auth: col.auth } : {};
  if (col.event?.length) events.push(...col.event.map((e) => ({ ...e, script: { ...e.script, exec: [`// ${name}`, ...(e.script?.exec || [])] } })));

  const isSingleFolder = col.item?.length === 1 && Array.isArray(col.item[0].item);
  items.push(isSingleFolder ? { ...col.item[0], ...folderAuth } : { name, description: col.info?.description, item: col.item || [], ...folderAuth });
  console.log(`+ ${name} (${file})`);
}

const merged = {
  info: {
    name: "Plateforme d'analyse de données",
    description: 'Collection complète de l’API. Exécuter d’abord le dossier Auth (login) pour renseigner {{token}}.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  ...(events.length ? { event: events } : {}),
  variable: [...variables.values()],
  item: items,
};

fs.writeFileSync(output, `${JSON.stringify(merged, null, 2)}\n`);
console.log(`\n${items.length} dossiers, ${variables.size} variables → ${output}`);
