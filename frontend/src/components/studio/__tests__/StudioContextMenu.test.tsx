import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StudioContextMenu, type StudioMenuItem } from '../StudioContextMenu';

afterEach(() => cleanup());

describe('StudioContextMenu', () => {
  it('renders title and menu items correctly', () => {
    const items: StudioMenuItem[] = [
      { id: 'item1', label: 'Duplicate Layer', shortcut: 'Ctrl+D', onClick: vi.fn() },
      { id: 'item2', label: 'Delete Layer', danger: true, onClick: vi.fn() },
    ];
    const onClose = vi.fn();

    render(<StudioContextMenu x={100} y={150} title="Layer: Title" items={items} onClose={onClose} />);

    expect(screen.getByText('Layer: Title')).toBeInTheDocument();
    expect(screen.getByText('Duplicate Layer')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+D')).toBeInTheDocument();
    expect(screen.getByText('Delete Layer')).toBeInTheDocument();
  });

  it('triggers item onClick and onClose when clicked', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    const items: StudioMenuItem[] = [
      { id: 'item1', label: 'Duplicate Layer', onClick },
    ];

    render(<StudioContextMenu x={100} y={150} items={items} onClose={onClose} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /Duplicate Layer/ }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onClick for disabled items', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    const items: StudioMenuItem[] = [
      { id: 'item1', label: 'Disabled Action', disabled: true, onClick },
    ];

    render(<StudioContextMenu x={100} y={150} items={items} onClose={onClose} />);

    const item = screen.getByRole('menuitem', { name: /Disabled Action/ });
    expect(item).toBeDisabled();
    fireEvent.click(item);

    expect(onClick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape key press', () => {
    const onClose = vi.fn();
    const items: StudioMenuItem[] = [
      { id: 'item1', label: 'Action', onClick: vi.fn() },
    ];

    render(<StudioContextMenu x={100} y={150} items={items} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates with Arrow keys and triggers on Enter', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    const items: StudioMenuItem[] = [
      { id: 'item1', label: 'First Action', onClick },
      { id: 'item2', label: 'Second Action', onClick: vi.fn() },
    ];

    render(<StudioContextMenu x={100} y={150} items={items} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
