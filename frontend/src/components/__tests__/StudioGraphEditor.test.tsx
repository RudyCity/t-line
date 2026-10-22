import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StudioGraphEditor } from '../StudioGraphEditor';

afterEach(() => cleanup());
const track = { property: 'opacity' as const, keyframes: [
  { frame: 0, value: 0, easing: 'easeInOut' as const },
  { frame: 30, value: 1 },
] };
describe('Studio Graph Editor', () => {
  it('plots real timeline evaluator and submits a selected keyframe value', () => {
    const onValue = vi.fn();
    render(<StudioGraphEditor track={track} property="opacity" selectedFrame={30}
      disabled={false} onValue={onValue} />);
    expect(screen.getByRole('img', { name: /animation curve/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Selected Studio keyframe value' }),
      { target: { value: '0.75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save value' }));
    expect(onValue).toHaveBeenCalledWith(.75);
    expect(track.keyframes[1].value).toBe(1);
  });
  it('rejects invalid opacity values and disables save while editing is locked', () => {
    const ui = render(<StudioGraphEditor track={track} property="opacity" selectedFrame={30}
      disabled={false} onValue={vi.fn()} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Selected Studio keyframe value' }),
      { target: { value: '2' } });
    expect(screen.getByRole('button', { name: 'Save value' })).toBeDisabled();
    ui.rerender(<StudioGraphEditor track={track} property="opacity" selectedFrame={30}
      disabled={true} onValue={vi.fn()} />);
    expect(screen.getByRole('spinbutton', { name: 'Selected Studio keyframe value' })).toBeDisabled();
  });
});
