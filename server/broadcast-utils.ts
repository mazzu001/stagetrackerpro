// broadcast-utils.ts - temporarily disabled DB cleanup to avoid crashes when tables missing

export function setupBroadcastCleanup() {
  console.log('📡 Broadcast DB cleanup disabled (no-op).');
  // Return noop cleanup function
  return () => {};
}