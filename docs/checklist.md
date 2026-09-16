# Master Application Quality Checklist

This checklist defines mandatory UI/UX features, SEO essentials, and technical performance requirements for the Freelancer Book application.

---

### 1. UI / UX Features

- **Dark mode** — System preference + manual toggle. Persist choice in localStorage.
- **Sticky header** — Header stays fixed on scroll. Add slight shadow or background blur when sticky.
- **Mobile menu** — Hamburger → full-screen or slide-in drawer. Close on link click + Escape key.
- **Hover states** — Consistent hover feedback on buttons, links, cards (scale, color, underline).
- **Scroll progress bar** — Thin top bar that fills as user scrolls the page.
- **Back-to-top button** — Appears after scrolling ~400–600px. Smooth scroll to top.
- **Loading states** — Skeletons or spinners for data fetching (never blank screens).
- **Search** — Site-wide search (or at least searchable FAQ/blog). Debounce input.
- **Skip-to-content** — Hidden link that becomes visible on focus (accessibility).
- **Floating contact button** — Fixed bottom-right (or left) button that opens contact form / WhatsApp / email.
- **FAQ section** — Accordion style. Good for SEO + reducing support load.
- **Newsletter signup** — Simple form + success/error states. GDPR-friendly consent text.
- **Password toggle** — Show/hide eye icon on password fields.
- **Cookie banner** — Consent banner with Accept / Reject / Manage options.
- **Confirmation modals** — For destructive actions (delete, logout, etc.).
- **Real 404 page** — Custom, branded, with search + popular links.
- **Print stylesheet** — Clean print styles (hide nav, ads, buttons).
- **UTM tracking** — Capture UTM parameters and store them (for analytics).
- **Copy-to-clipboard** — One-click copy for codes, links, referral codes.
- **Last updated dates** — Show “Last updated: DD MMM YYYY” on content pages.

---

### 2. SEO Essentials

- ❌ **noindex tags** — Only use when you deliberately want a page hidden from search.
- ✅ **Meta titles** — Unique, under ~60 characters, include primary keyword.
- ✅ **Meta descriptions** — Unique, 150–160 characters, compelling.
- ✅ **Alt text on images** — Descriptive, not keyword-stuffed.
- ✅ **Core Web Vitals** — Focus on LCP, CLS, INP. Aim for “Good” in Search Console.
- ✅ **Sitemap.xml** — Auto-generate and submit to Google Search Console.
- ✅ **og:image** — Open Graph image (1200×630 recommended) for social sharing.
- ❌ **Broken links** — Regularly check and fix (use tools or scripts).
- ✅ **Header hierarchy** — Proper H1 → H2 → H3 structure. Never skip levels.
- ✅ **Backlink strategy** — Guest posts, partnerships, directories, content that earns links.
- ✅ **Clean URL slugs** — Short, readable, keyword-rich, no dates or IDs if possible.
- ✅ **Internal links** — Link related pages (helps SEO + user navigation).
- ✅ **Canonical tags** — Prevent duplicate content issues.
- ✅ **Enforce HTTPS** — Redirect all HTTP → HTTPS + HSTS if possible.
- ✅ **Compress images** — WebP/AVIF + proper sizing.
- ✅ **Schema markup** — Organization, FAQ, Article, Product, etc. (JSON-LD preferred).
- ✅ **Verify Search Console** — Confirm ownership and monitor indexing/performance.
- ✅ **Only 1 H1 per page** — Strict rule.
- ✅ **robots.txt** — Allow important pages, block admin/private areas.

---

### 3. Performance & Technical

- ✅ **Cache API responses** — Browser + server-side caching where appropriate.
- ✅ **Load balancer** — For high traffic / multiple servers.
- ✅ **Index the database** — Proper indexes on frequently queried columns.
- ✅ **Compress images** — Already listed above, but critical.
- ✅ **Loading skeletons** — Better perceived performance.
- ✅ **Cache expensive queries** — Redis / in-memory cache for heavy DB calls.
- ❌ **N+1 database queries** — Detect and fix (use eager loading / joins).
- ✅ **Debounce input handlers** — Search, filters, auto-save.
- ✅ **Code splitting** — Split JS into chunks (route-based or component-based).
- ✅ **CDN** — Serve static assets from a CDN.
- ✅ **Server-side caching** — Full page or fragment caching where possible.
- ✅ **Paginate large lists** — Never load 1000+ items at once.
- ✅ **Lighthouse audit** — Regularly run and fix Performance, Accessibility, Best Practices, SEO.
- ✅ **Compress API payloads** — Gzip / Brotli + remove unnecessary fields.
- ❌ **Unnecessary re-renders** — Fix with memo, useCallback, useMemo (or equivalent).
- ✅ **Minify JS & CSS** — Production builds only.
- ✅ **Lazy loading** — Images, components, routes.
- ✅ **Defer non-critical scripts** — Analytics, chat widgets, etc.
- 开启 **Unused dependencies** — Audit and remove (bundle size killers).
- ✅ **Database connection pooling** — Essential for production.
