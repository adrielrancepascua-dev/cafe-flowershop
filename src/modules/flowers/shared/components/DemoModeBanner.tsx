import { Sparkles } from 'lucide-react';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import { getFlowerStorageMode } from '../../../../services/flowers/storage-mode';

export default function DemoModeBanner() {
  const supabaseReady = isSupabaseConfigured();
  const storageMode = getFlowerStorageMode();

  if (supabaseReady && storageMode !== 'local') {
    return null;
  }

  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/60 px-4 py-3.5 sm:mb-6 sm:items-center">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Sparkles className="h-4 w-4" />
      </span>
      <p className="text-sm leading-relaxed text-amber-950/85">
        <span className="font-semibold">Demo mode</span>
        {' — '}
        Sample data runs locally in your browser. Connect Supabase when you&apos;re ready for production.
      </p>
    </div>
  );
}
