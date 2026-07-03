/**
 * Suspense fallback for lazily-loaded route pages (audit 3.6). Reuses the
 * same spinner ProtectedRoute shows so a code-split page load looks
 * consistent. `fullScreen` centers in the viewport (standalone routes);
 * the default fills the content area so the sidebar stays put.
 */
export const PageLoader: React.FC<{ fullScreen?: boolean }> = ({ fullScreen = false }) => (
  <div className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'py-24'}`}>
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
  </div>
);

export default PageLoader;
