import { memo, useEffect, useState } from 'react';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { api, useBattle } from './store.js';
import type { ReadinessCheck, ReadinessReport } from '../../../packages/shared/src/index.js';

export const ReadinessPanel = memo(function ReadinessPanel({ roomId }: { roomId: string }) {
  const connection = useBattle((s) => s.connection);
  const renderer = useBattle((s) => s.renderer);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(timer);
  }, [open]);
  const last = useBattle.getState().lastSnapshotAt;
  const fresh = last !== null && now - last < 10000;
  const local: ReadinessCheck[] = [
    {
      id: 'socket',
      label: 'Arena connection',
      status:
        connection === 'connected' && fresh ? 'pass' : connection === 'offline' ? 'fail' : 'warn',
      detail:
        connection === 'connected' && fresh
          ? 'Live snapshots are arriving.'
          : connection === 'connected'
            ? 'No recent snapshot. Check the server and reconnect before presenting.'
            : `Arena connection is ${connection}. Wait for live snapshots before presenting.`,
    },
    {
      id: 'renderer',
      label: 'Battlefield renderer',
      status: renderer === 'ready' ? 'pass' : renderer === 'error' ? 'fail' : 'warn',
      detail:
        renderer === 'ready'
          ? 'The battlefield canvas initialized.'
          : renderer === 'error'
            ? 'Renderer unavailable. Check connection and browser hardware acceleration, then reload.'
            : 'The battlefield renderer is loading.',
    },
  ];
  const checks = [...local, ...(report?.checks ?? [])];
  const status = checks.some((c) => c.status === 'fail')
    ? 'fail'
    : !report || checks.some((c) => c.status === 'warn')
      ? 'warn'
      : 'pass';
  async function check() {
    setBusy(true);
    setError('');
    try {
      setReport(
        await api<ReadinessReport>(
          `/api/rooms/${roomId}/readiness?origin=${encodeURIComponent(location.origin)}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setNow(Date.now());
    }
  }
  return (
    <details className="readiness-panel" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span>Presentation readiness</span>
        <span className="readiness-pill" data-status={status}>
          {!report
            ? 'Check setup'
            : status === 'pass'
              ? 'Local checks passed'
              : status === 'fail'
                ? 'Needs attention'
                : 'Review notes'}
        </span>
      </summary>
      <div className="readiness-body">
        <div className="readiness-grid">
          {checks.map((c) => (
            <div className="readiness-check" key={c.id} data-status={c.status}>
              {c.status === 'pass' ? <CheckCircle size={20} /> : <WarningCircle size={20} />}
              <div>
                <strong>{c.label}</strong>
                <small>{c.detail}</small>
              </div>
              <span>{c.status === 'pass' ? 'Pass' : c.status === 'fail' ? 'Fix' : 'Note'}</span>
            </div>
          ))}
        </div>
        <div className="readiness-actions">
          <button className="button secondary compact" disabled={busy} onClick={() => void check()}>
            {busy ? 'Checking…' : 'Check setup'}
          </button>
          <small>
            {report
              ? `Last checked ${new Date(report.checkedAt).toLocaleTimeString()}`
              : 'Run local checks without starting AI generation.'}
          </small>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="readiness-limit">
          Configuration checks do not verify live chat delivery, AI generation quality, public
          access or submission. Rooms and Twitch authorization are still cleared by server restarts.
        </p>
      </div>
    </details>
  );
});
