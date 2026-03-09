/* ═══════════════════════════════════════════════════════════════
   SATYAM KUMAR — Portfolio Script  v3
   ─────────────────────────────────────────────────────────────
   Execution order (safe, no conflicts):
     A. Lenis smooth scroll + ScrollTrigger sync
     B. Scroll progress bar
     C. Custom cursor (dot + ring + state classes)
     D. Nav scroll-state
     E. Three.js hero  — cube + particle field (self-contained RAF)
     F. GSAP hero intro timeline
     G. SplitType text mask reveals (about, section titles, contact)
     H. Skills stagger + parallax depth + bar fill
     I. Work rows reveal
     J. Cert cards reveal
     K. Parallax layers (skills orbs, work grid)
     L. Magnetic buttons (contact mega-btn + primary)
     M. Tag / section label reveals
   ─────────────────────────────────────────────────────────────
   Rules followed to prevent conflicts:
   • Three.js runs in its own RAF loop, never touches GSAP.
   • GSAP ScrollTrigger is registered ONCE.
   • Lenis drives GSAP ticker; no duplicate raf calls.
   • SplitType runs AFTER hero intro (hero text is NOT split).
   • Magnetic buttons use GSAP but only on transform x/y.
   • Parallax uses scrub:true ScrollTriggers (no overlap with
     the reveal triggers which use toggleActions).
   • cursor-hover class is added/removed per element; no races.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────
   GUARD: make sure all libs loaded before running
───────────────────────────────────────────────── */
if (typeof gsap === 'undefined' || typeof THREE === 'undefined') {
  console.error('Required libraries missing.');
}

gsap.registerPlugin(ScrollTrigger);


/* ═══════════════════════════════════════════════════
   A. LENIS SMOOTH SCROLL
   Quartic ease-out produces the Apple "silky stop".
   We drive it via gsap.ticker so there's one RAF loop.
═══════════════════════════════════════════════════ */
const lenis = new Lenis({
  duration: 1.5,
  easing: t => 1 - Math.pow(1 - t, 4),
  smoothWheel: true,
  wheelMultiplier: 0.82,
  touchMultiplier: 1.8,
});

gsap.ticker.add(time => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
lenis.on('scroll', ScrollTrigger.update);


/* ═══════════════════════════════════════════════════
   B. SCROLL PROGRESS BAR
   Reads lenis scroll position and updates #scroll-progress width.
═══════════════════════════════════════════════════ */
const progressBar = document.getElementById('scroll-progress');
if (progressBar) {
  lenis.on('scroll', ({ progress }) => {
    progressBar.style.width = (progress * 100) + '%';
  });
}


/* ═══════════════════════════════════════════════════
   C. CUSTOM CURSOR
   - #cursor  (dot) follows mouse instantly via direct style
   - #cursor-ring lerps behind with simple rAF loop
   - body class changes: cursor-hover, cursor-text, cursor-mag
═══════════════════════════════════════════════════ */
(function initCursor() {
  const dot  = document.getElementById('cursor');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;
  let rafId;

  window.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
  });

  function ringLoop() {
    // Lerp the ring — coefficient 0.10 = buttery lag
    rx += (mx - rx) * 0.10;
    ry += (my - ry) * 0.10;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    rafId = requestAnimationFrame(ringLoop);
  }
  ringLoop();

  // ── Hover states ──
  // General interactive elements → larger ring
  document.querySelectorAll('a, button, [data-mag], .sk-card, .cert-card, .project-row').forEach(el => {
    el.addEventListener('mouseenter', () => {
      document.body.classList.add('cursor-hover');
      // Magnetic elements get a teal ring
      if (el.hasAttribute('data-mag')) document.body.classList.add('cursor-mag');
    });
    el.addEventListener('mouseleave', () => {
      document.body.classList.remove('cursor-hover', 'cursor-mag');
    });
  });

  // Text areas → I-beam cursor dot
  document.querySelectorAll('p, h1, h2, h3').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-text'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-text'));
  });
})();


