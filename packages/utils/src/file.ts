import { join } from 'node:path';
import type { MakeDirectoryOptions, PathLike } from 'node:fs';
import { existsSync, mkdirSync as fsMkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';

/**
 * Check whether a file or directory exists on disk.
 */
export function fileExists(filePath: PathLike): boolean {
    return existsSync(filePath);
}

/**
 * Read a file as a string when it exists or return null.
 */
export function readFile(filePath: PathLike, encoding: 'utf8' | 'ascii' | 'base64' | 'hex' = 'utf8'): string | null {
    try {
        return readFileSync(filePath, { encoding });
    } catch (error) {
        console.error(`Cannot read file: ${filePath.toString()}`, error);
        return null;
    }
}

/**
 * Write file content to disk. Logs errors instead of throwing.
 */
export function writeFile(
    filePath: PathLike,
    content: string | Uint8Array,
    encoding: 'utf8' | 'ascii' | 'base64' | 'hex' = 'utf8',
): void {
    try {
        writeFileSync(filePath, content, { encoding });
    } catch (error) {
        console.error(`Cannot write to file: ${filePath.toString()}`, error);
    }
}

/**
 * Create a directory and any missing parent folders.
 */
export function mkdirSync(
    dirPath: PathLike,
    options: MakeDirectoryOptions & { recursive?: boolean } = { recursive: true },
): void {
    try {
        fsMkdirSync(dirPath, options);
    } catch (error) {
        console.error(`Cannot create directory: ${dirPath.toString()}`, error);
    }
}

/**
 * Copy all contents of a directory to another directory recursively.
 * // USAGE: copyDirectoryContents('path/to/source', 'path/to/destination');
 */
export function copyDirectoryContents(src: PathLike, dest: PathLike): void {
    try {
        const entries = readdirSync(src, { withFileTypes: true });

        entries.forEach((entry) => {
            const srcPath = join(src.toString(), entry.name);
            const destPath = join(dest.toString(), entry.name);

            if (entry.isDirectory()) {
                fsMkdirSync(destPath, { recursive: true });
                copyDirectoryContents(srcPath, destPath);
            } else {
                copyFileSync(srcPath, destPath);
            }
        });
    } catch (error) {
        console.error(`Cannot copy directory contents from ${src.toString()} to ${dest.toString()}:`, error);
    }
}

/**
 * Remove the file extension from a file path.
 * @example removeFileExtension("document.pdf") // "document"
 */
export function removeFileExtension(filePath: string): string {
    if (!filePath) return '';

    const lastDotIndex = filePath.lastIndexOf('.');
    const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));

    // Only remove extension if the dot is after the last slash (not part of directory name)
    if (lastDotIndex > lastSlashIndex && lastDotIndex > 0) {
        return filePath.substring(0, lastDotIndex);
    }

    return filePath;
}

/**
 * Get the file extension from a file path.
 * @example getFileExtension("document.pdf") // "pdf"
 */
export function getFileExtension(filePath: string): string {
    if (!filePath) return '';

    const lastDotIndex = filePath.lastIndexOf('.');
    const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));

    // Only get extension if the dot is after the last slash
    if (lastDotIndex > lastSlashIndex && lastDotIndex > 0) {
        return filePath.substring(lastDotIndex + 1);
    }

    return '';
}
