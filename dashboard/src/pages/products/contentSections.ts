/** Mirrors validators/product.validator.js. */
export const CONTENT_SECTION_MAX = 10;
export const SECTION_KEY_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

export interface SpecRow { key: string; value: string }
export interface ContentSectionRow {
  key: string;
  title: string;
  body: string;
  titleAr: string;
  bodyAr: string;
  /** false once the merchant edited the key by hand — stop deriving it from the title. */
  autoKey: boolean;
}

export function slugifyKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Quick-add presets. Keys match the tabs themes map onto (how-to-use, ingredients, nutrition). */
export const SUGGESTED_SECTIONS: ReadonlyArray<{ key: string; title: string; titleAr: string }> = [
  { key: 'how-to-use', title: 'How to use', titleAr: 'طريقة الاستخدام' },
  { key: 'ingredients', title: 'Ingredients', titleAr: 'المكونات' },
  { key: 'nutrition', title: 'Nutrition', titleAr: 'القيمة الغذائية' },
  { key: 'care', title: 'Care', titleAr: 'العناية' },
  { key: 'warranty', title: 'Warranty', titleAr: 'الضمان' },
  { key: 'size-guide', title: 'Size guide', titleAr: 'دليل المقاسات' },
];
