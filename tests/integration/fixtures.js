// Fixture commune : remplace les CDN par des copies locales quand le réseau
// n'est pas disponible (OFFLINE_CDN=1), pour que les tests restent fiables.
// En CI avec accès Internet, les vrais CDN sont utilisés.
const fs = require('node:fs');
const base = require('@playwright/test');

const OFFLINE = process.env.OFFLINE_CDN === '1';

function readOrEmpty(file) {
    try { return file ? fs.readFileSync(file) : ''; } catch { return ''; }
}

const test = base.test.extend({
    page: async ({ page }, use) => {
        if (OFFLINE) {
            const bootstrapJs = readOrEmpty(process.env.BOOTSTRAP_JS);
            const bootstrapCss = readOrEmpty(process.env.BOOTSTRAP_CSS);
            await page.route(/^https?:\/\/(?!localhost)/, (route) => {
                const url = route.request().url();
                if (url.includes('bootstrap.bundle')) {
                    return route.fulfill({ status: 200, contentType: 'text/javascript', body: bootstrapJs });
                }
                if (/bootstrap@[\d.]+\/dist\/css\/bootstrap\.min\.css/.test(url)) {
                    return route.fulfill({ status: 200, contentType: 'text/css', body: bootstrapCss });
                }
                if (/\.css(\?|$)|fonts\.googleapis/.test(url)) {
                    return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
                }
                return route.fulfill({ status: 204, body: '' });
            });
        }
        await use(page);
    },
});

/** Bloque toutes les ressources externes (simule des CDN en panne). */
async function blockThirdParty(page) {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort('blockedbyclient'));
}

/** Collecte les erreurs JS et les requêtes locales en échec. */
function watchProblems(page) {
    const problems = { pageErrors: [], consoleErrors: [], failedLocal: [] };
    page.on('pageerror', (e) => problems.pageErrors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') problems.consoleErrors.push(m.text()); });
    page.on('response', (r) => {
        if (r.url().startsWith('http://localhost') && r.status() >= 400) problems.failedLocal.push(`${r.status()} ${r.url()}`);
    });
    page.on('requestfailed', (r) => {
        if (r.url().startsWith('http://localhost')) problems.failedLocal.push(`FAILED ${r.url()}`);
    });
    return problems;
}

module.exports = { test, expect: base.expect, blockThirdParty, watchProblems, OFFLINE };
