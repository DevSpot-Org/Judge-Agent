interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface ChunkResult {
    technologies: string[];
    projectNameHints: string[];
    features: string[];
    potentialChallenges: string[];
    description: string;
}

export type { CacheEntry, ChunkResult };
