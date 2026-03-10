/**
 * Cloudflare Worker — route les sous-domaines vers les bonnes pages statiques
 *
 * SOUS-DOMAINES uniquement :
 * debouchage-lille.depannagefrance.com     → /debouchage/59/lille/index.html
 * fuite-eau-annemasse.depannagefrance.com  → /fuite-eau/74/annemasse/index.html
 *
 * Le domaine principal (www / root) reste sur IONOS (ancien site)
 */

import routes from './routes.json'

const PAGES_ORIGIN = 'https://depannagefrance.pages.dev'

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const host = url.hostname

    // Extraire le sous-domaine
    const subdomain = host.replace('.depannagefrance.com', '')

    // www ou root → ne devrait pas arriver ici, mais au cas où
    if (subdomain === 'www' || subdomain === 'depannagefrance.com') {
      return fetch(request)
    }

    // robots.txt — servi directement pour éviter l'injection Cloudflare Content-Signal
    const path = url.pathname
    if (path === '/robots.txt') {
      return new Response('User-agent: *\nAllow: /\n\nSitemap: https://depannagefrance.com/sitemap.xml\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    // Pages légales → servies depuis n'importe quel sous-domaine
    if (path === '/conditions-generales-utilisation.html' || path === '/politique-de-confidentialite.html') {
      const response = await fetch(`${PAGES_ORIGIN}${path}`)
      return new Response(response.body, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers),
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    // Assets statiques → proxy direct vers Pages
    if (path !== '/' && path !== '/index.html') {
      const response = await fetch(`${PAGES_ORIGIN}${path}`)
      return new Response(response.body, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers),
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    // Chercher la route HTML du sous-domaine
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
