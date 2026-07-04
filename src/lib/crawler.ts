import { load } from "cheerio";
import robotsParser from "robots-parser";

// Types
export interface CrawledPage {
  url: string;
  title: string;
  cleanText: string;
}

interface QueueItem {
  url: string;
  depth: number;
}


const MAX_PAGES = 25;
const MAX_DEPTH = 2;
const RATE_LIMIT_MS = 500;
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "ChatWithWebsite/1.0";

// File extensions to ignore without fetching
const SKIP_EXTENSIONS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".avif",
  ".mp4", ".mp3", ".wav", ".zip", ".tar", ".gz",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".css", ".js", ".json", ".xml", ".ico",
  ".woff", ".woff2", ".ttf", ".eot",
]);

// Selectors for elements to remove from the page before text extraction.
// removes / covers structural chrome, sidebars, menus, ads, cookie notices, and other noise.
const NOISE_SELECTORS = [
  // Structural tags
  "nav", "footer", "header", "script", "style", "noscript", "iframe",
  // Class and ID patterns matching common noise elements (substring matches)
  '[class*="sidebar"]',   '[id*="sidebar"]',
  '[class*="menu"]',      '[id*="menu"]',
  '[class*="nav"]',       '[id*="nav"]',
  '[class*="cookie"]',    '[id*="cookie"]',
  '[class*="banner"]',    '[id*="banner"]',
  '[class*="popup"]',     '[id*="popup"]',
  '[class*="breadcrumb"]','[id*="breadcrumb"]',
  '[class*="toc"]',       '[id*="toc"]',
  '[class*="widget"]',    '[id*="widget"]',
  '[class*="share"]',     '[id*="share"]',
  '[class*="ad"]',        '[id*="ad"]',
  '[class*="advert"]',    '[id*="advert"]',
].join(", ");

// Selectors tried in priority order to find the main content container.
// The first match is used; falls back to <body> if none exist.
const CONTENT_SELECTORS = [
  "article",
  "main",
  "[role='main']",
  ".content",
  "#content",
  ".post-content",
  ".article-content",
];


function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Normalize a URL to ensure stable comparison and prevent duplicate crawls.
function normalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  let href = u.href;
  // Keep trailing slash only on root (https://example.com/)
  if (href.endsWith("/") && u.pathname !== "/") {
    href = href.slice(0, -1);
  }
  return href;
}

// Check if the URL pathname matches a known non-HTML file extension.
function hasNonHtmlExtension(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase();
  const lastDot = pathname.lastIndexOf(".");
  if (lastDot === -1) return false;
  const ext = pathname.slice(lastDot);
  return SKIP_EXTENSIONS.has(ext);
}

// Helper Functions

/**
 * Fetch robots.txt for the given origin and return a parser instance.
 * Returns null on any error (treat as fully allowed).
 */
async function fetchRobots(origin: string) {
  const robotsUrl = `${origin}/robots.txt`;
  try {
    const res = await fetch(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return robotsParser(robotsUrl, text);
  } catch (err) {
    console.warn("[crawler] Could not fetch robots.txt:", err);
    return null;
  }
}

/**
 * Fetch a single URL and return its HTML text.
 * Returns null when:
 *  - the HTTP status is not 2xx
 *  - Content-Type is not text/html
 *  - the pathname has a non-HTML extension
 *  - the fetch times out or throws
 */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`[crawler] HTTP ${res.status} — skipping: ${url}`);
      return null;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      console.log(`[crawler] Non-HTML content-type (${contentType}) — skipping: ${url}`);
      return null;
    }

    return await res.text();
  } catch (err) {
    console.error(`[crawler] Fetch error for ${url}:`, err);
    return null;
  }
}

/**
 * Given a parsed cheerio document, strip noise and return the page title
 * plus cleaned body text.
 */
