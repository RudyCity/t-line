// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SuperAgentMessageItem } from '../SuperAgentMessageItem';

describe('SuperAgentMessageItem - Thought Accordion & Message Rendering', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders thought accordion with collapsible toggle', () => {
    const thoughtText = 'Analyzing codebase architecture to locate ACP hooks...';
    render(
      <SuperAgentMessageItem
        index={0}
        msg={{
          role: 'thought',
          text: thoughtText,
        }}
      />
    );

    // Header exists
    expect(screen.getByText('Thought Process')).toBeDefined();
    expect(screen.getByText(`(${thoughtText.length} chars)`)).toBeDefined();

    // Body content is rendered initially (defaultOpen = true)
    expect(screen.getByText(thoughtText)).toBeDefined();

    // Toggle button collapses the accordion
    const toggleBtn = screen.getByRole('button');
    fireEvent.click(toggleBtn);

    // After click, content should no longer be visible
    expect(screen.queryByText(thoughtText)).toBeNull();

    // Click again to reopen
    fireEvent.click(toggleBtn);
    expect(screen.getByText(thoughtText)).toBeDefined();
  });

  it('renders standard assistant message', () => {
    render(
      <SuperAgentMessageItem
        index={1}
        msg={{
          role: 'assistant',
          text: 'Here is the completed implementation plan.',
        }}
      />
    );

    expect(screen.getByText('Assistant')).toBeDefined();
    expect(screen.getByText('Here is the completed implementation plan.')).toBeDefined();
  });

  it('renders standard user message', () => {
    render(
      <SuperAgentMessageItem
        index={2}
        msg={{
          role: 'user',
          text: 'Please start the server.',
        }}
      />
    );

    expect(screen.getByText('❯ USER')).toBeDefined();
    expect(screen.getByText('Please start the server.')).toBeDefined();
  });

  it('intercepts file:/// markdown links and triggers onOpenFile', () => {
    let openedPath = '';
    let openedName = '';

    render(
      <SuperAgentMessageItem
        index={3}
        msg={{
          role: 'assistant',
          text: 'Check this out: [demo.mp4](file:///D:/assets/demo.mp4) and [app.tsx](file:///D:/src/app.tsx#L45)',
        }}
        onOpenFile={(path, name) => {
          openedPath = path;
          openedName = name || '';
        }}
      />
    );

    const videoLink = screen.getByText('demo.mp4');
    expect(videoLink).toBeDefined();

    fireEvent.click(videoLink);
    expect(openedPath).toBe('D:/assets/demo.mp4');
    expect(openedName).toBe('demo.mp4');

    const codeLink = screen.getByText('app.tsx');
    expect(codeLink).toBeDefined();

    fireEvent.click(codeLink);
    expect(openedPath).toBe('D:/src/app.tsx');
    expect(openedName).toBe('app.tsx');
  });

  it('renders standard external https links with target="_blank"', () => {
    let called = false;
    render(
      <SuperAgentMessageItem
        index={4}
        msg={{
          role: 'assistant',
          text: 'Visit [Google](https://google.com) for details.',
        }}
        onOpenFile={() => {
          called = true;
        }}
      />
    );

    const link = screen.getByText('Google');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('href')).toBe('https://google.com');

    fireEvent.click(link);
    expect(called).toBe(false);
  });
});
