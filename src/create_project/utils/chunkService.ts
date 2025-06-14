class ChunkService {
  estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
  };

  chunkStrings = (text: string, maxTokens: number): string[] => {
    const chunks: string[] = [];
    const tokens = this.estimateTokens(text);

    // If text is too large, truncate it
    if (tokens > maxTokens) {
      const truncatedText =
        text.substring(0, maxTokens * 4 * 0.8) + "\n... [truncated]";
      chunks.push(truncatedText);
      return chunks;
    }

    // If text fits within limit, return as single chunk
    chunks.push(text);
    return chunks;
  };

  chunkString = (codebaseXml: string, maxTokens: number): string[] => {
    const chunks: string[] = [];
    const totalTokens = this.estimateTokens(codebaseXml);

    // If the entire codebase fits, return as single chunk
    if (totalTokens <= maxTokens) {
      return [codebaseXml];
    }

    // Simple chunking by character count (approximate token limit)
    const maxCharsPerChunk = maxTokens * 4; // Rough approximation: 1 token = 4 chars
    let currentPosition = 0;

    while (currentPosition < codebaseXml.length) {
      let chunkEnd = currentPosition + maxCharsPerChunk;

      // If we're not at the end of the string, try to find a good break point
      if (chunkEnd < codebaseXml.length) {
        // Look for </file> tag to break cleanly between files
        const fileEndIndex = codebaseXml.lastIndexOf("</file>", chunkEnd);
        if (fileEndIndex > currentPosition) {
          chunkEnd = fileEndIndex + 7; // Include the </file> tag
        }
      }

      // Extract the chunk
      const chunk = codebaseXml.substring(
        currentPosition,
        Math.min(chunkEnd, codebaseXml.length)
      );
      chunks.push(chunk);

      currentPosition = chunkEnd;
    }

    return chunks;
  };
}


export default new ChunkService()