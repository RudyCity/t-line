import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CoreReconnectBanner } from '../CoreReconnectBanner';
import type { CoreReconnectNotice } from '../../services/coreReconnectNotice';
afterEach(cleanup);
const base: CoreReconnectNotice = {
  type: 'core_reconnect_state', sessionId: 'sess_123456',
  phase: 'offline', code: 'CORE_SUPERVISOR_UNAVAILABLE',
  message: 'Core offline; no chat has been resent.',
  automaticChatReplayAllowed: false,
};
describe('desktop Core recovery notice and approval buttons', () => {
  it('offers only read-only connection probe on temporary Core outage', () => {
    const check = vi.fn(), resume = vi.fn();
    render(<CoreReconnectBanner notice={base} canSend onCheck={check} onResume={resume} />);
    fireEvent.click(screen.getByRole('button', {name:'Check Core connection'}));
    expect(check).toHaveBeenCalledOnce();
    expect(resume).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name:/Resume saved session/})).toBeNull();
  });
  it('makes manual resume explicit and disables it when the WS is offline', () => {
    const resume = vi.fn();
    const props = { notice:{...base,phase:'explicit_resume_required' as const},
      canSend:false, onCheck:vi.fn(),onResume:resume };
    const { rerender } = render(<CoreReconnectBanner {...props} />);
    const button = screen.getByRole('button',{name:'Resume saved session after worker crash'}) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(resume).not.toHaveBeenCalled();
    rerender(<CoreReconnectBanner {...props} canSend />);
    fireEvent.click(screen.getByRole('button',{name:'Resume saved session after worker crash'}));
    expect(resume).toHaveBeenCalledOnce();
  });
  it('never offers retry-chat for unconfirmed outcomes', () => {
    render(<CoreReconnectBanner notice={{...base,phase:'review_required',
      code:'UNCONFIRMED_CHAT_OUTCOME'}}
      canSend onCheck={vi.fn()} onResume={vi.fn()} />);
    expect(screen.getByText(/Inspect saved chat and tool results/)).toBeTruthy();
    expect(screen.queryByRole('button',{name:/Resume saved session/})).toBeNull();
    expect(screen.queryByRole('button',{name:/Retry chat|Resend prompt/i})).toBeNull();
  });
});
