// Tests d'intégration : la page complète dans un vrai navigateur (Chromium).
const { test, expect, blockThirdParty, watchProblems } = require('./fixtures');

const isMobile = (testInfo) => ['mobile', 'iphone'].includes(testInfo.project.name);

test.describe('Chargement de la page', () => {
    test('la page se charge sans erreur JS ni ressource locale manquante', async ({ page }) => {
        const problems = watchProblems(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveTitle(/Ousmane Barry/);
        await expect(page.locator('h1')).toHaveText('Ousmane Barry');
        expect(problems.pageErrors, 'erreurs JavaScript').toEqual([]);
        expect(problems.consoleErrors, 'erreurs console').toEqual([]);
        expect(problems.failedLocal, 'ressources locales en échec').toEqual([]);
    });

    test('le JavaScript s\'initialise (classe js, année du pied de page)', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('html')).toHaveClass(/\bjs\b/);
        await expect(page.locator('#year')).toHaveText(String(new Date().getFullYear()));
    });

    test('toutes les images s\'affichent et ont un texte alternatif', async ({ page }) => {
        await page.goto('/');
        const images = page.locator('img');
        const count = await images.count();
        expect(count).toBeGreaterThanOrEqual(6);
        for (let i = 0; i < count; i++) {
            const img = images.nth(i);
            await img.scrollIntoViewIfNeeded();
            const alt = await img.getAttribute('alt');
            expect(alt && alt.trim().length, `alt manquant: ${await img.getAttribute('src')}`).toBeTruthy();
            await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0),
                { message: `image non chargée: ${await img.getAttribute('src')}` }).toBe(true);
        }
    });

    test('chaque fichier local référencé existe sur le serveur', async ({ page, request }) => {
        await page.goto('/');
        const urls = await page.evaluate(() => {
            const attrs = [...document.querySelectorAll('[src], [href]')]
                .map((el) => el.getAttribute('src') || el.getAttribute('href'));
            return [...new Set(attrs)].filter((u) => u && !/^(https?:|mailto:|#|data:)/.test(u));
        });
        expect(urls.length).toBeGreaterThan(5);
        for (const url of urls) {
            const res = await request.get(new URL(url, page.url()).toString());
            expect(res.status(), url).toBe(200);
        }
    });
});

test.describe('Contenu', () => {
    test('le profil correspond à la recherche de stage Développeur Data', async ({ page }) => {
        await page.goto('/');
        const hero = page.locator('#about');
        await expect(hero).toContainText('stage Développeur Data');
        await expect(hero).toContainText('du 26 avril à fin juin 2027');
        await expect(hero).toContainText('8 à 9 semaines');
        await expect(hero).toContainText('Lyon');
        await expect(hero).toContainText('Licence 3 MIASHS');
        // Plus aucune trace de l'ancien positionnement
        const body = await page.locator('body').innerText();
        expect(body).not.toMatch(/data analyst|alternance|licence 2 miashs parcours|power bi/i);
    });

    test('les projets data et web sont tous présents', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('data-project')).toHaveCount(4);
        await expect(page.getByTestId('web-project')).toHaveCount(5);
        await expect(page.locator('#projects')).toContainText('MLOps');
        await expect(page.locator('#projects')).toContainText('consommation électrique');
        await expect(page.locator('#projects')).not.toContainText(/retard des vols/i);
        // Le projet Qualité de l'air a été réalisé en Python, SQLite et R (sans Pandas)
        const airQuality = page.getByTestId('data-project').filter({ hasText: "Qualité de l'air" });
        await expect(airQuality).toHaveCount(1);
        await expect(airQuality).not.toContainText('Pandas');
        await expect(page.locator('body')).not.toContainText('6 à 8 semaines');
        await expect(page.locator('body')).not.toContainText('8 à 10 semaines');
        await expect(page.locator('#projects')).toContainText('SQLite');
    });

    test('la hiérarchie des titres est correcte (un seul h1, pas de niveau sauté)', async ({ page }) => {
        await page.goto('/');
        const levels = await page.$$eval('h1, h2, h3, h4, h5, h6', (els) => els.map((e) => Number(e.tagName[1])));
        expect(levels.filter((l) => l === 1)).toHaveLength(1);
        for (let i = 1; i < levels.length; i++) {
            expect(levels[i] - levels[i - 1], `saut de niveau à l'index ${i}`).toBeLessThanOrEqual(1);
        }
    });

    test('les métadonnées de partage et de référencement sont présentes', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
        await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /data engineering/);
        for (const prop of ['og:title', 'og:description', 'og:url', 'og:image']) {
            await expect(page.locator(`meta[property="${prop}"]`)).toHaveAttribute('content', /\S/);
        }
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\/.+og-image\.jpg$/);
    });
});

