// Tests unitaires de site/js/portfolio.js — lancés avec `node --test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../site/js/portfolio.js');

// --- Petits doubles de test (pas de navigateur nécessaire) -----------------
function fakeClassList(initial = []) {
    const set = new Set(initial);
    return {
        add: (c) => set.add(c),
        remove: (c) => set.delete(c),
        contains: (c) => set.has(c),
        toArray: () => [...set],
    };
}
function fakeEl(classes = []) {
    const attrs = {};
    return {
        textContent: '',
        classList: fakeClassList(classes),
        setAttribute: (k, v) => { attrs[k] = String(v); },
        getAttribute: (k) => (k in attrs ? attrs[k] : null),
        removeAttribute: (k) => { delete attrs[k]; },
        attrs,
    };
}
function fakeDoc(elements) {
    return { querySelectorAll: () => elements };
}

// --- parseWords --------------------------------------------------------------
test('parseWords lit un tableau JSON et nettoie les espaces', () => {
    assert.deepEqual(P.parseWords('["  A ", "B"]', ['x']), ['A', 'B']);
});

test('parseWords ignore les entrées vides ou non textuelles', () => {
    assert.deepEqual(P.parseWords('["A", "", "  ", 42, null, "B"]', []), ['A', 'B']);
});

test('parseWords renvoie la valeur de secours si le JSON est invalide, vide ou absent', () => {
    for (const raw of ['{pas du json', '[]', '{"a":1}', '', null, undefined, '[""]']) {
        assert.deepEqual(P.parseWords(raw, ['secours']), ['secours'], `entrée: ${raw}`);
    }
    assert.deepEqual(P.parseWords('oops', 'pas un tableau'), []);
});

// --- typewriterStep ----------------------------------------------------------
const timing = { typeDelay: 1, deleteDelay: 2, holdDelay: 3, nextWordDelay: 4 };

test('typewriterStep écrit le mot lettre par lettre', () => {
    let state = { wordIndex: 0, charIndex: 0, deleting: false };
    const texts = [];
    for (let i = 0; i < 2; i++) {
        const step = P.typewriterStep(state, ['abc'], timing);
        texts.push(step.text);
        assert.equal(step.delay, timing.typeDelay);
        state = step.state;
    }
    assert.deepEqual(texts, ['a', 'ab']);
});

test('typewriterStep marque une pause quand le mot est complet puis efface', () => {
    const full = P.typewriterStep({ wordIndex: 0, charIndex: 2, deleting: false }, ['abc'], timing);
    assert.equal(full.text, 'abc');
    assert.equal(full.delay, timing.holdDelay);
    assert.equal(full.state.deleting, true);

    const erase = P.typewriterStep(full.state, ['abc'], timing);
    assert.equal(erase.text, 'ab');
    assert.equal(erase.delay, timing.deleteDelay);
});

test('typewriterStep passe au mot suivant et boucle sur la liste', () => {
    const next = P.typewriterStep({ wordIndex: 1, charIndex: 1, deleting: true }, ['a', 'b'], timing);
    assert.equal(next.text, '');
    assert.equal(next.delay, timing.nextWordDelay);
    assert.deepEqual(next.state, { wordIndex: 0, charIndex: 0, deleting: false });
});

test('typewriterStep produit un cycle complet cohérent', () => {
    const words = ['ab', 'c'];
    let state = { wordIndex: 0, charIndex: 0, deleting: false };
    const seen = [];
    for (let i = 0; i < 8; i++) {
        const step = P.typewriterStep(state, words, timing);
        seen.push(step.text);
        state = step.state;
    }
    // a, ab (pause), a, '' (mot suivant), c (pause), '' (retour au 1er mot), a, ab
    assert.deepEqual(seen, ['a', 'ab', 'a', '', 'c', '', 'a', 'ab']);
});

test('typewriterStep utilise les délais par défaut et tolère un état absent', () => {
    const step = P.typewriterStep(undefined, ['xy']);
    assert.equal(step.text, 'x');
    assert.equal(step.delay, P.DEFAULT_TIMING.typeDelay);
});

test('typewriterStep refuse une liste vide', () => {
    assert.throws(() => P.typewriterStep({}, []), /non vide/);
    assert.throws(() => P.typewriterStep({}, null), /non vide/);
});

// --- startTypewriter ---------------------------------------------------------
test('startTypewriter affiche directement le premier mot si les animations sont réduites', () => {
    const el = fakeEl();
    let scheduled = 0;
    P.startTypewriter(el, ['Bonjour', 'Salut'], { reducedMotion: true, schedule: () => scheduled++ });
    assert.equal(el.textContent, 'Bonjour');
    assert.equal(scheduled, 0);
});

test('startTypewriter enchaîne les étapes et s\'arrête proprement', () => {
    const el = fakeEl();
    const queue = [];
    let cancelled = null;
    const stop = P.startTypewriter(el, ['abc'], {
        timing,
        schedule: (fn, delay) => { queue.push({ fn, delay }); return queue.length; },
        cancel: (id) => { cancelled = id; },
    });
    assert.equal(el.textContent, 'a');
    queue.shift().fn();
    assert.equal(el.textContent, 'ab');
    stop();
    assert.equal(cancelled, queue.length);
    const before = el.textContent;
    queue.shift().fn(); // un tick tardif ne doit plus rien modifier
    assert.equal(el.textContent, before);
});

test('startTypewriter ne plante pas sans élément ni mots', () => {
    assert.equal(typeof P.startTypewriter(null, ['a']), 'function');
    assert.equal(typeof P.startTypewriter(fakeEl(), []), 'function');
});

