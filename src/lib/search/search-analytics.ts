// ==============================================================================
// JAINAM TRADERS — ANONYMOUS SEARCH ANALYTICS ENGINE
// Aggregates popular search queries and zero-result searches.
// STRICT PRIVACY: NEVER records customer IDs, IPs, names, emails, or personal data.
// ==============================================================================

export interface SearchQueryStat {
  query: string;
  count: number;
  lastSearchedAt: string;
  resultCount: number;
}

export interface SearchAnalyticsSummary {
  totalSearches: number;
  popularSearches: SearchQueryStat[];
  zeroResultSearches: SearchQueryStat[];
}

class SearchAnalyticsStore {
  private queryStats: Map<string, SearchQueryStat> = new Map();
  private totalSearchCount = 0;

  constructor() {
    // Seed sample initial anonymous trends
    this.record('wall clock', 4);
    this.record('photo frame', 5);
    this.record('gift for birthday', 3);
    this.record('brass ganesha', 2);
    this.record('dewar ghadi', 0);
  }

  public record(rawQuery: string, resultCount: number): void {
    const clean = rawQuery.toLowerCase().trim();
    if (!clean || clean.length < 2) return;

    this.totalSearchCount++;
    const existing = this.queryStats.get(clean);

    if (existing) {
      existing.count += 1;
      existing.resultCount = resultCount;
      existing.lastSearchedAt = new Date().toISOString();
    } else {
      this.queryStats.set(clean, {
        query: clean,
        count: 1,
        lastSearchedAt: new Date().toISOString(),
        resultCount,
      });
    }
  }

  public getSummary(): SearchAnalyticsSummary {
    const all = Array.from(this.queryStats.values());

    const popular = [...all]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const zeroResult = all
      .filter((s) => s.resultCount === 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSearches: this.totalSearchCount,
      popularSearches: popular,
      zeroResultSearches: zeroResult,
    };
  }

  public reset(): void {
    this.queryStats.clear();
    this.totalSearchCount = 0;
  }
}

export const searchAnalytics = new SearchAnalyticsStore();
