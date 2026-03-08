/**
 * Cloudflare Worker — route les sous-domaines vers les bonnes pages statiques
 *
 * debouchage-lille.depannagefrance.com     → /debouchage/59/lille/index.html
 * fuite-eau-annemasse.depannagefrance.com  → /fuite-eau/74/annemasse/index.html
 * www.depannagefrance.com                  → /index.html (accueil)
 * depannagefrance.com                      → /index.html (accueil)
 */

// Table de routage : sous-domaine → chemin dans Pages
// Générée automatiquement par generate.ts
import routes from './routes.json'

const PAGES_ORIGIN = 'https://depannagefrance.pages.dev'

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const host = url.hostname

    // Extraire le sous-domaine
    const subdomain = host.replace('.depannagefrance.com', '').replace('depannagefrance.com', '')

    // Root ou www → page d'accueil
    if (!subdomain || subdomain === 'www') {
      return fetch(`${PAGES_ORIGIN}/index.html`)
    }

    // Chercher la route
    const route = (routes as Record<string, string>)[subdomain]
    if (!route) {
      return new Response('Page non trouvée', { status: 404 })
    }

    // Fetcher la page depuis Cloudflare Pages
    const pageUrl = `${PAGES_ORIGIN}${route}`
    const response = await fetch(pageUrl)

    // Renvoyer avec les bons headers
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  },
}
