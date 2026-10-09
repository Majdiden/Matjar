import { useFeatures } from '../contexts/features-context';
import { FULL_PRODUCT_ROUTE, QUICK_PRODUCT_ROUTE } from '../lib/quickProduct';

/**
 * Where "Add product" buttons go: the quick form (photo, name, price,
 * quantity) for stores in simple mode (`design.simpleMode`), else the full
 * product form. The quick form links to the full one.
 */
export function useNewProductRoute(): string {
  const { hasFeature } = useFeatures();
  return hasFeature('design.simpleMode') ? QUICK_PRODUCT_ROUTE : FULL_PRODUCT_ROUTE;
}
