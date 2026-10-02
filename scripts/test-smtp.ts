import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

// Read .env.local manually
try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of envLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
} catch (e) {
  console.warn('Could not read .env.local', e);
}

async function verifySmtp() {
  console.log('Testing SMTP connection with credentials from environment variables...');
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  console.log(`Host: ${host || 'NOT SET'}, Port: ${port}, User: ${user || 'NOT SET'}, Pass: [${pass ? 'CONFIGURED' : 'MISSING'}]`);

  if (!host || !user || !pass) {
    console.log('[BLOCKED] SMTP_HOST, SMTP_USER, or SMTP_PASS is missing.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: user.trim(),
      pass: pass.replace(/\s+/g, ''),
    },
  });

  try {
    await transporter.verify();
    console.log('[PASS] SMTP server connection verified successfully! Credentials are active.');
  } catch (err: unknown) {
    console.log(`[FAIL / BLOCKED] SMTP verification failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

verifySmtp();
