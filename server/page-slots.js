'use strict';
/*
 * Page content slots: every photo and editable line of text on the Studio, About and Services pages.
 * The admin panel (Website > Page content) lists these. Anything the admin has not changed uses the default below.
 * The same defaults are written into the HTML files, so the pages look right even before the server answers.
 * Run `node tests/page-slots.test.js` to check that the HTML and this file still agree.
 */
const mk = id => `https://assets.mixkit.co/videos/${id}/${id}-thumb-720-0.jpg`;

const IMG = {
  studioShoot: mk(44062),     // lights and camera on a commercial shoot
  portrait: mk(50641),        // photographer working with a model
  fashion: mk(50639),         // fashion studio shoot
  setCamera: mk(44069),       // setting up a camera on set
  lens: mk(50635),            // photographer holding a lens
  dslr: mk(44076),            // DSLR close-up
  editHands: mk(44074),       // hands editing video
  editSuite: mk(44071),       // editor at a computer
  workflow: mk(44073),        // working in the studio
  training: mk(44068),        // training room
  story: mk(44075)            // story / mood image
};

const PAGES = [
  { id: 'studio', label: 'Studio page', url: 'studio.html' },
  { id: 'about', label: 'About page', url: 'about.html' },
  { id: 'services', label: 'Services page', url: 'services.html' },
  { id: 'shared', label: 'Numbers on every page', url: null }
];

/* image(key, page, group, label, def, alt, hint) and text(key, page, group, label, def, { long, hint }) */
const S = [];
const image = (key, page, group, label, def, alt, hint) => S.push({ key, page, group, label, type: 'image', def, alt, hint: hint || '' });
const text = (key, page, group, label, def, opt) => S.push(Object.assign({ key, page, group, label, type: (opt && opt.long) ? 'textarea' : 'text', def }, opt && opt.hint ? { hint: opt.hint } : {}));

/* ---------- Shared numbers ---------- */
text('stat-students', 'shared', 'Numbers', 'Students trained', '500+', { hint: 'Shown on the Studio, About and Services pages. Example: 500+' });
text('stat-clients', 'shared', 'Numbers', 'Clients served', '3,000+', { hint: 'Shown on the Studio and About pages. Example: 3,000+' });
text('stat-since', 'shared', 'Numbers', 'Year DEBONE started', '1997', { hint: 'Digits only. The number of years is worked out from this by itself every year.' });

/* ---------- Studio ---------- */
text('studio-hero-kicker', 'studio', 'Top of the page', 'Small line above the title', 'Photography · Film · Drone · Editing');
text('studio-hero-title', 'studio', 'Top of the page', 'Main title', 'The DEBONE Studio.');
text('studio-hero-lead', 'studio', 'Top of the page', 'Short introduction', 'Photography, film, drone and editing, made by people who also teach it.', { long: true });
image('studio-hero-bg', 'studio', 'Top of the page', 'Big background photo', IMG.studioShoot, 'Lights and camera set up for a shoot at the DEBONE studio', 'Wide photo. Landscape works best.');
image('studio-hero-a', 'studio', 'Top of the page', 'Floating photo 1 (tall)', IMG.portrait, 'Photographer working with a model', 'Portrait (tall) photo.');
image('studio-hero-b', 'studio', 'Top of the page', 'Floating photo 2', IMG.editHands, 'Hands editing video on a computer', 'Landscape or square photo.');
image('studio-hero-c', 'studio', 'Top of the page', 'Floating photo 3', IMG.lens, 'Photographer holding a camera lens', 'Landscape or square photo.');

text('studio-intro-title', 'studio', 'Inside the studio', 'Heading', 'A working studio, not a showroom.', {});
text('studio-intro-text', 'studio', 'Inside the studio', 'Paragraph', 'Since 1997 DEBONE has lit, shot, cut and printed the moments Port Harcourt cares about. The same team that photographs your wedding edits it, prints the album and, when you are ready, teaches you how to do it yourself.', { long: true });
image('studio-intro-a', 'studio', 'Inside the studio', 'Large photo', IMG.setCamera, 'Setting up a camera on set', 'Tall or square photo.');
image('studio-intro-b', 'studio', 'Inside the studio', 'Small photo', IMG.workflow, 'Working on a computer in the studio', 'Landscape photo.');

