import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'base/index': 'src/base/index.ts',
    'decorators/index': 'src/decorators/index.ts',
    'models/Post': 'src/models/Post.ts',
    'models/Tag': 'src/models/Tag.ts',
    'models/Category': 'src/models/Category.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
});
