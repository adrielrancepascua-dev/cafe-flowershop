/** Domain used when admins create staff login emails (no @ symbol). */
export const STAFF_EMAIL_DOMAIN =
  import.meta.env.VITE_STAFF_EMAIL_DOMAIN || 'papersandpetals.ph';

export function formatStaffEmailExample(localPart = 'maria.santos'): string {
  return `${localPart}@${STAFF_EMAIL_DOMAIN}`;
}