// --- prefersReducedMotion ----------------------------------------------------
test('prefersReducedMotion lit la préférence système', () => {
    assert.equal(P.prefersReducedMotion({ matchMedia: () => ({ matches: true }) }), true);
    assert.equal(P.prefersReducedMotion({ matchMedia: () => ({ matches: false }) }), false);
});

test('prefersReducedMotion renvoie false si matchMedia est absent ou plante', () => {
    assert.equal(P.prefersReducedMotion({}), false);
    assert.equal(P.prefersReducedMotion(undefined), false);
    assert.equal(P.prefersReducedMotion({ matchMedia: () => { throw new Error('x'); } }), false);
});

// --- setActiveLink -----------------------------------------------------------
test('setActiveLink active un seul lien et met à jour aria-current', () => {
    const links = [fakeEl(['nav-link', 'active']), fakeEl(['nav-link']), fakeEl(['nav-link'])];
    links[0].setAttribute('aria-current', 'true');
    P.setActiveLink(links, links[2]);
    assert.deepEqual(links.map((l) => l.classList.contains('active')), [false, false, true]);
    assert.equal(links[0].getAttribute('aria-current'), null);
    assert.equal(links[2].getAttribute('aria-current'), 'true');
});

test('setActiveLink tolère une liste vide ou un lien nul', () => {
    assert.doesNotThrow(() => P.setActiveLink(null, null));
    const links = [fakeEl(['active'])];
    P.setActiveLink(links, null);
    assert.equal(links[0].classList.contains('active'), false);
});

// --- initReveal --------------------------------------------------------------
test('initReveal affiche tout immédiatement sans IntersectionObserver', () => {
    const items = [fakeEl(), fakeEl()];
    const count = P.initReveal(fakeDoc(items), {}, false);
    assert.equal(count, 2);
    assert.ok(items.every((i) => i.classList.contains('is-visible')));
});

test('initReveal affiche tout immédiatement si les animations sont réduites', () => {
    const items = [fakeEl()];
    P.initReveal(fakeDoc(items), { IntersectionObserver: function () { throw new Error('ne doit pas être appelé'); } }, true);
    assert.ok(items[0].classList.contains('is-visible'));
});

test('initReveal révèle les éléments quand ils entrent à l\'écran', () => {
    const items = [fakeEl(), fakeEl()];
    let callback;
    const unobserved = [];
    function FakeObserver(cb) { callback = cb; }
    FakeObserver.prototype.observe = function () {};
    FakeObserver.prototype.unobserve = function (t) { unobserved.push(t); };

    P.initReveal(fakeDoc(items), { IntersectionObserver: FakeObserver }, false);
    assert.equal(items[0].classList.contains('is-visible'), false);

    callback([{ isIntersecting: true, target: items[0] }, { isIntersecting: false, target: items[1] }]);
    assert.equal(items[0].classList.contains('is-visible'), true);
    assert.equal(items[1].classList.contains('is-visible'), false);
    assert.deepEqual(unobserved, [items[0]]);
});

// --- setYear -----------------------------------------------------------------
test('setYear écrit l\'année de la date fournie', () => {
    const el = fakeEl();
    assert.equal(P.setYear(el, new Date('2027-03-01T12:00:00Z')), '2027');
    assert.equal(el.textContent, '2027');
    assert.equal(P.setYear(null), null);
});

// --- closeMobileMenu ---------------------------------------------------------
test('closeMobileMenu ne fait rien si le menu est déjà fermé', () => {
    assert.equal(P.closeMobileMenu(fakeEl(['collapse']), {}), false);
    assert.equal(P.closeMobileMenu(null, {}), false);
});

test('closeMobileMenu utilise Bootstrap quand il est chargé', () => {
    const menu = fakeEl(['collapse', 'show']);
    let hidden = false;
    const win = { bootstrap: { Collapse: { getOrCreateInstance: () => ({ hide: () => { hidden = true; } }) } } };
    assert.equal(P.closeMobileMenu(menu, win), true);
    assert.equal(hidden, true);
});

test('closeMobileMenu ferme le menu même sans Bootstrap (CDN indisponible)', () => {
    const menu = fakeEl(['collapse', 'show']);
    assert.equal(P.closeMobileMenu(menu, {}), true);
    assert.equal(menu.classList.contains('show'), false);
});

// --- whenMenuClosed ----------------------------------------------------------
test('whenMenuClosed agit tout de suite quand aucun menu ne se ferme (ordinateur)', () => {
    let calls = 0;
    assert.equal(P.whenMenuClosed(fakeEl(), false, { bootstrap: {} }, () => calls++), 'now');
    assert.equal(calls, 1);
});

test('whenMenuClosed agit tout de suite sans Bootstrap (CDN indisponible)', () => {
    let calls = 0;
    assert.equal(P.whenMenuClosed(fakeEl(), true, {}, () => calls++), 'now');
    assert.equal(calls, 1);
});

test('whenMenuClosed attend la fin du repli du menu, une seule fois', () => {
    const listeners = {};
    const menu = { addEventListener: (name, fn) => { listeners[name] = fn; } };
    let timeout;
    const win = { bootstrap: {}, setTimeout: (fn) => { timeout = fn; } };
    let calls = 0;
    assert.equal(P.whenMenuClosed(menu, true, win, () => calls++), 'deferred');
    assert.equal(calls, 0);
    listeners['hidden.bs.collapse']();
    assert.equal(calls, 1);
    timeout(); // le filet de sécurité ne doit pas rappeler une 2e fois
    assert.equal(calls, 1);
});

test('whenMenuClosed agit au plus tard après le délai si l\'animation ne se termine pas', () => {
    const menu = { addEventListener: () => {} };
    let timeout;
    let calls = 0;
    P.whenMenuClosed(menu, true, { bootstrap: {}, setTimeout: (fn) => { timeout = fn; } }, () => calls++);
    timeout();
    assert.equal(calls, 1);
});
