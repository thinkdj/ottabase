import fs from 'node:fs';
import path from 'node:path';
import type { StorybookConfig } from '@storybook/react-webpack5';
import { resolveScope } from './scope.ts';

type ScopeKind = 'package' | 'app';

type ScopeRecord = {
    kind: ScopeKind;
    dirName: string;
    root: string;
    packageJsonPath: string;
    packageJson: { name?: string } | null;
    packageName: string | null;
    title: string;
};

type ScopeResult = {
    rootDir: string;
    packagesRoot: string;
    appsRoot: string;
    allPackages: ScopeRecord[];
    allApps: ScopeRecord[];
    selectedPackages: ScopeRecord[];
    selectedApps: ScopeRecord[];
    primaryApp: ScopeRecord | null;
};

const STORY_PATTERN = '**/*.stories.@(js|jsx|ts|tsx|mdx)';

const PACKAGE_FOLDERS = ['stories', 'src'];

const APP_FOLDERS: Array<{ folder: string; label: string }> = [
    { folder: 'stories', label: 'Stories' },
    { folder: 'app', label: 'App' },
    { folder: 'src', label: 'Src' },
    { folder: 'components', label: 'Components' },
    { folder: 'ottabase', label: 'Ottabase' },
];

interface StoryEntriesResult {
    stories: StorybookConfig['stories'];
    staticDirs: string[];
    scope: ScopeResult;
}

function addEntry(entries: StorybookConfig['stories'], seen: Set<string>, directory: string, titlePrefix: string) {
    if (!fs.existsSync(directory)) {
        return;
    }
    const key = `${directory}::${titlePrefix}`;
    if (seen.has(key)) {
        return;
    }
    // Only add titlePrefix if it's not empty
    const storyEntry: any = {
        directory,
        files: STORY_PATTERN,
    };

    if (titlePrefix && titlePrefix.trim()) {
        storyEntry.titlePrefix = titlePrefix;
    }

    (entries as any[]).push(storyEntry);
    seen.add(key);
}

export function resolveStorybookEntries(): StoryEntriesResult {
    const scope = resolveScope();
    const stories: StorybookConfig['stories'] = [];
    const seen = new Set<string>();
    const staticDirs: string[] = [];
    const staticSeen = new Set<string>();

    scope.selectedPackages.forEach((pkg) => {
        const titlePrefix = `Packages/${pkg.title}`;
        PACKAGE_FOLDERS.forEach((folder) => {
            const directory = path.join(pkg.root, folder);
            addEntry(stories, seen, directory, titlePrefix);
        });
    });

    scope.selectedApps.forEach((app) => {
        APP_FOLDERS.forEach(({ folder, label }) => {
            const directory = path.join(app.root, folder);
            addEntry(stories, seen, directory, `Apps/${app.title}/${label}`);
        });

        const publicDir = path.join(app.root, 'public');
        if (fs.existsSync(publicDir) && !staticSeen.has(publicDir)) {
            staticDirs.push(publicDir);
            staticSeen.add(publicDir);
        }
    });

    return {
        stories,
        staticDirs,
        scope,
    };
}
