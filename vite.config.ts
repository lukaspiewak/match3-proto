import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Wielostronicowo: `index.html` = prototyp city-buildera, `daily.html` = Daily Challenge
// (inny gatunek na tym samym silniku, model hybrydowy: plansza w Pixi, UI w DOM+Tailwind).
export default defineConfig({
    plugins: [tailwindcss()],
    build: {
        rollupOptions: {
            input: {
                main: resolve(import.meta.dirname, 'index.html'),
                daily: resolve(import.meta.dirname, 'daily.html'),
            },
        },
    },
});
