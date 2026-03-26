/* SABI Landing — Interactions */
document.addEventListener('DOMContentLoaded',()=>{
  // Navbar scroll
  const nav=document.getElementById('navbar');
  window.addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>30),{passive:true});

  // Mobile menu
  const mob=document.getElementById('mobTog'),links=document.querySelector('.nav-links');
  mob.addEventListener('click',()=>{links.classList.toggle('open');const s=mob.querySelectorAll('span');if(links.classList.contains('open')){s[0].style.transform='rotate(45deg) translate(5px,5px)';s[1].style.opacity='0';s[2].style.transform='rotate(-45deg) translate(5px,-5px)'}else{s.forEach(x=>{x.style.transform='';x.style.opacity=''})}});
  links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{links.classList.remove('open');mob.querySelectorAll('span').forEach(x=>{x.style.transform='';x.style.opacity=''})}));

  // Scroll reveal
  const obs=new IntersectionObserver(e=>e.forEach(x=>{if(x.isIntersecting){setTimeout(()=>x.target.classList.add('visible'),parseInt(x.target.dataset.delay||0));obs.unobserve(x.target)}}),{threshold:.08,rootMargin:'0px 0px -40px'});
  document.querySelectorAll('[data-anim]').forEach(el=>obs.observe(el));

  // Counter animation
  const cObs=new IntersectionObserver(e=>e.forEach(x=>{if(x.isIntersecting){const el=x.target,t=parseInt(el.dataset.count),sfx=el.dataset.sfx||'',dur=1800,st=performance.now();const anim=n=>{const p=Math.min((n-st)/dur,1),v=Math.round((1-Math.pow(1-p,3))*t);el.textContent=v+sfx;if(p<1)requestAnimationFrame(anim)};requestAnimationFrame(anim);cObs.unobserve(el)}}),{threshold:.5});
  document.querySelectorAll('[data-count]').forEach(el=>cObs.observe(el));

  // Screenshot tabs
  const ssTabs=document.querySelectorAll('.ss-tab'),ssImgs=document.querySelectorAll('.ss-img');
  ssTabs.forEach(tab=>tab.addEventListener('click',()=>{ssTabs.forEach(t=>t.classList.remove('active'));tab.classList.add('active');ssImgs.forEach(img=>img.classList.toggle('active',img.dataset.idx===tab.dataset.ss))}));

  // Feature filter
  const fBtns=document.querySelectorAll('.ff'),fCards=document.querySelectorAll('.fc');
  fBtns.forEach(btn=>btn.addEventListener('click',()=>{fBtns.forEach(b=>b.classList.remove('active'));btn.classList.add('active');const f=btn.dataset.f;fCards.forEach(c=>{const show=f==='all'||c.dataset.f===f;c.classList.toggle('hidden',!show);if(show){c.style.opacity='0';c.style.transform='translateY(12px)';requestAnimationFrame(()=>{c.style.transition='opacity .3s,transform .3s';c.style.opacity='1';c.style.transform='translateY(0)'})}})}));

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const t=document.querySelector(a.getAttribute('href'));if(t){const off=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'))||64;window.scrollTo({top:t.getBoundingClientRect().top+scrollY-off,behavior:'smooth'})}}));
});
