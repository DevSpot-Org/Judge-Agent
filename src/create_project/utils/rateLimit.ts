import { setTimeout } from 'timers/promises';

class RateLimitHandler {
    private lastRequestTime = 0;
    private minDelay = 2000; // Minimum 2 seconds between requests

    // Extract retry delay from error message
    private extractRetryDelay(errorMessage: string): number {
        const match = errorMessage.match(/try again in (\d+(?:\.\d+)?)s/);
        if (match) {
            return Math.ceil(parseFloat(match[1]) * 1000);
        }
        return 60000;
    }

    // Check if error is rate limit related
    private isRateLimitError(error: any): boolean {
        return error?.code === 'rate_limit_exceeded' || error?.message?.includes('Rate limit') || error?.status === 429;
    }

    // Exponential backoff with jitter
    private calculateBackoffDelay(attempt: number, baseDelay: number = 1000): number {
        const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), 300000); // Max 5 minutes
        const jitter = Math.random() * 1000; // Add up to 1 second of jitter
        return exponentialDelay + jitter;
    }

    // Retry with exponential backoff
    async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 5, context: string = 'API call'): Promise<T> {
        let lastError: any;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Respect minimum delay between requests
                const timeSinceLastRequest = Date.now() - this.lastRequestTime;
                if (timeSinceLastRequest < this.minDelay) {
                    await setTimeout(this.minDelay - timeSinceLastRequest);
                }

                console.log(`${context} - Attempt ${attempt + 1}/${maxRetries + 1}`);

                const result = await fn();
                this.lastRequestTime = Date.now();
                return result;
            } catch (error: any) {
                lastError = error;
                const errorObj = error?.response?.data?.error ?? error;

                console.error(`${context} - Attempt ${attempt + 1} failed:`, errorObj?.message || errorObj);

                if (!this.isRateLimitError(errorObj)) {
                    throw error;
                }

                if (attempt === maxRetries) {
                    // Last attempt failed
                    break;
                }

                let delay: number;

                if (errorObj.message && errorObj.message.includes('try again in')) {
                    // Use the specific delay from the error message
                    delay = this.extractRetryDelay(errorObj.message);
                    console.log(`Rate limited. Waiting ${delay / 1000} seconds as suggested...`);
                } else {
                    // Use exponential backoff
                    delay = this.calculateBackoffDelay(attempt);
                    console.log(`Rate limited. Using exponential backoff: ${delay / 1000} seconds...`);
                }

                await setTimeout(delay);
            }
        }

        throw new Error(`${context} failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message || lastError}`);
    }
}

export default new RateLimitHandler();
