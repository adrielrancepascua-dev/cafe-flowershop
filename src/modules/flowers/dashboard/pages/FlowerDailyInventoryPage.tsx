import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listFlowerBranches } from '../../../../services/flowers/inventory';
import {
  getDailyInventoryWorksheet,
  listDailyInventoryBranchSummaries,
  submitDailyInventoryCount,
} from '../../../../services/flowers/inventory/flowers-daily-inventory.service';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import { extractSupabaseErrorMessage } from '../../../../lib/supabase/errors';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import type {
  FlowerDailyInventoryBranchSummary,
  FlowerDailyInventoryWorksheet,
  FlowerDailyInventoryWorksheetLine,
} from '../../shared/types/flower-daily-inventory';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import FlowerConfirmDialog from '../components/FlowerConfirmDialog';
import {
  formatDailyInventoryVariance,
  groupDailyInventoryWorksheetLines,
} from '../../shared/utils/flower-daily-inventory';
import {
  flowerProductColorSwatchClass,
  normalizeFlowerProductColor,
} from '../../shared/utils/flower-product-colors';
import { normalizeFlowerProductKind } from '../../shared/utils/flower-product-kind';
import { toDateKey } from '../../shared/utils/flower-format';

function formatCountDateLabel(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatSubmittedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sanitizeCountInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits === '') {
    return '';
  }

  return String(Number(digits));
}

function varianceClass(variance: number | null): string {
  if (variance == null || variance === 0) {
    return 'text-emerald-800';
  }

  return variance < 0 ? 'text-red-700' : 'text-amber-800';
}

