import { handler, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";

/**
 * GET /api/calls/ice — конфигурация ICE (STUN + TURN) для WebRTC. Только с сервера:
 * реквизиты релея не попадают в клиентский код, короткоживущие креды выдаются на каждый звонок.
 *
 * Провайдеры TURN (первый настроенный побеждает):
 *   1) Cloudflare Calls TURN:  CF_TURN_KEY_ID + CF_TURN_API_TOKEN   (1 ТБ/мес бесплатно)
 *   2) Metered.ca:             METERED_DOMAIN + METERED_API_KEY      (домен вида myapp.metered.live)
 *   3) Свой coturn/любой TURN: TURN_URLS="turn:host:3478,turns:host:5349" + TURN_USERNAME + TURN_CREDENTIAL
 *   4) Без настроек — только STUN + публичный Open Relay (без гарантий; между разными сетями может не соединить).
 */
const STUN: RTCIceServer = { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] };

let cache: { at: number; servers: RTCIceServer[]; provider: string } | null = null;

async function cloudflare(): Promise<RTCIceServer[] | null> {
  const id = process.env.CF_TURN_KEY_ID, token = process.env.CF_TURN_API_TOKEN;
  if (!id || !token) return null;
  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ ttl: 86400 }), signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Cloudflare TURN: ${res.status}`);
  const j = (await res.json()) as { iceServers: RTCIceServer | RTCIceServer[] };
  return Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers];
}

async function metered(): Promise<RTCIceServer[] | null> {
  const domain = process.env.METERED_DOMAIN, key = process.env.METERED_API_KEY;
  if (!domain || !key) return null;
  const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Metered TURN: ${res.status}`);
  return (await res.json()) as RTCIceServer[];
}

function custom(): RTCIceServer[] | null {
  if (!process.env.TURN_URLS) return null;
  return [{ urls: process.env.TURN_URLS.split(",").map((u) => u.trim()), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL }];
}

const OPEN_RELAY: RTCIceServer[] = [
  { urls: "stun:stun.relay.metered.ca:80" },
  { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp", "turns:openrelay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" },
];

export const GET = handler(async () => {
  await requireUser();
  // креды провайдеров живут долго — кэшируем на 10 минут, чтобы не дёргать API на каждый вход в комнату
  if (cache && Date.now() - cache.at < 10 * 60_000) return ok({ iceServers: cache.servers, provider: cache.provider });
  let servers: RTCIceServer[] | null = null;
  let provider = "open-relay";
  try {
    servers = custom();
    if (servers) provider = "custom";
    if (!servers) { servers = await cloudflare(); if (servers) provider = "cloudflare"; }
    if (!servers) { servers = await metered(); if (servers) provider = "metered"; }
  } catch (e) {
    console.error("[ice]", e instanceof Error ? e.message : e);
    servers = null;
  }
  const all = [STUN, ...(servers ?? OPEN_RELAY)];
  cache = { at: Date.now(), servers: all, provider };
  return ok({ iceServers: all, provider });
});
