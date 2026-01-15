import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'client/index': 'src/client/index.ts',
    'server/index': 'src/server/index.ts',
    'validation/index': 'src/validation/index.ts',
    'types/index': 'src/types/index.ts',
    'utils/index': 'src/utils/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom'],
  splitting: false,
  sourcemap: true,
});
