import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MasterPasswordAlertBanner } from '../MasterPasswordAlertBanner';

describe('MasterPasswordAlertBanner', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('renders alert banner with prompt when master password is not configured', () => {
    const onOpen = vi.fn();
    render(<MasterPasswordAlertBanner configured={false} onOpenSecuritySettings={onOpen} />);

    expect(screen.getByText(/Master password belum dipasang/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pasang Password/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tutup pemberitahuan/i })).toBeTruthy();
  });

  it('calls onOpenSecuritySettings when clicking "Pasang Password" button', () => {
    const onOpen = vi.fn();
    render(<MasterPasswordAlertBanner configured={false} onOpenSecuritySettings={onOpen} />);

    const actionBtn = screen.getByRole('button', { name: /Pasang Password/i });
    fireEvent.click(actionBtn);

    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('hides the banner and saves dismissed state to sessionStorage when clicking dismiss', () => {
    const onOpen = vi.fn();
    render(<MasterPasswordAlertBanner configured={false} onOpenSecuritySettings={onOpen} />);

    const dismissBtn = screen.getByRole('button', { name: /Tutup pemberitahuan/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/Master password belum dipasang/i)).toBeNull();
    expect(sessionStorage.getItem('tline-dismiss-master-pw-alert')).toBe('true');
  });

  it('does not render banner when configured is true', () => {
    const onOpen = vi.fn();
    render(<MasterPasswordAlertBanner configured={true} onOpenSecuritySettings={onOpen} />);

    expect(screen.queryByText(/Master password belum dipasang/i)).toBeNull();
  });

  it('remains hidden on mount if previously dismissed in sessionStorage', () => {
    sessionStorage.setItem('tline-dismiss-master-pw-alert', 'true');
    const onOpen = vi.fn();
    render(<MasterPasswordAlertBanner configured={false} onOpenSecuritySettings={onOpen} />);

    expect(screen.queryByText(/Master password belum dipasang/i)).toBeNull();
  });
});
