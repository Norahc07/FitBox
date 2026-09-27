import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import GameScreen from '../game/GameScreen.jsx';
import Modal from '../components/Modal.jsx';
import SolutionPreview from './SolutionPreview.jsx';
import { generateLevel } from '../engine/generator.js';
import { DIFFICULTIES, DIFFICULTY_PROFILES } from '../engine/difficulty.js';
import { validateLevel, LEVEL_LIMITS } from '../levels/validator.js';
import { DEFAULT_SETTINGS } from '../storage/settingsStore.js';
import { uuid } from '../utils/id.js';

export function newLevelId(number, version) {
  return `level-${String(number).padStart(2, '0')}-v${version}-${uuid().slice(0, 8)}`;
}

export function blankLevel(number = 25) {
  return {
    id: newLevelId(number, 1),
    number,
    version: 1,
    difficulty: 'beginner',
    width: 5,
    height: 5,
    totalPieces: 13,
    requiredPieces: 10,
    timeLimit: null,
    hints: DIFFICULTY_PROFILES.beginner.defaultHints,
    seed: Math.floor(Math.random() * 1e9),
    published: false,
    pieces: [],
    solution: [],
  };
}

function NumberField({ label, value, onChange, min, max, allowEmpty = false, help }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        min={min}
        max={max}
        placeholder={allowEmpty ? 'None' : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '' && allowEmpty) onChange(null);
          else if (raw !== '') onChange(Math.trunc(Number(raw)));
        }}
      />
      {help ? <small className="field-help">{help}</small> : null}
    </label>
  );
}

/**
 * Level editor: configure metadata, generate a solvable puzzle from a seed,
 * validate it, play-test it and save / publish it. Publishing is blocked
 * unless the automated validator passes.
 */
