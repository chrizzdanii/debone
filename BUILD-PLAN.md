# BUILD-PLAN.md — DEBONE Photos & Video Editing Studio

> Master Build Plan: creative brief + complete implementation instructions for Claude Code.
> Status: **DRAFT, awaiting client approval before any build begins.**

---

## 1. Website Overview

| Item | Detail |
|---|---|
| Brand | **DEBONE Photos & Video Editing Studio** (styled **DEBONE**) |
| Site type | Local business, creative studio, training academy |
| Location | 179 Old Refinery Road, Elelenwo, Port Harcourt, Rivers State, Nigeria |
| Feeling | **Creative** (expressive, bold, alive, built by makers) |
| Main CTA | Chat on WhatsApp: **0803 598 8889** (`https://wa.me/2348035988889`) |
| Secondary contact | 0813 976 3301 |
| Hours (verify before launch) | Mon, Tue, Fri 7:00 AM–8:00 PM · Wed, Thu 10:00 AM–8:00 PM (confirm Wed) · Sat 8:00 AM–8:00 PM · Sun closed |
| Build type | Static site: `index.html`, `style.css`, `script.js`, `/assets` |
| Quality bar | Awwwards-level cinematic scroll storytelling |

**Primary goals**
1. Turn visitors into WhatsApp conversations (bookings, quotes, enrolments).
2. Prove 27 years of craft with cinematic proof, not claims.
3. Make DEBONE the obvious first name in Port Harcourt for coverage, editing and training.

---

## 2. Core Positioning

**One-line promise:** DEBONE captures stories, edits them into something unforgettable, and teaches others to do the same.

**Positioning statement:** For people and brands in Port Harcourt who want visuals that stand out, DEBONE is the studio with 27 years of experience that shoots it, edits it and trains the next generation of creators, all under one roof.

**Differentiators**
- 27 years in business (rare longevity in a fast-moving field).
- 500+ students trained, 3,000+ clients served.
- Full chain: shoot (photo, video, drone), edit, print, train, repair, equip.

**Hero headline options (pick one at approval):**
1. **WE CAPTURE. WE CUT. WE TEACH.**
2. **STORIES THAT MOVE. SINCE DAY ONE.**
3. **27 YEARS OF MAKING PORT HARCOURT LOOK UNFORGETTABLE.** ← recommended

**Sub-headline:** Photography, video, drone and music videos, plus hands-on editing training. Everything creative, one studio.

---

## 3. Brand Personality

- **Creative:** playful with form, serious about craft.
- **Rooted:** proudly Port Harcourt, proudly Nigerian.
- **Seasoned:** 27 years speaks quietly; the work speaks loudly.
- **Generous:** teaches what it knows (500+ students).
- **Energetic:** confident, never arrogant.

**Voice:** short, punchy, active verbs. Warm and direct. Occasional playful line. No jargon, no corporate filler.

| We say | We don't say |
|---|---|
| "Let's make it unforgettable." | "We offer best-in-class solutions." |
| "Bring your idea. We'll bring the camera." | "Contact us for inquiries." |

---

## 4. Visual Direction

**Concept: "The Dark Edit Suite."** Black studio ground with warm bone-white type, flashes of record-light orange, and rare teal highlights, like footage glowing on a timeline.

**Palette**

| Role | Name | Hex |
|---|---|---|
| Background | Ink | `#0A0A0C` |
| Surface | Graphite | `#141418` |
| Primary text | Bone | `#F2EDE4` |
| Muted text | Ash | `#9A968E` |
| Accent (primary) | Signal Orange | `#FF5A1F` |
| Accent (rare) | Electric Teal | `#1FE0C4` |

**Rules**
- Orange is the "record light": CTAs, active states, key words in headlines.
- Teal appears only as a tiny highlight (cursor ring, counter glow). Never large areas.
- Subtle film grain over everything (see section 22).
- Timeline motifs: thin lines, tick marks, timecode labels (`00:00:27:00`), crop marks, viewfinder corners.
- Photography and footage always full-bleed or in cinematic 2.39:1 / 16:9 frames.

---

## 5. Higgsfield Seedance 2.0 Asset Generation

