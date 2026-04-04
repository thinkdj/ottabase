/* ============================================================
   Ottabase homepage.ob — interactions
   ============================================================ */

(function () {
  'use strict';

  /* ── Nav scroll blur ─────────────────────────────────────── */
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Mobile hamburger ────────────────────────────────────── */
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(open));
    });
  }

  /* ── Scroll-triggered animations ────────────────────────── */
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );
  document.querySelectorAll('.animate').forEach((el) => observer.observe(el));

  /* ── Code showcase tabs ──────────────────────────────────── */
  const tabsEl = document.querySelectorAll('.code-tab');
  const panels  = document.querySelectorAll('.code-panel');
  if (tabsEl.length) {
    tabsEl.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabsEl.forEach((t) => t.classList.toggle('active', t === tab));
        panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === target));
      });
    });
  }

  /* ── Package filter ──────────────────────────────────────── */
  const filterBtns = document.querySelectorAll('.pkg-filter-btn');
  const pkgCards   = document.querySelectorAll('.pkg-card');
  if (filterBtns.length) {
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat;
        filterBtns.forEach((b) => b.classList.toggle('active', b === btn));
        pkgCards.forEach((card) => {
          const show = cat === 'all' || card.dataset.cat === cat;
          card.style.display = show ? '' : 'none';
        });
        // also toggle section headers
        document.querySelectorAll('.pkg-section').forEach((sec) => {
          const haVisible = [...sec.querySelectorAll('.pkg-card')].some((c) => c.style.display !== 'none');
          sec.style.display = haVisible ? '' : 'none';
        });
      });
    });
  }

  /* ── Copy install command on click ──────────────────────── */
  document.querySelectorAll('.pkg-install').forEach((el) => {
    el.addEventListener('click', () => {
      const text = el.textContent.trim();
      navigator.clipboard?.writeText(text).then(() => {
        const orig = el.textContent;
        el.textContent = 'copied!';
        setTimeout(() => (el.textContent = orig), 1400);
      });
    });
  });

  /* ── Terminal typing animation ───────────────────────────── */
  const terminalBody = document.getElementById('terminal-body');
  if (terminalBody) {
    const lines = [
      { type: 'cmd',     prompt: '$', text: 'pnpm create ottabase@latest my-saas' },
      { type: 'out',     text: '  ✓ Scaffolded 47 packages' },
      { type: 'out',     text: '  ✓ Cloudflare Workers configured' },
      { type: 'gap' },
      { type: 'cmd',     prompt: '$', text: 'cd my-saas && pnpm install' },
      { type: 'out',     text: '  ✓ Dependencies installed' },
      { type: 'gap' },
      { type: 'cmd',     prompt: '$', text: 'pnpm dev' },
      { type: 'out',     text: '  ┌ Vite       → localhost:3003' },
      { type: 'out',     text: '  └ Wrangler   → localhost:3004' },
      { type: 'gap' },
      { type: 'cmd',     prompt: '$', text: 'curl -X POST localhost:3004/api/ottaorm/init' },
      { type: 'success', text: '  ✓ Database initialized. Your SaaS is alive.' },
    ];

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const typeChars = async (el, text, speed = 28) => {
      for (const ch of text) {
        el.textContent += ch;
        await sleep(speed + Math.random() * 12);
      }
    };

    const runTerminal = async () => {
      await sleep(600);
      for (const line of lines) {
        const row = document.createElement('div');
        row.className = 'terminal-line';

        if (line.type === 'gap') {
          row.className = 'terminal-gap';
          terminalBody.appendChild(row);
          await sleep(160);
          continue;
        }

        if (line.type === 'cmd') {
          const prompt = document.createElement('span');
          prompt.className = 'terminal-prompt';
          prompt.textContent = line.prompt;
          const cmd = document.createElement('span');
          cmd.className = 'terminal-cmd';
          row.appendChild(prompt);
          row.appendChild(cmd);
          terminalBody.appendChild(row);
          await typeChars(cmd, line.text, 24);
          await sleep(220);
        } else if (line.type === 'out') {
          const out = document.createElement('div');
          out.className = 'terminal-out';
          out.textContent = line.text;
          terminalBody.appendChild(out);
          await sleep(80);
        } else if (line.type === 'success') {
          const s = document.createElement('div');
          s.className = 'terminal-success';
          s.textContent = line.text;
          terminalBody.appendChild(s);
        }
      }
      // blinking cursor at end
      const cursor = document.createElement('span');
      cursor.className = 'cursor';
      const lastLine = document.createElement('div');
      lastLine.className = 'terminal-line';
      const prompt = document.createElement('span');
      prompt.className = 'terminal-prompt';
      prompt.textContent = '$';
      lastLine.appendChild(prompt);
      lastLine.appendChild(cursor);
      terminalBody.appendChild(lastLine);
    };

    // start when terminal scrolls into view
    const termObs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { termObs.disconnect(); runTerminal(); } },
      { threshold: 0.3 }
    );
    termObs.observe(terminalBody);
  }
})();
