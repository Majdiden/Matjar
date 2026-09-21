/**
 * Order receipt — the itemised summary a customer gets when they place an
 * order, as an email-safe HTML block (`buildReceiptHtml`) and as a PDF
 * attachment (`buildReceiptPdf`).
 *
 * One file, no framework. Every order/tenant string is escaped before it
 * lands in HTML; the PDF draws text only (no markup), so there escaping is
 * not needed but lengths are clamped.
 *
 * Money: the receipt shows what the customer SAW at checkout — the
 * presentment currency and amounts when the order carries them, otherwise
 * the store's base currency. Numbers print with two decimals only when they
 * are not whole.
 *
 * Arabic in the PDF: pdfkit/fontkit joins Arabic glyphs correctly and the
 * `rtla` feature lays the run out right-to-left, but it also mirrors every
 * embedded Latin/digit run ("1042" → "2401"). `rtlText` pre-reverses those
 * runs (and swaps brackets, which `rtla` mirrors) so the two reversals cancel
 * and mixed lines read correctly. Verified visually (scratchpad pdftest2.png).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_REGULAR = path.join(__dirname, "..", "assets", "fonts", "IBMPlexSansArabic-Regular.ttf");
const FONT_BOLD = path.join(__dirname, "..", "assets", "fonts", "IBMPlexSansArabic-SemiBold.ttf");

const ACCENT = "#1f6f5f";
const INK = "#16181d";
const MUTED = "#6b7280";
const RULE = "#e5e7eb";
const MAX_ITEMS = 200;
const ARABIC_CHARS = /[\u0600-\u06FF\u0750-\u077F]/;

const LABELS = {
  en: {
    receipt: "Receipt",
    order: "Order",
    date: "Date",
    billedTo: "Customer",
    shipTo: "Ship to",
    payment: "Payment",
    item: "Item",
    qty: "Qty",
    price: "Price",
    lineTotal: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Shipping",
    tax: "Tax",
    taxIncluded: "Tax (included)",
    total: "Total",
    thanks: "Thank you for your order.",
    keep: "Keep this receipt for your records.",
    free: "Free",
    shippingMethod: "Shipping method",
  },
  ar: {
    receipt: "إيصال الطلب",
    order: "رقم الطلب",
    date: "التاريخ",
    billedTo: "العميل",
    shipTo: "عنوان الشحن",
    payment: "طريقة الدفع",
    item: "المنتج",
    qty: "الكمية",
    price: "السعر",
    lineTotal: "الإجمالي",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    shipping: "الشحن",
    tax: "الضريبة",
    taxIncluded: "الضريبة (مشمولة)",
    total: "الإجمالي",
    thanks: "شكراً لطلبك.",
    keep: "احتفظ بهذا الإيصال للرجوع إليه.",
    free: "مجاني",
    shippingMethod: "طريقة الشحن",
  },
};

export function isArabic(language) {
  return String(language || "").toLowerCase().startsWith("ar");
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function clamp(str, n = 120) {
  const s = String(str ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function formatAmount(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  const rounded = Math.round(v * 100) / 100;
  const whole = Number.isInteger(rounded);
  return rounded.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

function money(n, currency) {
  return `${formatAmount(n)} ${currency}`;
}

function formatDate(d, language) {
  const date = d ? new Date(d) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(isArabic(language) ? "ar-EG-u-nu-latn" : "en-GB", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Normalise an order into the plain numbers/strings both renderers need.
 * Exported for tests.
 */
