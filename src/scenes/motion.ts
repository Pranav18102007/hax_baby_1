import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { isTouch, reducedMotion } from '../core/a11y';
import { store } from '../core/store';
import { setLenis } from '../core/scroll';

/**
 * Scroll choreography. Everything here is decoration on top of a page that already works
 * without it: with reduced motion none of it runs, and the scenes simply stack.
 */

let ctx: gsap.Context | null = null;
let lenis: Lenis | null = null;

function build(): void {
  ctx?.revert();
  ctx = null;
  if (reducedMotion()) return;

  ctx = gsap.context(() => {
    // S1: the giant PIP letters stretch tall and drift up; Pip rises; clouds roll in
    const hero = { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 0.6 };
    gsap.to('.hero-letters', { scaleY: 1.9, scaleX: 0.86, yPercent: -30, opacity: 0.15, transformOrigin: '50% 0%', ease: 'none', scrollTrigger: hero });
    gsap.to('.hero-sub, .tagline', { yPercent: -60, opacity: 0, ease: 'none', scrollTrigger: { ...hero, end: '60% top' } });
    gsap.to('#pip', { yPercent: -18, ease: 'none', scrollTrigger: hero });
    gsap.to('.hero-clouds', { yPercent: -22, ease: 'none', scrollTrigger: hero });
    gsap.to('#hero .paint', { yPercent: 12, ease: 'none', scrollTrigger: hero });

    // S4: fly up into the dome's oculus
    const domeTl = gsap.timeline({ scrollTrigger: { trigger: '#dome', start: 'top top', end: isTouch() ? '+=70%' : '+=110%', scrub: 0.5, pin: true } });
    domeTl
      .fromTo('.dome-paint img', { scale: 1 }, { scale: 4.2, ease: 'power2.in', duration: 1 }, 0)
      .fromTo('.dome-title', { scale: 0.85, opacity: 0.75 }, { scale: 1.15, opacity: 1, duration: 0.45, ease: 'power1.out' }, 0)
      .to('.dome-title', { scale: 2.4, opacity: 0, duration: 0.4, ease: 'power2.in' }, 0.6)
      // a full-screen starlight wash that blooms and clears, instead of a lingering yellow disc
      .fromTo('.dome-flash', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1.4, duration: 0.16, ease: 'power2.in' }, 0.72)
      .to('.dome-flash', { opacity: 0, duration: 0.12, ease: 'power1.out' }, 0.88)
      .fromTo('.dome-sparks i', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.12, stagger: 0.008 }, 0.7)
      .to('.dome-sparks i', { x: (i: number) => Math.cos(i * 2.4) * window.innerWidth * 0.6, y: (i: number) => Math.sin(i * 2.4) * window.innerHeight * 0.6, opacity: 0, duration: 0.3, ease: 'power2.out' }, 0.8);

    // Story paintings drift slowly (parallax)
    gsap.utils.toArray<HTMLElement>('.room .paint').forEach((p) => {
      gsap.fromTo(p, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: p.parentElement!, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  });
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}

export function initMotion(): void {
  gsap.registerPlugin(ScrollTrigger);

  if (!isTouch() && !reducedMotion()) {
    lenis = new Lenis({
      lerp: 0.11,
      wheelMultiplier: 0.9,
      // let menus, windows and overlays scroll themselves instead of the page
      prevent: (node: HTMLElement) => !!node.closest?.('#startmenu, #windows, .crib, .chaos-layer, [data-lenis-prevent], dialog, .overlay'),
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis?.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    setLenis(lenis);
  }
  build();
  store.on('motion.reduced', () => {
    if (reducedMotion()) { lenis?.destroy(); lenis = null; setLenis(null); }
    build();
  });
  // images change layout as they load: re-measure once everything is in
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
