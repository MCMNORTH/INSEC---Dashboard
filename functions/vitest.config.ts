import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        // Les suites partagent les mêmes émulateurs : exécution séquentielle.
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 30_000,
        env: {
            GCLOUD_PROJECT: 'demo-insec',
            METADATA_SERVER_DETECTION: 'none',
            FIREBASE_CONFIG: JSON.stringify({ projectId: 'demo-insec', storageBucket: 'demo-insec.appspot.com' }),
            APP_URL: 'https://dashboard.insec.test',
            MAIL_FROM_ADDRESS: 'contact@insec.mr',
            MAIL_FROM_NAME: 'INSEC',
        },
    },
});
