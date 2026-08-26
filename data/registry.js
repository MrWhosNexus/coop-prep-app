import { MODULES } from './curriculum.js';
import { HEART_MODULES } from './heart.js';
import { HUSTLE_MODULES } from './hustle.js';
import { HUSTLE_TOOLS } from './hustle-tools.js';
import { SIE_MODULES } from './certs/sie.js';
import { SERIES65_MODULES } from './certs/series65.js';
import { CFI_MODULES } from './certs/cfi.js';
import { SIE_BANK } from './certs/sie-bank.js';
import { SERIES65_BANK } from './certs/series65-bank.js';
import { registerBank } from '../lib/exam/banks.js';

/* ── Phase 3 wiring: exam simulator + guided-lesson registry ── */

/**
 * SIE_BANK tags items with the bank's semantic section keys, while the exam
 * blueprint (lib/exam/banks.js sieBlueprint) resolves numeric section ids,
 * section titles, and SIE_MODULES-derived aliases. "products-risks" (44% of
 * the real exam) matches none of those, so the keys are mapped to blueprint
 * ids here at registration — without this map those items would be dropped
 * as unresolvable. Mirrors SECTION_TO_BLUEPRINT_ID in
 * test/cert-sie-bank.test.js.
 * @type {Object<string, number>}
 */
export const SIE_SECTION_IDS = {
  'capital-markets': 1,
  'products-risks': 2,
  'trading-accounts': 3,
  'regulatory': 4,
};

// Attach the question banks to the exam engine. lib/exam deliberately does not
// import data/certs/*-bank.js itself (a missing bank must degrade honestly, not
// crash the engine); this app-level registry is where the two meet. Runs once at
// module load — Dashboard.js imports this module, so the banks are registered
// before any exam UI can render. resetExams() (tests only) reverts to the empty
// built-in banks; re-import or re-register after it.
registerBank(
  'sie',
  SIE_BANK.map((item) => ({
    ...item,
    section: SIE_SECTION_IDS[item.section] ?? item.section,
  }))
);

// No slug map for Series 65: unlike SIE, this bank's section slugs ("economic",
// "vehicles", "client", "laws") ARE the blueprint's own section ids, straight
// off SERIES65_META.sections, so every item resolves as-tagged. An identity map
// here would be a lie about the shape of the problem and one more thing to keep
// in sync — if the two ever diverge, that is a bug to fix at the source, not to
// paper over with a translation layer.
registerBank('series65', SERIES65_BANK);

// The guided-lesson registry, re-exported so nav surfaces can resolve a
// curriculum lesson's hands-on counterparts through the same module that
// gives them modules and tools.
export {
  LESSONS as GUIDED_LESSONS,
  LESSONS_BY_ID as GUIDED_LESSONS_BY_ID,
  CURRICULUM_MAP as GUIDED_CURRICULUM_MAP,
  getLesson as getGuidedLesson,
  lessonsForCurriculumLesson,
} from '../lib/guide/lessons/index.js';

/**
 * Every module the app can navigate to, across all tracks. Shapes are
 * identical (data/curriculum.js's MODULES contract), so the existing
 * module/lesson views render all of them without a parallel code path.
 */
export const ALL_MODULES = [
  ...MODULES,
  ...HEART_MODULES,
  ...HUSTLE_MODULES,
  ...SIE_MODULES,
  ...SERIES65_MODULES,
  ...CFI_MODULES,
];

/**
 * Resolve any module id (core curriculum, heart/hustle, or a licensing
 * track) to its module object.
 * @param {string} id
 * @returns {object|undefined}
 */
export function findModule(id) {
  return ALL_MODULES.find((m) => m.id === id);
}

const asModuleEntries = (modules, pillarId, baseOrder = 0) =>
  modules.map((mod, index) => ({
    id: mod.id,
    kind: 'module',
    pillarId,
    order: baseOrder + index,
    label: mod.title,
  }));

const moduleEntries = asModuleEntries(MODULES, 'head');
const heartEntries = asModuleEntries(HEART_MODULES, 'heart');
const hustleEntries = asModuleEntries(HUSTLE_MODULES, 'hustle');
// One licensing pillar, three cert tracks in sequence: SIE, then Series 65,
// then the CFI-style modeling track.
const licensingEntries = asModuleEntries(
  [...SIE_MODULES, ...SERIES65_MODULES, ...CFI_MODULES],
  'licensing'
);

// Tools sit after a pillar's modules (orders >= 100) so getByPillar's numeric
// sort never interleaves them with the lesson modules.
const toolEntries = [
  { id: 'sheet', kind: 'tool', pillarId: 'head', order: 100, label: 'Spreadsheet Lab' },
  { id: 'viz', kind: 'tool', pillarId: 'head', order: 101, label: 'Viz Builder' },
  { id: 'games', kind: 'tool', pillarId: 'head', order: 102, label: 'Practice Games' },
  { id: 'notes', kind: 'tool', pillarId: 'head', order: 103, label: 'Note Taker' },
  { id: 'lessonBuilder', kind: 'tool', pillarId: 'head', order: 104, label: 'AI Lesson Builder' },
  { id: 'coverLetter', kind: 'tool', pillarId: 'hustle', order: 100, label: 'Cover Letter Builder' },
  // The six Hustle job-search tools, straight off their data/hustle-tools.js
  // specs (ids there are the store slice keys the components persist to).
  ...HUSTLE_TOOLS.map((t, i) => ({
    id: t.id,
    kind: 'tool',
    pillarId: 'hustle',
    order: 101 + i,
    label: t.label,
  })),
  // Licensing: the exam simulator covers SIE + Series 65 (multiple-choice);
  // CFI/FMVA is a skills credential, so its drills get their own surface
  // rather than being forced into the exam mould.
  { id: 'examSim', kind: 'tool', pillarId: 'licensing', order: 100, label: 'Exam Simulator' },
  { id: 'cfiDrills', kind: 'tool', pillarId: 'licensing', order: 101, label: 'CFI Modeling Drills' },
];

export const REGISTRY = [
  ...moduleEntries,
  ...heartEntries,
  ...hustleEntries,
  ...licensingEntries,
  ...toolEntries,
];

export function getByPillar(pillarId) {
  return REGISTRY.filter(x => x.pillarId === pillarId).sort((a, b) => a.order - b.order);
}
