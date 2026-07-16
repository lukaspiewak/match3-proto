import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Rejestruje content bloków gry przed testami (silnik nie definiuje bloków).
        setupFiles: ['./src/content/blocks.ts'],
    },
});
