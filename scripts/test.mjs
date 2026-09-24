import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const compile = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.test.json'], { stdio: 'inherit' });
if (compile.status !== 0) process.exit(compile.status ?? 1);
const result = spawnSync(process.execPath, ['--test', 'work/tests/tests/bot.test.js'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