/* ═══════════════════════════════════════════════════
   D. NAV SCROLL STATE
═══════════════════════════════════════════════════ */
const nav = document.getElementById('nav');
if (nav) {
  ScrollTrigger.create({
    start: 'top -80px',
    onUpdate: self => nav.classList.toggle('scrolled', self.scroll() > 80),
  });
}


/* ═══════════════════════════════════════════════════
   E. THREE.JS HERO — CUBE + PARTICLE FIELD
   ──────────────────────────────────────────────────
   Two passes in one scene:
     1. Particle field  — 1 800 PointsMaterial pts
        (lilac + teal + white vertex colours, slow drift)
     2. Central cube    — BoxGeometry with EdgesGeometry
        (wireframe-style with subtle ambient + point lights)

   Mouse parallax gently tilts the whole scene group.
   Cube auto-rotates at ~8 rpm — no ScrollTrigger.
   Runs in its own requestAnimationFrame, isolated from GSAP.
═══════════════════════════════════════════════════ */
(function initHeroThree() {
  const canvas = document.getElementById('c');
  if (!canvas) return;

  /* ── Renderer ── */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping    = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  /* ── Scene & Camera ── */
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 0, 5);

  /* ── Root group (receives mouse parallax) ── */
  const root = new THREE.Group();
  scene.add(root);

  /* ─────────────────────────────────────
     PARTICLE FIELD
     1 800 points with vertex colours.
     Drift velocities are tiny so particles
     float imperceptibly rather than swim.
  ───────────────────────────────────── */
  const PTS   = 1800;
  const ptPos = new Float32Array(PTS * 3);
  const ptCol = new Float32Array(PTS * 3);
  const ptVel = new Float32Array(PTS * 3); // xy drift only

  const cLilac = new THREE.Color('#c4b5fd');
  const cTeal  = new THREE.Color('#2dd4bf');
  const cWhite = new THREE.Color('#ffffff');

  for (let i = 0; i < PTS; i++) {
    const i3 = i * 3;
    ptPos[i3]     = (Math.random() - 0.5) * 22;
    ptPos[i3 + 1] = (Math.random() - 0.5) * 14;
    ptPos[i3 + 2] = (Math.random() - 0.5) * 10 - 2; // push particles back a little

    ptVel[i3]     = (Math.random() - 0.5) * 0.0012;
    ptVel[i3 + 1] = (Math.random() - 0.5) * 0.0009;

    const r   = Math.random();
    const col = r < 0.55 ? cLilac : r < 0.85 ? cTeal : cWhite;
    ptCol[i3]     = col.r;
    ptCol[i3 + 1] = col.g;
    ptCol[i3 + 2] = col.b;
  }

  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(ptPos, 3));
  ptGeo.setAttribute('color',    new THREE.BufferAttribute(ptCol, 3));

  const ptMat = new THREE.PointsMaterial({
    size: 0.02,
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
    depthWrite: false,       // prevents z-fighting with cube
  });

  const particles = new THREE.Points(ptGeo, ptMat);
  root.add(particles);

  /* ─────────────────────────────────────
     CUBE — wireframe-style with edges
     Using EdgesGeometry over BoxGeometry
     gives a clean, minimal floating cube.
     Three lights: ambient, warm point (top-right),
     cool point (bottom-left) = soft cinematic rim.
  ───────────────────────────────────── */

  // Solid geometry (invisible, just for lighting reference)
  const boxGeo   = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const edgesGeo = new THREE.EdgesGeometry(boxGeo);

  // Glowing edge lines
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xc4b5fd,        // lilac
    transparent: true,
    opacity: 0.85,
    linewidth: 1,           // WebGL always 1px in most browsers
  });
  const edgeMesh = new THREE.LineSegments(edgesGeo, edgeMat);

  // Inner fill — very faint so edges pop
  const fillMat  = new THREE.MeshStandardMaterial({
    color: 0x100818,
    roughness: 0.2,
    metalness: 0.9,
    transparent: true,
    opacity: 0.35,
  });
  const fillMesh = new THREE.Mesh(boxGeo, fillMat);

  // Cube group positioned right-of-centre
  const cubeGroup = new THREE.Group();
  cubeGroup.add(fillMesh, edgeMesh);
  cubeGroup.position.set(2.8, 0, 0);   // right side of hero
  root.add(cubeGroup);

  /* ── Lighting ── */
  // Ambient — dim fill so the solid face isn't pitch black
  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambient);

  // Key light — warm lilac, top-right
  const keyLight = new THREE.PointLight(0xc4b5fd, 3.5, 18);
  keyLight.position.set(5, 5, 4);
  scene.add(keyLight);

  // Rim light — teal, bottom-left
  const rimLight = new THREE.PointLight(0x2dd4bf, 2.0, 14);
  rimLight.position.set(-4, -3, 2);
  scene.add(rimLight);

  // Subtle bounce — very dim warm white from below
  const bounceLight = new THREE.PointLight(0xffe8d0, 0.6, 10);
  bounceLight.position.set(0, -5, 3);
  scene.add(bounceLight);

  /* ── Secondary detail cube (small, offset, faster spin) ── */
  const smallEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.55, 0.55, 0.55));
  const smallMat   = new THREE.LineBasicMaterial({
    color: 0x2dd4bf, transparent: true, opacity: 0.45,
  });
  const smallCube = new THREE.LineSegments(smallEdges, smallMat);
  smallCube.position.set(1.5, -1.1, 0.5);
  root.add(smallCube);

  /* ── Mouse parallax tracking ── */
  let tRotX = 0, tRotY = 0;   // target
  let cRotX = 0, cRotY = 0;   // current (lerped)

  window.addEventListener('mousemove', e => {
    // Normalise -0.5 → 0.5
    tRotY = ((e.clientX / innerWidth)  - 0.5) *  0.45;
    tRotX = ((e.clientY / innerHeight) - 0.5) * -0.28;
  });

  /* ── Resize ── */
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /* ── Animation loop (isolated rAF) ── */
  const clock = new THREE.Clock();

  function tick() {
    const t = clock.getElapsedTime();

    /* Drift particles */
    const pos = ptGeo.attributes.position.array;
    for (let i = 0; i < PTS; i++) {
      const i3 = i * 3;
      pos[i3]     += ptVel[i3];
      pos[i3 + 1] += ptVel[i3 + 1];
      // Wrap at bounds
      if (pos[i3]     >  11) pos[i3]     = -11;
      if (pos[i3]     < -11) pos[i3]     =  11;
      if (pos[i3 + 1] >   7) pos[i3 + 1] = -7;
      if (pos[i3 + 1] < -7)  pos[i3 + 1] =  7;
    }
    ptGeo.attributes.position.needsUpdate = true;

    /* Rotate main cube — slow, cinematic */
    cubeGroup.rotation.x = t * 0.22;
    cubeGroup.rotation.y = t * 0.34;
    cubeGroup.rotation.z = t * 0.09;

    /* Rotate secondary cube — slightly faster, opposite axis */
    smallCube.rotation.x = -t * 0.45;
    smallCube.rotation.y =  t * 0.6;

    /* Subtle cube hover bob */
    cubeGroup.position.y = Math.sin(t * 0.7) * 0.18;

    /* Mouse parallax: lerp root group toward target */
    cRotX += (tRotX - cRotX) * 0.04;
    cRotY += (tRotY - cRotY) * 0.04;
    root.rotation.x = cRotX;
    root.rotation.y = cRotY;

    /* Slow overall particle drift rotation */
    particles.rotation.z = t * 0.012;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
})();


