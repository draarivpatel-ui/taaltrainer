# DESIGN.md

TaalTrainer, a tabla practice room in the browser. Design record for the build,
written before any code so later passes stay consistent.

## Product context

- Subject. A rhythm trainer for tabla: thirteen bol strokes synthesized live in
  the browser, four taal practice loops, twelve progressive lessons with call
  and response, and a tap recorder that renders bol notation.
- Audience. Absolute beginners and returning players who want a quiet place to
  practice between lessons with a real teacher or book. The app itself teaches
  only through the lessons built into it.
- Job. Let a visitor press a key, hear a convincing stroke, and leave the first
  session able to play a keherwa theka.
- Tone. Concert stage at dusk. Restrained, warm, precise.

## Concept card

- Idea. A practice room at dusk: the stage lights are off except one brass lamp
  on the drums, and the Devanagari glyphs glow like the letters of a concert
  banner while you learn to speak the bols.
- Metaphor. The concert stage before the audience arrives. Everything on the
  page is a stage object: the keyboard is the drum set, the beat lamps are the
  footlights, the tempo readout is the conductor's stand.
- Signature. The home row is the drum. Every keypress fires a brass strike
  flash that decays exactly like the synthesized sound decays, and during
  playback the sam footlight breathes brass on beat one of every cycle.
- Emotion. Quiet focus, then the small thrill of hearing yourself keep taal.
- Motion verb. Strike and ring. Fast attack, long soft decay, on the same curve
  as the sound.
- Screenshot frame. The keyboard mid phrase, one key lit brass, the sam lamp
  breathing, the BPM numeral tabular and steady.

## Art direction system

Custom theme, anchored on the brief's own palette.

- Palette (OKLCH, every value lives in css/tokens.css and nothing inline).
  - stage, deep indigo canvas, oklch(18% 0.055 285)
  - curtain, deeper panels, oklch(13.5% 0.045 287)
  - board, raised surfaces, oklch(23% 0.06 283)
  - line, hairlines, oklch(31% 0.05 282)
  - ink, warm off-white text, oklch(92% 0.02 85)
  - muted, secondary text, oklch(71% 0.035 280)
  - brass, the accent, oklch(74% 0.115 82)
  - brass bright, accent text and focus, oklch(84% 0.1 88)
  - lamp, lit footlight, oklch(80% 0.14 70)
  - miss, a dusk red reserved for scoring misses, oklch(62% 0.14 25)
- Type. System stacks only, zero dependencies, offline.
  - Display, Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia, serif.
    Roman always, tracking tuned per size, display capped around 6rem.
  - Devanagari art, Devanagari Sangam MN, Nirmala UI, Noto Sans Devanagari.
    Treated as display art, set in lang attributes.
  - Body, system-ui stack, 16 to 18px, leading 1.55, measure capped near 68ch.
  - Numerals, ui-monospace stack with font-variant-numeric tabular-nums for
    BPM, timing, and scores.
- Grid. One 72rem content rail, a wider 86rem rail for the keyboard panel.
  Section rhythm varies: hero tall and typographic, keyboard dense and
  instrument-like, taal player a horizontal strip, lessons a ledger list,
  recorder a timeline strip.
- Radius. One rule, 10px on interactive panels, 999px on lamps and chips.
- Motion. Strike and ring. Eases from the canon only (--ease-out for entries,
  --ease-in for exits). Durations 100ms strikes, 200ms hovers, 400ms page
  entrance once. Three primitives total: strike flash on keys, beat lamp step,
  sam breathing at rest. All collapse under prefers-reduced-motion.
- Idle state. The sam lamp breathes slowly when the player is stopped and the
  page is otherwise still. Off under reduced motion.

## Structure

Macrostructure: Workbench. Nav: N9 edge-aligned minimal, four anchor links.
Footer: Ft5 statement close. Enrichment: none, typography and the Devanagari
art carry the hero. Sections in DOM order: hero, bol keyboard, taal player,
learner path, recorder, about and colophon.

## Honesty constraints

- No claims about teachers, schools, lineages, or testers anywhere in the app.
  The app teaches through the twelve built-in lessons and says so in NOTES.md.
- Thekas are practice lines adapted to the app's thirteen strokes and are
  labeled as practice versions in the interface.
- No invented metrics. Every number on the page (13 strokes, 4 taals, 12
  lessons, 40 to 240 BPM) is a count of what ships.
