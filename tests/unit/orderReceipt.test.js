import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildReceiptHtml, buildReceiptPdf, receiptModel, rtlText, formatAmount } from "../../services/orderReceipt.js";

const tenant = { name: "Nile Roasters", settings: { storeName: "Nile Roasters", currency: "SDG", supportEmail: "hello@nileroasters.sd" } };
const order = {
  orderNumber: "NR-1042",
  createdAt: new Date("2026-09-21T10:00:00Z"),
  paymentMethod: "cod",
  language: "en",
  customerSnapshot: { email: "jane@example.com", firstName: "Jane", lastName: "Doe" },
  shippingAddress: { firstName: "Jane", lastName: "Doe", addressLine1: "12 Nile St", city: "Khartoum", country: "SD" },
  shippingMethod: { name: "Standard", price: 15 },
  products: [
    { name: "Yirgacheffe 250g <script>alert(1)</script>", sku: "YRG-250", quantity: 2, price: 45, variantOptions: [{ name: "Grind", value: "Whole bean" }] },
    { name: "Dripper", quantity: 1, price: 120.5 },
  ],
  subtotal: 210.5, discount: 21.05, discountCodes: ["WELCOME10"], shippingCost: 15, tax: 0, totalAmount: 204.45, baseCurrency: "SDG",
};

describe("orderReceipt", () => {
  it("formats whole amounts without decimals and fractions with two", () => {
    assert.equal(formatAmount(90), "90");
    assert.equal(formatAmount(60.5), "60.50");
    assert.equal(formatAmount(1250.456), "1,250.46");
  });

  it("HTML receipt escapes item names and lists totals + discount code", () => {
    const html = buildReceiptHtml({ order, tenant, language: "en" });
    assert.equal(html.includes("<script>"), false, "raw script tag must not survive");
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /Yirgacheffe 250g/);
    assert.match(html, /Grind: Whole bean/);
    assert.match(html, /90 SDG/); // 2 × 45
    assert.match(html, /120\.50 SDG/);
    assert.match(html, /WELCOME10/);
    assert.match(html, /−21\.05 SDG/);
    assert.match(html, /204\.45 SDG/);
    assert.match(html, /dir="ltr"/);
    assert.match(html, /NR-1042/);
  });

  it("prefers the presentment currency the customer saw at checkout", () => {
    const m = receiptModel({ order: { ...order, presentmentCurrency: "USD", presentmentTotal: 3.4, presentmentSubtotal: 3.5, presentmentShipping: 0.25, presentmentTax: 0, fxRate: 1 / 60 }, tenant });
    assert.equal(m.currency, "USD");
    assert.equal(m.total, 3.4);
    assert.equal(m.subtotal, 3.5);
    assert.equal(m.shipping, 0.25);
    assert.ok(Math.abs(m.items[0].unit - 0.75) < 1e-9, "unit price converted with fxRate");
  });

  it("rtlText pre-reverses Latin/digit runs and swaps brackets so rtla renders them upright", () => {
    assert.equal(rtlText("الطلب NR-1043"), "الطلب 3401-RN");
    assert.equal(rtlText("البريد hello@shop.sd"), "البريد ds.pohs@olleh");
    assert.equal(rtlText("قميص (Blue)"), "قميص (eulB)");
    assert.equal(rtlText("−27.10 SDG"), "GDS 01.72−");
  });

  it("builds a PDF for an English order", async () => {
    const pdf = await buildReceiptPdf({ order, tenant, language: "en" });
    assert.ok(Buffer.isBuffer(pdf));
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    assert.ok(pdf.length > 5000, "embedded font + content");
  });

  it("builds a PDF for an Arabic order", async () => {
    const ar = {
      ...order,
      language: "ar",
      products: [{ name: "بن إثيوبي 250غ", quantity: 2, price: 45, variantOptions: [{ name: "الطحن", value: "حبوب كاملة" }] }],
      shippingAddress: { firstName: "سارة", lastName: "أحمد", addressLine1: "شارع النيل 12", city: "الخرطوم", country: "SD" },
    };
    const pdf = await buildReceiptPdf({ order: ar, tenant: { ...tenant, settings: { ...tenant.settings, language: "ar", storeName: "محمصة النيل" } }, language: "ar" });
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    const html = buildReceiptHtml({ order: ar, tenant, language: "ar" });
    assert.match(html, /dir="rtl"/);
    assert.match(html, /إيصال الطلب/);
  });

  it("never throws on an empty order", async () => {
    const html = buildReceiptHtml({ order: {}, tenant: {} });
    assert.match(html, /Receipt/);
    const pdf = await buildReceiptPdf({ order: {}, tenant: {} });
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  });
});
