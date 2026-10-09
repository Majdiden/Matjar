/**
 * Theme switch carry-over (services/themeSwitchCarry.js): the merchant's hero
 * words and photo move to the incoming theme's hero by role.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { carryCustomization, carryHero, findHero, readHeroRoles } from "../../services/themeSwitchCarry.js";

const STOCK = "https://images.unsplash.com/photo-1?w=1600";
const PHOTO = "https://cdn.example.com/me.jpg";
const declares = (map) => (type) => map[type] || [];

describe("readHeroRoles", () => {
  it("takes the merchant's values and their Arabic twins, skipping blanks and stock photos", () => {
    assert.deepEqual(
      readHeroRoles({ heading_line1: "Nile", heading_line1__ar: "النيل", subheading: " ", primary_button_text: "", image: STOCK }),
      { heading: { value: "Nile", twin: "النيل" } }
    );
    assert.deepEqual(readHeroRoles({ cta_text__ar: "تسوق", background_image: PHOTO }), {
      cta: { value: "تسوق", twin: "تسوق" },
      image: { value: PHOTO },
    });
    assert.deepEqual(readHeroRoles(null), {});
  });
});

describe("findHero", () => {
  it("is the first enabled hero by order", () => {
    const sections = [
      { id: "b", type: "hero", order: 2 },
      { id: "x", type: "misk-hero", order: 1, enabled: false },
      { id: "a", type: "aurum-split-hero", order: 1 },
      { id: "t", type: "top-strip", order: 0 },
    ];
    assert.equal(findHero(sections).id, "a");
    assert.equal(findHero([{ id: "p", type: "products" }]), null);
  });
});

describe("carryHero", () => {
  it("writes each role to the key the incoming hero declares", () => {
    const from = [{ id: "hero", type: "hero", settings: { heading_line1: "Nile", heading_line1__ar: "النيل", primary_button_text: "Browse", background_image: PHOTO } }];
    const to = { index: [{ id: "hero", type: "misk-hero", settings: { cta_url: "/products" } }, { id: "p", type: "products", settings: {} }] };
    const out = carryHero(from, to, declares({ "misk-hero": ["heading", "subheading", "image", "cta_text", "cta_url"] }));
    assert.deepEqual(out.index[0].settings, {
      cta_url: "/products",
      heading: "Nile",
      heading__ar: "النيل",
      cta_text: "Browse",
      image: PHOTO,
    });
    assert.equal(out.index[1], to.index[1]);
    assert.deepEqual(to.index[0].settings, { cta_url: "/products" }, "input left alone");
  });

  it("drops roles the incoming hero has no key for, and leaves stores without a hero alone", () => {
    const from = [{ id: "hero", type: "hero", settings: { heading: "Nile", image: PHOTO } }];
    const to = { index: [{ id: "h", type: "hero-showcase", settings: {} }] };
    const out = carryHero(from, to, declares({ "hero-showcase": ["heading_line1", "heading_line2", "primary_button_text"] }));
    assert.deepEqual(out.index[0].settings, { heading_line1: "Nile" });
    assert.equal(carryHero([], to, declares({})), to);
    const empty = { index: [] };
    assert.equal(carryHero(from, empty, declares({})), empty);
  });
});

describe("carryCustomization", () => {
  it("carries the top strip and keeps the incoming theme's other theme settings", () => {
    const from = {
      settings: { colors: { primary: "#111" }, theme: { announcement_text: "Hi", announcement_text__ar: "أهلا", show_announcement_bar: false, utility_phone: "1" } },
      sectionsByTemplate: { index: [] },
    };
    const to = { settings: { colors: {}, theme: { layout_style: "wide" } }, sectionsByTemplate: { index: [] } };
    const out = carryCustomization(from, to, declares({}));
    assert.deepEqual(out.settings.theme, { layout_style: "wide", announcement_text: "Hi", announcement_text__ar: "أهلا", show_announcement_bar: false });
    assert.deepEqual(out.settings.colors, {});
    assert.equal(carryCustomization(null, to, declares({})), to);
  });
});