/* ═══════════════════════════════════════════════════
   F. GSAP HERO INTRO TIMELINE
   Wraps each .ht-row in an overflow:hidden container
   so the inner span slides up from behind a clip mask.
   Runs once on load; no ScrollTrigger.
═══════════════════════════════════════════════════ */
(function heroIntro() {
  /* Prepare title line mask clips */
  document.querySelectorAll('.ht-row').forEach(row => {
    // Only process if not already wrapped
    if (row.querySelector('span')) return;
    const inner = document.createElement('span');
    inner.style.display = 'block';
    inner.innerHTML = row.innerHTML;
    row.innerHTML = '';
    row.style.overflow = 'hidden';
    row.appendChild(inner);
  });

  const lineSpans = document.querySelectorAll('.ht-row > span');

  const tl = gsap.timeline({ delay: 0.25 });

  // Kicker line + text
  tl.to('#hk', {
    opacity: 1, y: 0,
    duration: 0.9,
    ease: 'power3.out',
  });

  // Title lines cascade up
  tl.to(lineSpans, {
    y: '0%',
    duration: 1.15,
    stagger: 0.13,
    ease: 'power4.out',
  }, '-=0.4');

  // Subheading
  tl.to('#hs', {
    opacity: 1, y: 0,
    duration: 0.9,
    ease: 'power3.out',
  }, '-=0.55');

  // CTA buttons
  tl.to('#ha', {
    opacity: 1, y: 0,
    duration: 0.8,
    ease: 'power3.out',
  }, '-=0.5');

  // Scroll hint
  tl.to('.hero-scroll-hint', {
    opacity: 1,
    duration: 0.7,
    ease: 'power2.out',
  }, '-=0.35');

  // Stat pills bounce in
  tl.to('#p1', {
    opacity: 1, y: 0,
    duration: 0.65,
    ease: 'back.out(1.6)',
  }, '-=0.1')
    .to('#p2', {
    opacity: 1, y: 0,
    duration: 0.65,
    ease: 'back.out(1.6)',
  }, '-=0.42');
})();


