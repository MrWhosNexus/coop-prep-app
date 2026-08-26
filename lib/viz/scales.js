// Scale computation: the map from data space to pixel space, plus readable ticks.
//
// Written from scratch on purpose. A charting dependency would hide the very
// model the Tableau module teaches — continuous (green) pills get a LINEAR or
// TIME axis, discrete (blue) pills get a BAND axis — and lessons need to grade
// against that model, not around it.

/** Scale kinds, matching the axis a pill produces. */
export const ScaleType = {
  LINEAR: "linear",
  BAND: "band",
  TIME: "time",
};

/**
 * Min/max of numeric values, ignoring non-numbers.
 * @param {Array<number>} values
 * @returns {[number, number]|[null, null]}
 */
export function extent(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    const n = v instanceof Date ? v.getTime() : v;
    if (typeof n !== "number" || !Number.isFinite(n)) continue;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  return min === Infinity ? [null, null] : [min, max];
}

/**
 * A "nice" tick step: 1, 2, 5 or 10 times a power of ten. This is the classic
 * choice — those are the intervals people read fluently.
 * @param {number} span
 * @param {number} count target tick count
 * @returns {number} step size (never 0)
 */
export function niceStep(span, count) {
  if (!(span > 0) || !(count > 0)) return 1;
  const rough = span / count;
  const power = Math.floor(Math.log10(rough));
  const magnitude = Math.pow(10, power);
  const error = rough / magnitude;
  let factor;
  if (error >= Math.sqrt(50)) factor = 10;
  else if (error >= Math.sqrt(10)) factor = 5;
  else if (error >= Math.sqrt(2)) factor = 2;
  else factor = 1;
  return factor * magnitude;
}

/**
 * Round a domain outward to whole tick steps, so the axis ends on a label.
 * @param {number} min
 * @param {number} max
 * @param {number} [count] target tick count
 * @returns {[number, number]}
 */
export function niceDomain(min, max, count = 5) {
  if (min === null || max === null) return [0, 1];
  if (min === max) {
    // A flat domain has no span to nice. Pad it so the mark is still drawable.
    if (min === 0) return [0, 1];
    const pad = Math.abs(min) * 0.1;
    return [min - pad, max + pad];
  }
  const step = niceStep(max - min, count);
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}

// Floating point: 0.1 + 0.2 style drift makes ticks like 0.30000000000000004.
// Round each tick to the step's own precision.
function roundToStep(value, step) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(value.toFixed(Math.min(20, decimals)));
}

/**
 * Evenly spaced, human-readable ticks across [min, max].
 * @param {number} min
 * @param {number} max
 * @param {number} [count] approximate tick count
 * @returns {Array<number>}
 */
export function generateTicks(min, max, count = 5) {
  if (min === null || max === null) return [];
  if (min === max) return [min];
  const step = niceStep(max - min, count);
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  // Epsilon guards the inclusive upper bound against float drift.
  for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(roundToStep(v, step));
  return ticks;
}

/**
 * A continuous linear scale — what a green (continuous) measure pill produces.
 * @param {Object} config
 * @param {[number, number]} config.domain data-space bounds
 * @param {[number, number]} config.range pixel-space bounds
 * @param {boolean} [config.nice] round the domain to whole ticks (default true)
 * @param {number} [config.tickCount] default 5
 * @param {boolean} [config.zero] extend the domain to include 0 (default false)
 * @returns {Object} scale with scale(), invert(), ticks
 */
export function linearScale(config) {
  const { range, tickCount = 5 } = config;
  let [d0, d1] = config.domain;
  if (d0 === null || d1 === null) [d0, d1] = [0, 1];

  if (config.zero) {
    d0 = Math.min(0, d0);
    d1 = Math.max(0, d1);
  }
  if (config.nice !== false) [d0, d1] = niceDomain(d0, d1, tickCount);
  if (d0 === d1) d1 = d0 + 1;

  const [r0, r1] = range;
  const scale = (value) => {
    const n = value instanceof Date ? value.getTime() : value;
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    return r0 + ((n - d0) / (d1 - d0)) * (r1 - r0);
  };

  return {
    type: ScaleType.LINEAR,
    domain: [d0, d1],
    range: [r0, r1],
    scale,
    invert: (px) => d0 + ((px - r0) / (r1 - r0)) * (d1 - d0),
    ticks: generateTicks(d0, d1, tickCount),
    // Where the value 0 sits in pixels — bars grow from here, not from the axis.
    zeroPosition: d0 <= 0 && d1 >= 0 ? scale(0) : scale(d0 < 0 ? d1 : d0),
  };
}

/**
 * A band scale — what a blue (discrete) dimension pill produces. Each member
 * gets an equal slot; `padding` is the fraction of each slot left as gap.
 * @param {Object} config
 * @param {Array<*>} config.domain the members, in order
 * @param {[number, number]} config.range pixel-space bounds
 * @param {number} [config.padding] 0..1, default 0.1
 * @returns {Object} scale with scale(), bandwidth, center(), ticks
 */