function extractContent(
  $: ReturnType<typeof load>
): { title: string; cleanText: string } {
  const title = $("title").first().text().trim()
    || $("h1").first().text().trim()
    || "";

  // Step 1: Strip all boilerplate/noise elements in-place
  $(NOISE_SELECTORS).remove();

  // Step 2: Find the best content container, fall back to <body>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let contentRoot: any = $("body");
  for (const sel of CONTENT_SELECTORS) {
    const candidate = $(sel).first();
    if (candidate.length > 0) {
      contentRoot = candidate;
      break;
    }
  }

  // Step 3: Extract and normalise whitespace
  const cleanText = (contentRoot.text() as string)
    .replace(/\t/g, " ")              // tabs → space
    .replace(/[ ]{2,}/g, " ")         // runs of spaces → single space
    .replace(/(\r?\n){3,}/g, "\n\n")  // 3+ newlines → paragraph break
    .replace(/^[ \t]+|[ \t]+$/gm, "") // trim leading/trailing spaces per line
    .trim();

  return { title, cleanText };
}

/**
 * Extract all same-domain absolute links from a parsed cheerio document.
 * Links are normalised and de-duped within this call.
 */
function extractLinks(
  $: ReturnType<typeof load>,
  pageUrl: string,
  baseDomain: string
): string[] {
  const seen = new Set<string>();
  const links: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;

    try {
      const abs = new URL(href, pageUrl);

      // Ensure protocol is HTTP or HTTPS
      if (abs.protocol !== "http:" && abs.protocol !== "https:") return;

      // Ensure URL stays within the starting domain (no subdomains)
      if (abs.hostname !== baseDomain) return;

      const normalized = normalizeUrl(abs.href);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        links.push(normalized);
      }
    } catch {
      // Malformed href — ignore
    }
  });

  return links;
}

// -------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Crawl `startUrl` breadth-first, staying within its domain.
 *
 * Respects:
 *  - robots.txt (USER_AGENT = ChatWithWebsite/1.0)
 *  - 500 ms delay between requests
 *  - max 25 pages total
 *  - max depth of 2 (start page = depth 0)
 *
 * @returns An array of successfully crawled pages with extracted text.
 */
export async function crawlSite(startUrl: string): Promise<CrawledPage[]> {
  // Validate and normalise the entry point
  const start = normalizeUrl(startUrl);
  const { origin, hostname: baseDomain } = new URL(start);

  console.log(`[crawler] Starting crawl → ${start} (domain: ${baseDomain})`);

  // Initialize robots.txt rules
  const robots = await fetchRobots(origin);
  const isAllowed = (url: string): boolean =>
    robots ? (robots.isAllowed(url, USER_AGENT) ?? true) : true;

  // Initialize BFS queues and visited tracking
  const visited = new Set<string>();
  const queue: QueueItem[] = [{ url: start, depth: 0 }];
  const results: CrawledPage[] = [];

  while (queue.length > 0 && results.length < MAX_PAGES) {
    const { url, depth } = queue.shift()!;

    // De-duplicate
    if (visited.has(url)) continue;
    visited.add(url);

    // Pre-flight checks (cheap, no network)
    if (hasNonHtmlExtension(url)) {
      console.log(`[crawler] Skipping non-HTML extension: ${url}`);
      continue;
    }
    if (!isAllowed(url)) {
      console.log(`[crawler] Blocked by robots.txt: ${url}`);
      continue;
    }

    // Rate limit (skip delay for the very first request)
    if (visited.size > 1) {
      await delay(RATE_LIMIT_MS);
    }

    console.log(`[crawler] Fetching [depth=${depth}] (${results.length + 1}/${MAX_PAGES}): ${url}`);

    const html = await fetchHtml(url);
    if (!html) continue; // fetchHtml already logged the reason

    // Parse the HTML, extract links, and extract main content
    const $ = load(html);
    const links = extractLinks($, url, baseDomain);
    const { title, cleanText } = extractContent($);

    if (cleanText.length > 0) {
      results.push({ url, title, cleanText });
    }

    // Enqueue discovered links only if we can go deeper
    if (depth < MAX_DEPTH) {
      for (const link of links) {
        if (!visited.has(link)) {
          queue.push({ url: link, depth: depth + 1 });
        }
      }
    }
  }

  console.log(`[crawler] Finished — ${results.length} pages collected.`);
  return results;
}
