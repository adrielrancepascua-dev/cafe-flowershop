import { Cloud, Sparkles } from 'lucide-react';
import { isFlowerDemoMode } from '../../../../app/app-mode';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../../../../services/flowers/storage-mode';

export default function DemoModeBanner() {
  const supabaseReady = isSupabaseConfigured();
  const storageMode = getFlowerStorageMode();
  const usingCloud = supabaseReady && shouldUseFlowerSupabase(storageMode);

  if (usingCloud) {
    return (
      <div className="flower-demo-banner mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-teal-50/60 px-4 py-3.5 sm:mb-6 sm:items-center">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Cloud className="h-4 w-4" />
        </span>
        <p className="text-sm leading-relaxed text-emerald-950/85">
          <span className="font-semibold">Live mode</span>
          {' — '}
          Orders, stock, and expenses sync across all staff devices.
        </p>
      </div>
    );
  }

  if (isFlowerDemoMode()) {
    return (
      <div className="flower-demo-banner mb-5 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/60 px-4 py-3.5 sm:mb-6 sm:items-center">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="text-sm leading-relaxed text-amber-950/85">
          <span className="font-semibold">Demo mode</span>
          {' — '}
          Data is stored in this browser only. Connect Supabase for shared live operations.
        </p>
      </div>
    );
  }

  if (storageMode === 'local') {
    return (
      <div className="flower-demo-banner mb-5 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/60 px-4 py-3.5 sm:mb-6 sm:items-center">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="text-sm leading-relaxed text-amber-950/85">
          <span className="font-semibold">Local storage</span>
          {' — '}
          Set Supabase env vars and <code className="text-xs">VITE_FLOWER_STORAGE_MODE=supabase</code> for cloud sync.
        </p>
      </div>
    );
  }

  return null;
}
