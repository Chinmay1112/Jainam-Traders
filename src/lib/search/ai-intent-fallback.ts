// ==============================================================================
// JAINAM TRADERS — OPTIONAL AI INTENT FALLBACK (GEMINI)
// Purely optional helper to extract structured search intent from unusually complex queries.
// NEVER invents products, stock, prices, or categories.
// NEVER receives customer PII or entire database catalogs.
// Defaults gracefully to deterministic search if Gemini is unavailable or unconfigured.
// ==============================================================================

export interface StructuredAiIntent {
  keywords: string[];
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  occasion?: string;
}

/**
 * Optional AI intent extractor.
 * Only called if query is complex (>3 words) AND deterministic search yielded 0 results.
 * Strictly bounded by a 1-second timeout.
 */
export async function parseQueryIntentWithAi(
  rawQuery: string
): Promise<StructuredAiIntent | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !rawQuery || rawQuery.trim().length < 8) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const prompt = `You are a query parser for an Indian local retail shop called Jainam Traders.
Extract structured search intent as JSON from the customer's shopping query: "${rawQuery.slice(0, 100)}".
Only return valid JSON in this exact format:
{
  "keywords": ["search", "keywords"],
  "category": "category-slug-or-null",
  "minPrice": null,
  "maxPrice": null,
  "occasion": null
}
Available categories: "clocks", "photo-frames", "watches", "gifts-mementos", "toys-games", "belts-purses", "perfumes", "stationery", "decorative".
Do not invent products or prices. Return only valid JSON.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText) as StructuredAiIntent;
    return parsed;
  } catch {
    // Fail gracefully: deterministic search remains primary
    return null;
  }
}
