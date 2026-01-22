import type { ToolInfo, SearchResult } from "@mcp_router/shared";
import type {
  SearchProvider,
  SearchProviderRequest,
} from "./tool-catalog.service";

// BM25 parameters
const BM25_K1 = 1.5; // Term frequency saturation parameter (typically 1.2-2.0)
const BM25_B = 0.75; // Document length normalization parameter (typically 0.75)

// BM25F field weights
const WEIGHT_NAME = 3.0; // Tool name match → high score
const WEIGHT_DESC = 1.5; // Description match → medium score
const WEIGHT_PARAMS = 0.5; // Parameter match → low score

// Stop words for tokenization
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "need",
  "dare",
  "ought",
  "used",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "again",
  "further",
  "then",
  "once",
  "and",
  "but",
  "or",
  "nor",
  "so",
  "yet",
  "both",
  "either",
  "neither",
  "not",
  "only",
  "own",
  "same",
  "than",
  "too",
  "very",
  "just",
  "also",
  "now",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "every",
  "any",
  "some",
  "no",
  "other",
  "such",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
]);

/**
 * Tokenizes text into lowercase terms, filtering out short tokens and stop words.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_.,;:!?()[\]{}'"]+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

/**
 * Extracts parameter descriptions from inputSchema.
 */
function extractParamDescriptions(tool: ToolInfo): string {
  const props = tool.inputSchema?.properties;
  if (!props) {
    return "";
  }
  const descriptions: string[] = [];
  for (const [name, prop] of Object.entries(props)) {
    descriptions.push(name);
    if (prop.description) {
      descriptions.push(prop.description);
    }
  }
  return descriptions.join(" ");
}

/**
 * Represents a tokenized document for BM25F scoring.
 */
type TokenizedDoc = {
  tool: ToolInfo;
  nameTokens: string[];
  descTokens: string[];
  paramTokens: string[];
};

/**
 * Corpus statistics for a specific field.
 */
type FieldStats = {
  documentFrequency: Map<string, number>;
  averageLength: number;
};

/**
 * BM25F search provider implementation.
 * Uses BM25F algorithm with field-specific weights for relevance scoring.
 */
export class BM25SearchProvider implements SearchProvider {
  /**
   * Search for tools matching the query using BM25F algorithm.
   */
  public async search(request: SearchProviderRequest): Promise<SearchResult[]> {
    const { query, tools, maxResults = 20 } = request;

    const queryTokens = tokenize(query.join(" "));
    if (queryTokens.length === 0) {
      return [];
    }

    // Tokenize all documents by field
    const docs: TokenizedDoc[] = tools.map((tool) => ({
      tool,
      nameTokens: tokenize(`${tool.toolName} ${tool.serverName}`),
      descTokens: tokenize(tool.description || ""),
      paramTokens: tokenize(extractParamDescriptions(tool)),
    }));

    // Calculate corpus statistics per field
    const nameStats = this.calculateFieldStats(docs, "nameTokens");
    const descStats = this.calculateFieldStats(docs, "descTokens");
    const paramStats = this.calculateFieldStats(docs, "paramTokens");
    const totalDocuments = docs.length;

    // Score each document using BM25F
    const scoredResults: Array<{
      tool: ToolInfo;
      score: number;
    }> = [];

    for (const doc of docs) {
      const score = this.calculateBM25FScore(
        doc,
        queryTokens,
        nameStats,
        descStats,
        paramStats,
        totalDocuments,
      );

      if (score > 0) {
        scoredResults.push({
          tool: doc.tool,
          score,
        });
      }
    }

    // Sort by score descending
    scoredResults.sort((a, b) => b.score - a.score);

    // Normalize scores to 0-1 range
    const maxScore = scoredResults.length > 0 ? scoredResults[0].score : 1;
    const results: SearchResult[] = scoredResults
      .slice(0, maxResults)
      .map(({ tool, score }) => ({
        toolName: tool.toolName,
        serverId: tool.serverId,
        serverName: tool.serverName,
        projectId: tool.projectId,
        description: tool.description,
        relevance: maxScore > 0 ? score / maxScore : 0,
      }));

    return results;
  }

  /**
   * Calculates corpus statistics for a specific field.
   */
  private calculateFieldStats(
    docs: TokenizedDoc[],
    field: "nameTokens" | "descTokens" | "paramTokens",
  ): FieldStats {
    const documentFrequency = new Map<string, number>();
    let totalLength = 0;

    for (const doc of docs) {
      const tokens = doc[field];
      totalLength += tokens.length;

      // Count document frequency for each unique term
      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
      }
    }

    const averageLength = docs.length > 0 ? totalLength / docs.length : 0;

    return { documentFrequency, averageLength };
  }

  /**
   * Calculates IDF (Inverse Document Frequency) for a term.
   * Uses BM25 IDF formula: log((N - n + 0.5) / (n + 0.5) + 1)
   */
  private calculateIDF(
    term: string,
    documentFrequency: Map<string, number>,
    totalDocuments: number,
  ): number {
    const n = documentFrequency.get(term) || 0;
    const N = totalDocuments;
    return Math.log((N - n + 0.5) / (n + 0.5) + 1);
  }

  /**
   * Calculates BM25 score for a single field.
   */
  private calculateFieldScore(
    tokens: string[],
    queryTokens: string[],
    stats: FieldStats,
    totalDocuments: number,
  ): number {
    if (tokens.length === 0) {
      return 0;
    }

    const termFrequency = new Map<string, number>();
    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
    }

    let score = 0;
    const docLength = tokens.length;

    for (const queryTerm of queryTokens) {
      const tf = termFrequency.get(queryTerm) || 0;
      if (tf === 0) {
        continue;
      }

      const idf = this.calculateIDF(
        queryTerm,
        stats.documentFrequency,
        totalDocuments,
      );
      const lengthNormalization =
        stats.averageLength > 0
          ? 1 - BM25_B + BM25_B * (docLength / stats.averageLength)
          : 1;
      const tfComponent =
        (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * lengthNormalization);

      score += idf * tfComponent;
    }

    return score;
  }

  /**
   * Calculates BM25F score for a document using field-specific weights.
   */
  private calculateBM25FScore(
    doc: TokenizedDoc,
    queryTokens: string[],
    nameStats: FieldStats,
    descStats: FieldStats,
    paramStats: FieldStats,
    totalDocuments: number,
  ): number {
    const nameScore = this.calculateFieldScore(
      doc.nameTokens,
      queryTokens,
      nameStats,
      totalDocuments,
    );
    const descScore = this.calculateFieldScore(
      doc.descTokens,
      queryTokens,
      descStats,
      totalDocuments,
    );
    const paramScore = this.calculateFieldScore(
      doc.paramTokens,
      queryTokens,
      paramStats,
      totalDocuments,
    );

    return (
      WEIGHT_NAME * nameScore +
      WEIGHT_DESC * descScore +
      WEIGHT_PARAMS * paramScore
    );
  }
}
