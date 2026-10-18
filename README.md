# Pip · Junior Dream Engineer

**Live:** https://hax-baby-1.vercel.app

Our entry for **haX.baby — Baby's First Website** (Track 1: Pip, the skull baby). Pip's portfolio is a scroll story through painted, Renaissance-style dream scenes, wrapped in a fake 90s operating system called **DreamOS 93**. Scroll from dusk to dawn: meet Pip, watch how Pip came to be, visit the workshop, fly the dream-delivery route, sign the guestbook, and see the town fall asleep.

> Tip: there's at least one secret. Pip's sky, and a very sleepy sock, know more than they say.

## The story behind the build

We wanted Pip's site to feel like a *place*, not a page. Renaissance ceilings are full of babies on clouds, and Pip is literally a baby on a cloud, so we painted Pip's whole world as a pastel night fresco and dropped the soft 3D Pip into it, like modern objects in an old painting. Then we framed it all in a 90s desktop, because nothing says "first website" like a Start button, a hit counter and a guestbook.

Everything Pip shows off is playable. The Lullaby Lab composes a new music-box lullaby each time you wind it (and slows down as the spring runs out). The nightlight gallery is pitch dark until you bring your lantern close. The toy box has real physics. Pip's eye-lights follow you around the page, Pip hates silence (so muting the site makes Pip sad), and switching day to night runs a bath with rubber ducks. The proudest bits: the stardust that builds each of Pip's inventions as you scroll in, and Bad Dream Mode, where nightmares take over the whole site until a tiny unicorn antivirus saves the day.

We built it in 48 hours as a team of three: **Anushka Bhalekar** designed the world, generated and art-directed every picture and recorded Pip's voice; **Pranav Shinde** built it with Claude Code as the coding partner; **Atharva Baodhankar** guided us along the way. We kept it phone-first, keyboard-friendly and quiet until you ask for sound.

## What's inside

| | |
| --- | --- |
| **Required** | Who Pip is (profile + growth chart) · 5 projects (Lullaby Lab, Nightlight Collection, Rattle & Block Toys, Dream Delivery Route, Growth Chart) · scroll-told origin story · reacts to you (eye-tracking lights, poke Pip, sound with a mute toggle) · phone and tablet layouts · a hidden Easter egg |
| **Tier 1** | Eyes follow the pointer (tap on phones) · scroll-driven story · day/night toggle that changes Pip's face and the palette · responsive · Easter egg |
| **Tier 2** | Lullaby Lab with real Web Audio · lantern flashlight cursor in the dark gallery · delivery map path synced to scroll · physics toy box |
| **Tier 3** | Live guestbook (serverless + Redis) · remembers returning visitors · ~100 Lighthouse |
| **Side quests** | Guestbook · section-aware sparkle cursor trail · hit-counter odometer · click sounds with an always-visible mute · Responsive Chaos Mode (Bad Dream Mode) |
| **Extras** | DreamOS boot screen, taskbar, Start menu and draggable springy windows · CRT / LCD / 1-bit display modes · desktop pets (ghost kitten, moon bunny, sleepy bat) · peeking ghosts · Mixtape of real nursery rhymes · Bath Time · "I'm feeling sleepy" · a teddy that climbs the scroll-bar ladder (parachute down, rocket up) · a pixel cursor for every scene |
| **The story** | Scroll-told and reversible (scroll back and the star flies home), with one thing to do in each chapter: knock on the sleepless ghosts' windows, reach the little hand up to the Moon, wish on the falling star, tuck the ghosts in |
| **Secrets & toys** | Secret Crib (portal or the SILENCE code) with a musical mobile, wish jar, a note from Pip and the *Catch the Falling Dreams* mini-game · Konami code star party · Ask Pip chat · Stickers & sticky notes · Bad Dream Bin · unicorn rainbow wave · project case files · free wallpapers · Pip's Webring |

## Accessibility and performance

- Phone-first; every hover has a tap, long-press or keyboard equivalent; 44 px tap targets.
- Real buttons and form controls, visible focus, Esc closes things, `M` mutes, `D` toggles day/night.
- Pip's speech bubbles are announced to screen readers; sound never plays before you tap.
- Respects *reduced motion* (and has its own setting): scenes crossfade, nothing shakes.
- axe-core: no WCAG 2.1 A/AA violations. Lighthouse: mobile 95/100/100, desktop 100/100/100 (performance / accessibility / best practices).
- Zero console errors: a Playwright script clicks through the site at phone, tablet and desktop sizes before every deploy.

## Run it

```bash
npm install
npm run dev                 # http://localhost:5173
npm run build               # type-check + production build
npx vite preview --port 4173 &
npm run check               # console-error click-through at 3 sizes (REDUCED=1 for reduced motion)
npm run check:a11y          # axe-core accessibility audit
npm run assets              # raw art (assets-raw/, not in git) -> public/assets/img/*.webp
npm run voice               # raw voice lines -> public/assets/voice/*.mp3
```

The guestbook and counter use Vercel Functions (`/api`) with Upstash Redis. Set `VITE_BACKEND=1` once Redis is connected; without it, the guestbook keeps wishes on the visitor's own device.

## How it's built

- **Vite + TypeScript**, no framework. **GSAP** (ScrollTrigger) + **Lenis** for scroll, **Matter.js** (lazy-loaded) for the toy box, the **Web Audio API** for every sound and the music box.
- Every feature is a self-contained module listed in `src/features.config.ts`. The registry wires up its Start-menu items, windows and sounds, so features never touch each other.
- `scripts/process_assets.py` slices sprite sheets, cuts out backgrounds and makes responsive WebP files.

## Credits

- **Team:** Anushka Bhalekar (design, art direction, voice) and Pranav Shinde (build), with guidance from Atharva Baodhankar.
- **Pip** and the original asset pack: [haX.baby](https://hax.baby/baby-problem) (Track 1 canon).
- **All other artwork:** generated with ChatGPT image generation from our own prompts and art-directed by Anushka Bhalekar from the official Pip references (backgrounds, props, the teddy, pets, cursors).
- **Voice of Pip:** every line recorded by Anushka Bhalekar, lightly cleaned up with AI audio editing (ChatGPT), then pitched and levelled in our build script.
- **Code:** [GSAP](https://gsap.com) (Standard License, free), [Lenis](https://github.com/darkroomengineering/lenis) (MIT), [Matter.js](https://github.com/liabru/matter-js) (MIT), [Upstash](https://upstash.com) SDKs (MIT).
- **Fonts:** Lilita One, Nunito and VT323 via Fontsource (SIL Open Font License).
- **Melodies:** traditional nursery rhymes and lullabies, all public domain (Twinkle Twinkle, Brahms' Lullaby, Mary Had a Little Lamb, Frère Jacques, Row Row Row Your Boat, London Bridge, Hot Cross Buns), played on a synthesized music box with soft chords.
