import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            // Règles métier partagées avec les Cloud Functions.
            '@shared': fileURLToPath(new URL('./functions/src/shared', import.meta.url)),
        },
    },
    build: {
        chunkSizeWarningLimit: 900,
    },
});
