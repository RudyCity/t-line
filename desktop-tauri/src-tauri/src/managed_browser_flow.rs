//! One-frame-in-flight browser preview flow control.
//! The UI must ACK a sequence after it schedules the frame for rendering.
//! An unacknowledged frame is never replaced in the native event channel.
use serde::Serialize;
use std::time::{Duration, Instant};

pub const ACK_DEADLINE: Duration = Duration::from_secs(4);
#[derive(Default)]
pub struct FrameFlow {
    sequence: u64,
    pending: Option<(u64, Instant)>,
    sent: u64,
    acknowledged: u64,
    dropped: u64,
    last_ack_ms: Option<u64>,
    started: Option<Instant>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameStats {
    pub stream_id: String,
    pub sent: u64,
    pub acknowledged: u64,
    pub dropped: u64,
    pub in_flight: bool,
    pub last_ack_ms: Option<u64>,
    pub elapsed_ms: u64,
}
impl FrameFlow {
    pub fn reserve(&mut self, now: Instant) -> Result<Option<u64>, &'static str> {
        if let Some((_, sent_at)) = self.pending {
            if now.saturating_duration_since(sent_at) >= ACK_DEADLINE {
                return Err("Renderer frame ACK timed out; closing managed preview stream.");
            }
            self.dropped = self.dropped.saturating_add(1);
            return Ok(None);
        }
        self.started.get_or_insert(now);
        self.sequence = self.sequence.saturating_add(1);
        self.sent = self.sent.saturating_add(1);
        self.pending = Some((self.sequence, now));
        Ok(Some(self.sequence))
    }
    pub fn is_timed_out(&self, now: Instant) -> bool {
        self.pending
            .is_some_and(|(_, sent_at)| now.saturating_duration_since(sent_at) >= ACK_DEADLINE)
    }
    pub fn acknowledge(&mut self, sequence: u64, now: Instant) -> bool {
        match self.pending {
            Some((expected, sent_at)) if expected == sequence => {
                self.acknowledged = self.acknowledged.saturating_add(1);
                self.last_ack_ms = Some(
                    now.saturating_duration_since(sent_at)
                        .as_millis()
                        .min(u64::MAX as u128) as u64,
                );
                self.pending = None;
                true
            }
            _ => false,
        }
    }
    /// If Tauri could not enqueue a frame, undo its reservation immediately.
    pub fn failed_emit(&mut self, sequence: u64) {
        if self
            .pending
            .as_ref()
            .is_some_and(|(expected, _)| *expected == sequence)
        {
            self.pending = None;
        }
    }
    pub fn stats(&self, stream_id: &str, now: Instant) -> FrameStats {
        FrameStats {
            stream_id: stream_id.to_owned(),
            sent: self.sent,
            acknowledged: self.acknowledged,
            dropped: self.dropped,
            in_flight: self.pending.is_some(),
            last_ack_ms: self.last_ack_ms,
            elapsed_ms: self.started.map_or(0, |started| {
                now.saturating_duration_since(started)
                    .as_millis()
                    .min(u64::MAX as u128) as u64
            }),
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn at_most_one_frame_until_valid_ack() {
        let t = Instant::now();
        let mut flow = FrameFlow::default();
        assert_eq!(flow.reserve(t).unwrap(), Some(1));
        for _ in 0..500 {
            assert_eq!(flow.reserve(t + Duration::from_millis(100)).unwrap(), None);
        }
        assert_eq!(flow.stats("1-1", t).dropped, 500);
        assert!(!flow.acknowledge(2, t));
        assert!(flow.acknowledge(1, t + Duration::from_millis(200)));
        assert!(!flow.acknowledge(1, t + Duration::from_millis(201)));
        assert_eq!(
            flow.reserve(t + Duration::from_millis(250)).unwrap(),
            Some(2)
        );
        assert_eq!(
            flow.stats("1-1", t + Duration::from_millis(250))
                .acknowledged,
            1
        );
    }
    #[test]
    fn simulated_thirty_minute_flow_has_one_or_zero_pending_frames() {
        // Logical-time stress, NOT a 30-minute real-device soak/CPU measurement.
        let start = Instant::now();
        let mut flow = FrameFlow::default();
        for i in 0..9000u64 {
            // 30 minutes at the 5 FPS ceiling
            let now = start + Duration::from_millis(i * 200);
            let seq = flow.reserve(now).unwrap().expect("prior ACK cleared");
            assert_eq!(flow.reserve(now + Duration::from_millis(1)).unwrap(), None);
            assert!(flow.acknowledge(seq, now + Duration::from_millis(40)));
        }
        let stats = flow.stats("stress-1", start + Duration::from_secs(1800));
        assert_eq!(stats.sent, 9000);
        assert_eq!(stats.acknowledged, 9000);
        assert_eq!(stats.dropped, 9000);
        assert!(!stats.in_flight);
        assert_eq!(stats.last_ack_ms, Some(40));
    }
    #[test]
    fn expired_ack_fails_closed_and_emit_failure_clears_reservation() {
        let t = Instant::now();
        let mut flow = FrameFlow::default();
        assert_eq!(flow.reserve(t).unwrap(), Some(1));
        assert!(flow.is_timed_out(t + ACK_DEADLINE));
        assert!(flow
            .reserve(t + ACK_DEADLINE)
            .unwrap_err()
            .contains("timed out"));
        flow.failed_emit(1);
        assert_eq!(flow.reserve(t + ACK_DEADLINE).unwrap(), Some(2));
        assert!(!flow.acknowledge(1, t + ACK_DEADLINE));
        assert!(flow.acknowledge(2, t + ACK_DEADLINE + Duration::from_millis(50)));
        assert_eq!(flow.stats("1-1", t + ACK_DEADLINE).last_ack_ms, Some(50));
    }
}
