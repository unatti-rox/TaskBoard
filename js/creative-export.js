/* Batch creative export: resize one master image into every required ad size, in the browser. */
(function () {
  const SIZES = [
    { name: "FB-1080x1920-reel", width: 1080, height: 1920 },
    { name: "FB-1080x1920-story", width: 1080, height: 1920 },
    { name: "FB-1200x628", width: 1200, height: 628 },
    { name: "FB-1200x1200", width: 1200, height: 1200 },
    { name: "GD-960x1200", width: 960, height: 1200 },
    { name: "GD-1200x628", width: 1200, height: 628 },
    { name: "GD-1200x1200", width: 1200, height: 1200 }
  ];

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that file as an image."));
      };
      img.src = url;
    });
  }

  /* Draws img into a targetW x targetH canvas, cropped (cover) or padded (contain) to fit. */
  function drawToCanvas(img, targetW, targetH, fit, background) {
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, targetW, targetH);

    const sw0 = img.naturalWidth, sh0 = img.naturalHeight;
    const targetRatio = targetW / targetH;
    const srcRatio = sw0 / sh0;

    if (fit === "contain") {
      const scale = Math.min(targetW / sw0, targetH / sh0);
      const dw = sw0 * scale, dh = sh0 * scale;
      ctx.drawImage(img, 0, 0, sw0, sh0, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);
    } else {
      let sx, sy, sw, sh;
      if (srcRatio > targetRatio) {
        sh = sh0; sw = sh * targetRatio; sx = (sw0 - sw) / 2; sy = 0;
      } else {
        sw = sw0; sh = sw / targetRatio; sx = 0; sy = (sh0 - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
    }
    return canvas;
  }

  function canvasToBlob(canvas, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error("Could not export image"));
      }, "image/jpeg", quality);
    });
  }

  /* Resizes `file` into every configured size. Returns [{ name, filename, width, height, blob, url }]. */
  async function run(file, opts) {
    const o = opts || {};
    const fit = o.fit === "contain" ? "contain" : "cover";
    const quality = o.quality || 0.9;
    const background = o.background || "#ffffff";
    const sizes = o.sizes || SIZES;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "creative";

    const img = await loadImage(file);
    try {
      const results = [];
      for (const size of sizes) {
        const canvas = drawToCanvas(img, size.width, size.height, fit, background);
        const blob = await canvasToBlob(canvas, quality);
        const filename = baseName + "_" + size.name + ".jpg";
        results.push({
          name: size.name,
          filename: filename,
          width: size.width,
          height: size.height,
          blob: blob,
          url: URL.createObjectURL(blob)
        });
      }
      return results;
    } finally {
      URL.revokeObjectURL(img.src);
    }
  }

  /* ---------------- ZIP (store method, no compression) ---------------- */

  let crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        crcTable[n] = c;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function buildZip(entries) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    const now = new Date();
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
    const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

    for (const entry of entries) {
      const nameBytes = encoder.encode(entry.name);
      const data = new Uint8Array(await entry.blob.arrayBuffer());
      const crc = crc32(data);
      const size = data.length;

      const local = new Uint8Array(30 + nameBytes.length);
      const ldv = new DataView(local.buffer);
      ldv.setUint32(0, 0x04034b50, true);
      ldv.setUint16(4, 20, true);
      ldv.setUint16(6, 0, true);
      ldv.setUint16(8, 0, true);
      ldv.setUint16(10, dosTime, true);
      ldv.setUint16(12, dosDate, true);
      ldv.setUint32(14, crc, true);
      ldv.setUint32(18, size, true);
      ldv.setUint32(22, size, true);
      ldv.setUint16(26, nameBytes.length, true);
      ldv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      localParts.push(local, data);

      const central = new Uint8Array(46 + nameBytes.length);
      const cdv = new DataView(central.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, dosTime, true);
      cdv.setUint16(14, dosDate, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, size, true);
      cdv.setUint32(24, size, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centralParts.push(central);

      offset += local.length + data.length;
    }

    const centralSize = centralParts.reduce(function (n, p) { return n + p.length; }, 0);
    const centralOffset = offset;

    const end = new Uint8Array(22);
    const edv = new DataView(end.buffer);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(8, entries.length, true);
    edv.setUint16(10, entries.length, true);
    edv.setUint32(12, centralSize, true);
    edv.setUint32(16, centralOffset, true);

    return new Blob(localParts.concat(centralParts, [end]), { type: "application/zip" });
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  window.COCreativeExport = { SIZES, run, buildZip, downloadBlob };
})();
