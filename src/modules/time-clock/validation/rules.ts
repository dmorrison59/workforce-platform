export function clockInError(hasOpenEntry: boolean) {
  return hasOpenEntry ? "Employee already has an open time entry." : null;
}

export function clockOutError(hasOpenEntry: boolean, hasOpenBreak: boolean) {
  if (!hasOpenEntry) return "No open time entry exists to clock out.";
  if (hasOpenBreak) return "End the active break before clocking out.";
  return null;
}

export function startBreakError(hasOpenEntry: boolean, hasOpenBreak: boolean) {
  if (!hasOpenEntry) return "Clock in before starting a break.";
  if (hasOpenBreak) return "A break is already active.";
  return null;
}

export function endBreakError(hasOpenEntry: boolean, hasOpenBreak: boolean) {
  if (!hasOpenEntry) return "No open time entry exists.";
  if (!hasOpenBreak) return "No active break exists to end.";
  return null;
}
