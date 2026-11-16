import { existsSync, symlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import path from 'node:path';

const fixture = fileURLToPath(new URL('.', import.meta.url));
const modules = path.resolve(fixture, '../../starter/node_modules');
if (!existsSync(path.join(fixture, 'node_modules'))) symlinkSync(modules, path.join(fixture, 'node_modules'), 'dir');
const child = spawn(process.execPath, [path.join(modules, 'expo/bin/cli'), 'start', '--web', '--host', 'localhost', '--port', '4173'], { cwd: fixture, stdio: 'inherit', env: { ...process.env, CI: process.env.CI ?? '0' } });
child.on('exit', code => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
