"use client";

// Inline function reference: the teaching surface for the formula language.
// Exports FUNCTION_HELP (data), searchFunctions (matcher used by the formula
// bar autocomplete), getFunctionHelp (signature hints), and the panel UI.
//
// Every entry documents a function implemented in lib/sheet/functions.js.
// Examples use the HMDA sample layout: A=applicant_id, B=race, C=gender,
// D=zip_code, E=loan_amount, F=income, G=approved (rows 2..101).

import { useMemo, useState } from "react";

/**
 * @type {Array<{name: string, category: string, signature: string, description: string, example: string}>}
 */
export const FUNCTION_HELP = [
  // ── Aggregation ──
  { name: "SUM", category: "Aggregation", signature: "SUM(number1, [number2], ...)", description: "Adds all numbers in the given cells or ranges.", example: "=SUM(E2:E101)" },
  { name: "AVERAGE", category: "Aggregation", signature: "AVERAGE(number1, [number2], ...)", description: "Arithmetic mean of the numeric values.", example: "=AVERAGE(F2:F101)" },
  { name: "COUNT", category: "Aggregation", signature: "COUNT(value1, [value2], ...)", description: "Counts how many values are numbers.", example: "=COUNT(E2:E101)" },
  { name: "COUNTA", category: "Aggregation", signature: "COUNTA(value1, [value2], ...)", description: "Counts non-empty cells of any type.", example: "=COUNTA(A2:A101)" },
  { name: "MIN", category: "Aggregation", signature: "MIN(number1, [number2], ...)", description: "Smallest numeric value.", example: "=MIN(E2:E101)" },
  { name: "MAX", category: "Aggregation", signature: "MAX(number1, [number2], ...)", description: "Largest numeric value.", example: "=MAX(E2:E101)" },
  { name: "MEDIAN", category: "Aggregation", signature: "MEDIAN(number1, [number2], ...)", description: "Middle value: half the data is above, half below.", example: "=MEDIAN(F2:F101)" },

  // ── Conditional aggregation ──
  { name: "COUNTIF", category: "Conditional", signature: "COUNTIF(range, criteria)", description: "Counts cells matching one criterion. Criteria accept comparisons (\">50000\") and wildcards (\"A*\").", example: "=COUNTIF(G2:G101,\"APPROVED\")" },
  { name: "COUNTIFS", category: "Conditional", signature: "COUNTIFS(range1, criteria1, [range2, criteria2], ...)", description: "Counts rows where EVERY range/criteria pair matches — the denials-by-race workhorse.", example: "=COUNTIFS(B2:B101,\"Black\",G2:G101,\"APPROVED\")" },
  { name: "SUMIF", category: "Conditional", signature: "SUMIF(range, criteria, [sum_range])", description: "Sums sum_range where range matches the criterion.", example: "=SUMIF(G2:G101,\"APPROVED\",E2:E101)" },
  { name: "SUMIFS", category: "Conditional", signature: "SUMIFS(sum_range, range1, criteria1, ...)", description: "Sums with multiple conditions. Note: the SUM range comes FIRST, unlike SUMIF.", example: "=SUMIFS(E2:E101,B2:B101,\"Black\",G2:G101,\"APPROVED\")" },
  { name: "AVERAGEIF", category: "Conditional", signature: "AVERAGEIF(range, criteria, [average_range])", description: "Average of the cells that match one criterion.", example: "=AVERAGEIF(B2:B101,\"White\",F2:F101)" },
  { name: "AVERAGEIFS", category: "Conditional", signature: "AVERAGEIFS(average_range, range1, criteria1, ...)", description: "Average with multiple conditions; average range first.", example: "=AVERAGEIFS(F2:F101,B2:B101,\"Hispanic\",G2:G101,\"DENIED\")" },

  // ── Statistics ──
  { name: "STDEV.S", category: "Statistics", signature: "STDEV.S(number1, [number2], ...)", description: "Sample standard deviation — how spread out the data is.", example: "=STDEV.S(F2:F101)" },
  { name: "STDEV.P", category: "Statistics", signature: "STDEV.P(number1, [number2], ...)", description: "Population standard deviation (divides by n, not n-1).", example: "=STDEV.P(F2:F101)" },
  { name: "VAR.S", category: "Statistics", signature: "VAR.S(number1, [number2], ...)", description: "Sample variance (standard deviation squared).", example: "=VAR.S(E2:E101)" },
  { name: "VAR.P", category: "Statistics", signature: "VAR.P(number1, [number2], ...)", description: "Population variance.", example: "=VAR.P(E2:E101)" },
  { name: "CORREL", category: "Statistics", signature: "CORREL(array1, array2)", description: "Correlation coefficient (-1 to 1) between two ranges — e.g. does income move with loan amount?", example: "=CORREL(E2:E101,F2:F101)" },
  { name: "PERCENTILE", category: "Statistics", signature: "PERCENTILE(array, k)", description: "The value below which k (0-1) of the data falls.", example: "=PERCENTILE(F2:F101,0.9)" },
  { name: "QUARTILE", category: "Statistics", signature: "QUARTILE(array, quart)", description: "Quartile of a data set: 0=min, 1=Q1, 2=median, 3=Q3, 4=max.", example: "=QUARTILE(E2:E101,3)" },

  // ── Lookup ──
  { name: "XLOOKUP", category: "Lookup", signature: "XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode])", description: "The modern lookup: finds a value in one column and returns the matching value from another — works right-to-left too.", example: "=XLOOKUP(\"A0042\",A2:A101,E2:E101,\"not found\")" },
  { name: "VLOOKUP", category: "Lookup", signature: "VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])", description: "Classic vertical lookup: match in the FIRST column, return column N. Use FALSE for exact match.", example: "=VLOOKUP(\"A0042\",A2:G101,5,FALSE)" },
  { name: "HLOOKUP", category: "Lookup", signature: "HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])", description: "Horizontal lookup: match in the first ROW, return row N.", example: "=HLOOKUP(\"income\",A1:G101,2,FALSE)" },
  { name: "INDEX", category: "Lookup", signature: "INDEX(array, row_num, [column_num])", description: "Returns the value at a row/column position within a range.", example: "=INDEX(E2:E101,3)" },
  { name: "MATCH", category: "Lookup", signature: "MATCH(lookup_value, lookup_array, [match_type])", description: "Position (not value) of a match in a range — pair with INDEX.", example: "=MATCH(\"A0042\",A2:A101,0)" },

  // ── Logical ──
  { name: "IF", category: "Logical", signature: "IF(logical_test, value_if_true, [value_if_false])", description: "Returns one value when the test is TRUE and another when FALSE.", example: "=IF(F2>=50000,\"qualifies\",\"review\")" },
  { name: "IFS", category: "Logical", signature: "IFS(test1, value1, [test2, value2], ...)", description: "First TRUE test wins — cleaner than nesting IF inside IF.", example: "=IFS(F2>100000,\"high\",F2>50000,\"mid\",TRUE,\"low\")" },
  { name: "IFERROR", category: "Logical", signature: "IFERROR(value, value_if_error)", description: "Replaces any error result with a fallback value.", example: "=IFERROR(E2/F2,0)" },
  { name: "AND", category: "Logical", signature: "AND(logical1, [logical2], ...)", description: "TRUE only when every argument is TRUE.", example: "=AND(F2>50000,G2=\"APPROVED\")" },
  { name: "OR", category: "Logical", signature: "OR(logical1, [logical2], ...)", description: "TRUE when at least one argument is TRUE.", example: "=OR(B2=\"Black\",B2=\"Hispanic\")" },
  { name: "NOT", category: "Logical", signature: "NOT(logical)", description: "Flips TRUE to FALSE and back.", example: "=NOT(G2=\"APPROVED\")" },

  // ── Information ──
  { name: "ISBLANK", category: "Information", signature: "ISBLANK(value)", description: "TRUE when the referenced cell is empty.", example: "=ISBLANK(C2)" },
  { name: "ISNUMBER", category: "Information", signature: "ISNUMBER(value)", description: "TRUE when the value is a number.", example: "=ISNUMBER(E2)" },
  { name: "ISTEXT", category: "Information", signature: "ISTEXT(value)", description: "TRUE when the value is text.", example: "=ISTEXT(D2)" },
  { name: "ISERROR", category: "Information", signature: "ISERROR(value)", description: "TRUE when the value is any error (#N/A, #DIV/0!, ...).", example: "=ISERROR(E2/0)" },

  // ── Text ──
  { name: "CONCAT", category: "Text", signature: "CONCAT(text1, [text2], ...)", description: "Joins text values together (also works on ranges).", example: "=CONCAT(B2,\" — \",G2)" },
  { name: "CONCATENATE", category: "Text", signature: "CONCATENATE(text1, [text2], ...)", description: "Legacy join — same idea as CONCAT, scalar args only.", example: "=CONCATENATE(A2,\": \",B2)" },
  { name: "LEFT", category: "Text", signature: "LEFT(text, [num_chars])", description: "First N characters of a text value.", example: "=LEFT(A2,2)" },
  { name: "RIGHT", category: "Text", signature: "RIGHT(text, [num_chars])", description: "Last N characters of a text value.", example: "=RIGHT(D2,3)" },
  { name: "MID", category: "Text", signature: "MID(text, start_num, num_chars)", description: "N characters starting at a 1-based position.", example: "=MID(A2,2,4)" },
  { name: "LEN", category: "Text", signature: "LEN(text)", description: "Number of characters.", example: "=LEN(A2)" },
  { name: "TRIM", category: "Text", signature: "TRIM(text)", description: "Removes leading, trailing, and doubled spaces — the #1 fix for \"identical\" values that will not match.", example: "=TRIM(B2)" },
  { name: "UPPER", category: "Text", signature: "UPPER(text)", description: "Converts to UPPERCASE.", example: "=UPPER(B2)" },
  { name: "LOWER", category: "Text", signature: "LOWER(text)", description: "Converts to lowercase.", example: "=LOWER(G2)" },
  { name: "TEXT", category: "Text", signature: "TEXT(value, format_text)", description: "Formats a number as text: \"0.0%\", \"#,##0\", \"$#,##0.00\".", example: "=TEXT(E2/1000,\"#,##0\")" },
  { name: "VALUE", category: "Text", signature: "VALUE(text)", description: "Converts numeric text to a real number.", example: "=VALUE(\"42500\")" },
  { name: "SUBSTITUTE", category: "Text", signature: "SUBSTITUTE(text, old_text, new_text, [instance_num])", description: "Replaces occurrences of one substring with another.", example: "=SUBSTITUTE(A2,\"A\",\"ID-\")" },

  // ── Math ──
  { name: "ROUND", category: "Math", signature: "ROUND(number, num_digits)", description: "Rounds to N digits (negative N rounds left of the decimal).", example: "=ROUND(AVERAGE(F2:F101),-3)" },
  { name: "ROUNDUP", category: "Math", signature: "ROUNDUP(number, num_digits)", description: "Always rounds away from zero.", example: "=ROUNDUP(E2/12,0)" },
  { name: "ROUNDDOWN", category: "Math", signature: "ROUNDDOWN(number, num_digits)", description: "Always rounds toward zero.", example: "=ROUNDDOWN(F2/1000,0)" },
  { name: "ABS", category: "Math", signature: "ABS(number)", description: "Absolute value.", example: "=ABS(E2-F2)" },
  { name: "SQRT", category: "Math", signature: "SQRT(number)", description: "Square root (#NUM! for negatives).", example: "=SQRT(VAR.S(F2:F101))" },
  { name: "POWER", category: "Math", signature: "POWER(number, power)", description: "Raises a number to a power (same as the ^ operator).", example: "=POWER(1.05,10)" },

  // ── Date ──
  { name: "TODAY", category: "Date", signature: "TODAY()", description: "Today's date as an Excel serial number.", example: "=TODAY()" },
  { name: "DATE", category: "Date", signature: "DATE(year, month, day)", description: "Builds a date serial from parts.", example: "=DATE(2026,8,12)" },
  { name: "YEAR", category: "Date", signature: "YEAR(serial_number)", description: "The year of a date.", example: "=YEAR(TODAY())" },
  { name: "MONTH", category: "Date", signature: "MONTH(serial_number)", description: "The month (1-12) of a date.", example: "=MONTH(TODAY())" },
  { name: "DAY", category: "Date", signature: "DAY(serial_number)", description: "The day of month (1-31) of a date.", example: "=DAY(TODAY())" },
  { name: "DATEDIF", category: "Date", signature: "DATEDIF(start_date, end_date, unit)", description: "Difference between dates in \"Y\", \"M\", or \"D\" units.", example: "=DATEDIF(TODAY(),DATE(2026,8,12),\"D\")" },
];

