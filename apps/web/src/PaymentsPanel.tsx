import { useEffect, useState } from 'react';
import { z } from 'zod';
import { DeploymentRecord, SOLDIER_PRODUCTS } from '../../../packages/shared/src/payments.js';
import { api } from './store.js';

const Overview = z.object({
  enabled: z.boolean(),
  channels: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        accepting: z.boolean(),
        canManage: z.boolean(),
        records: z.array(DeploymentRecord).max(50),
      }),
    )
    .max(2),
});
export function PaymentsPanel({ roomId }: { roomId: string }) {
  const [data, setData] = useState<z.infer<typeof Overview>>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const value = Overview.parse(await api(`/api/rooms/${roomId}/payments`));
        if (alive) setData(value);
      } catch (error) {
        if (alive) setMessage((error as Error).message);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [roomId]);
  async function act(body: object) {
    setBusy(true);
    try {
      await api(`/api/rooms/${roomId}/payments`, body);
      setData(Overview.parse(await api(`/api/rooms/${roomId}/payments`)));
      setMessage('Activation settings updated.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel operator-panel" aria-label="Bits deployments">
      <div className="panel-heading">
        <h2>BITS DEPLOYMENTS</h2>
        <span className="tiny-tag">{data?.enabled ? 'TWITCH EXTENSION' : 'DISABLED'}</span>
      </div>
      <p>
        {SOLDIER_PRODUCTS.map((product) => `${product.name}: ${product.bits} Bits`).join(' · ')}
      </p>
      {!data?.enabled && (
        <p>
          No Bits are used. Enable and configure Twitch Extension monetization on the server before
          offering paid activations.
        </p>
      )}
      {data?.enabled &&
        data.channels.map((channel) => (
          <div key={channel.id}>
            <h3>{channel.name}</h3>
            {channel.canManage ? (
              <button
                disabled={busy}
                onClick={() =>
                  void act({
                    action: 'accepting',
                    channelId: channel.id,
                    accepting: !channel.accepting,
                  })
                }
              >
                {channel.accepting ? 'Stop new activations' : 'Allow new activations'}
              </button>
            ) : (
              <p>
                This channel’s broadcaster manages its own activations through its authenticated
                extension.
              </p>
            )}
            <p>
              Confirmed activations wait for space or the channel’s next battle. Stopping new
              activations does not cancel existing ones.
            </p>
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              {channel.records.map((record) => (
                <article key={record.id}>
                  <strong>
                    {record.unitId} · {record.bits} Bits · {record.status}
                  </strong>
                  <p>{record.note}</p>
                  <small>
                    Viewer {record.userId} · {new Date(record.createdAt).toLocaleString()}
                  </small>
                  {record.status === 'review' && channel.canManage && (
                    <div>
                      <label>
                        Resolution note{' '}
                        <input
                          maxLength={300}
                          value={notes[record.id] ?? ''}
                          onChange={(event) =>
                            setNotes((current) => ({ ...current, [record.id]: event.target.value }))
                          }
                        />
                      </label>
                      <p>
                        Inspect the recorded delivery before requeuing. Requeuing an already
                        delivered action can deploy another soldier.
                      </p>
                      {(['requeue', 'fulfilled'] as const).map((action) => (
                        <button
                          key={action}
                          disabled={busy || (notes[record.id]?.trim().length ?? 0) < 10}
                          onClick={() =>
                            void act({
                              action,
                              channelId: channel.id,
                              id: record.id,
                              note: notes[record.id],
                            })
                          }
                        >
                          {action === 'requeue'
                            ? 'Requeue after inspection'
                            : 'Confirm already delivered'}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        ))}
      <p role="status">{message}</p>
    </section>
  );
}
