import { handler, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";

/**
 * GET /api/calls/ice — конфигурация ICE для WebRTC.
 * Отдаётся с сервера, чтобы реквизиты TURN не лежали в клиентском коде и их можно было сменить через env:
 *   TURN_URLS="turn:host:3478,turns:host:5349"  TURN_USERNAME  TURN_CREDENTIAL
 * По умолчанию — бесплатный публичный релей Open Relay (metered.ca): без TURN звонок между
 * двумя разными сетями за NAT часто не устанавливается.
 */
export const GET = handler(async () => {
  await requireUser();
  const iceServers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  if (process.env.TURN_URLS) {
    iceServers.push({ urls: process.env.TURN_URLS.split(",").map((u) => u.trim()), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  } else {
    iceServers.push(
      { urls: "stun:stun.relay.metered.ca:80" },
      { urls: ["turn:global.relay.metered.ca:80", "turn:global.relay.metered.ca:80?transport=tcp", "turn:global.relay.metered.ca:443", "turns:global.relay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" },
      { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" },
    );
  }
  return ok({ iceServers });
});
