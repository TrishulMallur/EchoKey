## Security Policy

This tool is designed with strict security constraints for internal banking use:

1.  **Zero Network Surface**: The extension makes no external network requests.
2.  **Local Storage Only**: All data is stored in `chrome.storage.local`.
3.  **No PII**: The tool does not store Personally Identifiable Information, only comment templates.

If you discover a security vulnerability, please report it immediately to the project maintainer via internal channels. Do not open a public issue.

## Compliance

This project adheres to the following internal security standards:
- Manifest V3 strict CSP.
- No `eval()` or dynamic code execution.
- No third-party dependencies (supply chain security).
