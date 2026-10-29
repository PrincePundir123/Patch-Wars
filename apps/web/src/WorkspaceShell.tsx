import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sword } from '@phosphor-icons/react/dist/csr/Sword';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { Broadcast } from '@phosphor-icons/react/dist/csr/Broadcast';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';

const sections = [
  { id: 'battle', label: 'Battlefield', Icon: Sword },
  { id: 'forge', label: 'Forge', Icon: Sparkle },
  { id: 'units', label: 'Units', Icon: UsersThree },
  { id: 'controls', label: 'Stream controls', Icon: Broadcast },
];

export function WorkspaceShell({
  children,
  hasMatch,
  spectator = false,
}: {
  children: ReactNode;
  hasMatch: boolean;
  spectator?: boolean;
}) {
  const [section, setSection] = useState('battle');
  useEffect(() => {
    if (!hasMatch) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setSection(visible[0]!.target.id);
      },
      { rootMargin: '-10% 0px -55% 0px' },
    );
    for (const { id } of sections) {
      const target = document.getElementById(id);
      if (target) observer.observe(target);
    }
    return () => observer.disconnect();
  }, [hasMatch]);
  return (
    <div className="studio-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to workspace
      </a>
      <aside className="studio-sidebar" aria-label="Workspace">
        <Link to="/" className="studio-brand" aria-label="Patch Wars home">
          <Sword size={30} weight="duotone" />
          <span>
            PATCH<span className="studio-brand-light">WARS</span>
          </span>
          <small>LIVE STRATEGY</small>
        </Link>
        <nav aria-label="Match sections">
          {sections
            .filter((s) => !spectator || s.id !== 'controls')
            .map(({ id, label, Icon }) => (
              <a
                key={id}
                href={hasMatch ? `#${id}` : id === 'battle' ? '/demo' : undefined}
                aria-disabled={!hasMatch && id !== 'battle' ? true : undefined}
                aria-current={hasMatch && section === id ? 'location' : undefined}
                onClick={() => setSection(id)}
              >
                <Icon size={20} /> <span>{label}</span>
              </a>
            ))}
        </nav>
        <div className="studio-sidebar-end">
          <Link to="/">
            <ArrowLeft size={16} /> Overview
          </Link>
          {spectator && <Link to="/dashboard">Open control room</Link>}
          <span>
            <Broadcast size={18} /> BUILT FOR TWITCH
          </span>
        </div>
      </aside>
      <div className="studio-content">{children}</div>
    </div>
  );
}
