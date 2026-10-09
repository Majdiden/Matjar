/**
 * Quick add product helpers (dashboard/src/lib/quickProduct.ts): what a
 * merchant types into price and quantity on an Arabic phone keyboard. Also
 * keeps the dashboard limits in step with the server validator.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  QUICK_PRODUCT_LIMITS,
  parsePriceInput,
  parseQuantityInput,
  stepQuantity,
  productLink,
} from "../../dashboard/src/lib/quickProduct.ts";
import { QUICK_PRODUCT_LIMITS as SERVER_LIMITS } from "../../validators/product.validator.js";

describe("parsePriceInput", () => {
  it("reads Arabic digits, the Arabic decimal mark and thousands separators", () => {
    assert.equal(parsePriceInput("15000"), 15000);
    assert.equal(parsePriceInput("١٥٠٠٠"), 15000);
    assert.equal(parsePriceInput("۱۵۰۰۰"), 15000);
    assert.equal(parsePriceInput("15,000"), 15000);
    assert.equal(parsePriceInput("١٥٬٠٠٠"), 15000);
    assert.equal(parsePriceInput(" 15 000 "), 15000);
    assert.equal(parsePriceInput("١٢٫٥"), 12.5);
    assert.equal(parsePriceInput("12.5"), 12.5);
  });

  it("rejects empty, zero, negative, words and too-large prices", () => {
    for (const bad of ["", "   ", "0", "0.0", "-5", "abc", "12abc", "1.2.3", ".5", "1e5", String(QUICK_PRODUCT_LIMITS.priceMax + 1)]) {
      assert.equal(parsePriceInput(bad), null, bad);
    }
  });
});

describe("parseQuantityInput / stepQuantity", () => {
  it("reads whole numbers in either digit set, zero included", () => {
    assert.equal(parseQuantityInput("٣"), 3);
    assert.equal(parseQuantityInput("0"), 0);
    assert.equal(parseQuantityInput("1,000"), 1000);
  });

  it("rejects fractions, negatives, words and too-large quantities", () => {
    for (const bad of ["", "1.5", "١٫٥", "-1", "two", String(QUICK_PRODUCT_LIMITS.stockMax + 1)]) {
      assert.equal(parseQuantityInput(bad), null, bad);
    }
  });

  it("steps within 0 and the maximum", () => {
    assert.equal(stepQuantity(1, 1), 2);
    assert.equal(stepQuantity(0, -1), 0);
    assert.equal(stepQuantity(null, 1), 1);
    assert.equal(stepQuantity(QUICK_PRODUCT_LIMITS.stockMax, 1), QUICK_PRODUCT_LIMITS.stockMax);
  });
});

describe("productLink", () => {
  it("builds the public link, or the path alone without a host", () => {
    assert.equal(productLink("nile.matjar.to", "atr-sandal"), "https://nile.matjar.to/products/atr-sandal");
    assert.equal(productLink("", "atr-sandal"), "/products/atr-sandal");
  });
});

describe("limits", () => {
  it("match the server validator", () => {
    assert.deepEqual({ ...QUICK_PRODUCT_LIMITS }, { ...SERVER_LIMITS });
  });
});
