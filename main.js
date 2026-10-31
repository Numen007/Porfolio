/* Prabodh Kale — interactions (vanilla, no dependencies) */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const WORK = window.WORK || [];
  // self-hosted clips have `src` (assets/video/<slug>): <slug>.mp4 full, <slug>-sm.mp4 light preview, <slug>.jpg poster
  const vurl = (id, q = '720p') => {
    const w = WORK.find(x => x.id === id);
    if (w?.src) return `${w.src}${/^(360|480)p$/.test(q) ? '-sm' : ''}.mp4`;
    return `https://video.wixstatic.com/video/${id}/${q}/mp4/file.mp4`;
  };
  const purl = w => w.src ? `${w.src}.jpg` : `https://static.wixstatic.com/media/${w.id}${w.p}.jpg/v1/fill/w_${w.v ? 480 : 800},h_${w.v ? 853 : 450},q_80/p.jpg`;

  /* ---------- Split text into word/char spans ---------- */
  $$('[data-split]').forEach(el => {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span'); w.className = 'w';
            [...part].forEach(ch => {
              const c = document.createElement('span'); c.className = 'c'; c.textContent = ch; c.style.setProperty('--i', i++); w.append(c);
            });
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  });

  /* ---------- Word-by-word scroll highlight ---------- */
  const lead = $('[data-words]');
  if (lead) lead.innerHTML = lead.textContent.trim().split(/\s+/).map(w => `<span class="wd">${w}</span>`).join(' ');

  /* ---------- Reveal on view ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .18, rootMargin: '0px 0px -6% 0px' });
  const watchReveals = () => $$('[data-split]:not(.hero [data-split]), .reveal-clip, .card:not(.in)').forEach(el => io.observe(el));

  /* ---------- Preloader (film leader countdown) ---------- */
  const loader = $('.loader');
  const startHero = () => {
    document.body.classList.remove('is-loading');
    $$('.hero [data-split]').forEach((el, k) => setTimeout(() => el.classList.add('in'), 120 + k * 140));
    $$('.hero .reveal-fade').forEach((el, k) => setTimeout(() => el.classList.add('in'), 500 + k * 200));
    setTimeout(() => $('.hero__portrait')?.classList.add('in'), 350);
  };
  const seen = (() => { try { return sessionStorage.getItem('pk-seen'); } catch { return null; } })();
  if (reduce || seen) { loader.remove(); startHero(); }
  else {
    try { sessionStorage.setItem('pk-seen', '1'); } catch {}
    const num = $('.loader__num'), sweep = $('.loader__sweep'), pct = $('.loader__pct');
    const T = 1500, t0 = performance.now();
    const tick = now => {
      const p = clamp((now - t0) / T, 0, 1);
      const local = (p * 3) % 1;
      num.textContent = 3 - Math.min(2, Math.floor(p * 3));
      sweep.style.setProperty('--a', `${local * 360}deg`);
      pct.textContent = String(Math.round(p * 100)).padStart(2, '0') + '%';
      if (p < 1) requestAnimationFrame(tick);
      else { loader.classList.add('is-done'); setTimeout(startHero, 250); setTimeout(() => loader.remove(), 1100); }
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Hero reel: crossfading grayscale montage ---------- */
  // hero montage + showreel follow the top 9 pinned picks ('pos' in data.js)
  const REEL = WORK.filter(w => w.pos && w.pos <= 9).sort((a, b) => a.pos - b.pos).map(w => w.id);
  const reelVids = $$('.hero__reel video');
  if (!reduce && reelVids.length) {
    let r = 0, cur = 0;
    const load = (v, id) => { v.src = vurl(id, '480p'); v.load(); }; // dimmed backdrop: light files are plenty
    load(reelVids[0], REEL[0]);
    reelVids[0].addEventListener('canplay', () => { reelVids[0].play().catch(() => {}); reelVids[0].classList.add('is-on'); }, { once: true });
    setInterval(() => {
      if (document.hidden) return;
      const next = reelVids[1 - cur]; r = (r + 1) % REEL.length;
      load(next, REEL[r]);
      next.addEventListener('canplay', () => {
        next.play().catch(() => {});
        next.classList.add('is-on'); reelVids[cur].classList.remove('is-on');
        const old = reelVids[cur]; setTimeout(() => old.pause(), 1600);
        cur = 1 - cur;
      }, { once: true });
    }, 6000);
  }

  /* ---------- About: program monitor cycling through clips ---------- */
  const MON = ['22c792_c33fe99d55924c609713e3f7e655a9f3']; // Touch Grass, shown alone
  const mon = $('[data-monitor]');
  if (mon) {
    const clipsM = MON.map(id => WORK.find(w => w.id === id)).filter(Boolean);
    const mv = $$('video', mon), mt = $('[data-mon-t]', mon), mn = $('[data-mon-n]', mon), mtc = $('[data-mon-tc]', mon), bin = $('[data-mon-bin]', mon);
    bin.innerHTML = clipsM.map((w, k) => `<button type="button" aria-label="Play ${w.t}" style="background-image:url('${purl(w)}')" data-k="${k}"></button>`).join('');
    const btns = $$('button', bin);
    const SPAN = 7; // seconds each clip holds the monitor
    let m = -1, mcur = 0, timer, live = false, seq = 0;
    const pad = n => String(n).padStart(2, '0');
    const solo = clipsM.length === 1; // one clip: loop it, no bin or auto-advance
    bin.hidden = solo; mv.forEach(v => { v.loop = solo; });
    const show = k => {
      m = k; clearTimeout(timer); const tok = ++seq;
      const w = clipsM[k], v = mv[1 - mcur], old = mv[mcur];
      mt.textContent = w.t; mn.textContent = solo ? w.tag : `${pad(k + 1)} / ${pad(clipsM.length)} — ${w.tag}`;
      btns.forEach((b, i) => { b.classList.toggle('is-on', i === k); b.style.setProperty('--p', '0%'); });
      v.poster = purl(w); v.src = vurl(w.id, '480p'); v.load();
      v.addEventListener('canplay', () => {
        if (!live || tok !== seq) return;
        v.play().catch(() => {}); v.classList.add('is-on'); old.classList.remove('is-on');
        setTimeout(() => old.pause(), 1300); mcur = 1 - mcur;
      }, { once: true });
      if (!reduce && !solo) timer = setTimeout(() => live && show((m + 1) % clipsM.length), SPAN * 1000);
    };
    mv.forEach(v => v.addEventListener('timeupdate', () => {
      if (!v.classList.contains('is-on')) return;
      const t = v.currentTime, f = Math.floor((t % 1) * 24);
      mtc.textContent = `00:00:${pad(Math.floor(t))}:${pad(f)}`;
      btns[m]?.style.setProperty('--p', `${Math.min(100, t / SPAN * 100)}%`);
    }));
    btns.forEach(b => b.addEventListener('click', () => show(+b.dataset.k)));
    // only spend bandwidth while the monitor is on screen
    new IntersectionObserver(([e]) => {
      live = e.isIntersecting;
      if (live) { if (m < 0) show(0); else { mv[mcur].play().catch(() => {}); if (!solo) timer = setTimeout(() => show((m + 1) % clipsM.length), SPAN * 1000); } }
      else { clearTimeout(timer); mv.forEach(v => v.pause()); }
    }, { rootMargin: '200px 0px' }).observe(mon);
  }

  /* ---------- Custom cursor ---------- */
  const cursor = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
  const mouse = { x: innerWidth / 2, y: innerHeight / 2 }, ringPos = { ...mouse };
  if (fine && !reduce) {
    document.documentElement.classList.add('has-cursor');
    addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-cursor], a, button, input, textarea, label, .card');
      cursor.classList.toggle('is-hover', !!t);
      const lab = t?.dataset.cursor || (t?.classList.contains('card') ? 'Play' : '');
      cursor.classList.toggle('is-label', !!lab);
      label.textContent = lab;
    });
    document.addEventListener('pointerleave', () => cursor.style.opacity = 0);
    document.addEventListener('pointerenter', () => cursor.style.opacity = 1);
  }

  /* ---------- Magnetic elements ---------- */
  if (fine && !reduce) $$('[data-magnetic]').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * .3, y = (e.clientY - r.top - r.height / 2) * .35;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)'; el.style.transform = ''; setTimeout(() => el.style.transition = '', 700); });
  });

  /* ---------- Portrait tilt ---------- */
  const tilt = $('[data-tilt]');
  if (tilt && fine && !reduce) {
    tilt.addEventListener('pointermove', e => {
      const r = tilt.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      tilt.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    });
    tilt.addEventListener('pointerleave', () => tilt.style.transform = '');
  }

  /* ---------- Clock ---------- */
  const clock = $('[data-clock]');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const setClock = () => clock && (clock.textContent = `MUM ${fmt.format(new Date())}`);
  setClock(); setInterval(setClock, 15000);

  /* ---------- Work grid ---------- */
  const grid = $('[data-grid]'), moreBtn = $('[data-more]'), notes = $('[data-podcast-notes]');
  const PAGE = 9; // landscape cards on first load (3 rows)
  let filter = 'all', open = false, list = [];
  $$('[data-count]').forEach(s => {
    const c = s.dataset.count, n = c === 'all' ? WORK.length : WORK.filter(w => w.c === c).length;
    const pods = c === 'podcast' || c === 'all' ? $$('[data-pod]').length : 0; // YouTube episodes live outside the grid
    s.textContent = n + pods; if (!(n + pods)) s.parentElement.hidden = true; // no clips in this category yet
  });

  const cardHTML = (w, i) => `
    <button class="card${w.v ? ' card--v' : ''}" data-i="${i}" aria-label="Play ${w.t}">
      <div class="card__media">
        <img src="${purl(w)}" alt="" loading="lazy" decoding="async">
        <video muted playsinline loop preload="none"></video>
        <span class="card__n mono">${String(i + 1).padStart(2, '0')}</span>
        <span class="card__bar"></span>
      </div>
      <div class="card__meta"><span class="card__t">${w.t}</span><span class="card__tag mono">${w.tag}</span></div>
    </button>`;

  // Self-hosted clips are the newest work, so they lead. Landscape cards then alternate
  // AI / motion so the first rows show range; verticals sit in their own smaller row.
  const isNew = w => !!w.src;
  const LAND = (() => {
    const by = ['ai', 'motion', 'podcast'].map(c => WORK.filter(w => !w.v && !isNew(w) && w.c === c));
    const out = WORK.filter(w => !w.v && isNew(w));
    while (by.some(g => g.length)) by.forEach(g => g.length && out.push(g.shift()));
    const pinned = out.filter(w => w.pos).sort((a, b) => a.pos - b.pos);
    return [...pinned, ...out.filter(w => !w.pos && !w.later), ...out.filter(w => !w.pos && w.later)];
  })();
  const VERT = [...WORK.filter(w => w.v && isNew(w)), ...WORK.filter(w => w.v && !isNew(w))]
    .sort((a, b) => !!b.first - !!a.first);

  // keep = how many leading cards are already on screen (they skip the entrance animation)
  // Podcasts: collapsed rows; opening one closes the others and stops its player
  $$('.pod__head').forEach(h => h.addEventListener('click', () => {
    const pod = h.closest('.pod'), open = !pod.classList.contains('is-open');
    $$('.pod.is-open').forEach(p => {
      p.classList.remove('is-open'); $('.pod__head', p).setAttribute('aria-expanded', 'false');
      const box = $('.pod__media.is-live', p); if (box) box.replaceWith(box._btn); // collapsing stops playback
    });
    if (open) { pod.classList.add('is-open'); h.setAttribute('aria-expanded', 'true'); }
  }));

  // Podcasts: YouTube player loads only on click (lighter page, no tracking until then)
  $$('[data-yt]').forEach(b => b.addEventListener('click', () => {
    const box = document.createElement('div'); box.className = 'pod__media is-live'; box._btn = b;
    box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1&rel=0" title="${b.getAttribute('aria-label')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    b.replaceWith(box);
  }));

  const render = (animate = true, keep = 0) => {
    const land = filter === 'all' ? LAND : LAND.filter(w => w.c === filter);
    const vert = filter === 'all' ? VERT : VERT.filter(w => w.c === filter);
    const visLand = open ? land : land.slice(0, PAGE);
    const visVert = open || !land.length ? vert : [];
    list = [...visLand, ...visVert];
    grid.innerHTML =
      (visLand.length ? `<div class="grid__h">${visLand.map(cardHTML).join('')}</div>` : '') +
      (visVert.length ? `<p class="grid__label mono">Vertical · ${visVert.length} reels</p><div class="grid__v">${visVert.map((w, k) => cardHTML(w, visLand.length + k)).join('')}</div>` : '');
    moreBtn.hidden = list.length >= land.length + vert.length;
    notes.hidden = !(filter === 'podcast' || filter === 'all');
    $$('.grid__label', grid).forEach(l => l.classList.add('in'));
    $$('.card', grid).forEach((c, k) => {
      if (!animate || k < keep) { c.classList.add('in'); return; }
      c.style.transitionDelay = `${((k - keep) % 6) * 60}ms`;
      io.observe(c);
    });
    bindCards();
  };

  // Hover / in-view preview playback
  let activeCard = null;
  const playCard = c => {
    if (activeCard && activeCard !== c) stopCard(activeCard);
    const v = $('video', c), w = list[+c.dataset.i];
    if (!v.src) v.src = vurl(w.id, '480p');
    v.currentTime = 0;
    v.play().then(() => c.classList.add('is-playing')).catch(() => {});
    activeCard = c;
    const bar = $('.card__bar', c);
    const step = () => {
      if (activeCard !== c) return;
      if (v.duration) bar.style.transform = `scaleX(${v.currentTime / v.duration})`;
      requestAnimationFrame(step);
    };
    step();
  };
  const stopCard = c => {
    const v = $('video', c); v.pause(); c.classList.remove('is-playing');
    $('.card__bar', c).style.transform = 'scaleX(0)';
    if (activeCard === c) activeCard = null;
  };
  const touchIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.intersectionRatio > .7) playCard(e.target); else if (activeCard === e.target) stopCard(e.target);
  }), { threshold: [0, .7] });

  function bindCards() {
    $$('.card', grid).forEach(c => {
      if (fine) {
        c.addEventListener('pointerenter', () => playCard(c));
        c.addEventListener('pointerleave', () => stopCard(c));
      } else if (!reduce) touchIO.observe(c);
      c.addEventListener('click', () => openLB(+c.dataset.i));
    });
  }

  // Filters with sliding pill
  const pill = $('.filters__pill');
  const movePill = btn => { pill.style.width = btn.offsetWidth + 'px'; pill.style.transform = `translateX(${btn.offsetLeft}px)`; };
  $$('.filters button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.filter === filter) return;
    $$('.filters button').forEach(x => x.setAttribute('aria-selected', x === b));
    movePill(b);
    $$('.card', grid).forEach(c => c.classList.add('is-out'));
    setTimeout(() => { filter = b.dataset.filter; open = false; render(); }, 280);
  }));
  addEventListener('resize', () => movePill($('.filters [aria-selected="true"]')));
  document.fonts?.ready.then(() => movePill($('.filters [aria-selected="true"]')));
  movePill($('.filters [aria-selected="true"]'));

  moreBtn.addEventListener('click', () => { const keep = list.length; open = true; render(true, keep); });

  render();

  /* ---------- Lightbox (J/K/L like an editor) ---------- */
  const lb = $('.lightbox'), lbV = $('video', lb), lbT = $('[data-lb-title]'), lbC = $('[data-lb-count]');
  let lbList = [], lbI = 0, lastFocus = null;
  const showLB = () => {
    const w = lbList[lbI];
    lbV.src = vurl(w.id, '1080p'); lbV.poster = purl(w);
    lbV.style.height = w.v ? '100%' : 'auto'; lbV.style.width = w.v ? 'auto' : '100%';
    lbV.style.animation = 'none'; lbV.offsetHeight; lbV.style.animation = '';
    lbV.play().catch(() => {});
    lbT.textContent = `${w.t} — ${w.tag}`;
    lbC.textContent = `${String(lbI + 1).padStart(2, '0')} / ${String(lbList.length).padStart(2, '0')}`;
  };
  function openLB(i, arr = list) {
    lbList = arr; lbI = i; lastFocus = document.activeElement;
    lb.hidden = false; document.body.style.overflow = 'hidden';
    if (activeCard) stopCard(activeCard);
    showLB(); $('[data-lb-close]').focus();
  }
  const closeLB = () => { lbV.pause(); lbV.removeAttribute('src'); lbV.load(); lb.hidden = true; document.body.style.overflow = ''; lastFocus?.focus(); };
  const stepLB = d => { lbI = (lbI + d + lbList.length) % lbList.length; showLB(); };
  $('[data-lb-close]').addEventListener('click', closeLB);
  $('[data-lb-prev]').addEventListener('click', () => stepLB(-1));
  $('[data-lb-next]').addEventListener('click', () => stepLB(1));
  lbV.addEventListener('ended', () => lbList.reelMode && stepLB(1));
  lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lightbox__stage')) closeLB(); });

  // Showreel = AI reel playlist in sequence
  $$('[data-reel]').forEach(b => b.addEventListener('click', () => {
    const reel = REEL.map(id => WORK.find(w => w.id === id)).filter(Boolean);
    reel.reelMode = true; openLB(0, reel);
  }));

  /* ---------- Booking sheet ---------- */
  const sheet = $('.sheet'), frame = $('iframe', sheet);
  const openSheet = () => { if (!frame.src) frame.src = frame.dataset.src; sheet.hidden = false; document.body.style.overflow = 'hidden'; closeMenu(); };
  const closeSheet = () => { sheet.hidden = true; document.body.style.overflow = ''; };
  $$('[data-book]').forEach(b => b.addEventListener('click', openSheet));
  $('[data-sheet-close]').addEventListener('click', closeSheet);
  sheet.addEventListener('click', e => e.target === sheet && closeSheet());

  addEventListener('keydown', e => {
    if (!sheet.hidden && e.key === 'Escape') return closeSheet();
    if (lb.hidden) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') closeLB();
    else if (k === 'l' || k === 'arrowright') stepLB(1);
    else if (k === 'j' || k === 'arrowleft') stepLB(-1);
    else if (k === 'k' || k === ' ') { e.preventDefault(); lbV.paused ? lbV.play() : lbV.pause(); }
  });

  /* ---------- Mobile menu ---------- */
  const burger = $('.nav__burger'), menu = $('.menu');
  const closeMenu = () => { menu.classList.remove('is-open'); burger.setAttribute('aria-expanded', false); menu.setAttribute('aria-hidden', true); };
  burger.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open); burger.setAttribute('aria-expanded', open); menu.setAttribute('aria-hidden', !open);
  });
  $$('.menu a').forEach(a => a.addEventListener('click', closeMenu));

  /* ---------- Copy to clipboard + toast ---------- */
  const toast = $('.toast'); let tt;
  const say = msg => { toast.textContent = msg; toast.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('is-on'), 2200); };
  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); say('Email copied ✓'); }
    catch { location.href = `mailto:${b.dataset.copy}`; }
  }));

  /* ---------- Form → prefilled email ---------- */
  $('[data-form]').addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const types = f.getAll('type').join(', ') || 'Not specified';
    const body = `Hi Prabodh,\n\n${f.get('message')}\n\nProject type: ${types}\n\n— ${f.get('name')} (${f.get('email')})`;
    location.href = `mailto:kaleprabodh84@gmail.com?subject=${encodeURIComponent('New project — ' + f.get('name'))}&body=${encodeURIComponent(body)}`;
    say('Opening your email app…');
  });

  /* ---------- Count-up stats ---------- */
  const countIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, to = +el.dataset.countTo, suf = el.dataset.suffix || '', t0 = performance.now(), D = 1600;
    const tick = now => { const p = clamp((now - t0) / D, 0, 1), v = 1 - Math.pow(1 - p, 4); el.textContent = Math.round(to * v) + suf; if (p < 1) requestAnimationFrame(tick); };
    reduce ? el.textContent = to + suf : requestAnimationFrame(tick);
    countIO.unobserve(el);
  }), { threshold: .5 });
  $$('[data-count-to]').forEach(el => countIO.observe(el));

  /* ---------- Scroll-driven bits (single rAF loop) ---------- */
  const nav = $('.nav'), bar = $('.progress span'), tc = $('[data-timecode]');
  const track = $('.marquee__track'), tl = $('[data-timeline]'), head = $('.timeline__head'), clips = $$('.clip');
  if (track) track.innerHTML += track.innerHTML;
  let lastY = scrollY, mx = 0, vel = 0, dir = 1;
  const words = $$('.about__lead .wd');

  const loop = () => {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    const dy = y - lastY; lastY = y;

    // progress + timecode (24fps over a 3-minute "edit")
    const p = max > 0 ? y / max : 0;
    bar.style.transform = `scaleX(${p})`;
    const frames = Math.floor(p * 180 * 24);
    const pad = n => String(n).padStart(2, '0');
    tc.textContent = `00:${pad(Math.floor(frames / 1440))}:${pad(Math.floor(frames / 24) % 60)}:${pad(frames % 24)}`;

    // nav hide on scroll down
    nav.classList.toggle('is-scrolled', y > 40);
    if (Math.abs(dy) > 4) nav.classList.toggle('is-hidden', dy > 0 && y > 400 && !menu.classList.contains('is-open'));

    // velocity-reactive marquee
    if (!reduce && track) {
      if (dy !== 0) dir = dy > 0 ? 1 : -1;
      vel = lerp(vel, Math.abs(dy), .1);
      mx -= (0.6 + vel * .35) * dir;
      const half = track.scrollWidth / 2;
      if (mx <= -half) mx += half; if (mx > 0) mx -= half;
      track.style.transform = `translate3d(${mx}px,0,0) skewX(${clamp(-dy * .15, -8, 8)}deg)`;
    }

    // about words highlight
    if (words.length) {
      const r = lead.getBoundingClientRect();
      const prog = clamp((innerHeight * .85 - r.top) / (r.height + innerHeight * .35), 0, 1);
      const n = Math.floor(prog * words.length * 1.05);
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    }

    // timeline playhead
    if (tl) {
      const r = tl.getBoundingClientRect();
      const prog = clamp((innerHeight * .75 - r.top) / (innerHeight * .6), 0, 1);
      const w = tl.clientWidth - 36;
      head.style.transform = `translateX(${prog * w}px)`;
      const desktop = innerWidth > 1020;
      clips.forEach((c, i) => {
        const on = desktop ? prog * 4 > i + .15 : prog * 4 > i;
        c.classList.toggle('is-active', on);
      });
    }

    // cursor easing
    if (fine && !reduce) {
      dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
      ringPos.x = lerp(ringPos.x, mouse.x, .18); ringPos.y = lerp(ringPos.y, mouse.y, .18);
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  watchReveals();
})();
