import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ORDER_NOTIFICATION_DEFAULTS,
  ORDER_NOTIFICATION_DEFAULTS_AR,
  statusLabelFor,
} from "../../services/orderNotifications.js";

const dashboardDefaults = (lang) =>
  JSON.parse(fs.readFileSync(new URL(`../../dashboard/src/i18n/locales/${lang}/settings.json`, import.meta.url), "utf8"))
    .settings.email_template.defaults;

describe("order status email copy", () => {
  it("the dashboard shows the emails the server sends when a template is empty", () => {
    assert.deepEqual(dashboardDefaults("en"), ORDER_NOTIFICATION_DEFAULTS);
    assert.deepEqual(dashboardDefaults("ar"), ORDER_NOTIFICATION_DEFAULTS_AR);
  });

  it("{{status}} is the customer's language, not the internal status", () => {
    assert.equal(statusLabelFor("Processing", "ar"), "قيد التجهيز");
    assert.equal(statusLabelFor("Shipped", "en"), "shipped");
    assert.equal(statusLabelFor("Pending", undefined), "received");
  });
});