/* ═══════════════════════════════════════════════════
   G. SPLITTYPE TEXT MASK REVEALS
   ──────────────────────────────────────────────────
   Applied to:
   • #aboutBody        — word-by-word cascade
   • .section-title    — line-by-line (each heading)
   • #contactTitle     — line-by-line
   • .about-body-2     — simple fade-up (no split needed)

   Each reveal uses a ScrollTrigger with start:'top 80%'
   and toggleActions:'play none none reverse' so it
   re-animates when scrolling back up.

   IMPORTANT: SplitType is called AFTER a 100 ms timeout
   so the DOM is fully settled post-hero-intro, avoiding
   any layout-shift conflicts.
═══════════════════════════════════════════════════ */
setTimeout(function setupSplitType() {
  if (typeof SplitType === 'undefined') return;

  /* ── Helper: wrap each word's inner text in a clip container ── */
  function maskWords(el) {
    // Re-split fresh
    const st = new SplitType(el, { types: 'words', tagName: 'span' });
    st.words.forEach(word => {
      const inner = document.createElement('span');
      inner.style.display       = 'inline-block';
      inner.style.transform     = 'translateY(115%)';
      inner.style.opacity       = '0';
      inner.innerHTML = word.innerHTML;
      word.innerHTML  = '';
      word.style.overflow      = 'hidden';
      word.style.display       = 'inline-block';
      word.style.verticalAlign = 'bottom';
      word.appendChild(inner);
    });
    return el.querySelectorAll('.word > span');
  }

  /* ── Helper: split into lines and reveal each ── */
  function maskLines(el) {
    const st = new SplitType(el, { types: 'lines', tagName: 'span' });
    st.lines.forEach(line => {
      const inner = document.createElement('span');
      inner.style.display   = 'block';
      inner.style.transform = 'translateY(110%)';
      inner.style.opacity   = '0';
      inner.innerHTML = line.innerHTML;
      line.innerHTML  = '';
      line.style.overflow = 'hidden';
      line.style.display  = 'block';
      line.appendChild(inner);
    });
    return el.querySelectorAll('.line > span');
  }

  /* ── 1. About body — word cascade ── */
  const aboutEl = document.getElementById('aboutBody');
  if (aboutEl) {
    const spans = maskWords(aboutEl);
    gsap.to(spans, {
      y: '0%',
      opacity: 1,
      duration: 0.78,
      stagger: 0.015,
      ease: 'power4.out',
      scrollTrigger: {
        trigger: aboutEl,
        start: 'top 80%',
        toggleActions: 'play none none reverse',
      },
    });
  }

  /* ── 2. About body 2 — simple fade ── */
  const about2 = document.querySelector('.about-body-2');
  if (about2) {
    gsap.fromTo(about2,
      { opacity: 0, y: 18 },
      {
        opacity: 1, y: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: about2,
          start: 'top 83%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }

  /* ── 3. Section titles — line reveals ── */
  document.querySelectorAll('.section-title').forEach(el => {
    // Skip if already processed
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';

    const spans = maskLines(el);
    gsap.to(spans, {
      y: '0%',
      opacity: 1,
      duration: 1.0,
      stagger: 0.12,
      ease: 'power4.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
    });
  });

  /* ── 4. Contact title ── */
  const contactTitle = document.getElementById('contactTitle');
  if (contactTitle && !contactTitle.dataset.splitDone) {
    contactTitle.dataset.splitDone = '1';
    const spans = maskLines(contactTitle);
    gsap.to(spans, {
      y: '0%',
      opacity: 1,
      duration: 1.1,
      stagger: 0.14,
      ease: 'power4.out',
      scrollTrigger: {
        trigger: contactTitle,
        start: 'top 80%',
        toggleActions: 'play none none reverse',
      },
    });
  }

  /* ── 5. Project titles ── */
  document.querySelectorAll('.proj-title').forEach(el => {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    const spans = maskLines(el);
    gsap.to(spans, {
      y: '0%',
      opacity: 1,
      duration: 0.85,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none reverse',
      },
    });
  });

}, 120); // 120 ms delay — after hero intro starts


/* ═══════════════════════════════════════════════════
   H. SKILLS — STAGGER + PARALLAX DEPTH + BAR FILL
═══════════════════════════════════════════════════ */
(function skillsReveal() {
  const cards = document.querySelectorAll('.sk-card');

  /* Stagger reveal on scroll enter */
  gsap.to(cards, {
    opacity: 1,
    y: 0,
    duration: 0.75,
    stagger: 0.075,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#skills',
      start: 'top 72%',
      toggleActions: 'play none none reverse',
      onEnter: () => cards.forEach(c => c.classList.add('animated')),
      onLeaveBack: () => cards.forEach(c => c.classList.remove('animated')),
    },
  });

  /* Per-card depth parallax (scrub — no conflict with reveal) */
  cards.forEach(card => {
    const depth = parseFloat(card.dataset.depth || '0.4');
    gsap.to(card, {
      y: () => -55 * depth,
      ease: 'none',
      scrollTrigger: {
        trigger: '#skills',
        start: 'top bottom',
        end:   'bottom top',
        scrub: 1.5,
      },
    });
  });
})();


/* ═══════════════════════════════════════════════════
   I. WORK ROWS REVEAL
═══════════════════════════════════════════════════ */
(function workReveal() {
  document.querySelectorAll('.project-row').forEach((row, i) => {
    gsap.to(row, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      delay: i * 0.08,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: row,
        start: 'top 84%',
        toggleActions: 'play none none reverse',
      },
    });
  });
})();


