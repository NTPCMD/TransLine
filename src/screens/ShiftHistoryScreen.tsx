import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { useDriver } from '../state/DriverContext';
import { supabase } from '../lib/supabase';
import type { ScreenProps } from '../types/navigation';

interface Shift {
  id: string;
  driver_id: string;
  vehicle_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  start_odometer: number | null;
  end_odometer: number | null;
  vehicle_registration?: string;
}

export default function ShiftHistoryScreen(props: ScreenProps<'ShiftHistory'>) {
  const { navigation } = props;
  const { authUserId } = useDriver();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadShifts = useCallback(async () => {
    if (!authUserId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          id,
          driver_id,
          vehicle_id,
          status,
          started_at,
          ended_at,
          start_odometer,
          end_odometer,
          vehicles!inner(registration)
        `)
        .eq('driver_id', authUserId)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to load shift history:', error);
      } else {
        // Transform the data to flatten vehicle registration
        const transformedData = (data || []).map((shift: any) => ({
          ...shift,
          vehicle_registration: shift.vehicles?.registration || 'Unknown',
        }));
        setShifts(transformedData);
      }
    } catch (error) {
      console.error('Exception while loading shift history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authUserId]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadShifts();
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid time';
    }
  };

  const calculateDuration = (startedAt: string, endedAt: string | null) => {
    if (!endedAt) return 'In Progress';
    
    try {
      const start = new Date(startedAt).getTime();
      const end = new Date(endedAt).getTime();
      const durationMs = end - start;
      
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      
      return `${hours}h ${minutes}m`;
    } catch {
      return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return '#059669';
      case 'ended':
      case 'completed':
        return '#2563EB';
      case 'ended_by_admin':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return '🟢 Active';
      case 'ended':
      case 'completed':
        return '🔵 Completed';
      case 'ended_by_admin':
        return '🟠 Admin Ended';
      default:
        return status;
    }
  };

  const groupShiftsByDate = (shifts: Shift[]) => {
    const groups: { [key: string]: Shift[] } = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    shifts.forEach((shift) => {
      const shiftDate = new Date(shift.started_at);
      const shiftDay = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());

      let groupKey: string;
      if (shiftDay.getTime() === today.getTime()) {
        groupKey = 'Today';
      } else if (shiftDay.getTime() === yesterday.getTime()) {
        groupKey = 'Yesterday';
      } else if (shiftDay >= weekAgo) {
        groupKey = 'This Week';
      } else {
        groupKey = 'Older';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(shift);
    });

    return groups;
  };

  const renderShiftCard = (shift: Shift) => (
    <View key={shift.id} style={styles.shiftCard}>
      <View style={styles.shiftHeader}>
        <View>
          <Text style={styles.shiftDate}>{formatDate(shift.started_at)}</Text>
          <Text style={styles.vehicleReg}>{shift.vehicle_registration}</Text>
        </View>
        <Text style={[styles.statusBadge, { color: getStatusColor(shift.status) }]}>
          {getStatusLabel(shift.status)}
        </Text>
      </View>

      <View style={styles.shiftDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Start Time:</Text>
          <Text style={styles.detailValue}>{formatTime(shift.started_at)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>End Time:</Text>
          <Text style={styles.detailValue}>
            {shift.ended_at ? formatTime(shift.ended_at) : 'In Progress'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Duration:</Text>
          <Text style={styles.detailValue}>
            {calculateDuration(shift.started_at, shift.ended_at)}
          </Text>
        </View>
        {shift.start_odometer !== null && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Start Odometer:</Text>
            <Text style={styles.detailValue}>{shift.start_odometer} km</Text>
          </View>
        )}
        {shift.end_odometer !== null && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>End Odometer:</Text>
            <Text style={styles.detailValue}>{shift.end_odometer} km</Text>
          </View>
        )}
      </View>
    </View>
  );

  const groupedShifts = groupShiftsByDate(shifts);
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];

  if (loading) {
    return (
      <ScreenContainer title="Shift History" subtitle="Loading...">
        <Text style={styles.loadingText}>Loading shift history...</Text>
      </ScreenContainer>
    );
  }

  if (shifts.length === 0) {
    return (
      <ScreenContainer title="Shift History" subtitle="No shifts found">
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No shift history available</Text>
          <Text style={styles.emptyStateSubtext}>
            Your completed shifts will appear here
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="Shift History" subtitle={`${shifts.length} shifts`}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {groupOrder.map((groupKey) => {
          const groupShifts = groupedShifts[groupKey];
          if (!groupShifts || groupShifts.length === 0) return null;

          return (
            <View key={groupKey} style={styles.group}>
              <Text style={styles.groupTitle}>{groupKey}</Text>
              {groupShifts.map(renderShiftCard)}
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  group: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shiftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  shiftDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  vehicleReg: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    fontSize: 14,
    fontWeight: '600',
  },
  shiftDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
});
