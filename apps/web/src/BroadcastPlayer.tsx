import { useEffect, useRef, useState } from 'react';
import { Broadcast } from '@phosphor-icons/react/dist/csr/Broadcast';

export function BroadcastPlayer({ channel, demo }: { channel?: string; demo: boolean }) {
  const [watching, setWatching] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [wideEnough, setWideEnough] = useState(false);
  const host = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWideEnough(entry.contentRect.width >= 400 && entry.contentRect.height >= 330);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setWatching(false);
    setLoaded(false);
    setFailed(false);
  }, [channel]);
  useEffect(() => {
    if (!watching || loaded) return;
    const timer = setTimeout(() => setFailed(true), 15000);
    return () => clearTimeout(timer);
  }, [watching, loaded]);
  const valid = channel && /^[a-zA-Z0-9_]{1,25}$/.test(channel);
  const external = valid ? `https://www.twitch.tv/${encodeURIComponent(channel)}` : undefined;
  const source = valid
    ? `https://player.twitch.tv/?${new URLSearchParams({ channel, parent: location.hostname, autoplay: 'false', muted: 'true' })}`
    : undefined;
  return (
    <section className="broadcast-player" aria-label="Host broadcast" ref={host}>
      {watching && wideEnough && source ? (
        <>
          <iframe
            title={`${channel} live broadcast`}
            src={source}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            onLoad={() => {
              setLoaded(true);
              setFailed(false);
            }}
            onError={() => setFailed(true)}
          />
          {!loaded && (
            <p className="broadcast-loading" role="status">
              {failed
                ? 'Player could not load. Open the stream on Twitch below.'
                : 'Loading Twitch player…'}
            </p>
          )}
        </>
      ) : (
        <div className="broadcast-placeholder">
          <Broadcast size={36} aria-hidden="true" />
          <span className="eyebrow">{demo ? 'SIMULATED MATCH' : 'HOST BROADCAST'}</span>
          <h2>
            {demo
              ? 'The stream takes center stage.'
              : valid
                ? `Watch ${channel}`
                : 'Your community. Live.'}
          </h2>
          <p>
            {demo
              ? 'Battle and deployment work below. Connect a Twitch channel in a live match to watch the host here.'
              : valid
                ? 'Watch the host while your army fights below. The broadcaster must be live on Twitch.'
                : 'Connect a Twitch channel from the control room, then start your broadcast in OBS.'}
          </p>
          {valid && wideEnough && !demo && (
            <button onClick={() => setWatching(true)}>Watch broadcast</button>
          )}
          {valid && !wideEnough && (
            <p>Open the stream on Twitch for a full-size player on this screen.</p>
          )}
        </div>
      )}
      {external && (
        <div className="broadcast-caption">
          <span>#{channel} · Twitch player reports live / offline status</span>
          <a href={external} target="_blank" rel="noreferrer">
            Open stream ↗
          </a>
        </div>
      )}
    </section>
  );
}
