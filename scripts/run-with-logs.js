#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'dev';
const ts = new Date().toISOString().replace(/[:.]/g,'-');
const base = path.resolve(process.cwd(), 'logs');
fs.mkdirSync(base, { recursive: true });
fs.mkdirSync(path.join(base, 'vite'), { recursive: true });
fs.mkdirSync(path.join(base, 'npm'), { recursive: true });

const outFile = path.join(base, 'vite', `${mode}-${ts}.out.log`);
const errFile = path.join(base, 'vite', `${mode}-${ts}.err.log`);
const npmOut = path.join(base, 'npm', `${mode}-${ts}.out.log`);
const npmErr = path.join(base, 'npm', `${mode}-${ts}.err.log`);

const outFd = fs.openSync(outFile, 'a');
const errFd = fs.openSync(errFile, 'a');
const noutFd = fs.openSync(npmOut, 'a');
const nerrFd = fs.openSync(npmErr, 'a');

const cmd = mode === 'build' ? 'vite build' : (mode === 'preview' ? 'vite preview' : 'vite');
const child = spawn(cmd.split(' ')[0], cmd.split(' ').slice(1), { stdio: ['ignore', outFd, errFd], shell: true });

// Log wrapper process output too
process.stdout.write(`Started ${cmd} pid=${child.pid}\n`);
fs.writeSync(noutFd, `Started ${cmd} pid=${child.pid}\n`);

child.on('exit', (code, signal) => {
  const line = `Process exited code=${code} signal=${signal}\n`;
  process.stdout.write(line);
  fs.writeSync(noutFd, line);
  [outFd, errFd, noutFd, nerrFd].forEach(fd => { try { fs.closeSync(fd); } catch {} });
  process.exit(code || 0);
});
