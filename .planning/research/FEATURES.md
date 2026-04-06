# Features Research

**Research Date:** 2026-04-06
**Milestone Context:** Existing local single-player MVP expanding toward the PRD

## Table Stakes

### Core Practice Loop

- Immediate entry into a playable training round
- Reliable Halligalli rule enforcement for correct ring, wrong ring, and missed ring
- Clear timer / pace / difficulty controls
- Fast visible feedback after every bell event

**Complexity:** Medium
**Dependency notes:** Depends on game-engine correctness and responsive interaction

### Onboarding And Rule Learning

- Beginner tutorial that teaches "same fruit totals exactly 5"
- Static examples of correct vs incorrect ring situations
- Short guided practice or quiz before first full round
- Clear language that explains why a judgment was correct or wrong

**Complexity:** Medium
**Dependency notes:** Should share the same rule evaluation logic as gameplay

### Results And Progress Feedback

- End-of-round summary with score, accuracy, average reaction, best reaction, correct hits, wrong hits, missed hits
- Recent and best result recall on the home screen
- Clear actions into replay, tutorial, and settings adjustment

**Complexity:** Low to Medium
**Dependency notes:** Depends on summary correctness and persistence validation

### Device-Friendly Interaction

- Obvious always-reachable bell input
- Keyboard support on desktop
- Large touch target and centered critical information on mobile
- Responsive layouts that remain readable during active play

**Complexity:** Medium
**Dependency notes:** Depends on UI decomposition and targeted layout work

## Differentiators

### Training-Specific Feedback

- Distinguish error reasons such as "no fruit equals 5", "greater than 5 mistaken for 5", or "mixed fruit counted together"
- Highlight the fruit combination that made ringing valid
- Frame results as improvement advice, not only raw score

**Complexity:** Medium
**Dependency notes:** Requires richer evaluation metadata from the game engine

### Structured Practice Modes

- Focused drills for slower learning, faster cadence, or endless repetition
- Difficulty and speed framed as intentional training presets rather than just raw settings
- Boss or pressure mode as an advanced training layer

**Complexity:** Medium to High
**Dependency notes:** Depends on modular gameplay configuration and UI clarity

### Growth Signals Without Accounts

- Compare current round against local personal bests
- Preserve common settings and lightweight progression state
- Show simple trends or "next target" cues from local data

**Complexity:** Medium
**Dependency notes:** Depends on stable local storage model

## Anti-Features

### Real-Time Multiplayer

- Not needed to validate the core learning and practice loop
- Would force major architecture changes too early

### Login / Cloud Sync

- Adds product friction before the solo trainer is proven
- The PRD explicitly defers it

### Leaderboards / Social Competition

- Useful only after strong solo retention and clear scoring trust
- Risks shifting focus from learning quality to shallow gamification

### Overbuilt Meta Systems

- Achievements, currencies, unlock trees, and mission sprawl
- Can distract from the simple "learn rule -> practice -> improve" loop

## Requirement-Shaping Notes

- Tutorial, gameplay, and feedback should all use one source of rule truth
- Mobile usability is not polish-only; it is core product scope in the PRD
- Clear explanation of mistakes is part of the product value, not an optional enhancement
- Existing bilingual support means new features should be designed for translation from the start

## Suggested Requirement Categories

- Tutorial
- Practice Modes
- Feedback
- Results
- Persistence
- Accessibility And Responsive UX
- Quality / Game Integrity

---
*Features research completed: 2026-04-06*
