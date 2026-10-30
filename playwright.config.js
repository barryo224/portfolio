// Configuration des tests d'intégration (navigateur réel, Chromium).
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
    testDir: './tests/integration',
    timeout: 30_000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: 'retain-on-failure',
        video: process.env.VIDEO === '1' ? 'on' : 'off',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 820 } } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
        // Moteur de Safari (WebKit) : Mac et iPhone
        { name: 'safari', use: { ...devices['Desktop Safari'], viewport: { width: 1366, height: 820 } } },
        { name: 'iphone', use: { ...devices['iPhone 14'] } },
    ],
    webServer: {
        command: `node tests/static-server.js site ${PORT}`,
        url: `http://localhost:${PORT}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 10_000,
    },
});