/* ═══════════════════════════════════════════════════
   J. CERT CARDS REVEAL
═══════════════════════════════════════════════════ */
(function certReveal() {
  gsap.to('.cert-card', {
    opacity: 1,
    y: 0,
    duration: 0.7,
    stagger: 0.09,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '.certs-grid',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });
})();


/* ═══════════════════════════════════════════════════
   K. PARALLAX LAYERS
   ──────────────────────────────────────────────────
   Skills section: two ambient orbs move at different
   speeds relative to scroll (scrub).
   Work section: grid lines shift slightly upward.
   These use scrub:true so they never conflict with
   the toggle-based reveal triggers above.
═══════════════════════════════════════════════════ */
(function parallaxLayers() {
  /* Skills orbs */
  const orb1 = document.querySelector('#skills .plx-orb-1');
  const orb2 = document.querySelector('#skills .plx-orb-2');

  if (orb1) {
    gsap.to(orb1, {
      y: -80,
      ease: 'none',
      scrollTrigger: { trigger: '#skills', start: 'top bottom', end: 'bottom top', scrub: 2 },
    });
  }
  if (orb2) {
    gsap.to(orb2, {
      y: 60,
      x: -30,
      ease: 'none',
      scrollTrigger: { trigger: '#skills', start: 'top bottom', end: 'bottom top', scrub: 2.5 },
    });
  }

  /* Work section grid lines — subtle upward drift */
  const grid = document.querySelector('#work .plx-grid');
  if (grid) {
    gsap.to(grid, {
      y: -50,
      ease: 'none',
      scrollTrigger: { trigger: '#work', start: 'top bottom', end: 'bottom top', scrub: 1.8 },
    });
  }

  /* About section — portrait subtle scale on scroll */
  const portrait = document.querySelector('.about-portrait');
  if (portrait) {
    gsap.fromTo(portrait,
      { opacity: 0, scale: 0.88 },
      {
        opacity: 1, scale: 1,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: portrait, start: 'top 85%' },
      }
    );
  }

  /* Meta rows */
  gsap.fromTo('.meta-row',
    { opacity: 0, x: -14 },
    {
      opacity: 1, x: 0,
      duration: 0.55,
      stagger: 0.08,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.about-meta', start: 'top 85%' },
    }
  );

  /* Contact row */
  gsap.fromTo('.contact-row',
    { opacity: 0, y: 28 },
    {
      opacity: 1, y: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.contact-row', start: 'top 82%' },
    }
  );
})();