const CATEGORY_ORDER = [
  "Aggregation", "Conditional", "Statistics", "Lookup",
  "Logical", "Information", "Text", "Math", "Date",
];

const BY_NAME = new Map(FUNCTION_HELP.map((f) => [f.name, f]));

/**
 * Help entry for an exact function name (case-insensitive), or null.
 * @param {string} name
 */
export function getFunctionHelp(name) {
  if (!name) return null;
  return BY_NAME.get(String(name).toUpperCase()) || null;
}

/**
 * Rank help entries against a query: prefix matches first (alphabetical),
 * then substring matches in name, then matches in the description.
 * @param {string} query
 * @param {number} [limit]
 */
export function searchFunctions(query, limit = Infinity) {
  const q = String(query || "").trim().toUpperCase();
  if (q === "") return FUNCTION_HELP.slice(0, limit === Infinity ? undefined : limit);
  const prefix = [];
  const contains = [];
  const descr = [];
  for (const f of FUNCTION_HELP) {
    if (f.name.startsWith(q)) prefix.push(f);
    else if (f.name.includes(q)) contains.push(f);
    else if (f.description.toUpperCase().includes(q)) descr.push(f);
  }
  const all = [...prefix, ...contains, ...descr];
  return limit === Infinity ? all : all.slice(0, limit);
}

