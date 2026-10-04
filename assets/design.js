(() => {
  // Independent motion controller; cleaned up when the portable preview changes pages.
  if (typeof window !== 'undefined' && window.matchMedia) {
    window.__arvinifyMotionCleanup?.();
    const abort = new AbortController();
    const options = {signal: abort.signal};
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const html = document.documentElement;
    let paused = window.__arvinifyMotionPaused === true;
    let frame = 0;
    let observer;
    const animations = new Set();
    const tracked = [...document.querySelectorAll('.hero-screen, .browser-frame, .work-image img')];
    const reveal = [...document.querySelectorAll('.section-head, .work-card, .web-copy, .capabilities-intro, .capability, .catalog-card, .studio-grid, .contact-title, .contact-row, .step, .service-split')];
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'motion-toggle';
    control.setAttribute('aria-label', 'Pause animations');
    document.body.append(control);
    const active = () => !paused && !reduced.matches;
    const film = document.getElementById('studio-reel');
    const filmStage = document.querySelector('.reel-stage');
    const filmOpen = document.querySelector('.reel-open');
    const filmClose = document.querySelector('.reel-close');
    let expanded = false;
    const tryFilm = () => { if (film) film.play().catch(() => {}); };
    const syncFilm = () => {
      if (!film) return;
      if (document.hidden || (!expanded && !active())) film.pause();
      else tryFilm();
    };
    const closeFilm = () => {
      if (!film || !expanded) return;
      expanded = false; film.muted = true; film.controls = false; film.loop = true;
      filmStage.classList.remove('is-expanded'); filmStage.removeAttribute('role'); filmStage.removeAttribute('aria-modal');
      filmOpen.hidden = false; filmClose.hidden = true; document.body.style.overflow = '';
      filmOpen.focus(); syncFilm();
    };
    filmOpen?.addEventListener('click', () => {
      expanded = true; film.muted = false; film.controls = true; film.loop = false; film.currentTime = 0;
      filmStage.classList.add('is-expanded'); filmStage.setAttribute('role','dialog'); filmStage.setAttribute('aria-modal','true'); filmStage.setAttribute('aria-label','Arvinify portfolio film');
      filmOpen.hidden = true; filmClose.hidden = false; document.body.style.overflow = 'hidden'; filmClose.focus(); tryFilm();
    }, options);
    filmClose?.addEventListener('click',closeFilm,options);
    document.addEventListener('keydown',e=>{
      if(!expanded) return;
      if(e.key==='Escape')closeFilm();
      if(e.key==='Tab'){e.preventDefault();(document.activeElement===filmClose?film:filmClose).focus();}
    },options);
    film?.setAttribute('tabindex','0');
    document.addEventListener('visibilitychange',syncFilm,options);
    const intro = document.getElementById('cinema-intro');
    const replay = document.querySelector('.intro-replay');
    const skip = intro?.querySelector('.intro-skip');
    let introTimer;
    const finishIntro = () => {
      if (!intro) return;
      clearTimeout(introTimer);
      const restoreFocus = document.activeElement === skip;
      intro.hidden = true;
      html.classList.remove('intro-playing');
      if (restoreFocus) replay?.focus({preventScroll:true});
    };
    const startIntro = () => {
      if (!intro || !active()) return;
      finishIntro();
      // Reset the whole sequence for explicit replays, including child keyframes.
      void intro.offsetWidth;
      intro.hidden = false;
      html.classList.add('intro-playing');
      introTimer = setTimeout(finishIntro, 3500);
    };
    skip?.addEventListener('click', finishIntro, options);
    replay?.addEventListener('click', () => { window.scrollTo({top:0,behavior:'instant'}); startIntro(); }, options);
    intro?.addEventListener('animationend', e => { if(e.target === intro && e.animationName === 'cinema-exit') finishIntro(); },options);
    // Browsing intent always wins over a decorative sequence.
    window.addEventListener('wheel',finishIntro,{...options,passive:true});
    window.addEventListener('touchstart',finishIntro,{...options,passive:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Tab')finishIntro();},options);
    const play = (element, keyframes, settings) => {
      if (!active() || !element.animate) return;
      const animation = element.animate(keyframes, settings);
      animations.add(animation);
      animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    };
    const clearReveal = () => reveal.forEach(el => el.classList.remove('reveal-pending'));
    const watchReveals = () => {
      observer?.disconnect();
      clearReveal();
      if (!active() || !('IntersectionObserver' in window)) return;
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove('reveal-pending');
          observer.unobserve(entry.target);
          play(entry.target, [{opacity:0,translate:'0 48px'},{opacity:1,translate:'0 0'}], {duration:850,easing:'cubic-bezier(.16,1,.3,1)',fill:'none'});
        });
      }, {threshold:0,rootMargin:'0px 0px -35px 0px'});
      reveal.forEach(el => {
        // Never hide content already on screen, or keyboard-focused content.
        if (el.getBoundingClientRect().top > window.innerHeight && !el.matches(':focus-within')) {
          el.classList.add('reveal-pending');
          observer.observe(el);
        }
      });
    };
    const render = () => {
      frame = 0;
      if (!active() || document.hidden) return;
      const small = window.innerWidth < 761;
      const viewport = window.innerHeight;
      const measurements = tracked.map(el => ({el,rect:el.parentElement.getBoundingClientRect()}));
      measurements.forEach(({el,rect},index) => {
        if (rect.bottom < 0 || rect.top > viewport) return;
        const progress = Math.max(-1,Math.min(1,(viewport/2-(rect.top+rect.height/2))/viewport));
        const direction = el.classList.contains('hero-screen') && index%2 ? -1 : 1;
        el.style.setProperty('--scroll-shift', `${(progress*(small?22:85)*direction).toFixed(2)}px`);
      });
    };
    const schedule = () => { if (!frame && active() && !document.hidden) frame = requestAnimationFrame(render); };
    const sync = () => {
      syncFilm();
      html.classList.toggle('motion-paused', !active());
      if (replay) replay.hidden = !active();
      if (!active()) finishIntro();
      control.disabled = reduced.matches;
      control.textContent = reduced.matches ? 'Motion reduced' : paused ? '▶ Play motion' : 'Ⅱ Pause motion';
      control.setAttribute('aria-label', paused ? 'Play animations' : 'Pause animations');
      control.setAttribute('aria-pressed', String(!active()));
      animations.forEach(animation => animation.cancel());
      if (!active()) {
        cancelAnimationFrame(frame); frame=0;
        tracked.forEach(el => el.style.removeProperty('--scroll-shift'));
        document.querySelectorAll('.work-image').forEach(el => {el.style.removeProperty('--tilt-x');el.style.removeProperty('--tilt-y');});
      }
      watchReveals(); schedule();
    };
    control.addEventListener('click', () => {paused=!paused;window.__arvinifyMotionPaused=paused;sync();}, options);
    reduced.addEventListener('change',sync,options);
    window.addEventListener('scroll',schedule,{...options,passive:true});
    window.addEventListener('resize',schedule,{...options,passive:true});
    document.addEventListener('visibilitychange',()=>{html.classList.toggle('motion-background',document.hidden);schedule();},options);
    document.addEventListener('focusin', e => e.target.closest('.reveal-pending')?.classList.remove('reveal-pending'),options);
    document.querySelectorAll('.work-image').forEach(el => {
      el.addEventListener('pointermove',e=>{
        if (!active() || !finePointer.matches || e.pointerType === 'touch') return;
        const rect=el.getBoundingClientRect();
        el.style.setProperty('--tilt-x',`${((e.clientY-rect.top)/rect.height-.5)*-5}deg`);
        el.style.setProperty('--tilt-y',`${((e.clientX-rect.left)/rect.width-.5)*6}deg`);
      },options);
      el.addEventListener('pointerleave',()=>{el.style.setProperty('--tilt-x','0deg');el.style.setProperty('--tilt-y','0deg');},options);
    });
    document.querySelectorAll('.capability').forEach(el=>el.addEventListener('toggle',()=>{
      if(el.open) play(el.querySelector('.cap-content'),[{opacity:0,translate:'0 -10px'},{opacity:1,translate:'0 0'}],{duration:350,easing:'ease-out'});
    },options));
    // Original interactive wire surface: torus -> funnel, scroll and tap controlled.
    const clarity = document.querySelector('.clarity-motion');
    let stopClarity = () => {};
    if (clarity) {
      const canvas = clarity.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const toggle = clarity.querySelector('.shape-toggle');
      let raf=0, visible=true, width=0, height=0, spin=0, morph=0, tapped=false, pulse=0, last=0;
      let px=0,py=0; let visibility;
      const clamp=v=>Math.max(0,Math.min(1,v));
      const size=()=>{
        const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
        const dpr=Math.min(window.devicePixelRatio||1,2);
        canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
        ctx.setTransform(dpr,0,0,dpr,0,0);
      };
      const draw=now=>{
        raf=0;if(!width||!height)return;
        const moving=active()&&!document.hidden;const dt=Math.min((now-last)/1000||0,.04);last=now;
        const rect=clarity.getBoundingClientRect();
        const progress=clamp(-rect.top/Math.max(1,rect.height-window.innerHeight));
        const target=tapped?1-progress:progress;
        morph=moving?morph+(target-morph)*.075:target;
        if(moving){spin+=dt*.095;pulse*=.94;}
        ctx.clearRect(0,0,width,height);
        const scale=Math.min(width*.40,height*.54)*(1+pulse*.04);
        const project=(u,v)=>{
          const r=1+.29*Math.cos(v);
          const tx=r*Math.cos(u),ty=r*Math.sin(u),tz=.29*Math.sin(v);
          const q=(v+Math.PI)/(Math.PI*2),fr=.16+1.24*Math.pow(q,2.8);
          const fx=fr*Math.cos(u),fy=(q-.48)*2.45,fz=fr*Math.sin(u);
          let x=tx*(1-morph)+fx*morph,y=ty*(1-morph)+fy*morph,z=tz*(1-morph)+fz*morph;
          const yaw=spin+px*.13,tilt=.13+py*.11;
          const xx=x*Math.cos(yaw)+z*Math.sin(yaw),zz=-x*Math.sin(yaw)+z*Math.cos(yaw);
          const yy=y*Math.cos(tilt)-zz*Math.sin(tilt),depth=y*Math.sin(tilt)+zz*Math.cos(tilt);
          const perspective=3.8/(3.8+depth);
          return [width/2+xx*scale*perspective,height/2+yy*scale*perspective];
        };
        ctx.lineWidth=.65;ctx.strokeStyle='rgba(211,205,191,.25)';
        const line=points=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();};
        for(let j=0;j<=22;j++){const v=-Math.PI+j*Math.PI*2/22;line(Array.from({length:89},(_,i)=>project(i*Math.PI*2/88,v)));}
        ctx.strokeStyle='rgba(255,187,82,.18)';
        for(let i=0;i<56;i++){const u=i*Math.PI*2/56;line(Array.from({length:45},(_,j)=>project(u,-Math.PI+j*Math.PI*2/44)));}
        if(moving&&visible)raf=requestAnimationFrame(draw);
      };
      const wake=()=>{if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(draw);};
      const resize=()=>{size();wake();};size();
      if(window.IntersectionObserver){visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)wake();else{cancelAnimationFrame(raf);raf=0;}},{rootMargin:'100px'});visibility.observe(clarity);}
      toggle.addEventListener('click',()=>{tapped=!tapped;pulse=1;toggle.setAttribute('aria-pressed',String(tapped));wake();},options);
      canvas.addEventListener('click',()=>toggle.click(),options);
      clarity.addEventListener('pointermove',e=>{if(!finePointer.matches||!active())return;const r=canvas.getBoundingClientRect();px=(e.clientX-r.left)/r.width-.5;py=(e.clientY-r.top)/r.height-.5;},options);
      clarity.addEventListener('pointerleave',()=>{px=py=0;},options);
      window.addEventListener('resize',resize,{...options,passive:true});
      window.addEventListener('scroll',wake,{...options,passive:true});
      document.addEventListener('visibilitychange',wake,options);
      control.addEventListener('click',wake,options);reduced.addEventListener('change',wake,options);
      wake();stopClarity=()=>{cancelAnimationFrame(raf);visibility?.disconnect();};
    }
    document.querySelectorAll('.button,.brand-motion-card,.shape-toggle').forEach(el=>{
      el.addEventListener('pointermove',e=>{if(!active()||!finePointer.matches)return;const r=el.getBoundingClientRect();el.style.setProperty('--hover-x',`${((e.clientX-r.left)/r.width-.5)*8}px`);el.style.setProperty('--hover-y',`${((e.clientY-r.top)/r.height-.5)*6}px`);},options);
      el.addEventListener('pointerleave',()=>{el.style.setProperty('--hover-x','0px');el.style.setProperty('--hover-y','0px');},options);
    });
    window.__arvinifyMotionCleanup = () => {
      stopClarity();
      if (film) { film.pause(); document.body.style.overflow = ''; }
      finishIntro();
      abort.abort(); observer?.disconnect(); cancelAnimationFrame(frame);
      animations.forEach(animation=>animation.cancel()); clearReveal();control.remove();
      html.classList.remove('motion-paused','motion-background');
    };
    sync();
    if (!window.location?.hash) startIntro();
  }
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.primary-nav');
  if (menu && nav) {
    const close = () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.textContent = 'Menu'; };
    menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; nav.classList.toggle('open', open); menu.setAttribute('aria-expanded', String(open)); menu.textContent = open ? 'Close' : 'Menu'; });
    nav.addEventListener('click', e => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { close(); menu.focus(); } });
  }
  const filters = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('[data-category]')];
  const count = document.getElementById('catalog-count');
  filters.forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    let shown = 0;
    cards.forEach(card => { const match = filter === 'all' || card.dataset.category === filter; card.hidden = !match; shown += Number(match); });
    if (count) count.textContent = `Showing ${shown} of ${cards.length} products`;
  }));
  const form = document.getElementById('project-brief');
  if (!form) return;
  const service = new URLSearchParams(location.search).get('service');
  const serviceInput = form.elements.namedItem('service');
  if (serviceInput && [...serviceInput.options].some(option => option.value === service)) serviceInput.value = service;
  const status = document.getElementById('form-status');
  const summary = () => {
    const data = new FormData(form);
    return ['Project enquiry for Arvinify Technology Inc.', '', ...['name','email','company','service','stage','timeline','audience','problem'].map(key => `${({name:'Name',email:'Email',company:'Company',service:'Project type',stage:'Current stage',timeline:'Timeline',audience:'Audience',problem:'Project goals'})[key]}: ${data.get(key) || 'Not specified'}`)].join('\n\n');
  };
  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(form);
    location.href = `mailto:hello@arvinify.com?subject=${encodeURIComponent(`${data.get('service')} project — ${data.get('name')}`)}&body=${encodeURIComponent(summary())}`;
    status.textContent = 'Your email draft is prepared. Review and send it in your email app. If it did not open, use “Copy project brief” and email hello@arvinify.com.';
  });
  document.getElementById('copy-brief')?.addEventListener('click', async () => {
    if (!form.reportValidity()) return;
    try { await navigator.clipboard.writeText(summary()); status.textContent = 'Project brief copied. Paste it into an email to hello@arvinify.com. Nothing has been sent yet.'; }
    catch { status.textContent = 'Copy is unavailable in this preview. Use “Prepare my email” or email hello@arvinify.com directly.'; }
  });
})();
