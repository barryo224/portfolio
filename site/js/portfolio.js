/*
 * Portfolio d'Ousmane Barry : comportements de la page.
 *
 * Le fichier fonctionne de deux façons :
 *  - dans le navigateur, il s'initialise tout seul et expose window.Portfolio ;
 *  - dans Node (tests unitaires), il exporte ses fonctions via module.exports.
 *
 * Chaque fonctionnalité est isolée : si l'une échoue (ex. CDN Bootstrap
 * indisponible), les autres continuent de fonctionner.
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.Portfolio = api;
        if (root.document) {
            if (root.document.readyState === 'loading') {
                root.document.addEventListener('DOMContentLoaded', function () {
                    api.init(root.document, root);
                });
            } else {
                api.init(root.document, root);
            }
        }
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    var DEFAULT_TIMING = { typeDelay: 70, deleteDelay: 35, holdDelay: 1600, nextWordDelay: 400 };

    /**
     * Lit la liste de phrases du typewriter depuis un attribut data-words (JSON).
     * Renvoie `fallback` si l'attribut est absent, invalide ou vide.
     */
    function parseWords(raw, fallback) {
        var safeFallback = Array.isArray(fallback) ? fallback : [];
        if (typeof raw !== 'string' || raw.trim() === '') return safeFallback;
        try {
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return safeFallback;
            var words = parsed
                .filter(function (w) { return typeof w === 'string'; })
                .map(function (w) { return w.trim(); })
                .filter(function (w) { return w.length > 0; });
            return words.length > 0 ? words : safeFallback;
        } catch (e) {
            return safeFallback;
        }
    }

    /**
     * Une étape de l'effet « machine à écrire » (fonction pure).
     * state = { wordIndex, charIndex, deleting }
     * Renvoie { state, text, delay } : le nouvel état, le texte à afficher
     * et le délai avant l'étape suivante.
     */
    function typewriterStep(state, words, timing) {
        if (!Array.isArray(words) || words.length === 0) {
            throw new Error('typewriterStep: words doit être un tableau non vide');
        }
        var t = Object.assign({}, DEFAULT_TIMING, timing || {});
        var wordIndex = ((state && state.wordIndex) || 0) % words.length;
        var charIndex = (state && state.charIndex) || 0;
        var deleting = Boolean(state && state.deleting);
        var word = words[wordIndex];

        if (!deleting) {
            charIndex = Math.min(charIndex + 1, word.length);
            if (charIndex === word.length) {
                return {
                    state: { wordIndex: wordIndex, charIndex: charIndex, deleting: true },
                    text: word,
                    delay: t.holdDelay
                };
            }
            return {
                state: { wordIndex: wordIndex, charIndex: charIndex, deleting: false },
                text: word.slice(0, charIndex),
                delay: t.typeDelay
            };
        }

        charIndex = Math.max(charIndex - 1, 0);
        if (charIndex === 0) {
            return {
                state: { wordIndex: (wordIndex + 1) % words.length, charIndex: 0, deleting: false },
                text: '',
                delay: t.nextWordDelay
            };
        }
        return {
            state: { wordIndex: wordIndex, charIndex: charIndex, deleting: true },
            text: word.slice(0, charIndex),
            delay: t.deleteDelay
        };
    }

    /** true si l'utilisateur a demandé à réduire les animations. */
    function prefersReducedMotion(win) {
        try {
            return Boolean(win && typeof win.matchMedia === 'function' &&
                win.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (e) {
            return false;
        }
    }

    /**
     * Lance le typewriter sur `el`. `schedule` est injectable pour les tests.
     * Renvoie une fonction qui arrête l'animation.
     */
    function startTypewriter(el, words, options) {
        var opts = options || {};
        var schedule = opts.schedule || setTimeout;
        var cancel = opts.cancel || clearTimeout;
        if (!el || !Array.isArray(words) || words.length === 0) return function () {};

        if (opts.reducedMotion) {
            el.textContent = words[0];
            return function () {};
        }

        var state = { wordIndex: 0, charIndex: 0, deleting: false };
        var timer = null;
        var stopped = false;

        function tick() {
            if (stopped) return;
            var step = typewriterStep(state, words, opts.timing);
            state = step.state;
            el.textContent = step.text;
            timer = schedule(tick, step.delay);
        }
        tick();
        return function stop() {
            stopped = true;
            if (timer !== null) cancel(timer);
        };
    }

    /** Marque `active` comme lien courant de la navigation. */
    function setActiveLink(links, active) {
        Array.prototype.forEach.call(links || [], function (link) {
            link.classList.remove('active');
            if (typeof link.removeAttribute === 'function') link.removeAttribute('aria-current');
        });
        if (active) {
            active.classList.add('active');
            if (typeof active.setAttribute === 'function') active.setAttribute('aria-current', 'true');
        }
    }

    /**
     * Fait apparaître les éléments [data-reveal] quand ils entrent à l'écran.
     * Sans IntersectionObserver ou avec « réduire les animations », tout est
     * affiché immédiatement. Renvoie le nombre d'éléments pris en charge.
     */
    function initReveal(doc, win, reducedMotion) {
        var items = doc.querySelectorAll('[data-reveal]');
        var showAll = function () {
            Array.prototype.forEach.call(items, function (item) { item.classList.add('is-visible'); });
        };
        if (reducedMotion || !win || typeof win.IntersectionObserver !== 'function') {
            showAll();
            return items.length;
        }
        var observer = new win.IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
        Array.prototype.forEach.call(items, function (item) { observer.observe(item); });
        return items.length;
    }

    /** Écrit l'année courante dans le pied de page. */
    function setYear(el, date) {
        if (!el) return null;
        var year = String((date || new Date()).getFullYear());
        el.textContent = year;
        return year;
    }

    /** Referme le menu mobile Bootstrap après un clic (si Bootstrap est chargé). */
    function closeMobileMenu(menu, win) {
        if (!menu || !menu.classList.contains('show')) return false;
        var bs = win && win.bootstrap;
        if (bs && bs.Collapse && typeof bs.Collapse.getOrCreateInstance === 'function') {
            bs.Collapse.getOrCreateInstance(menu, { toggle: false }).hide();
            return true;
        }
        menu.classList.remove('show');
        return true;
    }

    /**
     * Appelle `cb` une fois le menu mobile complètement refermé.
     * Sans menu à fermer (ordinateur) ou sans Bootstrap : appel immédiat.
     * Avec Bootstrap : à la fin de l'animation, ou au plus tard après `maxWait` ms.
     * Renvoie 'now' ou 'deferred'.
     */
    function whenMenuClosed(menu, wasClosing, win, cb, maxWait) {
        var done = false;
        var finish = function () {
            if (done) return;
            done = true;
            cb();
        };
        var canWait = wasClosing && menu && typeof menu.addEventListener === 'function' && win && win.bootstrap;
        if (!canWait) {
            finish();
            return 'now';
        }
        menu.addEventListener('hidden.bs.collapse', finish, { once: true });
        (typeof win.setTimeout === 'function' ? win.setTimeout : setTimeout)(finish, maxWait || 600);
        return 'deferred';
    }

    /** Exécute `fn` sans laisser une erreur casser le reste de l'initialisation. */
    function safely(name, fn, errors) {
        try {
            fn();
        } catch (e) {
            errors.push(name + ': ' + (e && e.message ? e.message : e));
        }
    }

    function init(doc, win) {
        var errors = [];
        var reduced = prefersReducedMotion(win);
        doc.documentElement.classList.add('js');

        safely('typewriter', function () {
            var el = doc.getElementById('typewriter');
            if (!el) return;
            var words = parseWords(el.getAttribute('data-words'), [el.textContent.trim()].filter(Boolean));
            startTypewriter(el, words, { reducedMotion: reduced });
        }, errors);

        safely('reveal', function () { initReveal(doc, win, reduced); }, errors);

        safely('navigation', function () {
            var links = doc.querySelectorAll('#nav-main .nav-link[href^="#"]');
            var menu = doc.getElementById('navbarNav');
            Array.prototype.forEach.call(links, function (link) {
                link.addEventListener('click', function (event) {
                    var hash = link.getAttribute('href');
                    var target = hash && hash.length > 1 ? doc.querySelector(hash) : null;
                    setActiveLink(links, link);
                    var closing = closeMobileMenu(menu, win);
                    if (!target || typeof target.scrollIntoView !== 'function') return;
                    // On fait défiler nous-mêmes, une fois le menu refermé : sinon,
                    // sur mobile, le repli du menu peut annuler le défilement.
                    event.preventDefault();
                    whenMenuClosed(menu, closing, win, function () {
                        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
                        if (win && win.history && typeof win.history.pushState === 'function') {
                            win.history.pushState(null, '', hash);
                        }
                    });
                });
            });
        }, errors);

        safely('year', function () { setYear(doc.getElementById('year')); }, errors);

        if (errors.length && win && win.console) win.console.warn('[portfolio]', errors.join(' | '));
        return errors;
    }

    return {
        DEFAULT_TIMING: DEFAULT_TIMING,
        parseWords: parseWords,
        typewriterStep: typewriterStep,
        prefersReducedMotion: prefersReducedMotion,
        startTypewriter: startTypewriter,
        setActiveLink: setActiveLink,
        initReveal: initReveal,
        setYear: setYear,
        closeMobileMenu: closeMobileMenu,
        whenMenuClosed: whenMenuClosed,
        init: init
    };
});
