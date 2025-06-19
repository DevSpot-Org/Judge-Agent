import type { LLMProvider } from ".";

// Enhanced ChunkService with generic chunking capabilities
class EnhancedChunkService {
    private readonly TOKEN_CHAR_RATIO = 4; // Approximate: 1 token = 4 characters
    private readonly DEFAULT_MAX_TOKENS = 25000;

    estimateTokens = (text: string): number => {
        return Math.ceil(text.length / this.TOKEN_CHAR_RATIO);
    };

    // Generic text chunking for any content type
    chunkText = (text: string, maxTokens: number): string[] => {
        const chunks: string[] = [];
        const totalTokens = this.estimateTokens(text);

        // If text fits within limit, return as single chunk
        if (totalTokens <= maxTokens) {
            return [text];
        }

        const maxCharsPerChunk = maxTokens * this.TOKEN_CHAR_RATIO;
        let currentPosition = 0;

        while (currentPosition < text.length) {
            let chunkEnd = currentPosition + maxCharsPerChunk;

            // If we're not at the end, try to find good break points
            if (chunkEnd < text.length) {
                chunkEnd = this.findOptimalBreakPoint(text, currentPosition, chunkEnd);
            }

            const chunk = text.substring(currentPosition, Math.min(chunkEnd, text.length));
            chunks.push(chunk);
            currentPosition = chunkEnd;
        }

        return chunks;
    };

    // Find optimal break points to avoid cutting mid-sentence or mid-code block
    private findOptimalBreakPoint = (text: string, start: number, maxEnd: number): number => {
        // Look for natural break points in order of preference
        const breakPoints = [
            '\n\n', // Paragraph breaks
            '\n', // Line breaks
            '. ', // Sentence endings
            ', ', // Comma breaks
            ' ', // Word boundaries
        ];

        for (const breakPoint of breakPoints) {
            const lastIndex = text.lastIndexOf(breakPoint, maxEnd);
            if (lastIndex > start + (maxEnd - start) * 0.7) {
                // At least 70% of the chunk
                return lastIndex + breakPoint.length;
            }
        }

        return maxEnd; // Fallback to hard cut
    };

    // Specialized chunking for XML/structured content (preserving existing logic)
    chunkStructuredContent = (content: string, maxTokens: number): string[] => {
        const chunks: string[] = [];
        const totalTokens = this.estimateTokens(content);

        if (totalTokens <= maxTokens) {
            return [content];
        }

        const maxCharsPerChunk = maxTokens * this.TOKEN_CHAR_RATIO;
        let currentPosition = 0;

        while (currentPosition < content.length) {
            let chunkEnd = currentPosition + maxCharsPerChunk;

            if (chunkEnd < content.length) {
                // Look for XML tags or structured breaks
                const fileEndIndex = content.lastIndexOf('</file>', chunkEnd);
                const sectionEndIndex = content.lastIndexOf('</section>', chunkEnd);
                const divEndIndex = content.lastIndexOf('</div>', chunkEnd);

                const structuredBreaks = [fileEndIndex, sectionEndIndex, divEndIndex].filter(index => index > currentPosition).sort((a, b) => b - a);

                if (structuredBreaks.length > 0) {
                    const tagEnd = content.indexOf('>', structuredBreaks[0]) + 1;
                    chunkEnd = tagEnd > structuredBreaks[0] ? tagEnd : structuredBreaks[0];
                }
            }

            const chunk = content.substring(currentPosition, Math.min(chunkEnd, content.length));
            chunks.push(chunk);
            currentPosition = chunkEnd;
        }

        return chunks;
    };
}

// Enhanced LLM Requester with integrated chunking
interface ChunkingOptions {
    maxTokens?: number;
    useStructuredChunking?: boolean;
    chunkMergeStrategy?: 'concatenate' | 'summarize' | 'custom';
    customMerger?: (responses: string[]) => string;
}

interface ChunkedLLMRequest {
    provider: LLMProvider;
    prompt: string;
    model?: string;
    chunkingOptions?: ChunkingOptions;
}

class EnhancedLLMRequester {
    private chunkService: EnhancedChunkService;
    private llmQueues: any; // Replace with actual type
    private queueEventsMap: any; // Replace with actual type

    constructor(llmQueues: any, queueEventsMap: any) {
        this.chunkService = new EnhancedChunkService();
        this.llmQueues = llmQueues;
        this.queueEventsMap = queueEventsMap;
    }

    // Original requestLLM method for backward compatibility
    async requestLLM(provider: LLMProvider, prompt: string, model?: string): Promise<string> {
        return this.executeRequest(provider, prompt, model);
    }

    // Enhanced method with chunking support
    async requestLLMWithChunking({ provider, prompt, model, chunkingOptions = {} }: ChunkedLLMRequest): Promise<string> {
        const { maxTokens = 25000, useStructuredChunking = false, chunkMergeStrategy = 'concatenate', customMerger } = chunkingOptions;

        const estimatedTokens = this.chunkService.estimateTokens(prompt);

        // If prompt fits within limits, use standard processing
        if (estimatedTokens <= maxTokens) {
            console.log(`📊 Prompt tokens: ${estimatedTokens.toLocaleString()} - Using single request`);
            return this.executeRequest(provider, prompt, model);
        }

        console.log(`📊 Prompt tokens: ${estimatedTokens.toLocaleString()} - Using chunked processing`);
        return this.processChunkedRequest(provider, prompt, model, maxTokens, useStructuredChunking, chunkMergeStrategy, customMerger);
    }

