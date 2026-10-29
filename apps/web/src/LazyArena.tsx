import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import type { Arena as RendererType } from './Arena.js';

const Renderer = lazy(() => import('./Arena.js').then((module) => ({ default: module.Arena })));

class RendererBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="renderer-placeholder" role="alert">
        <div>
          <p>The battlefield renderer could not load. Check your connection, then reload.</p>
          <button className="button secondary compact" onClick={() => location.reload()}>
            Reload battlefield
          </button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}

export function Arena(props: ComponentProps<typeof RendererType>) {
  const slot = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState(!props.preview);
  useEffect(() => {
    if (requested || !slot.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRequested(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(slot.current);
    return () => observer.disconnect();
  }, [requested]);
  const placeholder = (
    <div className="renderer-placeholder" data-transparent={props.transparent || undefined}>
      {!props.transparent && <img src="/art/fracture-arena.webp" alt="" loading="lazy" />}
      <span role="status">
        {requested ? 'Loading battlefield…' : 'Battle preview starts when you scroll here.'}
      </span>
    </div>
  );
  return (
    <div
      className="arena-loader"
      ref={slot}
      data-renderer-status={requested ? 'requested' : 'deferred'}
    >
      {requested ? (
        <RendererBoundary>
          <Suspense fallback={placeholder}>
            <Renderer {...props} />
          </Suspense>
        </RendererBoundary>
      ) : (
        placeholder
      )}
    </div>
  );
}
