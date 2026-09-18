# **Website Checklist – UI, SEO & Performance Notes**

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
- **Optimistic UI** — Don’t block the entire interface while waiting for backend. Update the UI immediately and reconcile later (or show subtle loading only on the affected part).

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
- ❌ **Unused dependencies** — Audit and remove (bundle size killers).
- ✅ **Database connection pooling** — Essential for production.

**Extra performance lessons (from real cases):**

- **Server rebuilding HTML per visitor** — Without caching, the server does the same full render work for every visitor even if the page hasn’t changed. Solution: Add proper page/fragment caching so subsequent visitors get the already-rendered result (can cut rebuilds dramatically, e.g. 4 visitors → 1 render).
- **Single dependency bottleneck** — One slow external call or internal step can eat 80–90% of total latency. Solution: Measure round-trip time of each step, isolate the slowest dependency, and optimize/cache/parallelize it first.
- **DB writes one row at a time** — Writing 1,000 rows individually = 1,000 round trips. At scale this feels like molasses. Solution: Batch inserts/updates (e.g. 1,000 rows in a few round trips).
- **Uncompressed JSON** — Sending large uncompressed responses wastes bandwidth and slows users. Solution: Enable Gzip/Brotli compression (often one config change) — e.g. 247 KB → 31 KB.
- **UI blocked on backend response** — Every action freezes the screen until the server replies. Solution: Use optimistic UI + non-blocking patterns so the interface stays responsive.

---

### 4. Security & Reliability

- ✅ **Force HTTPS** — Redirect all HTTP traffic to HTTPS. Enable HSTS.
- ✅ **Password is hashed** — Never store plain text. Use strong hashing (bcrypt, Argon2, etc.).
- ✅ **Bot protection on forms** — CAPTCHA, honeypot fields, or rate limiting on login/signup/contact forms.
- ✅ **Login session expires** — Sessions should have a reasonable timeout and force re-login after inactivity.
- ✅ **CSRF protection** — Protect all state-changing requests (forms, APIs) with CSRF tokens.
- ✅ **Password reset link expires** — Reset links must expire after a short time (e.g. 15–60 minutes).
- ✅ **Key-limited database** — Restrict database access with proper roles/permissions. Never use root/admin for the app.
- ✅ **Logs do not print credentials or keys** — Never log passwords, API keys, tokens, or secrets.
- ✅ **Billing alerts** — Set up alerts for unexpected spending (cloud bills, payment failures, etc.).
- ✅ **Automated Backup** — Regular automated backups of database + critical files. Test restore process.

### 5. Third-Party Dependency Resilience

- ✅ **Audit all external services** — Payments, APIs, maps, email/SMS, storage, AI, auth providers, analytics, etc.
- ✅ **Handle complete unavailability** — App should not crash when a third-party is down.
- ✅ **Handle timeouts** — Set proper timeouts so requests don’t hang forever.
- ✅ **Handle 4xx / 5xx errors** — Catch and show user-friendly messages instead of breaking.
- ✅ **Handle rate limits** — Detect rate-limiting and back off gracefully.
- ✅ **Handle malformed data** — Validate responses so unexpected formats don’t crash the app.
- ✅ **Handle temporary unreachability** — Retry with exponential backoff when possible.
- ✅ **Handle slow / partial failures** — Don’t let one slow service block the whole experience.
- ✅ **Handle missing env variables** — Fail safely and log clearly when config is missing.
- ✅ **No unhandled exceptions** — External failures should never bring down the app.
- ✅ **UI never stuck forever** — Always show error state or fallback instead of infinite loading.
- ✅ **Requests don’t block the entire app** — Keep other features working when one dependency fails.
- ✅ **Add timeout handling** — Every external call needs a timeout.
- ✅ **Add retry + backoff** — Retry transient failures intelligently.
- ✅ **Add graceful fallbacks** — Show cached data, default values, or degraded mode when possible.
- ✅ **Support offline / degraded mode** — App should still be usable when possible.
- ✅ **Prevent duplicate actions after retry** — Avoid double charges, double emails, etc.
- ✅ **Show clear error messages** — Users should understand what went wrong.
- ✅ **Stop failure cascading** — One service down should not break unrelated features.
- ✅ **Never expose internal errors** — Hide stack traces and sensitive details from users.
- ✅ **Add health checks** — Know the status of critical dependencies.
- ✅ **Recover cleanly** — When the service comes back, the app should resume normally.

### 6. Frontend Performance & UX Polish

- ✅ **Eliminate unnecessary re-renders** — Only update the parts that actually changed. Avoid re-rendering the whole screen on every small update.
- ✅ **Prefetch data based on user intent** — Load data in the background when you can predict what the user will need next (e.g. next page or likely action).
- ✅ **Standardize typography** — Use a consistent font weight and size system across the whole app. No random guessing of weights.
- ✅ **Remove performance-killing animations** — Heavy or poorly optimized animations can delay the largest image from painting. Keep animations light so content appears fast.
- ✅ **Fix mobile horizontal scrolls** — Make sure content fits the screen width. Users should never have to scroll sideways to see everything.
