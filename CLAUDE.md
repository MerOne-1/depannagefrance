# Depannagefrance — Landing Pages

## Architecture

Generateur de landing pages statiques par sous-domaine, deployees sur Cloudflare Pages + routees via un Cloudflare Worker.

```
data/trades.json        — definition des metiers (slug, template, meta, avis)
data/regions.json       — regions, departements, secteurs, villes, numeros
templates/*.html        — templates HTML par metier (base.html, ballon-eau-chaude.html, etc.)
scripts/generate.ts     — generateur statique → dist/
worker/index.ts         — Cloudflare Worker routeur sous-domaine → page statique
worker/routes.json      — table de routage generee (sous-domaine → chemin dans dist/)
worker/wrangler.toml    — config du Worker
dist/                   — sortie generee (gitignored)
```

## Flux de generation

`scripts/generate.ts` :
1. Lit `data/regions.json` et `data/trades.json`
2. Pour chaque region × metier × secteur, genere une page HTML dans `dist/{trade}/{dept}/{sector}/index.html`
3. Ecrit `worker/routes.json` : mapping `{subdomain} → /path/index.html`
4. Copie les assets (logos, images, pages legales) dans `dist/`

Sous-domaine = `{trade.slug}-{sector.slug}` → ex: `ballon-lille`, `debouchage-annemasse`

## Deploiement — 3 etapes obligatoires

### 1. Generer les pages
```bash
npx tsx scripts/generate.ts
```
Regenere tout `dist/` et `worker/routes.json`.

### 2. Deployer les pages statiques (Cloudflare Pages)
```bash
CLOUDFLARE_API_TOKEN=$(grep "^CLOUDFLARE_DEPANNAGEFRANCE_API_TOKEN=" ../depannage-platform/.env | cut -d= -f2) \
  npx wrangler pages deploy dist --project-name=depannagefrance --commit-dirty=true
```
Upload les fichiers HTML/assets sur Cloudflare Pages (`depannagefrance.pages.dev`).

### 3. Deployer le Worker (routeur sous-domaines)
```bash
cd worker && \
CLOUDFLARE_API_TOKEN=$(grep "^CLOUDFLARE_DEPANNAGEFRANCE_API_TOKEN=" ../../depannage-platform/.env | cut -d= -f2) \
  npx wrangler deploy
```
Le Worker embarque `routes.json` au build time. Il **doit** etre redeploye apres toute modification de routes.

### Ordre important

**Toujours deployer Pages AVANT le Worker.** Si le Worker est deploye en premier, il va fetch des pages qui n'existent pas encore sur Pages, Cloudflare cache le 404, et les pages restent inaccessibles meme apres le deploy Pages. Dans ce cas il faut redeployer le Worker pour invalider le cache.

## Comment fonctionne le Worker

`worker/index.ts` intercepte toutes les requetes `*.depannagefrance.com/*` :

1. Extrait le sous-domaine (`ballon-lille` de `ballon-lille.depannagefrance.com`)
2. `www` / domaine nu → passthrough (site principal sur IONOS)
3. `/robots.txt` → reponse inline
4. Pages legales (`/conditions-generales-utilisation.html`, etc.) → proxy vers Pages
5. Assets statiques (tout sauf `/` et `/index.html`) → proxy vers Pages
6. Route principale (`/`) → lookup dans `routes.json`, fetch la page depuis `depannagefrance.pages.dev`
7. Si sous-domaine pas dans `routes.json` → 404

Le Worker ne sert aucun fichier lui-meme — il proxy tout vers Cloudflare Pages.

## Ajouter un nouveau metier

1. Creer le template HTML dans `templates/` (ou reutiliser `base.html`)
2. Ajouter l'entree dans `data/trades.json` (slug, template, title, metaDescription, reviews)
3. Ajouter le slug du metier dans `trades[]` des regions concernees dans `data/regions.json`
4. Ajouter le numero dans `TRADE_PHONES` et la valeur conversion dans `TRADE_VALUES` de `generate.ts`
5. Si le template utilise des images, les ajouter dans `templates/` et copier dans `dist/` via `generate.ts`
6. Generer + deployer Pages + deployer Worker (les 3 etapes)
7. Les DNS sont geres par le wildcard `*.depannagefrance.com` — pas besoin d'ajouter des records DNS

## Ajouter une ville/secteur

1. Ajouter le secteur dans la region concernee dans `data/regions.json`
2. Generer + deployer Pages + deployer Worker

## Credentials

- Token Cloudflare Pages/Worker : `CLOUDFLARE_DEPANNAGEFRANCE_API_TOKEN` dans `../depannage-platform/.env`
- Zone ID : `CLOUDFLARE_DEPANNAGEFRANCE_ZONE_ID` dans `../depannage-platform/.env`
- Projet Pages : `depannagefrance`
- Worker : `depannagefrance-router`
- Route Worker : `*.depannagefrance.com/*` (zone `depannagefrance.com`)

## Tracking

- **Google Ads** : conversion click-to-call (gtag + beacon vers standardiste API)
- **PostHog** : analytics, heatmaps, session recording (charge en differe apres interaction ou 5s)
