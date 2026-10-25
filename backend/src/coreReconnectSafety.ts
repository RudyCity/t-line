/**
 * T-Line -> supervised Core reconnect safety.
 * A socket error after a write is an UNKNOWN outcome, not permission to replay.
 * This module is pure and never sends chat, tools or authorization decisions.
 */
export type CoreReconnectCode =
  "CORE_SUPERVISOR_UNAVAILABLE" | "SESSION_WORKER_DEAD" |
  "SESSION_OWNER_UNAVAILABLE" | "UNCONFIRMED_CHAT_OUTCOME" |
  "REVIEW_REQUIRED" | "CONNECTED";
export type CoreReconnectPhase =
  "offline" | "explicit_resume_required" | "review_required" | "connected";
export interface CoreReconnectNotice {
  type: "core_reconnect_state";
  sessionId: string;
  phase: CoreReconnectPhase;
  code: CoreReconnectCode;
  automaticChatReplayAllowed: false;
  message: string;
}
export function classifyCoreReconnect(input: {
  sessionId: string; upstreamCode?: string; statusCode?: number;
  uncertainWrite?: boolean;
}): CoreReconnectNotice {
  const { sessionId, upstreamCode, statusCode, uncertainWrite } = input;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(sessionId)) throw new Error("Invalid bound session");
  let phase: CoreReconnectPhase = "review_required";
  let code: CoreReconnectCode = "REVIEW_REQUIRED";
  let message = "Core returned an unexpected state. Review session history before resuming.";
  if (uncertainWrite) {
    code = "UNCONFIRMED_CHAT_OUTCOME";
    message = "Chat delivery could not be confirmed. Nothing was resent. Inspect session history before submitting it again.";
  } else if (upstreamCode === "SESSION_WORKER_DEAD" || upstreamCode === "SESSION_OWNER_UNAVAILABLE") {
    code = upstreamCode;
    phase = "explicit_resume_required";
    message = "The session's previous worker is unavailable. Resume the saved session explicitly; no chat or tools will replay.";
  } else if (upstreamCode === "CORE_SUPERVISOR_UNAVAILABLE" || statusCode === 503) {
    code = "CORE_SUPERVISOR_UNAVAILABLE";
    phase = "offline";
    message = "Core is temporarily unavailable. Check its connection; any unfinished chat will not be resent.";
  } else if (statusCode === 200) {
    phase = "connected";
    code = "CONNECTED";
    message = "Core is connected. No previous chat was automatically replayed.";
  }
  return { type: "core_reconnect_state", sessionId, phase, code,
    automaticChatReplayAllowed: false, message };
}
export function isExplicitResumeRequest(input: {
  channelSessionId: string; requestedSessionId: unknown; approval: unknown;
}): boolean {
  return input.approval === true && input.requestedSessionId === input.channelSessionId &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.channelSessionId);
}
