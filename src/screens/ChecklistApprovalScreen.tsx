import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import NetworkStatusBanner from '../components/NetworkStatusBanner';
import { useAppState } from '../state/AppStateContext';
import { fetchChecklistApprovalStatus, type ApprovalStatus, type ChecklistApprovalRecord } from '../lib/checklistApproval';
import { formatPerthDateTime } from '../lib/formatPerthDateTime';
import type { ScreenProps } from '../types/navigation';

const POLL_INTERVAL_MS = 12_000;

export default function ChecklistApprovalScreen(props: ScreenProps<'ChecklistApproval'>) {
  const { navigation, route } = props;
  const { updateAppState } = useAppState();
  const { approvalRequestId, vehicleId, failedItems, checklistAnswers } = route.params;

  const [record, setRecord] = useState<ChecklistApprovalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    console.log('[ChecklistApproval] fetchStatus', { approvalRequestId });
    const { record: fetched, error: fetchError } = await fetchChecklistApprovalStatus(approvalRequestId);
    setLoading(false);
    if (fetchError) {
      setError(fetchError);
      return;
    }
    setError(null);
    setRecord(fetched);
    setLastChecked(new Date());
  }, [approvalRequestId]);

  // Initial fetch + polling while pending
  useEffect(() => {
    void fetchStatus();

    pollTimer.current = setInterval(() => {
      if (record?.status !== 'approved' && record?.status !== 'rejected') {
        void fetchStatus();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop polling once resolved
  useEffect(() => {
    if (record?.status === 'approved' || record?.status === 'rejected') {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    }
    // Log when approval is granted
    if (record?.status === 'approved') {
      console.log('[ApprovalResume] approved', { approvalRequestId, vehicleId });
      console.log('[ApprovalResume] checklistAnswers present', { count: checklistAnswers?.length ?? 0 });
    }
  }, [record?.status, approvalRequestId, vehicleId, checklistAnswers?.length]);

  const status: ApprovalStatus = record?.status ?? 'pending';

  const handleContinue = () => {
    // Navigate to ReadingsAndPhotos — preserving the full checklist answers
    console.log('[ApprovalResume] navigating to ReadingsAndPhotos', { approvalRequestId, vehicleId });
    updateAppState({
      checklistSubmitted: true,
      checklistCompleted: true,
      preStartChecklistAnswers: checklistAnswers,
    });
    navigation.navigate('ReadingsAndPhotos', {
      checklistAnswers: checklistAnswers,
    });
  };

  const handleResubmit = () => {
    navigation.replace('PreStartChecklist', { vehicleId });
  };

  return (
    <ScreenContainer
      title="Checklist Approval"
      subtitle="Admin review required before starting shift"
    >
      <NetworkStatusBanner />

      {/* Status badge */}
      <View style={[styles.statusBadge, statusBadgeStyle(status)]}>
        <Text style={[styles.statusText, statusTextStyle(status)]}>
          {statusLabel(status)}
        </Text>
        {status === 'pending' && (
          <ActivityIndicator size="small" color="#92400E" style={{ marginLeft: 8 }} />
        )}
      </View>

      {/* Guidance message */}
      <View style={[styles.messageBox, messageBoxStyle(status)]}>
        <Text style={[styles.messageText, messageTextStyle(status)]}>
          {guidanceMessage(status)}
        </Text>
        {record?.admin_note && record.note_visible_to_driver ? (
          <Text style={styles.adminNote}>Admin note: {record.admin_note}</Text>
        ) : null}
      </View>

      {/* Failed items list */}
      <Text style={styles.sectionHeading}>Failed inspection items</Text>
      <ScrollView style={styles.itemsScroll} contentContainerStyle={{ paddingBottom: 12 }}>
        {failedItems.map(item => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemLabel}>{item.label}</Text>
              {item.critical && (
                <View style={styles.criticalBadge}>
                  <Text style={styles.criticalText}>Critical</Text>
                </View>
              )}
            </View>
            <Text style={styles.itemSection}>{item.sectionTitle}</Text>
            {item.note ? (
              <Text style={styles.itemNote}>Note: {item.note}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>

      {/* Last checked */}
      {lastChecked ? (
        <Text style={styles.lastChecked}>
          Last checked: {formatPerthDateTime(lastChecked)}
        </Text>
      ) : null}

      {/* Error */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        {status === 'pending' && (
          <TouchableOpacity style={styles.refreshButton} onPress={() => { setLoading(true); void fetchStatus(); }}>
            <Text style={styles.refreshText}>
              {loading ? 'Checking…' : 'Refresh status'}
            </Text>
          </TouchableOpacity>
        )}

        {status === 'approved' && (
          <Button label="Continue to readings" onPress={handleContinue} />
        )}

        {status === 'rejected' && (
          <Button label="Re-submit checklist" onPress={handleResubmit} />
        )}
      </View>
    </ScreenContainer>
  );
}

function statusLabel(status: ApprovalStatus): string {
  switch (status) {
    case 'pending':  return '⏳  Pending approval';
    case 'approved': return '✓  Approved';
    case 'rejected': return '✗  Rejected';
  }
}

function guidanceMessage(status: ApprovalStatus): string {
  switch (status) {
    case 'pending':
      return 'Your checklist has been sent to an administrator for review. Please wait — the status below updates automatically every 12 seconds.';
    case 'approved':
      return 'Your checklist has been approved. You may now continue to enter odometer readings and start your shift.';
    case 'rejected':
      return 'Your checklist was not approved. Please fix the issues noted below, then re-submit the vehicle inspection.';
  }
}

function statusBadgeStyle(status: ApprovalStatus) {
  switch (status) {
    case 'pending':  return styles.badgePending;
    case 'approved': return styles.badgeApproved;
    case 'rejected': return styles.badgeRejected;
  }
}

function statusTextStyle(status: ApprovalStatus) {
  switch (status) {
    case 'pending':  return styles.textPending;
    case 'approved': return styles.textApproved;
    case 'rejected': return styles.textRejected;
  }
}

function messageBoxStyle(status: ApprovalStatus) {
  switch (status) {
    case 'pending':  return styles.msgPending;
    case 'approved': return styles.msgApproved;
    case 'rejected': return styles.msgRejected;
  }
}

function messageTextStyle(status: ApprovalStatus) {
  switch (status) {
    case 'pending':  return styles.msgTextPending;
    case 'approved': return styles.msgTextApproved;
    case 'rejected': return styles.msgTextRejected;
  }
}

const styles = StyleSheet.create({
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 15,
  },
  badgePending:  { backgroundColor: '#FEF3C7' },
  badgeApproved: { backgroundColor: '#D1FAE5' },
  badgeRejected: { backgroundColor: '#FEE2E2' },
  textPending:   { color: '#92400E' },
  textApproved:  { color: '#065F46' },
  textRejected:  { color: '#991B1B' },

  messageBox: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  messageText: { lineHeight: 20 },
  adminNote: {
    marginTop: 8,
    fontStyle: 'italic',
    color: '#7F1D1D',
    lineHeight: 20,
  },
  msgPending:      { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  msgApproved:     { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' },
  msgRejected:     { backgroundColor: '#FFF1F2', borderColor: '#FCA5A5' },
  msgTextPending:  { color: '#78350F' },
  msgTextApproved: { color: '#064E3B' },
  msgTextRejected: { color: '#7F1D1D' },

  sectionHeading: {
    fontWeight: '600',
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemsScroll: {
    maxHeight: 260,
    marginBottom: 8,
  },
  itemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemLabel: {
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  criticalBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  criticalText: {
    fontSize: 11,
    color: '#991B1B',
    fontWeight: '700',
  },
  itemSection: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  itemNote: {
    fontSize: 13,
    color: '#374151',
    marginTop: 4,
    fontStyle: 'italic',
  },

  lastChecked: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 8,
  },

  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
  },

  actions: {
    gap: 10,
    marginTop: 4,
  },
  refreshButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  refreshText: {
    color: '#374151',
    fontWeight: '600',
  },
});