**Identity reference (all generations):** use the founder's reference image from the project's `Media/` folder (use the file in that folder as the single identity reference for every clip) so the character stays consistent across all three scenes.

**Global settings**
- Model: Higgsfield **Seedance 2.0**
- Resolution: **1080p**
- Clip length: **8–12 seconds** each (target 10s)
- Aspect ratio: **16:9** (desktop master). Keep the subject centered with safe margins so a 9:16 center crop works for mobile.
- Camera: single continuous move per clip, no cuts, no handheld shake.
- Output: 3 separate clips (not a continuous video).
- Suggested file names: `scene-1-lens.mp4`, `scene-2-edit-suite.mp4`, `scene-3-classroom.mp4`

**Global style block (append to every prompt):**
> Cinematic, premium, shot on a high-end cinema camera, anamorphic feel, shallow depth of field, soft film grain, deep blacks, warm orange accent lighting with small touches of teal, calm confidence, no text, no logos, no watermarks, same person as the reference image in every shot, consistent face, hair, skin tone and wardrobe.

**Negative guidance (use if the tool supports it):** warped hands, extra fingers, face drift, flicker, text artifacts, cheesy motivational pose, fast cuts, camera shake.

**Wardrobe (keep identical across clips):** dark, simple, modern outfit (black or charcoal top) so he reads cleanly against black and glows under orange rim light. Adjust to match the reference photo.

**Workflow:** generate 2–3 takes per scene, pick the cleanest, check face consistency against the reference, then compress per section 24.

---

## 6. Three Cinematic Scenes

### Scene 1: THE LENS (Hero)
- **Role:** opens the site; pins the viewer in the DEBONE world.
- **Prompt:** The founder from the reference image stands confident and relaxed in a black-void photo studio. Strong orange rim light traces his shoulders and jaw, a faint teal glow in the far background, soft haze in the air. A professional cinema camera on a stand and a softbox are barely visible at the edges. The camera performs one slow, smooth 360° orbit around him at chest height. He holds still with calm confidence, a subtle half-smile, then slowly turns his head toward camera at the end. Cinematic, premium, quiet authority, not a cheesy pose. *(+ global style block)*
- **Duration:** 10–12s
- **Scroll behavior:** scrubbed. Scroll progress drives the orbit; the headline scales over it.

### Scene 2: THE EDIT SUITE
- **Role:** shows the craft: shooting and editing.
- **Prompt:** The founder sits at a dark desk in a moody edit suite, lit by the glow of an ultra-wide monitor showing a multi-track video timeline, with photo thumbnails, drone landscape footage and music-video clips floating as soft holographic panels around him. Warm orange accent light from the side. He works calmly, scrubbing the timeline with a mouse, then looks up at the screens with quiet satisfaction. Slow cinematic push-in from medium shot to a closer frame. Feels like a creator building something great at night. *(+ global style block)*
- **Duration:** 10–12s
- **Scroll behavior:** scrubbed push-in; pillar text slides in across the frame.

### Scene 3: THE CLASSROOM
- **Role:** shows the teaching side: community and legacy.
- **Prompt:** A dark, modern training room with a row of students at computers editing video, their faces lit by screen glow, orange accent light behind them. The founder walks toward the camera down the aisle between workstations, looks at a student's screen with an approving nod, then continues forward and stops in a relaxed hero pose, arms loosely at his sides, a warm confident expression. Camera slowly pulls back in front of him as he approaches. The vibe is "welcome, come learn with us", warm and proud, not corporate. *(+ global style block)*
- **Duration:** 10–12s
- **Scroll behavior:** scrubbed walk toward camera; final frame holds under the stats strip and CTA.

> **Note:** the other sections (story, products, work) use real photos and footage from DEBONE's archive in `/assets/work/`. Ask the client to supply 12–20 of their best images and 2–4 short clips.

---

## 7. Website Structure

Single-page, scroll-driven. Order:

1. Preloader
2. **Hero** (Scene 1)
3. **Animated stats strip**
4. **Mission** (kinetic type)
5. **Three pillars** (Scene 2 backdrop)
6. **Story** (Scene 3 backdrop)
7. **Services / Training / Gear** detail
8. **Featured work**
9. **Final CTA**
10. **Footer**

