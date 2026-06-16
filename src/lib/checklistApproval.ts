import { supabase } from './supabase';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ChecklistApprovalRecord {
  id: string;
  status: ApprovalStatus;
  admin_note: string | null;
  note_visible_to_driver: boolean;
  created_at: string;
}

export interface FailedChecklistItem {
  id: string;
  label: string;
  note: string;
  critical: boolean;
  sectionTitle: string;
}

export interface ChecklistApprovalItem {
  id: string;
  label: string;
  status: 'pass' | 'fail';
  note: string;
  critical: boolean;
  sectionTitle: string;
}

/**
 * Calls the request_checklist_approval RPC.
 * Returns the approval request id on success or an error string.
 *
 * The RPC is expected to:
 *  - Be idempotent: return an existing pending request for the same
 *    driver/vehicle/shift_date combination instead of creating a duplicate.
 *  - Accept: driver_id, vehicle_id, failed_items (jsonb[]), checklist (jsonb[])
 *  - Return: { id: uuid }
 */
export async function requestChecklistApproval(params: {
  driverId: string;
  vehicleId: string;
  failedItems: FailedChecklistItem[];
  checklist: ChecklistApprovalItem[];
}): Promise<{ approvalRequestId: string | null; error: string | null }> {
  console.log('[ChecklistApproval] requestChecklistApproval:start', {
    driverId: params.driverId,
    vehicleId: params.vehicleId,
    failedCount: params.failedItems.length,
    checklistCount: params.checklist.length,
  });

  const { data, error } = await supabase.rpc('request_checklist_approval', {
    p_driver_id: params.driverId,
    p_vehicle_id: params.vehicleId,
    p_failed_items: params.failedItems,
    p_checklist: params.checklist,
  });

  if (error) {
    console.error('[ChecklistApproval] requestChecklistApproval:error', {
      message: error.message,
    });
    return { approvalRequestId: null, error: error.message };
  }

  const approvalRequestId: string | null =
    typeof data === 'string'
      ? data
      : typeof data === 'object' && data !== null && 'id' in data
      ? String((data as { id: string }).id)
      : null;

  if (!approvalRequestId) {
    console.error('[ChecklistApproval] requestChecklistApproval:no-id', { data });
    return { approvalRequestId: null, error: 'Approval request created but no ID returned.' };
  }

  console.log('[ChecklistApproval] requestChecklistApproval:success', { approvalRequestId });
  return { approvalRequestId, error: null };
}

/**
 * Fetches the current status of a checklist approval request.
 */
export async function fetchChecklistApprovalStatus(
  approvalRequestId: string
): Promise<{ record: ChecklistApprovalRecord | null; error: string | null }> {
  // Select * (rather than naming note_visible_to_driver) so the app still works
  // if the note-visibility migration has not been applied to the database yet;
  // the flag simply defaults to false until the column exists.
  const { data, error } = await supabase
    .from('checklist_approval_requests')
    .select('*')
    .eq('id', approvalRequestId)
    .maybeSingle();

  if (error) {
    console.error('[ChecklistApproval] fetchStatus:error', { message: error.message });
    return { record: null, error: error.message };
  }

  if (!data) {
    return { record: null, error: 'Approval request not found.' };
  }

  const record: ChecklistApprovalRecord = {
    id: String((data as Record<string, unknown>).id ?? approvalRequestId),
    status: ((data as Record<string, unknown>).status as ApprovalStatus) ?? 'pending',
    admin_note: ((data as Record<string, unknown>).admin_note as string | null) ?? null,
    note_visible_to_driver: Boolean((data as Record<string, unknown>).note_visible_to_driver),
    created_at: ((data as Record<string, unknown>).created_at as string) ?? new Date().toISOString(),
  };

  return { record, error: null };
}
