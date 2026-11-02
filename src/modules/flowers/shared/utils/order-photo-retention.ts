/** Stored in place of a photo URL after the file is deleted. Keeps order rows valid. */
export const REMOVED_ORDER_PHOTO = 'expired';

export function isRemovedOrderPhoto(value: string | null | undefined): boolean {
  return value === REMOVED_ORDER_PHOTO;
}