Fixed elements: minimal top nav (logo, links, WhatsApp button), custom cursor (desktop), scroll progress bar, grain overlay, floating WhatsApp button on mobile.

---

## 8. Hero Section

- Full-viewport, pinned. Background: **Scene 1 video**, scroll-scrubbed.
- Headline (recommended): **27 YEARS OF MAKING PORT HARCOURT LOOK UNFORGETTABLE.** Huge type, split into lines and words, revealed with a masked rise on load.
- Sub-headline: *Photography, video, drone and music videos, plus hands-on editing training.*
- Buttons: **Chat on WhatsApp** (orange, filled) · **See our work** (outlined, scrolls down).
- Timecode in the corner that ticks with scroll (`00:00:00:00` → `00:00:12:00`).
- Viewfinder corner brackets framing the screen.
- Scroll cue: small "SCROLL" label with a line animation.

---

## 9. Animated Stats Strip

Directly under the hero, on Ink with a thin orange top border.

| Stat | Value | Label |
|---|---|---|
| 1 | **27** | Years in business |
| 2 | **500+** | Students trained |
| 3 | **3,000+** | Clients served |

- Numbers count up from 0 when 30% in view (GSAP, ease `power2.out`, ~2s). The `+` fades in at the end.
- Giant type (clamp to ~12vw desktop), labels in small caps with tick-mark dividers.
- Subtle marquee of service keywords scrolls under it: *PHOTOGRAPHY · VIDEOGRAPHY · DRONE · MUSIC VIDEOS · EDITING · TRAINING · PRINTING*.

---

## 10. Mission Section

- **Headline (kinetic, word-by-word fill on scroll):**
  > "We believe every moment deserves to be remembered beautifully, and every creative deserves the skills to make it."
- Words start at 15% opacity and fill to Bone as scroll progresses; key words (*remembered*, *beautifully*, *skills*) turn orange.
- Small label above: `OUR MISSION`.
- Background: faint animated grain, no video.

---

## 11. Three Pillars Section

Background: **Scene 2** video (scrubbed push-in), darkened 60%.

Three pillars appear one after another as the user scrolls (pinned section, each takes ~⅓ of the scroll length):

**01 / CAPTURE:** *Photo, Video & Drone.*
Weddings, events, music videos, corporate coverage and aerial shots, all delivered with a cinematic eye.

**02 / TEACH:** *Creative Training Academy.*
Hands-on training in video editing (Pinnacle Studio, Adobe Premiere Pro), photography, videography, computer skills, and **AI automation, including AI video creation**. 500+ students and counting.

**03 / EQUIP:** *Tech, Repair & Gear.*
Printer and computer repair, plus creator equipment: cameras, drones and print machines.

Each pillar has a huge outlined number, orange keyword, 2-line description and a small "Ask on WhatsApp" link.

---

## 12. Story Section

Background: **Scene 3** video (scrubbed walk toward camera).

**Draft story (to be refined with the client):**
> It started with a camera and a belief that Port Harcourt deserved to see itself in its best light. That was 27 years ago. Since then DEBONE has grown from a small photo studio into a full creative house: shooting weddings and music videos, flying drones, editing stories, and teaching hundreds of students the craft. Over 3,000 clients have trusted us with their moments. Over 500 students have walked out of our classroom ready to create. We're not done.

- Layout: left column sticky label `THE STORY`; right column paragraphs fade up line by line.
- A vertical timeline on the side with markers: **Day one**, **First studio**, **Training begins**, **Today** (labels to be confirmed with client; do not publish invented dates).
- **TODO (client):** add the real founder story, founding year, and one personal quote.

---

## 13. Product / Service / Community Section

**"Everything creative. One address."** A horizontal-scroll gallery (pinned) of service cards:

| Card | Details |
|---|---|
| Photography | Weddings, portraits, events, celebrity and comedy-skit shoots, photo books and printing |
| Videography | Event and wedding coverage, music videos, live streaming (confirm) |
| Drone / Aerial | Flying camera coverage for events and property |
| Video & Photo Editing | Professional post-production and retouching |
| Training | Video editing, photo editing, videography, photography and computer training |
| AI Automation Training | AI video creation and AI workflow automation, taught hands-on |
| Repair | Printer and computer repair and maintenance |
| Gear & Print | Cameras, drones, DI machine, flex machine |