export function receiptModel({ order, tenant, language, paymentLabel }) {
  const s = tenant?.settings || {};
  const lang = isArabic(language || order?.language || s.language) ? "ar" : "en";
  const L = LABELS[lang];
  const usePresentment = !!(order?.presentmentCurrency && order.presentmentTotal != null);
  const currency = usePresentment ? order.presentmentCurrency : order?.baseCurrency || s.currencies?.base || s.currency || "SDG";
  const fx = usePresentment && order.fxRate > 0 ? Number(order.fxRate) : 1;

  const items = (Array.isArray(order?.products) ? order.products : []).slice(0, MAX_ITEMS).map((p) => {
    const qty = Math.max(1, Number(p.quantity) || 1);
    const unit = (Number(p.price) || 0) * fx;
    return {
      name: clamp(p.name || "Item", 120),
      sku: clamp(p.sku || "", 40),
      options: (Array.isArray(p.variantOptions) ? p.variantOptions : [])
        .filter((o) => o && o.name && o.value)
        .map((o) => `${clamp(o.name, 30)}: ${clamp(o.value, 40)}`),
      qty,
      unit,
      lineTotal: unit * qty,
    };
  });

  const subtotal = usePresentment && order.presentmentSubtotal != null
    ? Number(order.presentmentSubtotal)
    : order?.subtotal != null
      ? Number(order.subtotal)
      : items.reduce((a, i) => a + i.lineTotal, 0);
  const shipping = usePresentment && order.presentmentShipping != null ? Number(order.presentmentShipping) : (Number(order?.shippingCost) || Number(order?.shippingMethod?.price) || 0) * (usePresentment ? fx : 1);
  const tax = usePresentment && order.presentmentTax != null ? Number(order.presentmentTax) : (Number(order?.tax) || 0) * (usePresentment ? fx : 1);
  const discount = (Number(order?.discount) || 0) * (usePresentment ? fx : 1);
  const total = usePresentment ? Number(order.presentmentTotal) : Number(order?.totalAmount) || 0;
  const discountCodes = [...new Set([...(order?.discountCodes || []), order?.discountCode].filter(Boolean))].map((c) => clamp(c, 32));

  const a = order?.shippingAddress || {};
  const customerName =
    clamp([a.firstName, a.lastName].filter(Boolean).join(" ") ||
      [order?.customerSnapshot?.firstName, order?.customerSnapshot?.lastName].filter(Boolean).join(" ") ||
      [order?.guestCustomer?.firstName, order?.guestCustomer?.lastName].filter(Boolean).join(" ") ||
      order?.user?.name ||
      "", 80);
  const addressLines = [
    a.addressLine1,
    a.addressLine2,
    [a.city, a.state].filter(Boolean).join(", "),
    [a.postalCode, a.country].filter(Boolean).join(" "),
    a.phone,
  ]
    .map((x) => clamp(x, 80))
    .filter(Boolean);

  return {
    lang,
    L,
    rtl: lang === "ar",
    storeName: clamp(s.storeName || tenant?.name || "Store", 60),
    logo: typeof s.logo === "string" && /^https?:\/\//.test(s.logo) ? s.logo : null,
    contact: [s.supportEmail, s.phone, s.address].map((x) => clamp(x, 80)).filter(Boolean),
    orderNumber: clamp(order?.orderNumber || String(order?._id || ""), 40),
    date: formatDate(order?.createdAt, lang),
    customerName,
    customerEmail: clamp(order?.customerSnapshot?.email || order?.guestCustomer?.email || order?.user?.email || "", 80),
    addressLines,
    payment: clamp(paymentLabel || order?.paymentMethod || "", 60),
    shippingMethod: clamp(order?.shippingMethod?.name || "", 60),
    currency: clamp(currency, 8),
    items,
    subtotal,
    discount,
    discountCodes,
    shipping,
    tax,
    taxIncluded: !!order?.taxIncluded,
    total,
  };
}

/** Label of the tenant-configured payment method, when the caller has scoped models. */
export async function resolvePaymentLabel(models, order) {
  try {
    if (!models?.PaymentMethod || !order?.paymentMethodCode) return null;
    const m = await models.PaymentMethod.findOne({ code: order.paymentMethodCode }).select("label name").lean();
    return m?.label || m?.name || null;
  } catch {
    return null;
  }
}

// ── HTML ──────────────────────────────────────────────────────────────────

/** Bidi-isolate a numeric/Latin value so RTL email clients keep "90 SDG", "+249…" and "−27.10" upright. */
function ltr(escaped) {
  return `<span dir="ltr" style="unicode-bidi:isolate">${escaped}</span>`;
}

