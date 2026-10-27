import { getATenantRepo } from "../repositories/tenant.js";
import { toCountryCode } from "../utils/countryCode.js";

/**
 * Calculate shipping cost based on cart and address
 */
export const calculateShipping = async (cart, address, tenantId) => {
  const tenant = await getATenantRepo({}, { _id: tenantId });
  const settings = tenant.settings?.shipping || { type: "flat", rate: 0, freeShippingThreshold: null };

  // Delivery by zone: the area the shopper picked (by id) — the only one when
  // the store has a single area — or that one is still needed. Resolved first
  // so a free-shipping order records it too.
  let deliveryZone = null;
  let deliveryZoneMissing = false;
  let picked = null;
  // The delivery country decides the area; a pick is only needed when the
  // country has several (e.g. Khartoum and Omdurman in Sudan).
  const country = toCountryCode(address.country);
  if (settings.type === "zone") {
    const areas = publicDeliveryZones(settings);
    const inCountry = country ? areas.filter((a) => a.countries.includes(country)) : areas;
    picked = findZoneById(settings.zones, address.deliveryZoneId);
    if (picked && country && !(picked.countries || []).some((c) => String(c).toUpperCase() === country)) picked = null;
    if (!picked && inCountry.length === 1) picked = findZoneById(settings.zones, inCountry[0].id);
    if (picked) deliveryZone = { id: String(picked._id), name: picked.name };
    else if (inCountry.length > 1) deliveryZoneMissing = true;
  }
  const zoneInfo = { ...(deliveryZone && { deliveryZone }), ...(deliveryZoneMissing && { deliveryZoneMissing }) };

  if (settings.freeShippingThreshold && cart.subtotal >= settings.freeShippingThreshold) {
    return { type: "free", cost: 0, description: "Free Shipping", ...zoneInfo };
  }

  let cost = 0;
  let description = "Standard Shipping";

  switch (settings.type) {
    case "flat":
      cost = settings.rate;
      break;
    case "weight": {
      const totalWeight = cart.items.reduce(
        (sum, item) => sum + (item.product.weight || 1) * item.quantity, 0
      );
      cost = settings.baseRate + totalWeight * settings.perKgRate;
      description = `Shipping (${totalWeight}kg)`;
      break;
    }
    case "zone": {
      // The shopper picks a delivery area (zone) at checkout; it is priced by
      // its id. Without one, the first zone for the country is the estimate
      // (older storefronts) — placing an order requires the pick.
      const zone =
        picked ||
        settings.zones?.find((z) => z.countries?.some((c) => String(c).toUpperCase() === country));
      if (!zone || !zone.rates?.length) {
        cost = settings.rate || 0;
        description = "Standard Shipping";
      } else {
        // Pick the cheapest rate whose weight band actually contains the
        // cart weight. Open-ended bands (no min and/or no max) are honoured.
        const totalWeight = cart.items.reduce(
          (sum, item) => sum + (item.product?.weight || 0) * item.quantity, 0
        );
        const eligible = zone.rates.filter((r) => {
          const minOk = r.minWeight == null || totalWeight >= r.minWeight;
          const maxOk = r.maxWeight == null || totalWeight <= r.maxWeight;
          return minOk && maxOk;
        });
        const rate = (eligible.length ? eligible : zone.rates)
          .slice()
          .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0];
        cost = rate.price;
        description = `${rate.name}${rate.estimatedDays ? ` (${rate.estimatedDays})` : ""}`;
      }
      break;
    }
    case "free":
      cost = 0;
      description = "Free Shipping";
      break;
    default:
      cost = 0;
  }

  return {
    type: settings.type,
    cost: Math.round(cost * 100) / 100,
    description,
    ...zoneInfo,
  };
};

/** A zone by its id (string or ObjectId), or null. */
export function findZoneById(zones, id) {
  if (!Array.isArray(zones) || !id) return null;
  return zones.find((z) => z?._id && String(z._id) === String(id)) || null;
}

/**
 * The delivery areas a shopper picks from at checkout — names only, and only
 * when the store delivers by zone (Settings → Shipping → Zones).
 */
export function publicDeliveryZones(shipping) {
  if (shipping?.type !== "zone" || !Array.isArray(shipping.zones)) return [];
  return shipping.zones
    .filter((z) => z?._id && z.name && z.rates?.length)
    .map((z) => ({ id: String(z._id), name: z.name, countries: (z.countries || []).map((c) => String(c).toUpperCase()) }));
}

/**
 * The countries a store delivers to (ISO codes), for the checkout country
 * list: its delivery zones' countries (zone shipping); else its markets'
 * countries, unless a market serves "every other country" (no countries);
 * else `fallback` (the platform's countries). Empty = no limit.
 */
export function storeCountries(settings, fallback = []) {
  const shipping = settings?.shipping;
  if (shipping?.type === "zone") {
    const fromZones = new Set(publicDeliveryZones(shipping).flatMap((z) => z.countries));
    if (fromZones.size) return [...fromZones];
  }
  const markets = (settings?.markets || []).filter((m) => m?.enabled !== false);
  if (markets.length && markets.every((m) => (m.countries || []).length)) {
    return [...new Set(markets.flatMap((m) => m.countries.map((c) => String(c).toUpperCase())))];
  }
  return Array.isArray(fallback) ? fallback.map((c) => String(c).toUpperCase()) : [];
}
