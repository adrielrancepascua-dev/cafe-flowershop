import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, UserPlus, Users } from 'lucide-react';
import {
  createFlowerStaff,
  deleteFlowerTeamMember,
  generateStaffEmailPreview,
  listFlowerTeam,
  setFlowerTeamMemberActive,
} from '../../../../services/flowers/team';
import type { CreateFlowerStaffResult, FlowerTeamMember } from '../../shared/types/auth';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import { RequireFlowerAdmin } from '../components/RequireFlowerAuth';

function statusLabel(member: FlowerTeamMember): string {
  if (!member.is_active) {
    return 'Deactivated';
  }

  if (!member.onboarding_completed) {
    return 'Pending setup';
  }

  return 'Active';
}

function statusClass(member: FlowerTeamMember): string {
  if (!member.is_active) {
    return 'bg-red-100 text-red-900 border-red-200';
  }

  if (!member.onboarding_completed) {
    return 'bg-amber-100 text-amber-950 border-amber-200';
  }

  return 'bg-emerald-100 text-emerald-900 border-emerald-200';
}

export default function FlowerTeamPage() {
  const { user } = useFlowerAuth();
  const [members, setMembers] = useState<FlowerTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [createdStaff, setCreatedStaff] = useState<CreateFlowerStaffResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);

  const emailPreview = useMemo(
    () => (displayName.trim() ? generateStaffEmailPreview(displayName.trim()) : ''),
    [displayName],
  );

  async function loadMembers() {
    setLoading(true);
    try {
      const rows = await listFlowerTeam();
      setMembers(rows);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load team.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setErrorMessage('Enter the staff member name.');
      return;
    }

    setIsCreating(true);
    setErrorMessage('');
    setCreatedStaff(null);

    try {
      const created = await createFlowerStaff(name);
      setCreatedStaff(created);
      setDisplayName('');
      await loadMembers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not create staff account.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleActive(member: FlowerTeamMember) {
    if (member.role !== 'staff' || member.id === user?.id) {
      return;
    }

    try {
      await setFlowerTeamMemberActive(member.id, !member.is_active);
      await loadMembers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update staff status.');
    }
  }

  async function handleDelete(member: FlowerTeamMember) {
    if (member.role !== 'staff' || member.id === user?.id) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${member.display_name} (${member.email})?\n\nThis permanently removes their login. Their past orders and expenses stay in the system.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingMemberId(member.id);
    setErrorMessage('');

    try {
      await deleteFlowerTeamMember(member.id);
      await loadMembers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not delete staff account.');
    } finally {
      setDeletingMemberId(null);
    }
  }

  async function handleCopyCredentials() {
    if (!createdStaff) {
      return;
    }

    const text = `Papers & Petals login\nEmail: ${createdStaff.email}\nTemporary password: ${createdStaff.temporary_password}\n\nFirst login: choose branch and set a new password.`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <RequireFlowerAdmin>
      <div className="animate-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">Admin</p>
            <h1 className="font-serif text-2xl font-semibold text-brand-dark">Team</h1>
            <p className="mt-1 text-sm text-brand-brown/75">
              Add staff accounts here. Share the generated email and temporary password{' '}
              <span className="font-semibold">1234</span>. They will choose their branch and set a
              new password on first login.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
          <section className="rounded-2xl border border-brand-muted/40 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-brand-brown" />
              <h2 className="text-sm font-semibold text-brand-dark">Add staff member</h2>
            </div>

            <form onSubmit={(event) => void handleCreate(event)} className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-brand-brown">
                Staff name
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="flower-input mt-1.5"
                  placeholder="e.g. Maria Santos"
                  required
                />
              </label>

              {emailPreview ? (
                <p className="rounded-xl border border-brand-muted/30 bg-brand-cream/30 px-3 py-2 text-xs text-brand-brown/80">
                  Login email will look like:{' '}
                  <span className="font-semibold text-brand-dark">{emailPreview}</span>
                </p>
              ) : null}

              <p className="text-xs text-brand-brown/65">
                Temporary password is always <span className="font-semibold">1234</span> until they
                finish first-time setup.
              </p>

              <button type="submit" disabled={isCreating} className="flower-btn-primary w-full">
                {isCreating ? 'Creating account...' : 'Create staff account'}
              </button>
            </form>

            {createdStaff ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-950">Account created</p>
                <dl className="mt-2 space-y-1 text-sm text-emerald-950">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-emerald-800/80">Email</dt>
                    <dd className="font-medium break-all">{createdStaff.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-emerald-800/80">
                      Temporary password
                    </dt>
                    <dd className="font-medium">{createdStaff.temporary_password}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => void handleCopyCredentials()}
                  className="flower-btn-secondary mt-3 inline-flex w-full items-center justify-center gap-2 text-sm"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy login details'}
                </button>
              </div>
            ) : null}

            {errorMessage ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-brand-muted/40 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-brown" />
              <h2 className="text-sm font-semibold text-brand-dark">Team members</h2>
            </div>

            {loading ? (
              <p className="mt-4 text-sm text-brand-brown/60">Loading team...</p>
            ) : members.length === 0 ? (
              <p className="mt-4 text-sm text-brand-brown/60">No team members yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {members.map((member) => (
                  <article
                    key={member.id}
                    className="rounded-xl border border-brand-muted/30 bg-brand-cream/15 px-3 py-3 sm:px-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-brand-dark">{member.display_name}</p>
                        <p className="mt-0.5 break-all text-sm text-brand-brown/75">{member.email}</p>
                        <p className="mt-1 text-xs text-brand-brown/60">
                          {member.role === 'admin' ? 'Admin' : 'Staff'}
                          {member.branch_name ? ` · ${member.branch_name}` : ''}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass(member)}`}
                        >
                          {statusLabel(member)}
                        </span>

                        {member.role === 'staff' && member.id !== user?.id ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => void handleToggleActive(member)}
                              className="text-xs font-medium text-brand-brown underline-offset-2 hover:underline"
                            >
                              {member.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(member)}
                              disabled={deletingMemberId === member.id}
                              className="text-xs font-medium text-red-700 underline-offset-2 hover:underline disabled:opacity-50"
                            >
                              {deletingMemberId === member.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </RequireFlowerAdmin>
  );
}