- Cards: 4:5 images (from `/assets/work/`), title, 1-line copy, "Enquire" arrow.
- Hover (desktop): image zooms 1.05, orange underline draws in, cursor changes to "VIEW".
- Includes a testimonial strip (real one found online, to be confirmed with client before use): *"One of the best companies I have entered in my life..."* — a customer (Comedy T). **Get permission and final wording before publishing.**

---

## 14. Featured Work / Content Section

- Title: **SELECTED WORK**
- Layout: asymmetric grid of 8–12 items (photos plus 2–4 short looping clips), with category filter: *All · Weddings · Music Videos · Drone · Portraits · Events*.
- Each item: reveal on scroll via clip-path mask; hover shows project title and category in a timecode-style label.
- Click opens a lightbox (keyboard accessible, ESC to close, swipe on mobile).
- Placeholder images are used until the client supplies real work (`/assets/work/work-01.jpg` …).

---

## 15. Final CTA Section

- Full-screen Ink background with slowly pulsing orange glow.
- Giant kinetic headline: **LET'S MAKE IT UNFORGETTABLE.**
- Sub-copy: *Tell us your idea. We'll bring the camera, the edit and the energy.*
- Big magnetic button: **Chat on WhatsApp →** (`https://wa.me/2348035988889?text=Hi%20DEBONE%2C%20I%27d%20like%20to%20make%20an%20enquiry`).
- Secondary: **Call 0803 598 8889** · **0813 976 3301**.
- Small line: *Visit us: 179 Old Refinery Road, Elelenwo, Port Harcourt.*

---

## 16. Footer

- Large DEBONE wordmark spanning full width (clipped by the bottom edge; outlined, filling to Bone on hover).
- Columns: **Studio** (address, hours) · **Services** (links to cards) · **Contact** (phone numbers, WhatsApp) · **Follow** (social links: placeholders until supplied).
- Map link: "Get directions" to the Elelenwo address (Google Maps).
- Bottom bar: © 2026 DEBONE Photos & Video Editing Studio · Back to top ↑.

---

## 17. Complete Visual Style Guide

- **Layout:** 12-column grid, max content width 1440px, generous negative space, full-bleed media.
- **Spacing scale:** 4, 8, 16, 24, 40, 64, 104, 168px (use CSS variables).
- **Radius:** 0 on media and buttons (sharp, editorial); 999px only on small pills and the WhatsApp button.
- **Lines:** 1px `rgba(242,237,228,0.15)` hairlines and tick marks.
- **Buttons:**
  - Primary: orange fill, Ink text, uppercase, letter-spacing 0.08em. Hover: Bone fill, text Ink, slight magnetic pull.
  - Secondary: 1px Bone border, transparent; hover fills Bone.
- **Imagery:** high contrast, deep blacks, warm highlights. Apply a consistent slight orange-teal grade to supplied photos if needed.
- **Iconography:** thin-line, 1.5px stroke.
- **Overlays:** viewfinder corners, timecode, REC dot (orange, blinking).

---

## 18. Typography

| Use | Font (Google Fonts) | Notes |
|---|---|---|
| Display / headlines | **Anton** or **Bebas Neue** (alt: *Syne ExtraBold*) | Condensed, huge, uppercase |
| Body | **Inter** (400/500) | Clean and readable |
| Accent / labels | **Space Mono** | Timecode, tags, small labels |

- Hero h1: `clamp(3.5rem, 11vw, 11rem)`, line-height 0.9, letter-spacing -0.02em.
- Section titles: `clamp(2.5rem, 7vw, 7rem)`.
- Body: `clamp(1rem, 1.1vw, 1.2rem)`, line-height 1.6, max 62ch.
- Labels: 0.75rem, uppercase, letter-spacing 0.14em.
- Load fonts with `display=swap` and `preconnect`. Fallbacks: `Impact, Arial Narrow, sans-serif` / `system-ui`.

---

## 19. Animation Direction

**Principles:** purposeful, smooth, cinematic. Nothing moves without a reason. Easing is `power3.out` / `expo.out` for reveals, `none` for scrubbed motion.

