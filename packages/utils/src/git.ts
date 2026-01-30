'use server';

import { execSync } from 'node:child_process';

/**
 * Git commit information interface
 */
export interface GitCommitInfo {
    message: string;
    hash: string;
    author: string;
    date: string;
}

/**
 * Get the last commit message with date.
 * @returns Formatted string with commit message and date
 * @example getLastCommitMessage() // "feat: add new feature @ Mon Jan 1 12:00:00 2024"
 */
export function getLastCommitMessage(): string {
    try {
        return execSync('git log -1 --pretty=format:"%s @ %ad"', {
            encoding: 'utf8',
        }).trim();
    } catch (error) {
        return 'Git: N/A';
    }
}

/**
 * Check if the current directory is a git repository.
 * @returns True if in a git repository, false otherwise
 */
export function isGitRepository(): boolean {
    try {
        execSync('git rev-parse --git-dir', { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get the current git branch name.
 * @returns Current branch name or 'unknown' if not in a git repository
 */
export function getCurrentBranch(): string {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', {
            encoding: 'utf8',
        }).trim();
    } catch (error) {
        return 'unknown';
    }
}

/**
 * Get the latest commit hash.
 * @param short - Whether to return short hash (7 chars) or full hash
 * @returns Commit hash or 'unknown' if not in a git repository
 */
export function getLatestCommitHash(short: boolean = true): string {
    try {
        const command = short ? 'git rev-parse --short HEAD' : 'git rev-parse HEAD';
        return execSync(command, { encoding: 'utf8' }).trim();
    } catch (error) {
        return 'unknown';
    }
}

/**
 * Get detailed information about the latest commit.
 * @returns GitCommitInfo object with commit details
 */
export function getLatestCommitInfo(): GitCommitInfo {
    try {
        const message = execSync('git log -1 --pretty=format:"%s"', {
            encoding: 'utf8',
        }).trim();
        const hash = execSync('git rev-parse --short HEAD', {
            encoding: 'utf8',
        }).trim();
        const author = execSync('git log -1 --pretty=format:"%an"', {
            encoding: 'utf8',
        }).trim();
        const date = execSync('git log -1 --pretty=format:"%ad"', {
            encoding: 'utf8',
        }).trim();

        return { message, hash, author, date };
    } catch (error) {
        return {
            message: 'N/A',
            hash: 'unknown',
            author: 'unknown',
            date: 'unknown',
        };
    }
}

/**
 * Get the git repository URL (origin remote).
 * @returns Repository URL or null if not available
 */
export function getRepositoryUrl(): string | null {
    try {
        return execSync('git config --get remote.origin.url', {
            encoding: 'utf8',
        }).trim();
    } catch (error) {
        return null;
    }
}

/**
 * Check if there are uncommitted changes in the repository.
 * @returns True if there are uncommitted changes, false otherwise
 */
export function hasUncommittedChanges(): boolean {
    try {
        const status = execSync('git status --porcelain', {
            encoding: 'utf8',
        }).trim();
        return status.length > 0;
    } catch (error) {
        return false;
    }
}

/**
 * Get the number of commits in the current branch.
 * @returns Number of commits or 0 if not in a git repository
 */
export function getCommitCount(): number {
    try {
        const count = execSync('git rev-list --count HEAD', {
            encoding: 'utf8',
        }).trim();
        return parseInt(count, 10);
    } catch (error) {
        return 0;
    }
}
