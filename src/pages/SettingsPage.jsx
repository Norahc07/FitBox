import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import { GAME_LOGO_SRC } from '../components/BrandMark.jsx';
import { useApp } from '../hooks/useApp.jsx';

const TOGGLES = [
  { key: 'sound', label: 'Sound effects', help: 'Sounds for picking up, placing and rotating pieces, hints and wins.' },
  { key: 'music', label: 'Background music', help: 'A calm, generated soundtrack while you solve.' },
  { key: 'haptics', label: 'Vibration', help: 'Short vibrations on supported phones.' },
  { key: 'showTimer', label: 'Show timer', help: 'Time is still recorded for scoring when hidden.' },
  {
    key: 'placementAssist',
    label: 'Placement assist',
    help: 'Snap a dropped piece to the nearest free spot (beginner: 1 cell in any direction, intermediate: 1 cell straight, hard: exact).',
  },
  { key: 'confirmReset', label: 'Confirm before reset', help: 'Ask before clearing the board.' },
  { key: 'reducedMotion', label: 'Reduce motion', help: 'Turn off animations. Your system setting is also respected.' },
];

export default function SettingsPage() {
  const { settings, updateSettings, resetLocalData } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <main className="page settings-page">
      <PageHeader title="Settings" />
      <section className="card">
        <ul className="settings-list">
          {TOGGLES.map((t) => (
            <li key={t.key} className="setting-row">
              <label className="switch-row">
                <span className="setting-text">
                  <span className="setting-label">{t.label}</span>
                  <span className="setting-help">{t.help}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={Boolean(settings[t.key])}
                  onChange={(e) => updateSettings({ [t.key]: e.target.checked })}
                />
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="card-title">Controls</h2>
        <ul className="shortcut-list">
          <li><span>Select a piece</span><span>Tap / click</span></li>
          <li><span>Place</span><span>Drag, or tap the board</span></li>
          <li><span>Rotate clockwise</span><kbd>R</kbd></li>
          <li><span>Rotate counter-clockwise</span><kbd>E</kbd></li>
          <li><span>Remove selected piece</span><span><kbd>Delete</kbd> / <kbd>Backspace</kbd></span></li>
          <li><span>Hint</span><kbd>Space</kbd></li>
          <li><span>Move board cursor / place</span><span><kbd>←↑→↓</kbd> + <kbd>Enter</kbd></span></li>
          <li><span>Pause</span><kbd>P</kbd></li>
        </ul>
      </section>

      <section className="card">
        <h2 className="card-title">Data on this device</h2>
        <p className="muted">Progress, scores and settings are stored locally so the game works offline.</p>
        <button type="button" className="btn btn-danger" onClick={() => setConfirm(true)}>
          Erase local progress
        </button>
        {done ? <p className="muted" role="status">Local data erased.</p> : null}
      </section>

      <section className="card about-card" aria-labelledby="about-title">
        <img className="about-mark" src={GAME_LOGO_SRC} alt="" width="64" height="64" />
        <div>
          <h2 id="about-title" className="card-title">
            FitBox — Brain Teaser
          </h2>
          <p className="muted">
            An original puzzle game by <strong className="about-brand">Fenix Innolabs</strong>. Works fully offline.
          </p>
        </div>
      </section>

      <Modal open={confirm} title="Erase local progress?" onClose={() => setConfirm(false)}>
        <p>This removes progress, scores, unsynced sessions and settings stored on this device. Progress already synced to your account is kept in the cloud.</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              await resetLocalData();
              setConfirm(false);
              setDone(true);
            }}
          >
            Erase
          </button>
          <button type="button" className="btn btn-ghost" data-autofocus onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </div>
      </Modal>
    </main>
  );
}
