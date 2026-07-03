// Shared error-message extraction for toasts and inline errors.
//
// `apiCall` (lib/api-client) throws the raw server envelope — an object
// with a `message` field — while direct axios calls throw AxiosError
// (server message under `response.data.message`). This helper narrows
// both shapes plus plain strings, falling back to the caller-supplied
// localized message. Do NOT change what apiCall throws; centralize
// extraction here instead.
export const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { message?: unknown } }; message?: unknown };
    const serverMsg = e.response?.data?.message;
    if (typeof serverMsg === 'string') return serverMsg;
    if (typeof e.message === 'string') return e.message;
  }
  if (typeof err === 'string') return err;
  return fallback;
};
