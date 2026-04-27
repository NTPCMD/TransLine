import { useActiveAssignment } from '../state/AssignmentContext';
import { useActiveShift } from '../state/ActiveShiftContext';
import { useAppState } from '../state/AppStateContext';

export function useShiftLifecycle() {
  const { state, startShift, endShift, createEvent, closeActiveBreak, refreshCurrentVehicle } = useAppState();
  const { status, vehicle, refresh } = useActiveAssignment();
  const { shift, status: activeShiftStatus, reload: reloadActiveShift } = useActiveShift();
  const activeShiftId = state.activeShiftId;

  return {
    activeShiftId,
    activeShift: shift,
    // Active shift UI must only show when we have a concrete active shift id.
    isShiftActive: Boolean(activeShiftId),
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
