import { navigate } from '../utils/router.jsx';
import { BackIcon } from './Icons.jsx';

export default function PageHeader({ title, backTo = '/', backLabel = 'Back to home', actions = null }) {
  return (
    <header className="page-header">
      <button type="button" className="icon-btn" onClick={() => navigate(backTo)} aria-label={backLabel}>
        <BackIcon />
      </button>
      <h1>{title}</h1>
      <div className="page-header-actions">{actions}</div>
    </header>
  );
}