export function buildReceiptHtml({ order, tenant, language, paymentLabel } = {}) {
  const m = receiptModel({ order, tenant, language, paymentLabel });
  const { L, rtl } = m;
  const dir = rtl ? "rtl" : "ltr";
  const start = rtl ? "right" : "left";
  const end = rtl ? "left" : "right";
  const td = (content, extra = "") => `<td style="padding:10px 6px;border-bottom:1px solid ${RULE};font-size:14px;color:${INK};vertical-align:top;${extra}">${content}</td>`;
  const th = (content, extra = "") => `<th style="padding:0 6px 8px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${MUTED};text-align:${start};${extra}">${content}</th>`;

  const rows = m.items
    .map((i) => {
      const meta = [...i.options, i.sku ? `SKU ${i.sku}` : ""].filter(Boolean).map(escapeHtml).join(" · ");
      return `<tr>${td(`<div style="font-weight:600">${escapeHtml(i.name)}</div>${meta ? `<div style="color:${MUTED};font-size:12px;margin-top:2px">${meta}</div>` : ""}`)}${td(escapeHtml(String(i.qty)), `text-align:center;white-space:nowrap`)}${td(ltr(escapeHtml(money(i.unit, m.currency))), `text-align:${end};white-space:nowrap`)}${td(ltr(escapeHtml(money(i.lineTotal, m.currency))), `text-align:${end};white-space:nowrap;font-weight:600`)}</tr>`;
    })
    .join("");

  const totalRow = (label, value, opts = {}) =>
    `<tr><td style="padding:6px 6px;font-size:${opts.big ? 16 : 14}px;color:${opts.big ? INK : MUTED};${opts.big ? "font-weight:700;border-top:2px solid " + INK + ";padding-top:12px" : ""}">${label}</td><td style="padding:6px 6px;font-size:${opts.big ? 16 : 14}px;text-align:${end};white-space:nowrap;color:${opts.color || INK};${opts.big ? "font-weight:700;border-top:2px solid " + INK + ";padding-top:12px" : ""}">${value}</td></tr>`;

  const totals = [
    totalRow(escapeHtml(L.subtotal), ltr(escapeHtml(money(m.subtotal, m.currency)))),
    m.discount > 0 ? totalRow(escapeHtml(`${L.discount}${m.discountCodes.length ? ` · ${m.discountCodes.join(", ")}` : ""}`), ltr(escapeHtml(`−${money(m.discount, m.currency)}`)), { color: ACCENT }) : "",
    totalRow(escapeHtml(`${L.shipping}${m.shippingMethod ? ` · ${m.shippingMethod}` : ""}`), m.shipping > 0 ? ltr(escapeHtml(money(m.shipping, m.currency))) : escapeHtml(L.free)),
    m.tax > 0 ? totalRow(escapeHtml(m.taxIncluded ? L.taxIncluded : L.tax), ltr(escapeHtml(money(m.tax, m.currency)))) : "",
    totalRow(escapeHtml(L.total), ltr(escapeHtml(money(m.total, m.currency))), { big: true }),
  ].join("");

  const block = (label, lines) =>
    lines.length
      ? `<td style="vertical-align:top;padding:0 6px 12px;width:50%"><div style="font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${MUTED};margin-bottom:4px">${escapeHtml(label)}</div><div style="font-size:14px;line-height:1.5;color:${INK}">${lines.map((l) => (ARABIC_CHARS.test(l) ? escapeHtml(l) : ltr(escapeHtml(l)))).join("<br>")}</div></td>`
      : "";

  return (
    `<div dir="${dir}" style="max-width:560px;margin:20px auto 0;text-align:${start}">` +
    `<div style="height:3px;background:${ACCENT};border-radius:2px;margin-bottom:16px"></div>` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr>` +
    `<td style="padding:0 6px 16px"><div style="font-size:20px;font-weight:700;color:${INK}">${escapeHtml(L.receipt)}</div><div style="font-size:13px;color:${MUTED};margin-top:2px">${escapeHtml(L.order)} <strong style="color:${INK}">${ltr(escapeHtml(m.orderNumber))}</strong> · ${ARABIC_CHARS.test(m.date) ? escapeHtml(m.date) : ltr(escapeHtml(m.date))}</div></td>` +
    `</tr></table>` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr>` +
    block(L.billedTo, [m.customerName, m.customerEmail].filter(Boolean)) +
    block(L.shipTo, m.addressLines) +
    `</tr></table>` +
    (m.payment ? `<div style="padding:0 6px 16px;font-size:13px;color:${MUTED}">${escapeHtml(L.payment)}: <span style="color:${INK}">${escapeHtml(m.payment)}</span></div>` : "") +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:4px">` +
    `<thead><tr>${th(escapeHtml(L.item))}${th(escapeHtml(L.qty), "text-align:center")}${th(escapeHtml(L.price), `text-align:${end}`)}${th(escapeHtml(L.lineTotal), `text-align:${end}`)}</tr></thead>` +
    `<tbody>${rows}</tbody></table>` +
    `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:12px 0 0 auto;width:100%;max-width:300px;${rtl ? "margin-left:0;margin-right:auto" : ""}"><tbody>${totals}</tbody></table>` +
    `<div style="margin:20px 6px 0;font-size:14px;color:${INK}">${escapeHtml(L.thanks)} <span style="color:${MUTED}">${escapeHtml(L.keep)}</span></div>` +
    `</div>`
  );
}

