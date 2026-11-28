import { it, expect } from 'vitest';
import { encodeConnectCode, decodeConnectCode, replyInviteKey, inviteKeyOf } from './connectCode';

const offer = `v=0\r\no=- 6124796250772422270 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=application 53289 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 103.143.181.167\r
a=candidate:480570404 1 udp 2113937151 a05046c7-318b-4be3-8c40-46d76051e0be.local 53289 typ host generation 0 network-cost 999\r
a=candidate:2116230754 1 udp 1677729535 103.143.181.167 53289 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999\r
a=candidate:9 1 udp 1677729535 2001:db8::1 53290 typ srflx raddr :: rport 0\r
a=candidate:10 1 tcp 1518280447 192.168.1.4 9 typ host tcptype active\r
a=ice-ufrag:w86J\r\na=ice-pwd:bVzTqxTJUWOTg6QAoXTghpUj\r\na=ice-options:trickle\r
a=fingerprint:sha-256 DB:FC:D2:68:E9:39:7A:DE:82:77:EF:23:81:F3:6C:03:08:AD:31:C2:9D:51:82:D4:C9:E8:30:B2:D4:33:F9:20\r
a=setup:actpass\r\na=mid:0\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n`;

it('packs a real offer into a short code and rebuilds what matters', () => {
  const code = encodeConnectCode(offer, 'invite');
  expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(code.length).toBeLessThan(150);
  const sdp = decodeConnectCode(code, 'invite');
  for (const want of [
    'a=ice-ufrag:w86J', 'a=ice-pwd:bVzTqxTJUWOTg6QAoXTghpUj', 'a=setup:actpass',
    'a=fingerprint:sha-256 DB:FC:D2:68:E9:39:7A:DE:82:77:EF:23:81:F3:6C:03:08:AD:31:C2:9D:51:82:D4:C9:E8:30:B2:D4:33:F9:20',
    'a05046c7-318b-4be3-8c40-46d76051e0be.local 53289 typ host', '103.143.181.167 53289 typ srflx', '2001:db8:0:0:0:0:0:1 53290 typ srflx',
  ]) expect(sdp).toContain(want);
  expect(sdp).not.toContain('tcp');
});

it('tells invites and replies apart, and rejects damaged codes', () => {
  const reply = encodeConnectCode(offer.replace('a=setup:actpass', 'a=setup:active'), 'reply', false, 'Ab3x');
  expect(decodeConnectCode(reply, 'reply')).toContain('a=setup:active');
  expect(replyInviteKey(reply)).toBe('Ab3x');
  expect(replyInviteKey(encodeConnectCode(offer, 'invite'))).toBeNull();
  expect(inviteKeyOf(offer)).toBe('w86J');
  expect(() => decodeConnectCode(reply, 'invite')).toThrow(/reply code/);
  expect(() => decodeConnectCode(reply.slice(0, 20), 'reply')).toThrow(/incomplete or damaged/);
});
