import fs from 'fs';
import path from 'path';

const logDir = 'audit/logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

export function logJsonl(file, data) {
  const entry = {
    ts: new Date().toISOString(),
    ...data
  };
  fs.appendFileSync(file, JSON.stringify(entry) + '\n');
}