// ── PDF ───────────────────────────────────────────────────────────────────

// Latin/digit runs (optionally wrapped in brackets or led by a sign). Inside
// an `rtla` run these come out mirrored, so we pre-reverse them.
const LTR_RUN = /[(\[\-−+]?[A-Za-z0-9](?:[A-Za-z0-9 .,:\/#+%@()\[\]_-]*[A-Za-z0-9%)\]])?|[(\[\-−+]?[A-Za-z0-9]/g;
const MIRROR = { "(": ")", ")": "(", "[": "]", "]": "[" };

export function rtlText(s) {
  return String(s).replace(LTR_RUN, (run) => [...run].reverse().map((c) => MIRROR[c] || c).join(""));
}

export async function buildReceiptPdf({ order, tenant, language, paymentLabel } = {}) {
  const m = receiptModel({ order, tenant, language, paymentLabel });
  const { L, rtl } = m;
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `${L.receipt} ${m.orderNumber}`, Author: m.storeName } });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.registerFont("body", FONT_REGULAR);
  doc.registerFont("bold", FONT_BOLD);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // Draw one line of text in a box. Arabic lines go through rtlText + rtla;
  // pure-Latin lines (a product name inside an Arabic receipt) do not.
  const text = (str, x, y, w, { align = "left", size = 10, bold = false, color = INK } = {}) => {
    const s = String(str ?? "");
    const arabic = rtl && ARABIC_CHARS.test(s);
    doc.font(bold ? "bold" : "body").fontSize(size).fillColor(color);
    doc.text(arabic ? rtlText(s) : s, x, y, { width: w, align, lineBreak: false, ellipsis: true, features: arabic ? ["rtla"] : [] });
  };
  // Mirror a column for RTL layouts.
  const col = (x, w) => (rtl ? [right - (x - left) - w, w] : [x, w]);
  const startAlign = rtl ? "right" : "left";
  const endAlign = rtl ? "left" : "right";
  const lineH = (size) => size * 1.45;

  // Header: accent bar, store name, receipt title, order meta.
  doc.rect(left, 40, width, 3).fill(ACCENT);
  let y = 60;
  text(m.storeName, left, y, width, { align: startAlign, size: 18, bold: true });
  text(L.receipt, left, y + 2, width, { align: endAlign, size: 12, color: MUTED });
  y += lineH(18) + 6;
  text(`${L.order} ${m.orderNumber}`, left, y, width, { align: startAlign, size: 10, color: MUTED });
  text(m.date, left, y, width, { align: endAlign, size: 10, color: MUTED });
  y += lineH(10) + 18;

  // Customer / ship-to blocks.
  const half = width / 2 - 8;
  const block = (label, lines, x0) => {
    const [x, w] = col(x0, half);
    let yy = y;
    text(label.toUpperCase(), x, yy, w, { align: startAlign, size: 8, bold: true, color: MUTED });
    yy += lineH(8) + 2;
    for (const line of lines) {
      text(line, x, yy, w, { align: startAlign, size: 10 });
      yy += lineH(10);
    }
    return yy;
  };
  const yA = block(L.billedTo, [m.customerName, m.customerEmail].filter(Boolean), left);
  const yB = m.addressLines.length ? block(L.shipTo, m.addressLines, left + half + 16) : y;
  y = Math.max(yA, yB) + 10;
  const metaBits = [m.payment ? `${L.payment}: ${m.payment}` : "", m.shippingMethod ? `${L.shippingMethod}: ${m.shippingMethod}` : ""].filter(Boolean);
  if (metaBits.length) {
    text(metaBits.join("   ·   "), left, y, width, { align: startAlign, size: 9, color: MUTED });
    y += lineH(9) + 12;
  } else {
    y += 6;
  }

  // Items table. Column geometry (LTR): item | qty | price | total.
  const cQty = 50;
  const cPrice = 90;
  const cTotal = 100;
  const cItem = width - cQty - cPrice - cTotal;
  const columns = [
    { key: "item", x: left, w: cItem, align: startAlign },
    { key: "qty", x: left + cItem, w: cQty, align: "center" },
    { key: "price", x: left + cItem + cQty, w: cPrice, align: endAlign },
    { key: "total", x: left + cItem + cQty + cPrice, w: cTotal, align: endAlign },
  ].map((c) => {
    const [x, w] = col(c.x, c.w);
    return { ...c, x, w };
  });
  const head = { item: L.item, qty: L.qty, price: L.price, total: L.lineTotal };
  for (const c of columns) text(head[c.key].toUpperCase(), c.x + 4, y, c.w - 8, { align: c.align, size: 8, bold: true, color: MUTED });
  y += lineH(8) + 4;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(1).strokeColor(INK).stroke();
  y += 8;

  const ensureRoom = (needed) => {
    if (y + needed > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  };

  for (const i of m.items) {
    const meta = [...i.options, i.sku ? `SKU ${i.sku}` : ""].filter(Boolean).join(" · ");
    const rowH = lineH(10) + (meta ? lineH(8) : 0) + 8;
    ensureRoom(rowH);
    const byKey = Object.fromEntries(columns.map((c) => [c.key, c]));
    text(i.name, byKey.item.x + 4, y, byKey.item.w - 8, { align: byKey.item.align, size: 10, bold: true });
    text(String(i.qty), byKey.qty.x + 4, y, byKey.qty.w - 8, { align: "center", size: 10 });
    text(money(i.unit, m.currency), byKey.price.x + 4, y, byKey.price.w - 8, { align: byKey.price.align, size: 10 });
    text(money(i.lineTotal, m.currency), byKey.total.x + 4, y, byKey.total.w - 8, { align: byKey.total.align, size: 10, bold: true });
    if (meta) text(meta, byKey.item.x + 4, y + lineH(10), byKey.item.w - 8, { align: byKey.item.align, size: 8, color: MUTED });
    y += rowH;
    doc.moveTo(left, y - 4).lineTo(right, y - 4).lineWidth(0.5).strokeColor(RULE).stroke();
  }

  // Totals, aligned to the end edge.
  y += 10;
  const tw = 260;
  const [tx] = col(right - tw, tw);
  const totalLine = (label, value, { big = false, color = INK } = {}) => {
    ensureRoom(lineH(big ? 13 : 10) + 6);
    const size = big ? 13 : 10;
    if (big) {
      doc.moveTo(tx, y).lineTo(tx + tw, y).lineWidth(1.2).strokeColor(INK).stroke();
      y += 8;
    }
    text(label, tx, y, tw * 0.55, { align: startAlign, size, bold: big, color: big ? INK : MUTED });
    text(value, tx + tw * 0.55, y, tw * 0.45, { align: endAlign, size, bold: big, color });
    y += lineH(size) + 2;
  };
  // Mirror label/value cells for RTL: label sits at the right edge.
  const totalLineRtlAware = rtl
    ? (label, value, o) => {
        ensureRoom(lineH(o?.big ? 13 : 10) + 6);
        const size = o?.big ? 13 : 10;
        if (o?.big) {
          doc.moveTo(tx, y).lineTo(tx + tw, y).lineWidth(1.2).strokeColor(INK).stroke();
          y += 8;
        }
        text(label, tx + tw * 0.45, y, tw * 0.55, { align: "right", size, bold: !!o?.big, color: o?.big ? INK : MUTED });
        text(value, tx, y, tw * 0.45, { align: "left", size, bold: !!o?.big, color: o?.color || INK });
        y += lineH(size) + 2;
      }
    : totalLine;

  totalLineRtlAware(L.subtotal, money(m.subtotal, m.currency));
  if (m.discount > 0) totalLineRtlAware(`${L.discount}${m.discountCodes.length ? ` · ${m.discountCodes.join(", ")}` : ""}`, `−${money(m.discount, m.currency)}`, { color: ACCENT });
  totalLineRtlAware(`${L.shipping}${m.shippingMethod ? ` · ${m.shippingMethod}` : ""}`, m.shipping > 0 ? money(m.shipping, m.currency) : L.free);
  if (m.tax > 0) totalLineRtlAware(m.taxIncluded ? L.taxIncluded : L.tax, money(m.tax, m.currency));
  totalLineRtlAware(L.total, money(m.total, m.currency), { big: true });

  // Footer.
  y += 24;
  ensureRoom(60);
  text(L.thanks, left, y, width, { align: startAlign, size: 11, bold: true });
  y += lineH(11);
  text(L.keep, left, y, width, { align: startAlign, size: 9, color: MUTED });
  y += lineH(9) + 14;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(RULE).stroke();
  y += 10;
  const footer = [m.storeName, ...m.contact].join("   ·   ");
  text(footer, left, y, width, { align: startAlign, size: 8, color: MUTED });

  doc.end();
  return done;
}
