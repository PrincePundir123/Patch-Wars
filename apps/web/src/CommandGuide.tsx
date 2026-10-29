import { useId, useRef, useState } from 'react';
import { ChatCircleDots } from '@phosphor-icons/react/dist/csr/ChatCircleDots';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { COMMAND_REFERENCE } from '../../../packages/shared/src/command-reference.js';
import type { Snapshot } from '../../../packages/shared/src/index.js';

export function CommandGuide({
  simulated = false,
  canSimulate = false,
  channels = [],
}: {
  simulated?: boolean;
  canSimulate?: boolean;
  channels?: Snapshot['channels'];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [copied, setCopied] = useState('');
  async function copy(example: string) {
    try {
      await navigator.clipboard.writeText(example);
      setCopied(
        `Copied ${example}. ${canSimulate ? 'Paste it into Replay controls to test it in this demo.' : 'Paste it into the participating Twitch channel’s chat.'}`,
      );
    } catch {
      setCopied(
        `Clipboard unavailable. Type ${example} ${canSimulate ? 'in Replay controls for this demo.' : 'in the participating Twitch channel’s chat.'}`,
      );
    }
  }
  return (
    <>
      <button
        className="button secondary compact command-guide-trigger"
        onClick={() => dialog.current?.showModal()}
      >
        <ChatCircleDots size={17} /> How to play
      </button>
      <dialog
        className="command-dialog"
        ref={dialog}
        aria-labelledby={title}
        onClose={() => setCopied('')}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="command-dialog-heading">
          <div>
            <span className="eyebrow">VIEWER FIELD GUIDE</span>
            <h2 id={title}>Your chat is the controller.</h2>
          </div>
          <button
            className="dialog-close"
            aria-label="Close command guide"
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        <p className="command-guide-intro">
          PATCH WARS is a web game controlled through Twitch chat. Send commands in a participating
          channel, not in this guide.
        </p>
        {simulated && (
          <p className="command-demo-note">
            {canSimulate
              ? 'Demo: send simulated messages in Replay controls below. They stay in this replay and are not sent to Twitch.'
              : 'You are watching a simulated replay. Open your own demo from the control room to try messages; this spectator page cannot send commands.'}
          </p>
        )}
        {!simulated && (
          <p className="command-demo-note">
            Live match: the streamer authorizes a Twitch channel and starts the battle. Viewers then
            type commands in that channel’s Twitch chat. This guide only copies examples.
          </p>
        )}
        {['Battle', 'Community Forge', 'Information'].map((group) => (
          <section key={group} className="command-group">
            <h3>{group}</h3>
            <div>
              {COMMAND_REFERENCE.filter((c) => c.group === group).map((c) => (
                <article key={c.command}>
                  <div>
                    <code>{c.example}</code>
                    <button aria-label={`Copy ${c.example}`} onClick={() => void copy(c.example)}>
                      <Copy size={16} />
                      Copy
                    </button>
                  </div>
                  <p>{c.description}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
        <div className="command-guide-rules">
          <strong>Before you send</strong>
          <p>
            Chat commands must be enabled. Combat commands need an active, unpaused battle. Leave at
            least two seconds between messages; team energy, channel cooldowns and unit limits still
            apply.
          </p>
        </div>
        <div className="command-guide-links">
          {channels
            .filter((c) => c.status.startsWith('connected'))
            .map((c) => (
              <a
                key={c.id}
                className="button secondary compact"
                href={`https://www.twitch.tv/${encodeURIComponent(c.name)}/chat`}
                target="_blank"
                rel="noreferrer"
              >
                Open {c.name} chat
              </a>
            ))}
        </div>
        <p className="command-copy-status" role="status" aria-live="polite">
          {copied || 'Copying a command never sends it or starts AI generation.'}
        </p>
      </dialog>
    </>
  );
}