test.describe('Liens', () => {
    test('les liens externes s\'ouvrent dans un nouvel onglet de façon sécurisée', async ({ page }) => {
        await page.goto('/');
        const external = page.locator('a[href^="http"]');
        const count = await external.count();
        expect(count).toBeGreaterThan(5);
        for (let i = 0; i < count; i++) {
            const link = external.nth(i);
            await expect(link, await link.getAttribute('href')).toHaveAttribute('target', '_blank');
            await expect(link, await link.getAttribute('href')).toHaveAttribute('rel', /noopener/);
        }
    });

    test('les bibliothèques externes ont une version figée (pas de @latest)', async ({ page }) => {
        await page.goto('/');
        const cdn = await page.$$eval('script[src^="http"], link[href^="https://cdn"]',
            (els) => els.map((e) => e.getAttribute('src') || e.getAttribute('href')));
        expect(cdn.length).toBeGreaterThan(0);
        for (const url of cdn) {
            expect(url, url).not.toContain('@latest');
            expect(url, url).toMatch(/@\d+\.\d+\.\d+\//);
        }
    });

    test('le CV se télécharge en PDF', async ({ page, request }) => {
        await page.goto('/');
        const href = await page.getByTestId('cv-link').getAttribute('href');
        const res = await request.get(new URL(href, page.url()).toString());
        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toContain('application/pdf');
        expect((await res.body()).subarray(0, 4).toString()).toBe('%PDF');
    });

    test('le lien e-mail est correct', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#contact a[href^="mailto:"]')).toHaveAttribute('href', 'mailto:ousmanebarrie224@gmail.com');
    });

    test('l\'ancienne adresse redirige vers le portfolio', async ({ page }) => {
        await page.goto('/portfolio_ousmane.html');
        await page.waitForURL((url) => url.pathname === '/');
        await expect(page.locator('h1')).toHaveText('Ousmane Barry');
    });
});

