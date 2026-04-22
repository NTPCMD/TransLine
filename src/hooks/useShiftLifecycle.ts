import { useActiveAssignment } from '../state/AssignmentContext';
import { useActiveShift } from '../state/ActiveShiftContext';
import { useAppState } from '../state/AppStateContext';

export function useShiftLifecycle() {
  const { state, startShift, endShift, createEvent, closeActiveBreak, refreshCurrentVehicle } = useAppState();
  const { status, vehicle, refresh } = useActiveAssignment();
  const { shift, status: activeShiftStatus, reload: reloadActiveShift } = useActiveShift();
  const activeShiftId = state.activeShiftId ?? shift?.id ?? null;

  return {
    activeShiftId,
    activeShift: shift,
    isShiftActive: Boolean(activeShiftId || state.shiftStarted || activeShiftStatus === 'active'),
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
