# Contributing Guidelines

EchoKey is an open-source project designed for high-compliance environments.

1.  **Clone the repository**:
    ```bash
    git clone [repository-url]
    ```
2.  **Load the extension**:
    - Open Chrome and navigate to `chrome://extensions/`.
    - Enable **Developer mode** (toggle in top-right).
    - Click **Load unpacked**.
    - Select the project root directory (containing `manifest.json`).

## Architecture & Standards

Please refer to [DEVELOPMENT.md](DEVELOPMENT.md) for detailed information on:
- Project architecture
- Coding standards (Vanilla JS, no frameworks)
- Security constraints (CSP, permissions)
- Storage schema

## Reporting Issues

If you encounter bugs, please open an issue in the repository issue tracker with the following details:
- Browser version
- Steps to reproduce
- Expected vs. actual behavior
