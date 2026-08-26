// Guided lesson: the stats block — AVERAGE, MEDIAN, STDEV.S, AVERAGEIF,
// CORREL over the real HMDA incomes and loan amounts. This is curriculum
// lesson stats-2's challenge ("compute the mean and standard deviation of
// income, broken out by race group") done live in the sheet.
//
// Ground truth (computed with the engine over public/data/hmda-sample.csv):
//   AVERAGE(income)  = 71475          MEDIAN(income) = 73750
//   STDEV.S(income)  = 20820.708295814384
//   AVERAGEIF Black  = 66562.5        AVERAGEIF White = 71720
//   CORREL(loan_amount, income) = 0.8871770056957681
//
// Grading doctrine: cellFormula (METHOD + OUTCOME in one descriptor) — the
// named functions are the lesson, and each must also compute the verified
// number. The long decimals carry an explicit tolerance so a correct formula
// can never lose to floating-point noise.

import { createLesson } from "../spec.js";

const HMDA = "hmda-sample.csv";

/** Verified statistics over the extract (income in F, loan_amount in E). */
export const STATS = {
  meanIncome: 71475,
  medianIncome: 73750,
  stdevIncome: 20820.708295814384,
  blackMeanIncome: 66562.5,
  whiteMeanIncome: 71720,
  correlation: 0.8871770056957681,
};

const LABELS = {
  I2: "mean income",
  I3: "median income",
  I4: "income stdev (sample)",
  I5: "Black mean income",
  I6: "White mean income",
  I7: "income x loan correlation",
};

function checkpoint(extra = {}) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", load: [{ resource: HMDA, origin: "A1" }], cells: { ...LABELS, ...extra } }],
  };
}

const MEAN = "=AVERAGE(F2:F101)";
const MEDIAN = "=MEDIAN(F2:F101)";
const STDEV = "=STDEV.S(F2:F101)";
const GROUP_MEANS = {
  J5: '=AVERAGEIF($B$2:$B$101, "Black", $F$2:$F$101)',
  J6: '=AVERAGEIF($B$2:$B$101, "White", $F$2:$F$101)',
};