test.describe('Navigation', () => {
    test('un clic sur un lien du menu amène à la section et la marque active', async ({ page }, testInfo) => {
        await page.goto('/');
        if (isMobile(testInfo)) {
            await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
            await expect(page.locator('#navbarNav')).toHaveClass(/\bshow\b/);
        }
        const link = page.locator('#nav-main .nav-link[href="#projects"]');
        await link.click();
        await expect(page).toHaveURL(/#projects$/);
        await expect(link).toHaveClass(/active/);
        await expect(link).toHaveAttribute('aria-current', 'true');
        await expect(page.locator('#projects h2')).toBeInViewport();
    });

    test('le lien d\'évitement mène au contenu principal', async ({ page, browserName }, testInfo) => {
        test.skip(isMobile(testInfo), 'navigation clavier testée sur ordinateur');
        await page.goto('/');
        // Safari n'atteint les liens qu'avec Option+Tab (réglage par défaut du Mac)
        await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
        const skip = page.locator('.skip-link');
        await expect(skip).toBeFocused();
        await expect(skip).toBeInViewport();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/#main$/);
    });

    test('menu mobile : s\'ouvre, puis se referme après un choix', async ({ page }, testInfo) => {
        test.skip(!isMobile(testInfo), 'menu repliable uniquement sur mobile');
        await page.goto('/');
        const toggler = page.getByRole('button', { name: 'Ouvrir le menu' });
        const menu = page.locator('#navbarNav');
        await expect(toggler).toBeVisible();
        await expect(menu).toBeHidden();

        await toggler.click();
        await expect(menu).toHaveClass(/\bshow\b/); // animation d'ouverture terminée
        await expect(toggler).toHaveAttribute('aria-expanded', 'true');

        await menu.locator('.nav-link[href="#path"]').click();
        await expect(menu).toBeHidden();
        await expect(page.locator('#path h2')).toBeInViewport();
    });

    test('aucun défilement horizontal parasite (y compris sur petit téléphone)', async ({ page }) => {
        await page.goto('/');
        for (const width of [page.viewportSize().width, 360, 320]) {
            await page.setViewportSize({ width, height: 800 });
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            expect(overflow, `débordement à ${width}px`).toBeLessThanOrEqual(0);
        }
    });
});

test.describe('Animations', () => {
    test('le texte animé affiche les phrases prévues', async ({ page }) => {
        await page.goto('/');
        const el = page.locator('#typewriter');
        const words = JSON.parse(await el.getAttribute('data-words'));
        await expect.poll(async () => (await el.textContent()).length, { timeout: 5000 }).toBeGreaterThan(3);
        const text = await el.textContent();
        expect(words.some((w) => w.startsWith(text)), `"${text}" ne correspond à aucune phrase`).toBe(true);
    });

    test('les sections apparaissent au défilement', async ({ page }) => {
        await page.goto('/');
        const card = page.locator('#path [data-reveal]').first();
        await card.scrollIntoViewIfNeeded();
        await expect(card).toHaveClass(/is-visible/);
        await expect(card).toHaveCSS('opacity', '1');
    });

    test('avec « réduire les animations », tout est affiché sans effet', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ ...testInfo.project.use, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await page.goto(`${testInfo.project.use.baseURL}/`);
        await expect(page.locator('#typewriter')).toHaveText('Futur Data Engineer');
        const hidden = await page.$$eval('[data-reveal]', (els) => els.filter((e) => !e.classList.contains('is-visible')).length);
        expect(hidden).toBe(0);
        await context.close();
    });
});

test.describe('Robustesse', () => {
    test('si les CDN sont en panne, le contenu reste lisible et le JS fonctionne', async ({ page }, testInfo) => {
        await blockThirdParty(page);
        const problems = watchProblems(page);
        await page.goto('/');

        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('#typewriter')).not.toBeEmpty();
        // Les sections finissent par s'afficher même loin dans la page
        const lastReveal = page.locator('#contact [data-reveal]');
        await lastReveal.scrollIntoViewIfNeeded();
        await expect(lastReveal).toHaveCSS('opacity', '1');

        // La navigation interne fonctionne sans Bootstrap
        await page.locator('#nav-main .nav-link[href="#path"]').click();
        await expect(page).toHaveURL(/#path$/);

        expect(problems.pageErrors, 'erreurs JavaScript').toEqual([]);
        expect(problems.failedLocal, 'ressources locales en échec').toEqual([]);
        void testInfo;
    });

    test('si le JavaScript ne se charge pas, tout le contenu s\'affiche quand même', async ({ page }) => {
        await page.route('**/js/portfolio.js', (route) => route.abort());
        await page.goto('/');
        const card = page.locator('#skills [data-reveal]').first();
        await card.scrollIntoViewIfNeeded();
        await expect(card).toHaveCSS('opacity', '1', { timeout: 5000 });
        await expect(page.locator('#typewriter')).toHaveText('Futur Data Engineer');
    });
});
