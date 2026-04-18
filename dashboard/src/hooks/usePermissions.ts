import { useAuth } from '../contexts/auth-context';

export function usePermissions() {
  const { permissions, can } = useAuth();
  const canAny = (...keys: string[]) => can(...keys);
  const canAll = (...keys: string[]) => {
    if (permissions.includes('*')) return true;
    return keys.every(k => permissions.includes(k));
  };
  return { permissions, can, canAny, canAll };
}
