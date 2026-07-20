#!/usr/bin/env node
import { readFileSync } from 'fs';

const msgFile = process.argv[2];
if (!msgFile) process.exit(0);

const msg = readFileSync(msgFile, 'utf8').trim();
const lines = msg.split('\n');

let errors = [];

const subject = lines[0];

if (!msg || lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
  errors.push('Commit message is empty');
}

if (subject && subject.length > 72) {
  errors.push(`Subject exceeds 72 chars (${subject.length})`);
}

const allowedTypes = new Set([
  'build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf',
  'refactor', 'revert', 'style', 'test',
]);

if (subject) {
  const match = subject.match(/^([a-z][a-z0-9]*)(?:\(([a-z0-9-]+)\))?(!)?: ([a-z].*)$/);
  if (!match) {
    errors.push(`Subject is not a valid conventional commit: "${subject}"`);
  } else {
    const [, type] = match;
    if (!allowedTypes.has(type)) {
      errors.push(`Subject type "${type}" is not allowed (use ${[...allowedTypes].join('|')})`);
    }
  }
}

if (lines.length < 2 || lines.slice(1).every(l => l.trim() === '')) {
  errors.push('Commit message body is required (use bullet points with "- ")');
} else {
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (!line.startsWith('- ')) {
      errors.push(`Line ${i + 1} does not start with "- ": "${line}"`);
    }
  }
}

if (errors.length > 0) {
  console.error('Commit message policy violations:');
  for (const err of errors) console.error(`  ❌ ${err}`);
  process.exit(1);
}

console.log('✅ Commit message policy passed');