/**
 * Browsable function reference panel.
 * @param {{onInsert?: (text: string) => void, onClose?: () => void}} props
 *   onInsert receives either "=EXAMPLE(...)" (example click) or "NAME(" (Insert).
 */
export default function FunctionHelp({ onInsert, onClose }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchFunctions(query), [query]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const f of matches) {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category).push(f);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)]);
  }, [matches]);

  return (
    <div className="fh-panel glass" aria-label="Function reference">
      <div className="fh-title">
        Function Reference
        <span className="spacer" />
        {onClose && (
          <button className="sheet-btn" onClick={onClose} aria-label="Close function reference">
            Close
          </button>
        )}
      </div>
      <input
        className="fh-search"
        type="search"
        placeholder={`Search ${FUNCTION_HELP.length} functions… (e.g. lookup, COUNTIF)`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search functions"
      />
      {grouped.length === 0 && <div className="fh-empty">No functions match “{query}”.</div>}
      {grouped.map(([category, fns]) => (
        <div key={category}>
          <div className="fh-cat">{category}</div>
          {fns.map((f) => (
            <div key={f.name} className="fh-item">
              <div className="head">
                <span className="name">{f.name}</span>
                {onInsert && (
                  <button className="insert" onClick={() => onInsert(f.name + "(")} aria-label={`Insert ${f.name}`}>
                    Insert
                  </button>
                )}
              </div>
              <div className="sig">{f.signature}</div>
              <div className="desc">{f.description}</div>
              <button
                className="example"
                onClick={() => onInsert && onInsert(f.example)}
                title={onInsert ? "Click to try this example in the selected cell" : undefined}
              >
                {f.example}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