image('studio-step-1', 'studio', 'How a shoot runs', 'Step 1 photo: Brief', IMG.workflow, 'Planning a shoot in the studio', 'Landscape photo.');
image('studio-step-2', 'studio', 'How a shoot runs', 'Step 2 photo: Shoot', IMG.fashion, 'A fashion shoot in the DEBONE studio', 'Landscape photo.');
image('studio-step-3', 'studio', 'How a shoot runs', 'Step 3 photo: Edit', IMG.editHands, 'Colour grading a video edit', 'Landscape photo.');
image('studio-step-4', 'studio', 'How a shoot runs', 'Step 4 photo: Deliver', IMG.dslr, 'A camera ready for delivery day', 'Landscape photo.');

image('studio-gear-img', 'studio', 'Gear and training', 'Gear section photo', IMG.lens, 'A camera lens held up to the light', 'Landscape photo.');
image('studio-academy-img', 'studio', 'Gear and training', 'Academy section photo', IMG.training, 'Students learning at the DEBONE academy', 'Landscape photo.');
image('studio-visit-img', 'studio', 'Visit', 'Visit section photo', IMG.editSuite, 'The edit suite at DEBONE', 'Landscape photo.');
image('studio-cta-bg', 'studio', 'Visit', 'Bottom banner background', IMG.story, 'DEBONE studio atmosphere', 'Wide, darker photos look best here.');

/* ---------- About ---------- */
text('about-hero-title', 'about', 'Top of the page', 'Main title', 'About DEBONE.');
text('about-hero-lead', 'about', 'Top of the page', 'Short introduction', 'A Port Harcourt studio that shoots it, edits it, prints it and teaches it, since 1997.', { long: true });
image('about-hero-bg', 'about', 'Top of the page', 'Big background photo', IMG.story, 'DEBONE studio atmosphere', 'Wide photo. Landscape works best.');
image('about-hero-a', 'about', 'Top of the page', 'Floating photo 1 (tall)', IMG.setCamera, 'Setting up a camera on set', 'Portrait (tall) photo.');
image('about-hero-b', 'about', 'Top of the page', 'Floating photo 2', IMG.training, 'Students in a DEBONE class', 'Landscape or square photo.');
image('about-hero-c', 'about', 'Top of the page', 'Floating photo 3', IMG.portrait, 'Photographer working with a model', 'Landscape or square photo.');

text('about-story-title', 'about', 'Our story', 'Heading', 'It started with a camera.');
text('about-story-p1', 'about', 'Our story', 'First paragraph', 'DEBONE began with one belief: Port Harcourt deserves to see itself in its best light. What started as a photo and video editing studio grew, one request at a time, into a place where people shoot, edit, print, repair, equip and learn.', { long: true });
text('about-story-p2', 'about', 'Our story', 'Second paragraph', 'We still work from the same idea. Do the job properly, tell the customer the price before we start, and share what we know. That is why so many of our students and customers keep coming back.', { long: true });
image('about-story-a', 'about', 'Our story', 'Large photo', IMG.setCamera, 'Recording on set with a camera', 'Tall or square photo.');
image('about-story-b', 'about', 'Our story', 'Small photo', IMG.editSuite, 'Editing in the DEBONE edit suite', 'Landscape photo.');

text('about-mission', 'about', 'Mission', 'Mission statement (one or two sentences)', 'We believe every moment deserves to be remembered beautifully, and every creative deserves the skills to make it.', { long: true, hint: 'Words fill with colour one by one as people scroll.' });

image('about-pillar-1', 'about', 'What we do', 'Photo: Shoot', IMG.portrait, 'Photography at DEBONE', 'Landscape photo.');
image('about-pillar-2', 'about', 'What we do', 'Photo: Edit', IMG.editHands, 'Video editing at DEBONE', 'Landscape photo.');
image('about-pillar-3', 'about', 'What we do', 'Photo: Teach', IMG.training, 'Teaching at the DEBONE academy', 'Landscape photo.');
image('about-pillar-4', 'about', 'What we do', 'Photo: Equip', IMG.lens, 'Camera gear from the DEBONE shop', 'Landscape photo.');

