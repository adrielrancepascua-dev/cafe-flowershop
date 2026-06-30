import { getSupabaseClient } from '../../../lib/supabase/client';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';

const ORDER_ATTACHMENTS_BUCKET = 'order-attachments';

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

export async function resolveOrderAttachmentUrl(
  value: string,
  orderId: string,
  fieldName: string,
): Promise<string> {
  if (!value || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  if (!value.startsWith('data:')) {
    return value;
  }

  const mode = getFlowerStorageMode();
  if (!shouldUseFlowerSupabase(mode)) {
    return value;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return value;
  }

  const blob = dataUrlToBlob(value);
  const extension = blob.type === 'image/png' ? 'png' : 'jpg';
  const path = `${orderId}/${fieldName}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(ORDER_ATTACHMENTS_BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: true,
  });

  if (error) {
    throw new Error(`Photo upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(ORDER_ATTACHMENTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function resolveOrderAttachments(input: {
  orderId: string;
  photo_inspo_data_url: string;
  proof_dp_data_url: string;
  order_form_ss_data_url: string;
  ready_photo_data_url?: string;
}): Promise<{
  photo_inspo_data_url: string;
  proof_dp_data_url: string;
  order_form_ss_data_url: string;
  ready_photo_data_url: string;
}> {
  const [photo_inspo_data_url, proof_dp_data_url, order_form_ss_data_url, ready_photo_data_url] =
    await Promise.all([
      resolveOrderAttachmentUrl(input.photo_inspo_data_url, input.orderId, 'inspo'),
      input.proof_dp_data_url
        ? resolveOrderAttachmentUrl(input.proof_dp_data_url, input.orderId, 'proof-dp')
        : Promise.resolve(''),
      resolveOrderAttachmentUrl(input.order_form_ss_data_url, input.orderId, 'order-form'),
      input.ready_photo_data_url
        ? resolveOrderAttachmentUrl(input.ready_photo_data_url, input.orderId, 'ready-photo')
        : Promise.resolve(''),
    ]);

  return {
    photo_inspo_data_url,
    proof_dp_data_url,
    order_form_ss_data_url,
    ready_photo_data_url,
  };
}
