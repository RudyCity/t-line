# Agent Rules for t-line Project

This document defines style guidelines, behavioral constraints, and coding standards that all AI agents must follow when working on the **t-line** codebase.

## Coding Standards & Architectural Guidelines

- **Best Practices**: Always write clean, secure, type-safe (TypeScript-first), and self-documenting code. Never write inline credentials, bypass security middleware, or introduce PTY command injection vulnerabilities.
- **Modular Design**: Code must be modular. Business logic, routing, services, and UI components should be strictly decoupled. Leverage React custom hooks to extract complex component states where possible.
- **Maintainability**: Maintain high readability. Keep comments and type interfaces up-to-date. Ensure variables, functions, and files have clean and descriptive names.
- **Strict File Length Limit**: No code file in the repository (backend, frontend, or desktop) should exceed **1000 lines of code**. If a file is approaching this limit, it must be refactored and split into smaller, dedicated sub-modules or utility files.
- **Workflow & Release Cycle**: For every successfully completed task or major change:
  - Commit the changes locally to the Git repository.
  - Bump the version of the application in package.json configurations.
  - Document the updates in CHANGELOG.md.
