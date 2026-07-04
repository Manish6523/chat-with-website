import { NextRequest, NextResponse } from "next/server";
import { crawlSite } from "@/lib/crawler";

export async function POST(request: NextRequest) {
  // Parse and validate request body
  let url: string;
  try {
    const body = await request.json();
    url = body?.url;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: 'Missing required field: "url"' },
      { status: 400 }
    );
  }

  // Validate that the URL is parseable and uses http/https
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http and https URLs are supported");
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid URL: ${String(err)}` },
      { status: 400 }
    );
  }

  // Run the crawl
  try {
    console.log(`[api/crawl] Starting crawl for: ${url}`);
    const pages = await crawlSite(url);

    return NextResponse.json({
      success: true,
      crawledUrl: url,
      count: pages.length,
      pages,
    });
  } catch (err) {
    console.error("[api/crawl] Unexpected error:", err);
    return NextResponse.json(
      { error: "Crawl failed", details: String(err) },
      { status: 500 }
    );
  }
}

// Reject other HTTP methods with a clear message
export async function GET() {
  return NextResponse.json(
    { error: "Use POST with { url: string } in the body" },
    { status: 405 }
  );
}