    // Process chunked requests
    private async processChunkedRequest(
        provider: LLMProvider,
        prompt: string,
        model: string | undefined,
        maxTokens: number,
        useStructuredChunking: boolean,
        mergeStrategy: string,
        customMerger?: (responses: string[]) => string
    ): Promise<string> {
        // Choose chunking method
        const chunks = useStructuredChunking ? this.chunkService.chunkStructuredContent(prompt, maxTokens) : this.chunkService.chunkText(prompt, maxTokens);

        console.log(`📄 Split into ${chunks.length} chunks`);

        const responses: string[] = [];

        // Process chunks sequentially to respect rate limits
        for (let i = 0; i < chunks.length; i++) {
            try {
                console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}...`);

                // Add chunk context to help LLM understand it's part of a larger request
                const chunkPrompt = this.createChunkPrompt(chunks[i], i + 1, chunks.length);
                const response = await this.executeRequest(provider, chunkPrompt, model);

                responses.push(response);
                console.log(`✅ Completed chunk ${i + 1}/${chunks.length}`);
            } catch (error) {
                console.error(`❌ Failed to process chunk ${i + 1}:`, error);
                // Continue with other chunks rather than failing completely
                responses.push(`[Error processing chunk ${i + 1}]`);
            }
        }

        // Merge responses based on strategy
        return this.mergeResponses(responses, mergeStrategy, customMerger);
    }

    // Create contextual prompt for chunks
    private createChunkPrompt(chunk: string, chunkIndex: number, totalChunks: number): string {
        if (totalChunks === 1) {
            return chunk;
        }

        return `
<chunk_context>
This is chunk ${chunkIndex} of ${totalChunks} from a larger request.
${chunkIndex === 1 ? 'This is the first chunk.' : ''}
${chunkIndex === totalChunks ? 'This is the final chunk. Please provide a comprehensive response that considers the entire context.' : ''}
</chunk_context>

${chunk}

${
    totalChunks > 1
        ? `
<processing_note>
Please analyze this chunk in the context of being part of a larger document. Focus on extracting relevant information and insights from this portion.
</processing_note>
`
        : ''
}
`;
    }

    // Merge chunk responses based on strategy
    private mergeResponses(responses: string[], strategy: string, customMerger?: (responses: string[]) => string): string {
        switch (strategy) {
            case 'custom':
                if (customMerger) {
                    return customMerger(responses);
                }
            // Fall through to concatenate if no custom merger provided
            case 'concatenate':
                return responses.join('\n\n---\n\n');
            case 'summarize':
                // For summarize strategy, you might want to send the concatenated responses
                // to the LLM again for summarization, but that would require another API call
                return `Summary of ${responses.length} chunks:\n\n${responses.join('\n\n')}`;
            default:
                return responses.join('\n\n');
        }
    }

    // Core request execution
    private async executeRequest(provider: LLMProvider, prompt: string, model?: string): Promise<string> {
        const queue = this.llmQueues[provider];
        const queueEvents = this.queueEventsMap[provider];

        const job = await queue.add(
            'llm-task',
            { provider, prompt, model },
            {
                attempts: 1,
                removeOnComplete: true,
                removeOnFail: true,
            }
        );

        const result = await job.waitUntilFinished(queueEvents);
        return result;
    }

    // Utility method to estimate if chunking is needed
    estimateTokens(text: string): number {
        return this.chunkService.estimateTokens(text);
    }

    // Utility method to check if chunking would be beneficial
    shouldUseChunking(text: string, maxTokens: number = 25000): boolean {
        return this.estimateTokens(text) > maxTokens;
    }
}

// Export enhanced service
export default EnhancedLLMRequester;

// Export convenience functions for easy integration
export const createEnhancedLLMRequester = (llmQueues: any, queueEventsMap: any) => {
    return new EnhancedLLMRequester(llmQueues, queueEventsMap);
};

// Backward compatibility export
export const requestLLM = async (requester: EnhancedLLMRequester, provider: LLMProvider, prompt: string, model?: string): Promise<string> => {
    return requester.requestLLM(provider, prompt, model);
};

// Enhanced request with chunking
export const requestLLMWithChunking = async (requester: EnhancedLLMRequester, request: ChunkedLLMRequest): Promise<string> => {
    return requester.requestLLMWithChunking(request);
};

// Example usage types for reference
export interface ExampleUsage {
    // Basic usage (unchanged)
    basicUsage: () => Promise<string>;

    // With chunking for long prompts
    chunkingUsage: () => Promise<string>;

    // With custom merge strategy
    customMergeUsage: () => Promise<string>;
}

/* 
USAGE EXAMPLES:

// 1. Initialize the enhanced requester
const enhancedRequester = new EnhancedLLMRequester(llmQueues, queueEventsMap);

// 2. Basic usage (backward compatible)
const result1 = await enhancedRequester.requestLLM('groq', 'short prompt');

// 3. Automatic chunking for long prompts
const result2 = await enhancedRequester.requestLLMWithChunking({
  provider: 'groq',
  prompt: veryLongPrompt,
  model: 'llama-3.1-70b',
  chunkingOptions: {
    maxTokens: 20000,
    useStructuredChunking: true,
    chunkMergeStrategy: 'concatenate'
  }
});

// 4. Custom merge strategy
const result3 = await enhancedRequester.requestLLMWithChunking({
  provider: 'groq',
  prompt: longAnalysisPrompt,
  chunkingOptions: {
    chunkMergeStrategy: 'custom',
    customMerger: (responses) => {
      // Custom logic to merge responses
      return responses.map((r, i) => `Section ${i + 1}: ${r}`).join('\n\n');
    }
  }
});
*/
