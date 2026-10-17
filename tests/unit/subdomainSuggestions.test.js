import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { subdomainCandidates, significantWords } from "../../services/subdomainSuggestions.js";

describe("store link suggestions", () => {
  it("a long Arabic name gives short links, the first word first", () => {
    const c = subdomainCandidates("بيتنا أصل العطور السودانية");
    assert.deepEqual(c.slice(0, 3), ["bitna", "betna", "bitna-asl"]);
    assert.ok(c.every((s) => s.length <= 24));
  });

  it("drops generic words and the ال / لل prefixes", () => {
    assert.deepEqual(significantWords("متجر النور للعطور"), ["nor", "ator"]);
    assert.equal(subdomainCandidates("متجر النور")[0], "nor");
    assert.equal(subdomainCandidates("Nile Perfume Store")[0], "nile");
  });

  it("English names get no Arabic spelling variant", () => {
    assert.deepEqual(subdomainCandidates("Rivers"), ["rivers", "rivers-store", "riverssd"]);
  });

  it("only valid links (no reserved names, 3+ characters)", () => {
    for (const name of ["Shop", "My Store", "ع", "🙂🙂"]) {
      for (const s of subdomainCandidates(name)) assert.match(s, /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/);
      assert.ok(!subdomainCandidates(name).includes("shop"));
    }
  });
});