export const lesson = createLesson({
  id: "excel-stats",
  tool: "sheet",
  moduleId: "stats",
  mode: "guided",
  voice: true,
  title: "The stats block: mean, median, spread, and correlation",
  description:
    "Before any bias test, an analyst profiles the data: what's a typical income here, how spread out " +
    "is it, and do the two money columns move together? Four formulas answer all of it — and the " +
    "Black/White group means preview the disparity the rate analysis will confirm.",
  resources: [HMDA],
  steps: [
    {
      id: "mean-median",
      title: "AVERAGE and MEDIAN",
      instruction:
        "Income lives in F2:F101. In J2, compute the mean with AVERAGE; in J3, the median with " +
        "MEDIAN. You should get 71,475 and 73,750. When the median sits ABOVE the mean like this, a " +
        "tail of low incomes is dragging the average down.",
      hints: [
        "Both functions take the same single range: the income column.",
        "F2:F101 — don't include the header in F1.",
        "=AVERAGE(F2:F101) in J2, =MEDIAN(F2:F101) in J3.",
        "J2: 71475. J3: 73750. Median > mean means the distribution leans on its low end.",
      ],
      target: { kind: "sheet-cell", ref: "J2" },
      spotlightLabel: "Compute AVERAGE of income in J2",
      checkpoint: checkpoint(),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", ref: "J2", mustUse: ["AVERAGE"], expectedValue: STATS.meanIncome },
          { type: "cellFormula", ref: "J3", mustUse: ["MEDIAN"], expectedValue: STATS.medianIncome },
        ],
      },
    },
    {
      id: "stdev",
      title: "STDEV.S: how spread out is income?",
      instruction:
        "In J4, compute the sample standard deviation of income: =STDEV.S(F2:F101). Roughly 20,821 — " +
        "so a typical income sits about $21k from the mean, and anything past 2 deviations " +
        "(under ~$30k or over ~$113k) is unusual in this file.",
      hints: [
        "Use the SAMPLE flavor, STDEV.S — this extract is 100 applicants out of millions.",
        "Same range as the mean: F2:F101.",
        "=STDEV.S(F2:F101).",
        "J4 shows about 20820.7. Mean ± 2 stdev spans roughly 29,834 to 113,116.",
      ],
      target: { kind: "sheet-cell", ref: "J4" },
      spotlightLabel: "Compute STDEV.S of income in J4",
      checkpoint: checkpoint({ J2: MEAN, J3: MEDIAN }),
      grader: {
        type: "cellFormula",
        ref: "J4",
        mustUse: ["STDEV.S"],
        expectedValue: STATS.stdevIncome,
        tolerance: 1e-6,
      },
    },
    {
      id: "group-means",
      title: "AVERAGEIF: means by group",
      instruction:
        "Does typical income differ by group? In J5, average income for Black applicants only: " +
        '=AVERAGEIF($B$2:$B$101, "Black", $F$2:$F$101). In J6, the same for White. Expected: 66,562.50 ' +
        "vs 71,720 — a $5k gap, far smaller than the 30-point approval gap. Hold that thought.",
      hints: [
        "AVERAGEIF is three arguments: the range to test, the criteria, the range to average.",
        "Test the race column B against the quoted group name; average the income column F.",
        '=AVERAGEIF($B$2:$B$101, "Black", $F$2:$F$101) and the "White" twin in J6.',
        "J5: 66562.5. J6: 71720. Income alone cannot explain the approval-rate gap — that's the finding.",
      ],
      target: { kind: "sheet-cell", ref: "J5" },
      spotlightLabel: "Compute AVERAGEIF for Black income in J5",
      checkpoint: checkpoint({ J2: MEAN, J3: MEDIAN, J4: STDEV }),
      grader: {
        type: "allOf",
        of: [
          {
            type: "anyOf",
            of: [
              { type: "cellFormula", ref: "J5", mustUse: ["AVERAGEIF"], expectedValue: STATS.blackMeanIncome },
              { type: "cellFormula", ref: "J5", mustUse: ["AVERAGEIFS"], expectedValue: STATS.blackMeanIncome },
            ],
          },
          {
            type: "anyOf",
            of: [
              { type: "cellFormula", ref: "J6", mustUse: ["AVERAGEIF"], expectedValue: STATS.whiteMeanIncome },
              { type: "cellFormula", ref: "J6", mustUse: ["AVERAGEIFS"], expectedValue: STATS.whiteMeanIncome },
            ],
          },
        ],
      },
    },
    {
      id: "correl",
      title: "CORREL: do loan size and income move together?",
      instruction:
        "In J7, correlate the two money columns: =CORREL(E2:E101, F2:F101). About 0.887 — strongly " +
        "positive, as you'd hope: bigger incomes support bigger loans. A LOW value here would mean " +
        "loan sizes are being set by something other than ability to pay.",
      hints: [
        "CORREL takes two same-length ranges and returns a number between -1 and 1.",
        "Loan amounts are E2:E101, incomes F2:F101 — order doesn't change the answer.",
        "=CORREL(E2:E101, F2:F101).",
        "J7 shows about 0.887. Above 0.7 is conventionally \"strong\"; this passes easily.",
      ],
      target: { kind: "sheet-cell", ref: "J7" },
      spotlightLabel: "Correlate loan amount and income in J7",
      checkpoint: checkpoint({ J2: MEAN, J3: MEDIAN, J4: STDEV, ...GROUP_MEANS }),
      grader: {
        type: "cellFormula",
        ref: "J7",
        mustUse: ["CORREL"],
        expectedValue: STATS.correlation,
        tolerance: 1e-6,
      },
    },
  ],
});

export default lesson;