export default function LevelEditor({ initial, canSave, onSave, onClose }) {
  const [draft, setDraft] = useState(initial);
  const [validation, setValidation] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const [confirmUntested, setConfirmUntested] = useState(false);

  const puzzleKey = useMemo(() => JSON.stringify([draft.pieces, draft.solution]), [draft.pieces, draft.solution]);
  const [testedKey, setTestedKey] = useState(null);
  const isTested = tested && testedKey === puzzleKey;

  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setValidation(null);
    setStatus(null);
  };

  const generate = () => {
    setBusy(true);
    setStatus(null);
    // Defer so the button shows its busy state before the synchronous generator runs.
    setTimeout(() => {
      try {
        const level = generateLevel({ ...draft, id: draft.id });
        setDraft({ ...level, published: draft.published });
        const result = validateLevel(level);
        setValidation(result);
        setStatus({ tone: 'ok', text: `Generated a ${level.width}×${level.height} puzzle from seed ${level.seed}.` });
      } catch (err) {
        setStatus({ tone: 'error', text: err.message });
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  const validate = () => {
    const result = validateLevel(draft);
    setValidation(result);
    return result;
  };

  const save = async (publish) => {
    const result = validate();
    if (publish && !result.valid) {
      setStatus({ tone: 'error', text: 'Fix the validation errors before publishing.' });
      return;
    }
    if (draft.published && !publish && !result.valid) {
      setStatus({ tone: 'error', text: 'This level is published, so it must stay valid. Unpublish it first or fix the errors.' });
      return;
    }
    setBusy(true);
    try {
      const saved = await onSave({ ...draft, published: publish ? true : draft.published });
      setDraft(saved);
      setStatus({ tone: 'ok', text: publish ? 'Published. Players will receive it on their next sync.' : 'Saved.' });
    } catch (err) {
      setStatus({ tone: 'error', text: err.message || String(err) });
    } finally {
      setBusy(false);
    }
  };

  const hasPuzzle = draft.pieces.length > 0 && draft.solution.length > 0;
  const area = draft.width * draft.height;

  return (
    <div className="editor">
      <div className="editor-header">
        <h2>{initial.pieces.length ? `Edit level ${initial.number} (v${initial.version})` : 'New level'}</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="editor-grid">
        <section className="card editor-form" aria-label="Level settings">
          <div className="field-grid">
            <NumberField label="Level number" value={draft.number} min={1} onChange={(number) => set({ number })} />
            <NumberField label="Version" value={draft.version} min={1} onChange={(version) => set({ version })} />
            <label className="field">
              <span>Difficulty</span>
              <select value={draft.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_PROFILES[d].label}
                  </option>
                ))}
              </select>
            </label>
            <NumberField label="Board width" value={draft.width} min={LEVEL_LIMITS.minSize} max={LEVEL_LIMITS.maxSize} onChange={(width) => set({ width })} />
            <NumberField label="Board height" value={draft.height} min={LEVEL_LIMITS.minSize} max={LEVEL_LIMITS.maxSize} onChange={(height) => set({ height })} />
            <NumberField label="Required pieces" value={draft.requiredPieces} min={1} max={area} onChange={(requiredPieces) => set({ requiredPieces })} help={`Board has ${area} cells`} />
            <NumberField label="Total pieces" value={draft.totalPieces} min={draft.requiredPieces + 1} max={LEVEL_LIMITS.maxPieces} onChange={(totalPieces) => set({ totalPieces })} help={`${Math.max(0, draft.totalPieces - draft.requiredPieces)} decoys`} />
            <NumberField label="Hints" value={draft.hints} min={0} max={LEVEL_LIMITS.maxHints} onChange={(hints) => set({ hints })} />
            <NumberField label="Time limit (seconds)" value={draft.timeLimit} min={1} allowEmpty onChange={(timeLimit) => set({ timeLimit })} help="Leave empty for no limit" />
            <div className="field">
              <span>Seed</span>
              <div className="input-row">
                <input type="number" value={draft.seed ?? ''} onChange={(e) => set({ seed: e.target.value === '' ? null : Math.trunc(Number(e.target.value)) })} />
                <button type="button" className="btn btn-ghost btn-small" onClick={() => set({ seed: Math.floor(Math.random() * 1e9) })}>
                  Random
                </button>
              </div>
            </div>
          </div>
          <p className="muted">
            Status: <strong>{draft.published ? 'Published' : 'Draft'}</strong>
            {isTested ? ' · Tested ✓' : hasPuzzle ? ' · Not tested yet' : ''}
          </p>

          <div className="button-row">
            <button type="button" className="btn btn-secondary" onClick={generate} disabled={busy || draft.seed === null}>
              Generate Puzzle
            </button>
            <button type="button" className="btn btn-secondary" onClick={validate} disabled={busy}>
              Validate Puzzle
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setTesting(true)} disabled={busy || !hasPuzzle || !validateLevel(draft).valid}>
              Test Puzzle
            </button>
          </div>
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={() => save(false)} disabled={busy || !canSave}>
              Save
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (isTested ? save(true) : setConfirmUntested(true))}
              disabled={busy || !canSave || !hasPuzzle}
            >
              Publish
            </button>
          </div>
          {!canSave ? <p className="form-message form-info">Local sandbox: saving and publishing need Supabase and an admin account.</p> : null}

          {status ? (
            <p className={`form-message form-${status.tone === 'ok' ? 'info' : 'error'}`} role="status">
              {status.text}
            </p>
          ) : null}

          {validation ? (
            <div className={`validation ${validation.valid ? 'is-valid' : 'is-invalid'}`} role="status">
              <strong>{validation.valid ? 'Valid puzzle — ready to publish.' : 'Validation failed — this puzzle cannot be published.'}</strong>
              {validation.errors.length ? (
                <ul>
                  {validation.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : null}
              {validation.warnings.length ? (
                <ul className="warnings">
                  {validation.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="card" aria-label="Puzzle preview">
          <SolutionPreview level={draft} />
        </section>
      </div>

      {testing
        ? createPortal(
            <div className="test-overlay" role="dialog" aria-modal="true" aria-label="Test puzzle">
              <GameScreen
                level={draft}
                mode="test"
                settings={DEFAULT_SETTINGS}
                exitLabel="Back to editor"
                onComplete={() => {
                  setTested(true);
                  setTestedKey(puzzleKey);
                  return null;
                }}
                onExit={() => setTesting(false)}
              />
            </div>,
            document.body,
          )
        : null}

      <Modal open={confirmUntested} title="Publish without testing?" onClose={() => setConfirmUntested(false)}>
        <p>The validator guarantees this puzzle is solvable, but you have not played it yet. Publish anyway?</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setConfirmUntested(false);
              save(true);
            }}
          >
            Publish
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            data-autofocus
            onClick={() => {
              setConfirmUntested(false);
              setTesting(true);
            }}
          >
            Test first
          </button>
        </div>
      </Modal>
    </div>
  );
}