image('about-life-1', 'about', 'Life at DEBONE', 'Gallery photo 1', IMG.fashion, 'Fashion shoot in the studio', 'Any shape. It is cropped to fit.');
image('about-life-2', 'about', 'Life at DEBONE', 'Gallery photo 2', IMG.workflow, 'Working in the studio', 'Any shape. It is cropped to fit.');
image('about-life-3', 'about', 'Life at DEBONE', 'Gallery photo 3', IMG.dslr, 'DSLR camera close-up', 'Any shape. It is cropped to fit.');
image('about-life-4', 'about', 'Life at DEBONE', 'Gallery photo 4', IMG.studioShoot, 'Lights and camera on a shoot', 'Any shape. It is cropped to fit.');
image('about-life-5', 'about', 'Life at DEBONE', 'Gallery photo 5', IMG.editSuite, 'Editing at a computer', 'Any shape. It is cropped to fit.');
image('about-life-6', 'about', 'Life at DEBONE', 'Gallery photo 6', IMG.lens, 'Camera lens detail', 'Any shape. It is cropped to fit.');

text('about-team-title', 'about', 'The people', 'Heading', 'The people behind the lens.');
image('about-team-1', 'about', 'The people', 'Card 1 photo', IMG.setCamera, 'DEBONE photographers on set', 'Portrait photo of a person or team.');
text('about-team-1-name', 'about', 'The people', 'Card 1 name', 'Photographers & videographers');
text('about-team-1-role', 'about', 'The people', 'Card 1 line', 'Weddings, events, portraits and films. Replace with a real name and photo any time.', { long: true });
image('about-team-2', 'about', 'The people', 'Card 2 photo', IMG.editSuite, 'DEBONE editors at work', 'Portrait photo of a person or team.');
text('about-team-2-name', 'about', 'The people', 'Card 2 name', 'Editors & retouchers');
text('about-team-2-role', 'about', 'The people', 'Card 2 line', 'Colour, cuts, cleanup and finishing. Replace with a real name and photo any time.', { long: true });
image('about-team-3', 'about', 'The people', 'Card 3 photo', IMG.training, 'DEBONE instructors teaching', 'Portrait photo of a person or team.');
text('about-team-3-name', 'about', 'The people', 'Card 3 name', 'Instructors');
text('about-team-3-role', 'about', 'The people', 'Card 3 line', 'Hands on teaching for the next generation of creators. Replace with a real name and photo any time.', { long: true });

image('about-visit-img', 'about', 'Visit', 'Visit section photo', IMG.dslr, 'The DEBONE studio in Elelenwo', 'Landscape photo.');
image('about-cta-bg', 'about', 'Visit', 'Bottom banner background', IMG.studioShoot, 'DEBONE studio atmosphere', 'Wide, darker photos look best here.');

/* ---------- Services ---------- */
text('services-hero-title', 'services', 'Top of the page', 'Main title', 'Everything creative, under one roof.');
text('services-hero-lead', 'services', 'Top of the page', 'Short introduction', 'From the first photo of the day to the last edit of the campaign, and a team that teaches what it does.', { long: true });
image('services-hero-a', 'services', 'Top of the page', 'Floating photo 1 (tall)', IMG.portrait, 'Photographer working with a model', 'Portrait (tall) photo.');
image('services-hero-b', 'services', 'Top of the page', 'Floating photo 2', IMG.editHands, 'Hands editing video on a computer', 'Landscape or square photo.');
image('services-hero-c', 'services', 'Top of the page', 'Floating photo 3', IMG.setCamera, 'Setting up a camera on a shoot', 'Landscape or square photo.');
image('services-hero-d', 'services', 'Top of the page', 'Floating photo 4', IMG.lens, 'Photographer holding a camera lens', 'Landscape or square photo.');
image('services-why-img', 'services', 'Why DEBONE', 'Photo beside the reasons', IMG.studioShoot, 'DEBONE crew on a shoot', 'Tall or square photo.');
image('services-process-img', 'services', 'Why DEBONE', 'Photo in the process section', IMG.workflow, 'Planning work with a client in the studio', 'Landscape photo.');
image('services-cta-bg', 'services', 'Why DEBONE', 'Bottom banner background', IMG.training, 'DEBONE studio atmosphere', 'Wide, darker photos look best here.');

const LIMITS = { text: 140, textarea: 480 };
const bySlot = new Map(S.map(s => [s.key, s]));

module.exports = { SLOTS: S, PAGES, SLOT_MAP: bySlot, LIMITS, IMG };
