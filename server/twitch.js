// Twitch chat via IRC (tmi.js). Anonymous read-only connection — no token needed to read a public channel.
import tmi from 'tmi.js';

export function connectTwitch(channel, onMessage, onStatus) {
  const client = new tmi.Client({
    channels: [channel],
    connection: { reconnect: true, secure: true },
  });
  client.on('message', (_ch, tags, text, self) => {
    if (self) return;
    onMessage({
      platform: 'twitch',
      user: tags['display-name'] || tags.username,
      id: tags.username,
      msg: text,
    });
  });
  client.on('connected', () => { console.log(`[twitch] joined #${channel}`); onStatus(true); });
  client.on('disconnected', r => { console.log(`[twitch] disconnected: ${r}`); onStatus(false); });
  client.connect().catch(e => console.error('[twitch] connect failed:', e?.message || e));
  return () => client.disconnect();
}
