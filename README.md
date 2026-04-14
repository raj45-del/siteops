# Windows Diagnostic Utility (siteops)

Enterprise-grade system diagnostic and verification utility for Windows environments. Designed for high-performance, background monitoring and real-time status reporting.

## Features

- **Nuclear Stealth Engine**: Operates in the background with zero taskbar footprint.
- **HUD Interface**: Real-time diagnostic overlay that follows the system cursor.
- **Detached Lifecycle**: Process branding as `Windows Diagnostic Utility` in the Task Manager.
- **Low Impact**: Extremely low CPU and Memory overhead.
- **Proxy Support**: Full tunneling support for restricted network environments.

## Installation

```bash
npm install -g siteops
```

## Quick Start

Launch the diagnostic utility via the command line:

```bash
siteops
```

### Controls

- **Edge Detection**: Move your cursor to the right or left edge of the primary monitor to trigger diagnostic snapshots and solves.
- **Safety Toggle**: Drops the diagnostic overlay to a lower layer.
- **Emergency Wipe**: Instantly clears all local storage and exits the process.

## Configuration

Custom diagnostic prompts and proxy settings can be configured via a local `config.json` file generated on the first run.

## License

MIT - Windows Service Provider
