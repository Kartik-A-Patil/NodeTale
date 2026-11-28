import { it, expect, vi } from 'vitest';
import { encodeConnectCode } from '../../src/services/connectCode';

// Fake invites: each knows its key and records what happened to it.
const made: any[] = [];
vi.mock('../../src/services/liveShare', () => ({
  createInvite: async () => {
    const n = made.length;
    const inv = { code: `CODE${n}`, key: `k${n}aa`, accepted: '', closed: false,
      accept: async (code: string) => { inv.accepted = code; return {}; },
      close: () => { inv.closed = true; } };
    made.push(inv);
    return inv;
  },
}));
const { invites, NoMatchingInvite } = await import('../../src/services/invites');

const sdp = (ufrag: string) => `a=ice-ufrag:${ufrag}\r\na=ice-pwd:abcdefghijklmnopqrstuvwx\r\na=setup:active\r\na=fingerprint:sha-256 ${Array(32).fill('AB').join(':')}\r\n`;
const replyTo = (key: string) => encodeConnectCode(sdp('zz11'), 'reply', false, key);
const project = () => ({ id: 'p', name: 'Story' }) as any;

it('routes a pasted reply to the invite it answers, among several', async () => {
  const a = await invites.create('p', project, 'copy');
  const b = await invites.create('p', project, 'copy');
  expect(invites.all().filter((i) => i.status === 'waiting').map((i) => i.id)).toEqual([a.id, b.id]);

  expect(invites.matches(`https://x/share#${replyTo(b.id)}`)).toBe(true);
  await invites.accept(replyTo(b.id));
  expect(made[1].accepted).toBe(replyTo(b.id));
  expect(made[1].closed).toBe(true); // a copy is done once sent
  expect(made[0].accepted).toBe('');
  expect(invites.all().find((i) => i.id === b.id)?.status).toBe('sent');
  expect(invites.all().find((i) => i.id === a.id)?.status).toBe('waiting');
});

it('explains replies it can’t use, and cancelling stops a link', async () => {
  const c = await invites.create('p', project, 'copy');
  invites.discard(c.id);
  expect(made[2].closed).toBe(true);
  await expect(invites.accept(replyTo(c.id))).rejects.toBeInstanceOf(NoMatchingInvite);
  await expect(invites.accept('hello there')).rejects.toBeInstanceOf(NoMatchingInvite);
  expect(invites.matches('hello there')).toBe(false);
});