- **Preloader:** counter 000 → 100 with a film-leader style circle; wipes up to reveal the hero (≈1.8s).
- **Kinetic typography:** headlines split into lines/words/chars (custom splitter, no paid plugins). Masked rise (`yPercent: 110 → 0`, stagger 0.04) on enter.
- **Mission:** scroll-linked word opacity fill.
- **Stats:** count-up on enter.
- **Scene videos:** scroll-scrubbed (see section 21).
- **Pillars:** pinned, crossfading text blocks driven by ScrollTrigger timeline.
- **Gallery:** horizontal scroll pinned via ScrollTrigger; images parallax at ±8%.
- **Work grid:** clip-path reveals (`inset(100% 0 0 0)` → `inset(0)`), staggered.
- **Marquee:** infinite CSS/GSAP loop; speeds up slightly with scroll velocity.
- **Section transitions:** background color cross-fades between Ink and Graphite; thin orange line draws across at each boundary.
- **Reduced motion:** `prefers-reduced-motion` → disable scrubbing/pins, show static poster frames, simple fades.

---

## 20. Interaction Design

- **Custom cursor (desktop only):** small Bone dot plus lagging ring (teal hairline). Grows and shows labels ("VIEW", "PLAY", "CHAT") over interactive items. Hidden on touch.
- **Magnetic buttons:** primary CTAs shift up to 12px toward the cursor.
- **Nav:** transparent at top, hides on scroll down, reveals on scroll up with blur backdrop. Full-screen menu on mobile with big staggered links.
- **Hover states:** every clickable thing has a visible hover and a visible `:focus-visible` outline (orange, 2px offset).
- **Lightbox:** keyboard and swipe navigation.
- **WhatsApp:** every CTA uses a prefilled message link; open in new tab with `rel="noopener"`.
- **Accessibility:** semantic landmarks, alt text on all images, aria-labels on icon buttons, contrast AA for text, skip link.

---

## 21. Scroll Behavior

- **Lenis** smooth scroll (`lerp: 0.1`, `smoothWheel: true`), synced with GSAP: `lenis.on('scroll', ScrollTrigger.update)` and `gsap.ticker.add(t => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`.
- **Video scrubbing:** for each scene, a pinned container whose scroll progress sets `video.currentTime = progress * video.duration`, via GSAP `ticker` with a small ease (`currentTime += (target - currentTime) * 0.12`) to avoid jitter.
  - Videos must be `muted`, `playsinline`, `preload="auto"`, and encoded **all-keyframe** (section 24) so scrubbing is smooth.
  - **Fallback:** if scrubbing is choppy or unsupported (low-power/Safari edge cases), switch to a canvas **image sequence** (`/assets/frames/scene-N/0001.webp` …, ~60–90 frames per scene, 1280px wide).
- **Pin lengths:** hero ≈ 250vh, pillars ≈ 300vh, story ≈ 250vh, gallery ≈ horizontal width of content.
- **Scroll progress bar:** 2px orange line at top.
- **Anchors:** nav links use `lenis.scrollTo()` with 1.4s ease.

---

## 22. Grain, Texture and Effects

- Full-screen fixed grain overlay: a small tiled noise PNG/SVG (≤ 40KB) animated with a stepped CSS `transform: translate()` keyframe (8 steps, 0.8s), opacity 0.06–0.09, `pointer-events: none`, `mix-blend-mode: overlay`.
- Vignette on video sections (radial gradient, 35% edge darkness).
- Optional: orange glow behind CTAs via blurred radial gradient.
- No heavy filters or SVG turbulence on large areas (performance).

---

## 23. Mobile Behavior

- **Breakpoints:** 480 / 768 / 1024 / 1440.
- Layout becomes single column; type scales by `clamp()`; hero headline wraps to 4–5 lines.
- **Video:** serve 720p, portrait-safe crop (`object-fit: cover; object-position: center`). If device is low-power or `saveData` is on, use the poster frame or image sequence.
- Scrub pin lengths reduced (≈ 70%) for thumb-friendly scrolling.
- Horizontal gallery becomes native swipe carousel (`scroll-snap`).
- No custom cursor, no magnetic effect.
- Floating **WhatsApp** button (bottom-right, 56px, orange) always visible after hero; respects iOS safe areas.
- Full-screen menu overlay; tap targets ≥ 48px.
- Test on a mid-range Android phone on a throttled connection (Port Harcourt mobile realities: keep first load light).

