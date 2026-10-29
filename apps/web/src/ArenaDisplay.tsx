import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CornersOut } from '@phosphor-icons/react/dist/csr/CornersOut';
import { CornersIn } from '@phosphor-icons/react/dist/csr/CornersIn';
import { Monitor } from '@phosphor-icons/react/dist/csr/Monitor';

// Presentation only: children (including Pixi and audio) stay mounted in every mode.
export function ArenaDisplay({
  children,
  enabled,
  simulated,
  provider,
}: {
  children: ReactNode;
  enabled: boolean;
  simulated: boolean;
  provider: string;
}) {
  const stage = useRef<HTMLElement>(null);
  const theaterButton = useRef<HTMLButtonElement>(null);
  const [theater, setTheater] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const immersive = theater || fullscreen;

  useEffect(() => {
    if (!enabled) return;
    const sync = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [enabled]);

  useEffect(() => {
    const root = stage.current;
    if (!immersive || !root) return;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Exclude only surrounding UI. Do not hide the live arena from accessibility tools.
    const siblings: { element: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement = root;
    while (branch.parentElement && branch !== document.body) {
      for (const node of Array.from(branch.parentElement.children)) {
        if (node !== branch && node instanceof HTMLElement) {
          siblings.push({ element: node, inert: node.inert });
          node.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    theaterButton.current?.focus({ preventScroll: true });
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        event.preventDefault();
        setTheater(false);
      }
      if (event.key !== 'Tab') return;
      const targets = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
      const first = targets[0],
        last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('keydown', keys);
      document.body.style.overflow = overflow;
      for (const { element, inert } of siblings) element.inert = inert;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [immersive]);

  async function toggleFullscreen() {
    setNotice('');
    try {
      if (document.fullscreenElement === stage.current) await document.exitFullscreen();
      else if (stage.current?.requestFullscreen && document.fullscreenEnabled)
        await stage.current.requestFullscreen();
      else throw new Error('Fullscreen unavailable');
    } catch {
      setTheater(true);
      setNotice('Browser fullscreen is unavailable. Theater view fills this window instead.');
    }
  }
  async function toggleTheater() {
    setNotice('');
    if (fullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        setNotice('Use your browser’s fullscreen exit control to return.');
        return;
      }
      setTheater(false);
    } else setTheater((value) => !value);
  }

  return (
    <section
      ref={stage}
      className={`battle-stage${immersive ? ' immersive-stage' : ''}`}
      id="battle"
      role={immersive ? 'dialog' : undefined}
      aria-modal={immersive ? true : undefined}
      aria-label={immersive ? 'Expanded battlefield' : 'Battlefield'}
    >
      {enabled && (
        <div className="arena-display-bar">
          <span>
            {simulated ? 'SIMULATED REPLAY' : 'TWITCH MATCH'} ·{' '}
            {provider === 'fixture' ? 'FIXTURE FORGE' : provider}
            <small>{immersive ? ' · ESC TO RETURN' : ' · BATTLEFIELD'}</small>
          </span>
          <div>
            <button
              ref={theaterButton}
              aria-pressed={immersive}
              onClick={() => void toggleTheater()}
            >
              <Monitor size={17} /> {immersive ? 'Exit theater' : 'Theater view'}
            </button>
            <button aria-pressed={fullscreen} onClick={() => void toggleFullscreen()}>
              {fullscreen ? <CornersIn size={17} /> : <CornersOut size={17} />}
              {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </button>
          </div>
          {notice && (
            <p className="display-notice" role="status">
              {notice}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
