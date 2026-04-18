import * as React from 'react';
import { BreadcrumbCtxObj, type Crumb } from './breadcrumb-context';

// The non-component exports (`useBreadcrumbOverride`, `useSetBreadcrumbs`,
// `Crumb`) live in `./breadcrumb-context` so Fast Refresh on this file
// only ever has to worry about <BreadcrumbProvider>. Consumers of the
// hooks should import from `./breadcrumb-context` directly.
export const BreadcrumbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trail, setTrail] = React.useState<Crumb[] | null>(null);
  return <BreadcrumbCtxObj.Provider value={{ trail, setTrail }}>{children}</BreadcrumbCtxObj.Provider>;
};
