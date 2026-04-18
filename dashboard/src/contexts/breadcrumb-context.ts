import * as React from 'react';

export interface Crumb {
  label: string;
  href?: string;
}

export interface BreadcrumbCtx {
  trail: Crumb[] | null;
  setTrail: (t: Crumb[] | null) => void;
}

export const BreadcrumbCtxObj = React.createContext<BreadcrumbCtx>({
  trail: null,
  setTrail: () => {},
});

export const useBreadcrumbOverride = (): Crumb[] | null =>
  React.useContext(BreadcrumbCtxObj).trail;

export const useSetBreadcrumbs = (crumbs: Crumb[] | null): void => {
  const { setTrail } = React.useContext(BreadcrumbCtxObj);
  const key = crumbs ? JSON.stringify(crumbs) : 'null';
  React.useEffect(() => {
    setTrail(crumbs);
    return () => setTrail(null);
    // `key` is the serialized form of `crumbs` — if it changes, `crumbs`
    // must have changed meaningfully. Listing `crumbs` directly would
    // re-fire on every parent render because a new array literal is
    // identity-new even when contents are equal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
};