---

## 24. Technical Implementation

**Stack (strict):** HTML, CSS, vanilla JavaScript. No React, Next.js or other frameworks.

**CDN libraries (pinned versions):**
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js"></script>
```

**File structure**
```
/
├── index.html
├── style.css
├── script.js
├── BUILD-PLAN.md
└── assets/
    ├── video/
    │   ├── scene-1-lens.mp4        (+ .webm)
    │   ├── scene-2-edit-suite.mp4  (+ .webm)
    │   └── scene-3-classroom.mp4   (+ .webm)
    ├── posters/    (scene-1.jpg, scene-2.jpg, scene-3.jpg)
    ├── frames/     (optional image-sequence fallback)
    ├── work/       (client photos, WebP + JPG fallback)
    ├── img/        (logo, grain.png, icons)
    └── fonts/      (optional self-hosted)
```
All paths **relative**.

**Video encoding (ffmpeg):**
```bash
# Desktop 1080p, all-keyframe for smooth scrubbing
ffmpeg -i in.mp4 -an -c:v libx264 -profile:v high -crf 23 -preset slow \
  -g 1 -keyint_min 1 -pix_fmt yuv420p -movflags +faststart scene-1-lens.mp4
# Mobile 720p
ffmpeg -i in.mp4 -an -vf scale=-2:720 -c:v libx264 -crf 24 -g 1 \
  -pix_fmt yuv420p -movflags +faststart scene-1-lens-720.mp4
```
- Target ≤ 8MB per desktop clip, ≤ 4MB per mobile clip. Strip audio.
- Optional frame extraction: `ffmpeg -i in.mp4 -vf "fps=8,scale=1280:-2" -c:v libwebp -quality 70 frames/scene-1/%04d.webp`

**Performance**
- Lazy-load below-fold images (`loading="lazy"`, `decoding="async"`), set width/height to avoid layout shift.
- Only the hero video preloads; others load when within 1.5 screens.
- Use `will-change` sparingly; animate only `transform` and `opacity`.
- Lighthouse targets: Performance ≥ 90 (desktop), ≥ 80 (mobile); CLS < 0.05; LCP < 2.5s (poster first).
- Preloader finishes when hero poster and fonts are ready, never waiting for all videos.
- Pause off-screen videos with IntersectionObserver.

**SEO & meta**
- Title: *DEBONE Photos & Video Editing Studio | Photography, Video, Drone & Training in Port Harcourt*
- Meta description (~155 chars), Open Graph and Twitter cards, `LocalBusiness` JSON-LD (name, address, phones, hours).
- Favicon: orange "D" on Ink.

**Build steps for Claude Code (after approval)**
1. Create the file structure and placeholder assets (gradient posters, dummy work images) so the site runs before real videos exist.
2. Build `index.html` with semantic sections and all content from this plan.
3. Write `style.css` using CSS variables for palette, type and spacing; mobile-first.
4. Write `script.js`: Lenis + ScrollTrigger setup, preloader, text splitter, count-ups, video scrubbing with image-sequence fallback, pinned sections, horizontal gallery, cursor, magnetic buttons, lightbox, nav behavior.
5. Wire in the three videos when generated (swap placeholders, no code change needed).
6. Test: desktop Chrome/Safari/Firefox, iOS Safari, mid-range Android; reduced-motion; keyboard navigation.
7. Optimize assets and run Lighthouse.

---

## 25. Open Items (client to supply later)

- [ ] Founder story, founding year, personal quote
- [ ] Reference image confirmation (in `Media/`)
- [ ] 12–20 best photos and 2–4 short clips for the Featured Work section
- [ ] Testimonial permissions and wording
- [ ] Social media links
- [ ] Logo file (or approval to use a typographic DEBONE wordmark)
- [ ] Confirm business hours and the full service list (e.g. live streaming)
- [ ] Choose the hero headline (option 3 recommended)