function WorksheetLineLabel({ line }: { line: FlowerDailyInventoryWorksheetLine }) {
  const isFlower = normalizeFlowerProductKind(line.product_kind) === 'flower';
  const color = normalizeFlowerProductColor(line.product_color);

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-brand-dark">
      {isFlower ? (
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${flowerProductColorSwatchClass(color)}`}
          aria-hidden
        />
      ) : null}
      <span className="truncate">{line.product_name}</span>
      {isFlower ? <span className="shrink-0 font-normal text-brand-brown/70">· {color}</span> : null}
    </span>
  );
}

export default function FlowerDailyInventoryPage() {
  const { user, isAdmin, isLoading: authLoading } = useFlowerAuth();
  const todayKey = toDateKey(new Date());
  const staffBranchId = !isAdmin ? user?.branch_id ?? null : null;

  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [countDate, setCountDate] = useState(todayKey);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [summaries, setSummaries] = useState<FlowerDailyInventoryBranchSummary[]>([]);
  const [worksheet, setWorksheet] = useState<FlowerDailyInventoryWorksheet | null>(null);
  const [actualCounts, setActualCounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const effectiveDate = isAdmin ? countDate : todayKey;
  const effectiveBranchId = isAdmin ? selectedBranchId : staffBranchId ?? '';
  const showAllBranches = isAdmin && selectedBranchId === 'all';

  useEffect(() => {
    if (authLoading) {
      return;
    }

    void listFlowerBranches().then((branchList) => {
      setBranches(branchList);
      setSelectedBranchId((current) => {
        if (current) {
          return current;
        }

        if (staffBranchId) {
          return staffBranchId;
        }

        return 'all';
      });
    });
  }, [authLoading, staffBranchId]);

  async function loadData() {
    if (!effectiveBranchId && !showAllBranches) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      if (showAllBranches) {
        setSummaries(await listDailyInventoryBranchSummaries({ countDate: effectiveDate }));
        setWorksheet(null);
        return;
      }

      const nextWorksheet = await getDailyInventoryWorksheet({
        branchId: effectiveBranchId,
        countDate: effectiveDate,
      });
      setWorksheet(nextWorksheet);
      setActualCounts((current) => {
        const next: Record<string, string> = {};
        for (const line of nextWorksheet.lines) {
          if (line.actual_count != null) {
            next[line.product_id] = String(line.actual_count);
          } else if (current[line.product_id] != null) {
            next[line.product_id] = current[line.product_id];
          }
        }
        return next;
      });
    } catch (error) {
      setErrorMessage(extractSupabaseErrorMessage(error, 'Failed to load daily inventory.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, effectiveBranchId, effectiveDate, showAllBranches]);

  const groupedLines = useMemo(
    () => (worksheet ? groupDailyInventoryWorksheetLines(worksheet.lines) : []),
    [worksheet],
  );

  const missingCount = worksheet
    ? worksheet.lines.filter((line) => actualCounts[line.product_id] === undefined || actualCounts[line.product_id] === '').length
    : 0;
  const canSubmit = Boolean(worksheet && !worksheet.submitted && worksheet.lines.length > 0 && missingCount === 0 && user);

  async function handleSubmit() {
    if (!user || !worksheet || !canSubmit) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setMessage('');

    try {
      const counts: Record<string, number> = {};
      for (const line of worksheet.lines) {
        counts[line.product_id] = Number(actualCounts[line.product_id]);
      }

      await submitDailyInventoryCount({
        branchId: worksheet.branch_id,
        countDate: worksheet.count_date,
        submittedById: user.id,
        submittedByName: user.display_name,
        actualCounts: counts,
      });
      setConfirmOpen(false);
      setMessage('Daily inventory submitted. Reports can unlock after day close.');
      await loadData();
    } catch (error) {
      setErrorMessage(extractSupabaseErrorMessage(error, 'Failed to submit daily inventory.'));
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <FlowerPageHeader
        label="Inventory audit"
        title="Daily count"
        description={
          isAdmin
            ? 'Staff count flowers and gift items each day. This does not change stock — review variances here, then adjust Inventory manually if needed.'
            : 'Count each flower color and gift item. Wrappers are skipped. This does not change system stock.'
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {isAdmin ? (
          <>
            <input
              type="date"
              value={countDate}
              onChange={(event) => setCountDate(event.target.value)}
              className="flower-input max-w-[180px]"
            />
            <select
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="flower-input max-w-[200px]"
            >
              <option value="all">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <p className="rounded-xl border border-brand-muted/40 bg-brand-cream/30 px-3 py-2 text-sm font-medium text-brand-dark">
              {formatCountDateLabel(todayKey)}
            </p>
            {user?.branch_name ? (
              <p className="rounded-xl border border-brand-brown/20 bg-brand-beige/50 px-3 py-2 text-sm font-semibold text-brand-dark">
                {user.branch_name}
              </p>
            ) : null}
          </>
        )}
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      {!isAdmin && !staffBranchId ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Finish first-time setup and choose your branch before submitting a daily count.
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-brand-brown/60">Loading daily inventory…</p>
      ) : showAllBranches ? (
        <ul className="mt-5 space-y-3">
          {summaries.map((summary) => (
            <li key={summary.branch_id}>
              <button
                type="button"
                onClick={() => setSelectedBranchId(summary.branch_id)}
                className="flower-card w-full p-4 text-left transition hover:border-brand-accent"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-dark">{summary.branch_name}</p>
                    {summary.submitted ? (
                      <p className="mt-1 text-xs text-brand-brown/65">
                        Submitted {summary.submitted_at ? formatSubmittedAt(summary.submitted_at) : ''}
                        {summary.submitted_by_name ? ` · ${summary.submitted_by_name}` : ''}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-amber-800">Not submitted</p>
                    )}
                  </div>
                  {summary.submitted ? (
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
                        {summary.match_count} match
                      </span>
                      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">
                        {summary.short_count} short · {summary.short_units} pcs
                      </span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">
                        {summary.extra_count} extra · {summary.extra_units} pcs
                      </span>
                    </div>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : worksheet ? (
        <>
          {worksheet.submitted ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-sm font-semibold text-emerald-900">Submitted</p>
              <p className="mt-1 text-sm text-emerald-900/80">
                {worksheet.submitted.submitted_by_name} · {formatSubmittedAt(worksheet.submitted.submitted_at)}
              </p>
              <p className="mt-2 text-sm text-brand-brown/75">
                Expected already subtracts today’s completed sales even if 7:00 PM deduct has not run. Stock is not
                changed automatically — use Inventory to adjust after you confirm a variance.
              </p>
              {isAdmin ? (
                <Link to="/dashboard/flowers/inventory" className="mt-3 inline-flex text-sm font-semibold text-brand-brown">
                  Open Inventory to adjust →
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm text-brand-brown/70">
              Type the actual count only. Expected vs actual appears after submit, so the 6:00 PM count stays fair
              against sales that deduct at 7:00 PM.
            </p>
          )}

          <div className="mt-4 space-y-4">
            {groupedLines.map((group) => (
              <section key={group.key} className="rounded-2xl border border-brand-muted/40 bg-white p-4">
                <h3 className="text-sm font-semibold text-brand-dark">{group.title}</h3>
                <ul className="mt-3 space-y-2">
                  {group.lines.map((line) => (
                    <li
                      key={line.product_id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-muted/30 bg-brand-cream/15 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <WorksheetLineLabel line={line} />
                        {worksheet.submitted ? (
                          <p className="mt-1 text-xs text-brand-brown/65">
                            Expected {line.expected_on_hand}
                            {line.sold_pending_deduction > 0 ? ` · ${line.sold_pending_deduction} sold pending deduct` : ''}
                          </p>
                        ) : null}
                      </div>
                      {worksheet.submitted ? (
                        <div className="text-right">
                          <p className="text-lg font-bold text-brand-dark">{line.actual_count}</p>
                          <p className={`text-xs font-semibold ${varianceClass(line.variance)}`}>
                            {line.variance == null ? '' : formatDailyInventoryVariance(line.variance)}
                          </p>
                        </div>
                      ) : (
                        <label className="w-24 shrink-0 text-xs font-medium text-brand-brown">
                          Count
                          <input
                            type="text"
                            inputMode="numeric"
                            value={actualCounts[line.product_id] ?? ''}
                            onChange={(event) =>
                              setActualCounts((current) => ({
                                ...current,
                                [line.product_id]: sanitizeCountInput(event.target.value),
                              }))
                            }
                            className="flower-input mt-1 text-center text-base font-semibold"
                            placeholder="0"
                          />
                        </label>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {!worksheet.submitted ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-brand-brown/70">
                {missingCount > 0
                  ? `${missingCount} item${missingCount === 1 ? '' : 's'} still need a count.`
                  : `${worksheet.lines.length} items ready to submit.`}
              </p>
              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={() => setConfirmOpen(true)}
                className="flower-btn-primary"
              >
                Submit daily count
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-6 text-sm text-brand-brown/60">Select a branch to view or submit a daily count.</p>
      )}

      <FlowerConfirmDialog
        open={confirmOpen}
        title="Submit daily count?"
        message="You can’t edit this after submit. Actual counts will be compared with expected remaining after today’s completed sales. Stock will not change automatically."
        confirmLabel={submitting ? 'Submitting…' : 'Submit count'}
        cancelLabel="Go back"
        busy={submitting}
        onConfirm={() => void handleSubmit()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
