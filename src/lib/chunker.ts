/**
 * Split text into overlapping word-count chunks for RAG indexing.
 *
 * @param text      - Raw text to split
 * @param chunkSize - Target chunk size in words (default 600)
 * @param overlap   - Words to repeat at the start of the next chunk (default 80)
 * @returns Array of non-empty chunk strings
 */

export function chunkText(
  text: string,
  chunkSize = 600,
  overlap = 80
): string[] {
  // Tokenise on whitespace, drop empty tokens
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);

    // Try to snap the break point to a sentence boundary.
    // Search backward through the last 20 % of the window for a word
    // that ends with a sentence-terminating punctuation mark.
    let breakAt = end;
    if (breakAt < words.length) {
      const searchFrom = Math.max(start, end - Math.floor(chunkSize * 0.2));
      for (let i = end - 1; i >= searchFrom; i--) {
        if (/[.!?]["']?$/.test(words[i])) {
          breakAt = i + 1; // include the sentence-ending word
          break;
        }
      }
    }

    const chunk = words.slice(start, breakAt).join(" ").trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Advance the window, keeping `overlap` words from the previous chunk
    const nextStart = breakAt - overlap;
    // Safety guard: always move forward to prevent an infinite loop
    start = nextStart > start ? nextStart : breakAt;
  }

  return chunks;
}
