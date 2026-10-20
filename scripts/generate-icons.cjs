const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function createLpgIconPNG(size, isMaskable = false) {
  const width = size;
  const height = size;

  // CRC32 table
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const body = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crcBuf]);
  }

  // 2D pixel buffer (width x height x 4)
  const pixels = new Uint8Array(width * height * 4);

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    // Alpha blending
    const srcA = a / 255;
    const dstA = pixels[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA > 0) {
      pixels[idx] = Math.round((r * srcA + pixels[idx] * dstA * (1 - srcA)) / outA);
      pixels[idx + 1] = Math.round((g * srcA + pixels[idx + 1] * dstA * (1 - srcA)) / outA);
      pixels[idx + 2] = Math.round((b * srcA + pixels[idx + 2] * dstA * (1 - srcA)) / outA);
      pixels[idx + 3] = Math.round(outA * 255);
    }
  }

  function fillRect(x0, y0, w, h, r, g, b, a = 255) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(height, Math.ceil(y0 + h)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(width, Math.ceil(x0 + w)); x++) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }

  function fillCircle(cx, cy, radius, r, g, b, a = 255) {
    const r2 = radius * radius;
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(height - 1, Math.ceil(cy + radius)); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(width - 1, Math.ceil(cx + radius)); x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist2 = dx * dx + dy * dy;
        if (dist2 <= r2) {
          // Antialiasing edge
          const edge = Math.sqrt(dist2) - radius;
          const alpha = edge > -1 ? Math.max(0, Math.min(1, -edge)) * a : a;
          setPixel(x, y, r, g, b, alpha);
        }
      }
    }
  }

  // 1. Background
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Dark slate background: rgb(15, 23, 42) -> rgb(30, 41, 59)
      const grad = y / height;
      const r = Math.round(15 + grad * 15);
      const g = Math.round(23 + grad * 18);
      const b = Math.round(42 + grad * 17);
      
      // If not maskable, rounded squircle corners
      if (!isMaskable) {
        const cornerR = width * 0.22;
        let inside = true;
        if (x < cornerR && y < cornerR) {
          inside = ((x - cornerR) ** 2 + (y - cornerR) ** 2) <= cornerR ** 2;
        } else if (x > width - cornerR && y < cornerR) {
          inside = ((x - (width - cornerR)) ** 2 + (y - cornerR) ** 2) <= cornerR ** 2;
        } else if (x < cornerR && y > height - cornerR) {
          inside = ((x - cornerR) ** 2 + (y - (height - cornerR)) ** 2) <= cornerR ** 2;
        } else if (x > width - cornerR && y > height - cornerR) {
          inside = ((x - (width - cornerR)) ** 2 + (y - (height - cornerR)) ** 2) <= cornerR ** 2;
        }
        if (inside) {
          setPixel(x, y, r, g, b, 255);
        }
      } else {
        setPixel(x, y, r, g, b, 255);
      }
    }
  }

  // 2. Draw Cylinder Graphic scaled
  const scale = isMaskable ? (size / 512) * 0.72 : (size / 512) * 0.92;
  const cx = width / 2;
  const cy = height / 2;

  function toScreenX(vx) { return cx + (vx - 256) * scale; }
  function toScreenY(vy) { return cy + (vy - 256) * scale; }

  // Cylinder body dome top and bottom
  const cylLeft = toScreenX(176);
  const cylRight = toScreenX(336);
  const cylW = cylRight - cylLeft;
  const cylTop = toScreenY(175);
  const cylBottom = toScreenY(375);
  const cylH = cylBottom - cylTop;

  // Main Cylinder Body
  fillRect(cylLeft, cylTop, cylW, cylH, 234, 88, 12); // #ea580c

  // Cylinder Top & Bottom Domes
  fillCircle(cx, cylTop, cylW / 2, 249, 115, 22); // #f97316
  fillCircle(cx, cylBottom, cylW / 2, 194, 65, 12); // #c2410c

  // Welds
  fillRect(cylLeft, toScreenY(225), cylW, Math.max(2, 6 * scale), 154, 52, 18);
  fillRect(cylLeft, toScreenY(335), cylW, Math.max(2, 6 * scale), 154, 52, 18);

  // Top Collar
  const collarW = 100 * scale;
  const collarH = 34 * scale;
  fillRect(cx - collarW / 2, toScreenY(95), collarW, collarH, 154, 52, 18);
  fillRect(cx - (collarW * 0.6) / 2, toScreenY(103), collarW * 0.6, collarH * 0.5, 15, 23, 42);

  // Brass valve
  const valveW = 36 * scale;
  const valveH = 18 * scale;
  fillRect(cx - valveW / 2, toScreenY(130), valveW, valveH, 251, 191, 36);

  // Foot ring
  const footW = 130 * scale;
  const footH = 24 * scale;
  fillRect(cx - footW / 2, toScreenY(400), footW, footH, 154, 52, 18);

  // Flame in center
  fillCircle(cx, toScreenY(280), 28 * scale, 250, 204, 21);
  fillCircle(cx, toScreenY(275), 18 * scale, 255, 255, 255);

  // Verification Badge (bottom right)
  const badgeX = toScreenX(375);
  const badgeY = toScreenY(375);
  const badgeR = 48 * scale;
  fillCircle(badgeX, badgeY, badgeR, 16, 185, 129); // green
  fillCircle(badgeX, badgeY, badgeR * 0.85, 6, 95, 70);

  // Checkmark inside badge
  const ckStroke = Math.max(2, 6 * scale);
  for (let t = 0; t <= 1; t += 0.05) {
    const px1 = (badgeX - 18 * scale) * (1 - t) + (badgeX - 4 * scale) * t;
    const py1 = (badgeY) * (1 - t) + (badgeY + 14 * scale) * t;
    fillCircle(px1, py1, ckStroke, 255, 255, 255);

    const px2 = (badgeX - 4 * scale) * (1 - t) + (badgeX + 20 * scale) * t;
    const py2 = (badgeY + 14 * scale) * (1 - t) + (badgeY - 14 * scale) * t;
    fillCircle(px2, py2, ckStroke, 255, 255, 255);
  }

  // PNG Creation
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Raw image data with filter byte 0
  const scanlineWidth = 1 + width * 4;
  const raw = Buffer.alloc(scanlineWidth * height);
  for (let y = 0; y < height; y++) {
    raw[y * scanlineWidth] = 0; // Filter None
    const rowOffset = y * width * 4;
    for (let i = 0; i < width * 4; i++) {
      raw[y * scanlineWidth + 1 + i] = pixels[rowOffset + i];
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Ensure public dir exists
const pubDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(pubDir)) {
  fs.mkdirSync(pubDir, { recursive: true });
}

// Generate icons
const pwa192 = createLpgIconPNG(192, false);
fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), pwa192);

const pwa512 = createLpgIconPNG(512, false);
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), pwa512);

const pwaMaskable = createLpgIconPNG(512, true);
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), pwaMaskable);

const appleTouch = createLpgIconPNG(180, false);
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), appleTouch);

// Copy 192 for favicon.ico
fs.writeFileSync(path.join(pubDir, 'favicon.ico'), pwa192);

console.log('Successfully generated all PWA PNG icons in /public:');
console.log('- public/pwa-192x192.png (', pwa192.length, 'bytes)');
console.log('- public/pwa-512x512.png (', pwa512.length, 'bytes)');
console.log('- public/pwa-maskable-512x512.png (', pwaMaskable.length, 'bytes)');
console.log('- public/apple-touch-icon.png (', appleTouch.length, 'bytes)');
console.log('- public/favicon.ico (', pwa192.length, 'bytes)');
