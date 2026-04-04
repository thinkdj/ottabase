(function () {
    'use strict';

    const nav = document.getElementById('hp-nav');
    if (nav) {
        const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 12);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    const themeToggle = document.getElementById('hp-theme-toggle');
    const root = document.documentElement;
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('hp-theme') : null;
    if (stored === 'light' || stored === 'dark') {
        root.setAttribute('data-theme', stored);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        root.setAttribute('data-theme', 'light');
    }
    const syncThemeLabel = () => {
        if (!themeToggle) return;
        const dark = root.getAttribute('data-theme') === 'dark';
        themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
        themeToggle.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
    };
    syncThemeLabel();
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            root.setAttribute('data-theme', next);
            try {
                localStorage.setItem('hp-theme', next);
            } catch (_) {}
            syncThemeLabel();
        });
    }

    /** Reveal scroll animations for anything already on screen (IO alone can miss first paint). */
    const revealIfInView = (el) => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        if (r.top < vh + 80 && r.bottom > -80) {
            el.classList.add('is-visible');
        }
    };

    const wireReveal = () => {
        const els = document.querySelectorAll('.hp-reveal');
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) e.target.classList.add('is-visible');
                });
            },
            { threshold: 0, rootMargin: '0px 0px 10% 0px' },
        );
        els.forEach((el) => {
            io.observe(el);
            revealIfInView(el);
        });
        requestAnimationFrame(() => {
            els.forEach(revealIfInView);
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireReveal);
    } else {
        wireReveal();
    }

    const hamburger = document.getElementById('hp-hamburger');
    const navLinks = document.getElementById('hp-nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            const open = navLinks.classList.toggle('is-open');
            hamburger.setAttribute('aria-expanded', String(open));
        });
    }

    const tabs = document.querySelectorAll('.hp-code-tab');
    const panels = document.querySelectorAll('.hp-code-panel');
    const filename = document.getElementById('hp-code-filename');
    const tabToFile = {
        model: 'ottabase/models/Todo.ts',
        hooks: 'src/hooks/useTodo.ts',
        rls: 'worker/middleware/rls.ts',
        deploy: 'terminal',
    };
    if (tabs.length && panels.length) {
        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const name = tab.dataset.tab;
                tabs.forEach((t) => {
                    t.classList.toggle('is-active', t === tab);
                    t.setAttribute('aria-selected', String(t === tab));
                });
                panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name));
                if (filename && tabToFile[name]) filename.textContent = tabToFile[name];
            });
        });
    }

    const filterBtns = document.querySelectorAll('.hp-filter-btn');
    const pkgCards = document.querySelectorAll('.hp-pkg-card');
    if (filterBtns.length && pkgCards.length) {
        filterBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.cat;
                filterBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
                pkgCards.forEach((card) => {
                    const show = cat === 'all' || card.dataset.cat === cat;
                    card.style.display = show ? '' : 'none';
                });
                document.querySelectorAll('.hp-pkg-section').forEach((sec) => {
                    const any = [...sec.querySelectorAll('.hp-pkg-card')].some((c) => c.style.display !== 'none');
                    sec.style.display = any ? '' : 'none';
                });
            });
        });
    }

    document.querySelectorAll('.hp-pkg-install').forEach((el) => {
        el.addEventListener('click', () => {
            const text = el.textContent.trim();
            navigator.clipboard?.writeText(text).then(() => {
                const orig = el.textContent;
                el.textContent = 'copied';
                setTimeout(() => {
                    el.textContent = orig;
                }, 1200);
            });
        });
    });

    const termBody = document.getElementById('hp-terminal-body');
    if (termBody) {
        const lines = [
            { type: 'cmd', prompt: '$', text: 'pnpm create ottabase@latest my-saas' },
            { type: 'out', text: '  ✓ Scaffolded 47 packages' },
            { type: 'out', text: '  ✓ Cloudflare Workers configured' },
            { type: 'gap' },
            { type: 'cmd', prompt: '$', text: 'cd my-saas && pnpm install' },
            { type: 'out', text: '  ✓ Dependencies installed' },
            { type: 'gap' },
            { type: 'cmd', prompt: '$', text: 'pnpm dev' },
            { type: 'out', text: '  ┌ Vite       → localhost:3003' },
            { type: 'out', text: '  └ Wrangler   → localhost:3004' },
            { type: 'gap' },
            { type: 'cmd', prompt: '$', text: 'curl -X POST localhost:3004/api/ottaorm/init' },
            { type: 'ok', text: '  ✓ Database initialized. Your SaaS is alive.' },
        ];

        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const typeChars = async (el, text, speed = 26) => {
            for (const ch of text) {
                el.textContent += ch;
                await sleep(speed + Math.random() * 10);
            }
        };

        const run = async () => {
            await sleep(500);
            for (const line of lines) {
                if (line.type === 'gap') {
                    const g = document.createElement('div');
                    g.className = 'hp-gap';
                    termBody.appendChild(g);
                    await sleep(140);
                    continue;
                }
                if (line.type === 'cmd') {
                    const row = document.createElement('div');
                    row.className = 'hp-term-line';
                    const pr = document.createElement('span');
                    pr.className = 'hp-prompt';
                    pr.textContent = line.prompt;
                    const cmd = document.createElement('span');
                    cmd.className = 'hp-cmd';
                    row.appendChild(pr);
                    row.appendChild(cmd);
                    termBody.appendChild(row);
                    await typeChars(cmd, line.text, 22);
                    await sleep(200);
                } else if (line.type === 'out') {
                    const o = document.createElement('div');
                    o.className = 'hp-out';
                    o.textContent = line.text;
                    termBody.appendChild(o);
                    await sleep(70);
                } else if (line.type === 'ok') {
                    const o = document.createElement('div');
                    o.className = 'hp-ok';
                    o.textContent = line.text;
                    termBody.appendChild(o);
                }
            }
            const last = document.createElement('div');
            last.className = 'hp-term-line';
            const pr = document.createElement('span');
            pr.className = 'hp-prompt';
            pr.textContent = '$';
            const cur = document.createElement('span');
            cur.className = 'hp-cursor';
            last.appendChild(pr);
            last.appendChild(cur);
            termBody.appendChild(last);
        };

        const obs = new IntersectionObserver(
            ([e]) => {
                if (e.isIntersecting) {
                    obs.disconnect();
                    run();
                }
            },
            { threshold: 0.25 },
        );
        obs.observe(termBody);
    }
})();
