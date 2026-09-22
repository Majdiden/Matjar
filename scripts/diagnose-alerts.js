/**
 * Why didn't a platform alert email arrive?
 *
 * Checks, in the order a mail actually has to pass:
 *   1. Is delivery switched on at all (EMAIL_ENABLED + provider key)?
 *   2. Is anyone subscribed to the event?
 *   3. Is that person active (suspended operators are skipped)?
 *   4. Optionally, send a real test alert and report the provider's answer.
 *
 * Run against any environment by pointing DB_URI at it:
 *   node scripts/diagnose-alerts.js 2>/dev/null     # 2>/dev/null hides
 *                                                    # mongoose index warnings
 *   node scripts/diagnose-alerts.js --event tenant.signup
 *   node scripts/diagnose-alerts.js --send            # actually sends one
 */
import mongoose from "mongoose";
import config from "../config/index.js";
import { registerAllModels } from "../utils/initDbConnection.js";
import { PLATFORM_NOTIFICATION_EVENTS } from "../config/platformNotificationEvents.js";
import { subscribedRecipients, notifyPlatform } from "../services/platform/notifications.js";

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? d : process.argv[i + 1] ?? true;
};
const EVENT = arg("event", "tenant.signup");
const SEND = process.argv.includes("--send");
const ok = (b) => (b ? "yes" : "NO");

const main = async () => {
  console.log(`\nEnvironment : ${config.nodeEnv}`);
  console.log(`Database    : ${String(config.dbUri || process.env.DB_URI || "").replace(/\/\/[^@]*@/, "//***@")}`);

  // 1. Delivery gate ------------------------------------------------------
  console.log("\n1. Delivery");
  console.log(`   EMAIL_ENABLED=true ......... ${ok(config.emailEnabled)}`);
  console.log(`   provider key present ....... ${ok(!!config.resendApiKey)}`);
  console.log(`   EMAIL_FROM set ............. ${ok(!!config.emailFrom)}${config.emailFrom ? ` (${config.emailFrom})` : ""}`);
  if (!config.emailEnabled) {
    console.log("   → Sends are LOGGED, NOT DELIVERED. Nothing will arrive until EMAIL_ENABLED=true.");
  } else if (!config.resendApiKey || !config.emailFrom) {
    console.log("   → Delivery is on but the provider is incomplete; sends will throw.");
  }

  await mongoose.connect(config.dbUri || process.env.DB_URI);
  registerAllModels(mongoose.connection);

  // 2 + 3. Who receives it ------------------------------------------------
  const TenantUser = mongoose.model("TenantUser");
  const staff = await TenantUser.find({ platformAdmin: true })
    .select("email platformRole platformStatus platformNotifications")
    .lean();

  console.log(`\n2. Subscriptions for "${EVENT}"`);
  const def = PLATFORM_NOTIFICATION_EVENTS.find((e) => e.key === EVENT);
  if (!def) {
    console.log(`   Unknown event. Known: ${PLATFORM_NOTIFICATION_EVENTS.map((e) => e.key).join(", ")}`);
  } else {
    if (def.alwaysRoles?.length) console.log(`   Always sent to roles: ${def.alwaysRoles.join(", ")}`);
    for (const u of staff) {
      const subscribed = (u.platformNotifications || []).includes(EVENT);
      const byRole = def.alwaysRoles?.includes(String(u.platformRole || "").toLowerCase());
      const suspended = u.platformStatus === "suspended";
      const gets = (subscribed || byRole) && !suspended;
      console.log(
        `   ${gets ? "✓" : "·"} ${u.email.padEnd(32)} role=${String(u.platformRole || "—").padEnd(11)}` +
          `${suspended ? " SUSPENDED (skipped)" : ""}${subscribed ? " subscribed" : byRole ? " via role" : " not subscribed"}`
      );
    }
    const recipients = await subscribedRecipients(EVENT);
    console.log(`   → ${recipients.length} recipient(s): ${recipients.map((r) => r.email).join(", ") || "none"}`);
    if (!recipients.length) {
      console.log("   → Nobody is subscribed, so no email is generated at all.");
      console.log("     Fix: platform console → Users → bell icon → tick the alert (owner only).");
    }
  }

  // 4. Optional live send --------------------------------------------------
  if (SEND) {
    console.log("\n3. Test send");
    const r = await notifyPlatform(EVENT, {
      subject: "Diagnostic test alert",
      lines: ["This is a test sent by scripts/diagnose-alerts.js.", `Event: ${EVENT}`],
      link: "/overview",
    });
    console.log(`   result: ${JSON.stringify(r)}`);
    if (r.skipped === "throttled") console.log("   → Throttled: this event already fired recently. Wait for the window to pass.");
    if (r.sent) console.log("   → Provider accepted it. If it still does not arrive, check spam and the sending domain's SPF/DKIM.");
  } else {
    console.log("\n3. Test send skipped (pass --send to actually send one).");
  }

  await mongoose.disconnect();
  console.log("");
};

main().catch((e) => { console.error(e); process.exit(1); });
