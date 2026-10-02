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

async function sendRealTestEmail() {
  console.log('Sending test email through configured SMTP provider...');
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log('[BLOCKED] SMTP_HOST, SMTP_USER, or SMTP_PASS is missing in environment variables.');
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

  const mailOptions = {
    from: `"Jainam Traders" <${user}>`,
    to: user, // send to the shop's own inbox
    subject: 'Jainam Traders — Production Email Delivery Verification',
    text: 'This is an actual automated verification email dispatched from the Jainam Traders retail application backend to verify real SMTP delivery to the inbox.',
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <h2 style="color: #d97706;">Jainam Traders — Production Email Verification</h2>
        <p>This email confirms that the production email provider connection is active and capable of sending customer OTPs, order updates, and password recovery emails.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Sender:</strong> ${user}</p>
        <p><strong>Status:</strong> Live SMTP Delivery Verified</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[PASS] Actual email delivered! Message ID: ${info.messageId}`);
    console.log(`Accepted by server: ${JSON.stringify(info.accepted)}`);
  } catch (err: unknown) {
    console.log(`[FAIL / BLOCKED] Email sending failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

sendRealTestEmail();
