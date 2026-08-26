// data/certs/expansion/index.js
// The 6x expansion: 410 items that lift every section of both banks from 4x its
// per-form quota to 6x.
//
// WHY THIS EXISTS. Before this, every section of both banks sat at EXACTLY 4.00x
// the questions a single form draws — 4 distinct mocks and not one item spare.
// That is a ceiling someone built to, and it had a nasty property: retracting a
// single wrong item for accuracy dropped the whole cert to three forms, so a
// correction could only ever be a careful swap, never a deletion. The banks were
// simultaneously at their promised depth and unmaintainable.
//
// At 6x the promise (4 distinct forms, asserted in test/cert-sie-bank.test.js and
// test/cert-series65.test.js) and the actual stock are no longer the same number.
// The gap between them IS the slack: two full forms' worth of items can be deleted
// outright before the promise is at risk. Note the tests deliberately still assert
// >= 4x, NOT >= 6x — pinning the floor to the current size would recreate the exact
// problem this expansion solves, one bank-size higher.
//
// Per-section growth is proportional to blueprint quota, so the section
// distribution the blueprint tests assert (SIE 16/44/31/9, Series 65 15/25/30/30)
// is unchanged by construction:
//
//   SIE            4x -> 6x     Series 65        4x -> 6x
//   capital-markets  48 -> 72     economic          80 -> 120
//   products-risks  132 -> 198    vehicles         128 -> 192
//   trading-accounts 92 -> 138    client           156 -> 234
//   regulatory       28 -> 42     laws             156 -> 234
//   total           300 -> 450    total            520 -> 780
//
// The per-file split is authorship history, not a semantic distinction: each file
// was one authoring batch with a reserved id range, and everything downstream sees
// one flat array. Kept separate because a per-batch accuracy review is the point.
//
// The reserved id ranges (…-x1NN for batch 1, -x2NN for batch 2, …) are what makes
// concurrent authoring safe: ids cannot collide by construction. Question TEXT can
// still collide across batches, and did — three duplicates were caught by a global
// sweep after the fact and replaced, because the per-batch reviewers could not see
// sibling files that did not exist yet. Any future batch must be swept globally,
// not just against what happened to be on disk when it ran.

import { SIE_CAPITAL_MARKETS_X1 } from "./sie-capital-markets-1.js";
import { SIE_CAPITAL_MARKETS_X2 } from "./sie-capital-markets-2.js";
import { SIE_PRODUCTS_RISKS_X1 } from "./sie-products-risks-1.js";
import { SIE_PRODUCTS_RISKS_X2 } from "./sie-products-risks-2.js";
import { SIE_PRODUCTS_RISKS_X3 } from "./sie-products-risks-3.js";
import { SIE_TRADING_ACCOUNTS_X1 } from "./sie-trading-accounts-1.js";
import { SIE_TRADING_ACCOUNTS_X2 } from "./sie-trading-accounts-2.js";
import { SIE_TRADING_ACCOUNTS_X3 } from "./sie-trading-accounts-3.js";
import { SIE_REGULATORY_X1 } from "./sie-regulatory-1.js";

import { S65_ECONOMIC_X1 } from "./series65-economic-1.js";
import { S65_ECONOMIC_X2 } from "./series65-economic-2.js";
import { S65_VEHICLES_X1 } from "./series65-vehicles-1.js";
import { S65_VEHICLES_X2 } from "./series65-vehicles-2.js";
import { S65_VEHICLES_X3 } from "./series65-vehicles-3.js";
import { S65_CLIENT_X1 } from "./series65-client-1.js";
import { S65_CLIENT_X2 } from "./series65-client-2.js";
import { S65_CLIENT_X3 } from "./series65-client-3.js";
import { S65_CLIENT_X4 } from "./series65-client-4.js";
import { S65_LAWS_X1 } from "./series65-laws-1.js";
import { S65_LAWS_X2 } from "./series65-laws-2.js";
import { S65_LAWS_X3 } from "./series65-laws-3.js";
import { S65_LAWS_X4 } from "./series65-laws-4.js";

/**
 * The 150 SIE expansion items, tagged with the same section slugs SIE_BANK uses
 * ("capital-markets" | "products-risks" | "trading-accounts" | "regulatory").
 * data/registry.js translates those slugs to blueprint ids at registration.
 * @type {Array<{id: string, section: string, q: string, a: string, explanation: string, options: Array<{text: string, explanation: string}>}>}
 */
export const SIE_EXPANSION = [
  ...SIE_CAPITAL_MARKETS_X1,
  ...SIE_CAPITAL_MARKETS_X2,
  ...SIE_PRODUCTS_RISKS_X1,
  ...SIE_PRODUCTS_RISKS_X2,
  ...SIE_PRODUCTS_RISKS_X3,
  ...SIE_TRADING_ACCOUNTS_X1,
  ...SIE_TRADING_ACCOUNTS_X2,
  ...SIE_TRADING_ACCOUNTS_X3,
  ...SIE_REGULATORY_X1,
];

/**
 * The 260 Series 65 expansion items, tagged with the section slugs SERIES65_BANK
 * uses ("economic" | "vehicles" | "client" | "laws"), which are the blueprint's
 * own ids — no translation needed.
 * @type {Array<{id: string, section: string, q: string, a: string, explanation: string, options: Array<{text: string, explanation: string}>}>}
 */
export const SERIES65_EXPANSION = [
  ...S65_ECONOMIC_X1,
  ...S65_ECONOMIC_X2,
  ...S65_VEHICLES_X1,
  ...S65_VEHICLES_X2,
  ...S65_VEHICLES_X3,
  ...S65_CLIENT_X1,
  ...S65_CLIENT_X2,
  ...S65_CLIENT_X3,
  ...S65_CLIENT_X4,
  ...S65_LAWS_X1,
  ...S65_LAWS_X2,
  ...S65_LAWS_X3,
  ...S65_LAWS_X4,
];
