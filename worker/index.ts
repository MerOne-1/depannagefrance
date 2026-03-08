/**
 * Cloudflare Worker — route les sous-domaines ET les chemins legacy vers les bonnes pages
 *
 * SOUS-DOMAINES (nouveau) :
 * debouchage-lille.depannagefrance.com     → /debouchage/59/lille/index.html
 * fuite-eau-annemasse.depannagefrance.com  → /fuite-eau/74/annemasse/index.html
 *
 * CHEMINS LEGACY (Google Ads existants) :
 * www.depannagefrance.com/plomberie        → /debouchage/59/lille/index.html
 * depannagefrance.com/plomberie            → /debouchage/59/lille/index.html
 */

import routes from './routes.json'

const PAGES_ORIGIN = 'https://depannagefrance.pages.dev'

// Redirections des anciennes URLs Google Ads → nouvelles pages
// Ajouter ici toutes les URLs de campagnes existantes
const LEGACY_PATHS: Record<string, string> = {
  '/plomberie': '/debouchage/59/lille/index.html',
  // Ajouter d'autres chemins legacy au fur et à mesure
  // '/plomberie-annemasse': '/debouchage/74/annemasse/index.html',
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const host = url.hostname
    const path = url.pathname

    // Extraire le sous-domaine
    const subdomain = host.replace('.depannagefrance.com', '').replace('depannagefrance.com', '')

    // Root ou www → vérifier les chemins legacy d'abord
    if (!subdomain || subdomain === 'www') {
      const legacyRoute = LEGACY_PATHS[path]
      if (legacyRoute) {
        const response = await fetch(`${PAGES_ORIGIN}${legacyRoute}`)
        return new Response(response.body, {
          status: response.status,
          headers: {
            ...Object.fromEntries(response.headers),
            'Cache-Control': 'public, max-age=3600',
          },
        })
      }
      // Sinon page d'accueil
      return fetch(`${PAGES_ORIGIN}/index.html`)
    }

    // Chercher la route par sous-domaine
    const route = (routes as Record<string, string>)[subdomain]
    if (!route) {
      return new Response('Page non trouvée', { status: 404 })
    }

    // Fetcher la page depuis Cloudflare Pages
    const response = await fetch(`${PAGES_ORIGIN}${route}`)

    return new Response(response.body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  },
}
