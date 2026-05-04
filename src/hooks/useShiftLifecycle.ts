import { useActiveAssignment } from '../state/AssignmentContext';
import { useActiveShift } from '../state/ActiveShiftContext';
import { useAppState } from '../state/AppStateContext';
import { useEffect, useState } from 'react';

export function useShiftLifecycle() {
  const { state, startShift, endShift, createEvent, closeActiveBreak, refreshCurrentVehicle } = useAppState();
  const { status, vehicle, refresh } = useActiveAssignment();
  const { shift, reload: reloadActiveShift } = useActiveShift();
  const [activeShiftId, setActiveShiftId] = useState<string | null>(shift?.id || null);

  useEffect(() => {
    setActiveShiftId(activeShiftId);
  }, [activeShiftId]);
  
  return {
    activeShiftId,
    activeShift: shift,
    // DB-backed active shift only.
    isShiftActive: Boolean(shift),
    assignmentStatus: status,
    assignedVehicle: vehicle,
    refreshAssignment: async (force = true) => {
      await refresh(force);
      await reloadActiveShift();
    },
    refreshCurrentVehicle,
    startShift,
    endShift,
    createEvent,
    closeActiveBreak,
    appState: {
      ...state,
      activeShiftId,
    },
  };
}
