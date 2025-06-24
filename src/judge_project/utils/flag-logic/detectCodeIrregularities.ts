import type { CommitAnalysis } from './analyzeCommitHistory';

export interface IrregularityFlag {
    type: 'large_single_commit' | 'suspicious_timing' | 'minimal_history_dump' | 'post_deadline_dump';
    severity: 'low' | 'medium' | 'high';
    description: string;
    commitHash?: string;
    timestamp?: string;
    metadata?: Record<string, any>;
}

const detectIrregularities = (commits: CommitAnalysis[], hackathonEndDate?: Date | string): IrregularityFlag[] => {
    const flags: IrregularityFlag[] = [];
    const codeCommits = commits.filter(c => c.isCodeCommit);

    if (codeCommits.length === 0) {
        return flags;
    }

    // Calculate statistics
    const totalLines = codeCommits.reduce((sum, c) => sum + c.linesAdded, 0);
    const largestCommit = codeCommits.reduce((max, c) => (c.linesAdded > max.linesAdded ? c : max));

    // Flag 1: Large single commit (>80% of total code in one commit)
    if (largestCommit.linesAdded > totalLines * 0.8 && totalLines > 100) {
        flags.push({
            type: 'large_single_commit',
            severity: 'high',
            description: `Single commit contains ${largestCommit.linesAdded} lines (${Math.round((largestCommit.linesAdded / totalLines) * 100)}% of total code)`,
            commitHash: largestCommit.hash,
            timestamp: largestCommit.timestamp,
            metadata: {
                linesAdded: largestCommit.linesAdded,
                percentageOfTotal: Math.round((largestCommit.linesAdded / totalLines) * 100),
                totalProjectLines: totalLines,
            },
        });
    }

    // Flag 2: Minimal commit history followed by code dump
    if (codeCommits.length <= 3 && totalLines > 500) {
        flags.push({
            type: 'minimal_history_dump',
            severity: 'medium',
            description: `Only ${codeCommits.length} commits but ${totalLines} lines of code`,
            metadata: {
                commitCount: codeCommits.length,
                totalLines: totalLines,
                averageLinesPerCommit: Math.round(totalLines / codeCommits.length),
            },
        });
    }

    // Flag 3: Post-deadline large commits
    if (hackathonEndDate) {
        const postDeadlineCommits = codeCommits.filter(c => c.date > hackathonEndDate);
        const postDeadlineLines = postDeadlineCommits.reduce((sum, c) => sum + c.linesAdded, 0);

        if (postDeadlineLines > 200) {
            flags.push({
                type: 'post_deadline_dump',
                severity: 'high',
                description: `${postDeadlineLines} lines of code added after deadline`,
                metadata: {
                    postDeadlineCommits: postDeadlineCommits.length,
                    postDeadlineLines: postDeadlineLines,
                    commits: postDeadlineCommits.map(c => ({
                        hash: c.hash,
                        timestamp: c.timestamp,
                        linesAdded: c.linesAdded,
                    })),
                },
            });
        }
    }

    // Flag 4: Suspicious timing (all commits in very short timespan)
    const firstCodeCommit = codeCommits[0];
    const lastCodeCommit = codeCommits[codeCommits.length - 1];
    const developmentTimeHours = (lastCodeCommit.date.getTime() - firstCodeCommit.date.getTime()) / (1000 * 60 * 60);

    if (developmentTimeHours < 2 && totalLines > 1000 && codeCommits.length > 1) {
        flags.push({
            type: 'suspicious_timing',
            severity: 'medium',
            description: `${totalLines} lines of code committed in ${Math.round(developmentTimeHours * 100) / 100} hours`,
            metadata: {
                developmentTimeHours: Math.round(developmentTimeHours * 100) / 100,
                totalLines: totalLines,
                linesPerHour: Math.round(totalLines / developmentTimeHours),
            },
        });
    }

    return flags;
};

const calculateRiskScore = (flags: IrregularityFlag[]): number => {
    let score = 0;

    for (const flag of flags) {
        switch (flag.severity) {
            case 'high':
                score += 40;
                break;
            case 'medium':
                score += 25;
                break;
            case 'low':
                score += 10;
                break;
        }
    }

    return Math.min(score, 100);
};

const generateIrregularitySummary = (flags: IrregularityFlag[]): string | null => {
    if (flags.length === 0) {
        return null;
    }

    let summary = 'Irregularities detected:\n\n';

    // Enhance descriptions with metadata
    const flagDescriptions = flags.map(flag => {
        let description = flag.description;
        const metadata = flag.metadata ?? {};

        switch (flag.type) {
            case 'large_single_commit':
                description += ` (${metadata['linesAdded']} lines in one commit, ${metadata['percentageOfTotal']}% of total ${metadata['totalProjectLines']} lines)`;
                break;
            case 'minimal_history_dump':
                description += ` (averaging ${metadata['averageLinesPerCommit']} lines per commit)`;
                break;
            case 'post_deadline_dump':
                description += ` across ${metadata['postDeadlineCommits']} commits`;
                break;
            case 'suspicious_timing':
                description += ` (${metadata['linesPerHour']} lines per hour)`;
                break;
        }

        return { ...flag, enhancedDescription: description };
    });

    // Sort by severity and group flags
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const sortedFlags = flagDescriptions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const groupedFlags = {
        '🔴 Critical Issues': sortedFlags.filter(f => f.severity === 'high'),
        '🟡 Moderate Concerns': sortedFlags.filter(f => f.severity === 'medium'),
        '🟢 Minor Issues': sortedFlags.filter(f => f.severity === 'low'),
    };

    // Generate summary with bullet points
    for (const [category, categoryFlags] of Object.entries(groupedFlags)) {
        if (categoryFlags.length > 0) {
            summary += `${category}:\n`;
            categoryFlags.forEach(flag => {
                summary += `• ${flag.enhancedDescription}\n`;
            });
            summary += '\n';
        }
    }

    // Append risk score
    const riskScore = calculateRiskScore(flags);
    summary += `Overall Risk Score: ${riskScore}/100`;

    return summary.trim();
};

export { calculateRiskScore, detectIrregularities, generateIrregularitySummary };