/* ═══════════════════════════════════════════════════
   L. MAGNETIC BUTTONS
   ──────────────────────────────────────────────────
   All [data-mag] elements pull toward the cursor.
   Strength: 0.3 (subtle, premium — not gimmicky).
   Spring-back uses elastic ease for physicality.
   Uses GSAP transforms only — no conflict with other
   animations since we only touch x/y.
═══════════════════════════════════════════════════ */
(function magneticButtons() {
  document.querySelectorAll('[data-mag]').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r  = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width  / 2);
      const dy = e.clientY - (r.top  + r.height / 2);
      gsap.to(btn, {
        x: dx * 0.30,
        y: dy * 0.30,
        duration: 0.45,
        ease: 'power2.out',
        overwrite: 'auto',  // prevents stacking tweens
      });
    });

    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, {
        x: 0, y: 0,
        duration: 0.8,
        ease: 'elastic.out(1, 0.32)',
        overwrite: 'auto',
      });
    });
  });
})();


/* ═══════════════════════════════════════════════════
   M. TAG LABELS + SECTION-LABEL REVEALS
═══════════════════════════════════════════════════ */
(function tagReveal() {
  gsap.utils.toArray('.reveal-tag, .tag').forEach(tag => {
    gsap.fromTo(tag,
      { opacity: 0, y: 10, scale: 0.94 },
      {
        opacity: 1, y: 0, scale: 1,
        duration: 0.65,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: tag,
          start: 'top 90%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  });
})();
