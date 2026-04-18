import { getATenantRepo } from "../repositories/tenant.js";

/**
 * Calculate shipping cost based on cart and address
 */
export const calculateShipping = async (cart, address, tenantId) => {
  const tenant = await getATenantRepo({}, { _id: tenantId });
  const settings = tenant.settings?.shipping || { type: "flat", rate: 0, freeShippingThreshold: null };

  if (settings.freeShippingThreshold && cart.subtotal >= settings.freeShippingThreshold) {
    return { type: "free", cost: 0, description: "Free Shipping" };
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
      // Country codes are normalised to upper-case at write time.
      const country = String(address.country || "").toUpperCase();
      const zone = settings.zones?.find((z) =>
        z.countries?.some((c) => String(c).toUpperCase() === country)
      );
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

  return { type: settings.type, cost: Math.round(cost * 100) / 100, description };
};
