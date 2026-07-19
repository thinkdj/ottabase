// ============================================================
// pnpm install hooks
// ============================================================
//
// Strip drizzle-orm's OPTIONAL `@prisma/client` peer dependency.
//
// Ottabase uses Drizzle over Cloudflare D1 and does not use Prisma. drizzle-orm
// declares `@prisma/client` as an optional peer (for its Prisma-adapter code path we
// never import); left alone, pnpm resolves and downloads @prisma/client + prisma +
// the Prisma engines into the store on every (including frozen CI) install, purely as
// dead weight. Removing the optional peer here keeps them out of the lockfile/store.
// ============================================================

function readPackage(pkg) {
    if (pkg.name === 'drizzle-orm') {
        if (pkg.peerDependencies) delete pkg.peerDependencies['@prisma/client'];
        if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta['@prisma/client'];
    }
    return pkg;
}

module.exports = { hooks: { readPackage } };
