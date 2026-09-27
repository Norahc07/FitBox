import { useApp } from '../hooks/useApp.jsx';
import { CloudIcon, OfflineIcon } from './Icons.jsx';

/** Connectivity + sync indicator. Offline is a normal state, not an error. */
export default function StatusPill() {
  const { online, cloudEnabled, sync, auth } = useApp();
  let label;
  let tone;
  if (!online) {
    label = sync.pending ? `Offline · ${sync.pending} to sync` : 'Offline · playing locally';
    tone = 'offline';
  } else if (!cloudEnabled) {
    label = 'Local play';
    tone = 'local';
  } else if (!auth.user) {
    label = 'Not signed in';
    tone = 'local';
  } else if (sync.status === 'syncing') {
    label = 'Syncing…';
    tone = 'syncing';
  } else if (sync.status === 'error') {
    label = sync.pending ? `Sync pending (${sync.pending})` : 'Sync issue';
    tone = 'warn';
  } else {
    label = 'Synced';
    tone = 'ok';
  }
  return (
    <span className={`status-pill status-${tone}`} role="status">
      {online ? <CloudIcon width={16} height={16} /> : <OfflineIcon width={16} height={16} />}
      {label}
    </span>
  );
}
