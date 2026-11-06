import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsModal } from '../SettingsModal';
import { openInSystemBrowser } from '../browserUrlUtils';

vi.mock('../browserUrlUtils', () => ({
  openInSystemBrowser: vi.fn()
}));

describe('Optional Ko-fi support in T-Line Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens only the configured Ko-fi page when clicked', () => {
    render(
      <SettingsModal
        show={true}
        onClose={() => {}}
        token="test-token"
        workspacesCount={0}
        showAlert={() => {}}
      />
    );
    const link = screen.getByRole('button', {
      name: /Support T-Line and SuperAgent development on Ko-fi/i
    });
    expect(link).toHaveAttribute('type', 'button');
    expect(screen.getByText(/Optional donations help maintain this open-source project/)).toBeInTheDocument();

    fireEvent.click(link);

    expect(openInSystemBrowser).toHaveBeenCalledTimes(1);
    expect(openInSystemBrowser).toHaveBeenCalledWith('https://ko-fi.com/rudycity');
  });
});