export function bandScale(config) {
  const domain = config.domain ?? [];
  const [r0, r1] = config.range;
  const padding = config.padding ?? 0.1;
  const n = Math.max(1, domain.length);
  const span = r1 - r0;
  const step = span / n;
  const bandwidth = Math.abs(step) * (1 - padding);
  const offset = (Math.abs(step) - bandwidth) / 2;

  const keyOf = (v) => (v instanceof Date ? v.toISOString() : String(v));
  const index = new Map(domain.map((d, i) => [keyOf(d), i]));

  const scale = (value) => {
    const i = index.get(keyOf(value));
    if (i === undefined) return null;
    return r0 + i * step + (span < 0 ? -offset : offset);
  };

  return {
    type: ScaleType.BAND,
    domain: [...domain],
    range: [r0, r1],
    scale,
    bandwidth,
    step: Math.abs(step),
    padding,
    center: (value) => {
      const p = scale(value);
      return p === null ? null : p + (span < 0 ? -bandwidth / 2 : bandwidth / 2);
    },
    ticks: [...domain],
  };
}

const TIME_UNITS = [
  { ms: 1000, label: "second" },
  { ms: 60000, label: "minute" },
  { ms: 3600000, label: "hour" },
  { ms: 86400000, label: "day" },
  { ms: 604800000, label: "week" },
  { ms: 2592000000, label: "month" },
  { ms: 31536000000, label: "year" },
];

/**
 * A time scale: linear in epoch-milliseconds, but with ticks snapped to calendar
 * units so labels land on real days/months/years rather than arbitrary offsets.
 * @param {Object} config
 * @param {[Date|number, Date|number]} config.domain
 * @param {[number, number]} config.range
 * @param {number} [config.tickCount] default 5
 * @returns {Object} scale; `ticks` are Dates
 */
export function timeScale(config) {
  const toMs = (v) => (v instanceof Date ? v.getTime() : v);
  const [d0, d1] = config.domain.map(toMs);
  const { range, tickCount = 5 } = config;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;

  const scale = (value) => {
    const n = toMs(value);
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    return r0 + ((n - d0) / span) * (r1 - r0);
  };

  const rough = span / Math.max(1, tickCount);
  const unit = TIME_UNITS.reduce((acc, u) => (rough >= u.ms ? u : acc), TIME_UNITS[0]);
  const step = Math.max(unit.ms, Math.round(rough / unit.ms) * unit.ms);
  const ticks = [];
  for (let t = Math.ceil(d0 / step) * step; t <= d1; t += step) ticks.push(new Date(t));

  return {
    type: ScaleType.TIME,
    domain: [new Date(d0), new Date(d1)],
    range: [r0, r1],
    scale,
    invert: (px) => new Date(d0 + ((px - r0) / (r1 - r0)) * span),
    ticks: ticks.length ? ticks : [new Date(d0), new Date(d1)],
    unit: unit.label,
    // Every continuous scale owes the mark builders a baseline. Time has no
    // meaningful zero — epoch 0 is 1970, decades off the end of most domains —
    // so a bar or area over time measures from the start of the axis instead.
    zeroPosition: r0,
  };
}

/**
 * Format a tick for display. Keeps big money readable (217K rather than 217000)
 * and avoids float noise on fractions.
 * @param {number|Date} value
 * @param {Object} [options] { type: "number"|"percent"|"currency"|"date" }
 * @returns {string}
 */
export function formatTick(value, options = {}) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "number" || !Number.isFinite(value)) return "";

  if (options.type === "percent") return `${Number((value * 100).toFixed(2))}%`;

  const abs = Math.abs(value);
  const prefix = options.type === "currency" ? "$" : "";
  if (abs >= 1e9) return `${prefix}${Number((value / 1e9).toFixed(1))}B`;
  if (abs >= 1e6) return `${prefix}${Number((value / 1e6).toFixed(1))}M`;
  if (abs >= 1e3) return `${prefix}${Number((value / 1e3).toFixed(1))}K`;
  return `${prefix}${Number(value.toFixed(2))}`;
}

/**
 * Pick and build the right scale for an axis from a resolved encoding.
 * This is the discrete-vs-continuous decision made concrete: blue pill → band,
 * green pill → linear (or time, for dates).
 * @param {Object} encoding a resolved encoding ({ discrete, type, ... })
 * @param {Object} data { values: Array<*>, domain?: Array<*> }
 * @param {[number, number]} range
 * @param {Object} [options] passed through to the underlying scale
 * @returns {Object} a scale
 */
export function scaleForEncoding(encoding, data, range, options = {}) {
  if (!encoding) return bandScale({ domain: [""], range });

  if (encoding.discrete) {
    return bandScale({ domain: data.domain ?? data.values, range, padding: options.padding ?? 0.1 });
  }
  if (encoding.type === "date") {
    const [min, max] = extent(data.values);
    return timeScale({ domain: [min, max], range, tickCount: options.tickCount });
  }
  const [min, max] = extent(data.values);
  return linearScale({
    domain: [min, max],
    range,
    nice: options.nice,
    tickCount: options.tickCount,
    // Bars must start at zero or they lie about magnitude.
    zero: options.zero ?? true,
  });
}
