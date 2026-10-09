import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Local value that follows the server value until the merchant edits it.
 * Starts from a restored unsaved draft when there is one.
 */
export function useFieldValue<T>(server: T, draft?: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(draft !== undefined ? draft : server);
  const serverKey = JSON.stringify(server ?? null);
  const lastServerKey = useRef(serverKey);
  useEffect(() => {
    if (serverKey === lastServerKey.current) return;
    const previous = lastServerKey.current;
    lastServerKey.current = serverKey;
    setValue((current) => (JSON.stringify(current ?? null) === previous ? server : current));
    // `serverKey` is the serialized `server`; listing `server` itself would
    // re-run on every render for object values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);
  return [value, setValue];
}
