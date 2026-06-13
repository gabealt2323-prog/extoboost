const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const cf = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';

function startTunnel(port, logFile) {
  const out = fs.openSync(logFile, 'w');
  const proc = spawn(cf, ['tunnel', '--url', `http://localhost:${port}`], {
    detached: true,
    stdio: ['ignore', out, out],
    windowsHide: true,
  });
  proc.unref();
  return proc.pid;
}

const backendPid = startTunnel(4000, path.join(process.env.TEMP, 'cf-be-node.log'));
const webPid = startTunnel(3000, path.join(process.env.TEMP, 'cf-we-node.log'));

console.log(`Backend tunnel PID: ${backendPid}`);
console.log(`Web tunnel PID: ${webPid}`);
console.log('Tunnels launched as detached processes');
