import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const DIST = resolve(ROOT, 'dist')
const TEMPLATES = resolve(ROOT, 'templates')
const DATA = resolve(ROOT, 'data')

// -- Load data --
const regions: Region[] = JSON.parse(readFileSync(resolve(DATA, 'regions.json'), 'utf-8'))
const trades: Trade[] = JSON.parse(readFileSync(resolve(DATA, 'trades.json'), 'utf-8'))
const template = readFileSync(resolve(TEMPLATES, 'base.html'), 'utf-8')

// -- Types --
interface Sector {
  slug: string
  name: string
  label: string
  postal: string
  cities: string[]
}

interface Region {
  department: string
  name: string
  phone: string
  phoneDisplay: string
  trades: string[]
  sectors: Sector[]
}

interface Review {
  text: string
  author: string
  meta: string
}

interface Trade {
  slug: string
  name: string
  template: string
  title: string
  metaDescription: string
  h1Before: string
  h1Accent: string
  h1After: string
  heroSubtitle: string
  heroUrgency: string
  heroTypes: string[]
  secondaryCta: string
  fixedCtaText: string
  reviews: Review[]
  urgenceBannerTitle: string
  urgenceBannerDesc: string
}

// -- PostHog (placeholder — remplacer par la vraie clé) --
const POSTHOG_SCRIPT = `<script>
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('YOUR_POSTHOG_KEY', {api_host: 'https://eu.i.posthog.com'})
  </script>`

// -- Helpers --
const checkSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'

function buildHeroTypes(types: string[]): string {
  return types.map(t => `        <span class="hero-type">\n          ${checkSvg}\n          ${t}\n        </span>`).join('\n')
}

function buildReviews(reviews: Review[], sectorName: string): string {
  return reviews.map(r => `        <div class="review-card fade-in">
          <div class="review-stars">★★★★★</div>
          <p class="review-text">"${r.text}"</p>
          <div class="review-author">${r.author}</div>
          <div class="review-meta">${r.meta} — ${sectorName}</div>
        </div>`).join('\n')
}

function buildZoneSectors(region: Region, currentSector: Sector): string {
  return region.sectors.map(s => {
    const isCurrent = s.slug === currentSector.slug
    const citiesList = s.cities.slice(0, 4).join(', ')
    return `            <div class="zone-sector-card${isCurrent ? ' current' : ''}">
              <div class="zone-sector-icon">📍</div>
              <div>
                <h4>${s.label}</h4>
                <p>${s.name} et environs : ${citiesList}</p>
              </div>
            </div>`
  }).join('\n')
}

function buildZonesTitle(region: Region): string {
  const names = region.sectors.map(s => s.name)
  const last = names.pop()
  if (names.length === 0) return last!
  return names.join(', ') + ' et ' + last
}

// -- Clean dist --
rmSync(DIST, { recursive: true, force: true })

let count = 0
const routes: Record<string, string> = {}

for (const region of regions) {
  for (const trade of trades) {
    if (!region.trades.includes(trade.slug)) continue

    for (const sector of region.sectors) {
      const citiesShort = sector.cities.slice(0, 3).join(', ')

      let html = template
        .replace(/\{\{PAGE_TITLE\}\}/g, trade.title.replace('{{SECTOR_NAME}}', sector.name).replace('{{DEPARTMENT}}', region.department))
        .replace(/\{\{META_DESCRIPTION\}\}/g, trade.metaDescription.replace('{{SECTOR_NAME}}', sector.name).replace('{{CITIES_SHORT}}', citiesShort).replace('{{DEPARTMENT}}', region.department))
        .replace(/\{\{PHONE\}\}/g, region.phone)
        .replace(/\{\{PHONE_DISPLAY\}\}/g, region.phoneDisplay)
        .replace(/\{\{HERO_URGENCY\}\}/g, `${trade.heroUrgency} — Secteur ${sector.name}`)
        .replace(/\{\{H1_BEFORE\}\}/g, trade.h1Before)
        .replace(/\{\{H1_ACCENT\}\}/g, trade.h1Accent)
        .replace(/\{\{H1_AFTER\}\}/g, trade.h1After)
        .replace(/\{\{HERO_SUBTITLE\}\}/g, trade.heroSubtitle)
        .replace(/\{\{HERO_TYPES\}\}/g, buildHeroTypes(trade.heroTypes))
        .replace(/\{\{SECONDARY_CTA\}\}/g, trade.secondaryCta)
        .replace(/\{\{FIXED_CTA_TEXT\}\}/g, trade.fixedCtaText)
        .replace(/\{\{REVIEWS_TITLE\}\}/g, `Avis clients — ${sector.name}`)
        .replace(/\{\{REVIEWS\}\}/g, buildReviews(trade.reviews, sector.name))
        .replace(/\{\{ZONES_TITLE\}\}/g, buildZonesTitle(region))
        .replace(/\{\{ZONE_SECTORS\}\}/g, buildZoneSectors(region, sector))
        .replace(/\{\{URGENCE_BANNER_TITLE\}\}/g, trade.urgenceBannerTitle)
        .replace(/\{\{URGENCE_BANNER_DESC\}\}/g, trade.urgenceBannerDesc)
        .replace(/\{\{POSTHOG_SCRIPT\}\}/g, POSTHOG_SCRIPT)

      const pagePath = `/${trade.slug}/${region.department}/${sector.slug}/index.html`
      const dir = resolve(DIST, trade.slug, region.department, sector.slug)
      mkdirSync(dir, { recursive: true })
      writeFileSync(resolve(dir, 'index.html'), html)

      // Route : sous-domaine → chemin
      // debouchage-lille → /debouchage/59/lille/index.html
      const subdomain = `${trade.slug}-${sector.slug}`
      routes[subdomain] = pagePath

      count++
    }
  }
}

// Écrire la table de routage pour le Worker
writeFileSync(resolve(ROOT, 'worker', 'routes.json'), JSON.stringify(routes, null, 2))

console.log(`✅ ${count} pages générées dans dist/`)
console.log(`✅ ${Object.keys(routes).length} routes générées dans worker/routes.json`)
