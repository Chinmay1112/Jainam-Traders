const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');
const publicDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Copy public directory contents recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(publicDir, outDir);

// Create standalone index.html fallback for Capacitor / offline native shell
const shellHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
  <title>Jainam Traders - Gifts & Stationery</title>
  <meta name="theme-color" content="#B84A1C" />
  <link rel="manifest" href="manifest.json" />
  <link rel="icon" href="icons/icon-192x192.png" />
  <style>
    :root {
      --primary: #B84A1C;
      --bg: #FAF8F5;
      --card-bg: #FFFFFF;
      --text: #1C1917;
      --muted: #78716C;
      --border: #E7E5E4;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }
    header {
      background: #FFFFFF;
      border-bottom: 1px solid var(--border);
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-badge {
      width: 36px;
      height: 36px;
      background: var(--primary);
      color: white;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 16px;
      letter-spacing: -0.5px;
    }
    .logo-text h1 {
      font-size: 17px;
      font-weight: 700;
      line-height: 1.1;
      color: #1C1917;
    }
    .logo-text span {
      font-size: 10px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    main {
      flex: 1;
      padding: 20px 16px 80px 16px;
      max-width: 500px;
      margin: 0 auto;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #FEF3C7;
      color: #92400E;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 9999px;
      margin-bottom: 20px;
    }
    .offline-icon {
      width: 64px;
      height: 64px;
      background: #FEE2E2;
      color: #DC2626;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      font-size: 28px;
    }
    h2 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    p {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .action-button {
      display: inline-block;
      width: 100%;
      background: var(--primary);
      color: white;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 20px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(184, 74, 28, 0.25);
      margin-bottom: 12px;
    }
    .action-button:active {
      transform: scale(0.98);
    }
    .secondary-button {
      display: inline-block;
      width: 100%;
      background: #FFFFFF;
      color: var(--text);
      border: 1px solid var(--border);
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 20px;
      border-radius: 12px;
      cursor: pointer;
    }
    .shop-details {
      margin-top: 32px;
      padding: 16px;
      background: #FFFFFF;
      border-radius: 14px;
      border: 1px solid var(--border);
      text-align: left;
      width: 100%;
      font-size: 13px;
    }
    .shop-details strong {
      display: block;
      color: var(--text);
      font-size: 14px;
      margin-bottom: 4px;
    }
    .shop-details p {
      margin-bottom: 8px;
    }
    nav.bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #FFFFFF;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-around;
      padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
      z-index: 100;
    }
    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      color: var(--muted);
      font-size: 11px;
      text-decoration: none;
      font-weight: 500;
    }
    .nav-item.active {
      color: var(--primary);
    }
  </style>
</head>
<body>
  <header>
    <div class="logo-container">
      <div class="logo-badge">JT</div>
      <div class="logo-text">
        <h1>Jainam Traders</h1>
        <span>Physical Store &bull; Pickup</span>
      </div>
    </div>
  </header>

  <main>
    <div class="offline-icon">&#128246;</div>
    <h2>Connecting to Storefront</h2>
    <p>Please ensure you are connected to the internet to browse our live catalogue and manage reservations.</p>
    <button class="action-button" onclick="window.location.reload()">Retry Connection</button>
    <div class="shop-details">
      <strong>Jainam Traders Store</strong>
      <p>Reserve online &bull; Inspect and pay upon counter pickup</p>
      <p>Hours: 07:30 AM - 09:30 PM (Mon-Sat, Closed Sun)</p>
      <p style="color: var(--primary); font-weight: 600; margin-bottom: 0;">Payment: Pay at Shop (Cash / UPI) &bull; Pickup Only</p>
    </div>
  </main>

  <nav class="bottom-nav">
    <a href="/" class="nav-item active"><span>&#127968;</span><span>Home</span></a>
    <a href="/categories" class="nav-item"><span>&#128092;</span><span>Categories</span></a>
    <a href="/search" class="nav-item"><span>&#128269;</span><span>Search</span></a>
    <a href="/cart" class="nav-item"><span>&#128722;</span><span>Cart</span></a>
    <a href="/account" class="nav-item"><span>&#128100;</span><span>Account</span></a>
  </nav>

  <script>
    // If online, navigate directly to main application
    window.addEventListener('online', () => { window.location.reload(); });
    if (navigator.onLine && window.location.protocol.startsWith('http')) {
      // Running under live web origin
    }
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'index.html'), shellHtml);
console.log('Capacitor web assets and offline fallback prepared in out/');
