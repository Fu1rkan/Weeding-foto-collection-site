import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const targetUrl = 'https://sophia-und-marcel-wedding.web.app/';
const outputDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'print-assets');
const svgPath = resolve(outputDir, 'sophia-marcel-startseite-qr.svg');
const pngPath = resolve(outputDir, 'sophia-marcel-startseite-qr.png');

const version = 6;
const errorCorrectionLevel = 2; // H
const size = 21 + (version - 1) * 4;
const quietZone = 4;
const dataCodewords = 60;
const ecCodewordsPerBlock = 28;
const blockCount = 4;
const darkColor = '#4f342b';
const lightColor = '#ffffff';

function createEmptyMatrix() {
  return {
    modules: Array.from({ length: size }, () => Array(size).fill(false)),
    isFunction: Array.from({ length: size }, () => Array(size).fill(false)),
  };
}

function setFunctionModule(matrix, row, col, dark) {
  if (row < 0 || row >= size || col < 0 || col >= size) {
    return;
  }

  matrix.modules[row][col] = dark;
  matrix.isFunction[row][col] = true;
}

function drawFinderPattern(matrix, row, col) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const currentRow = row + dy;
      const currentCol = col + dx;

      if (currentRow < 0 || currentRow >= size || currentCol < 0 || currentCol >= size) {
        continue;
      }

      const isInPattern = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6;
      const isDark =
        isInPattern &&
        (dy === 0 ||
          dy === 6 ||
          dx === 0 ||
          dx === 6 ||
          (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4));

      setFunctionModule(matrix, currentRow, currentCol, isDark);
    }
  }
}

function drawAlignmentPattern(matrix, centerRow, centerCol) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(
        matrix,
        centerRow + dy,
        centerCol + dx,
        distance === 2 || distance === 0,
      );
    }
  }
}

function drawFunctionPatterns(matrix) {
  drawFinderPattern(matrix, 0, 0);
  drawFinderPattern(matrix, 0, size - 7);
  drawFinderPattern(matrix, size - 7, 0);
  drawAlignmentPattern(matrix, size - 7, size - 7);

  for (let i = 8; i < size - 8; i += 1) {
    const dark = i % 2 === 0;
    setFunctionModule(matrix, 6, i, dark);
    setFunctionModule(matrix, i, 6, dark);
  }

  drawFormatBits(matrix, 0);
}

function getFormatBits(mask) {
  let data = (errorCorrectionLevel << 3) | mask;
  let remainder = data << 10;

  for (let i = 14; i >= 10; i -= 1) {
    if (((remainder >>> i) & 1) !== 0) {
      remainder ^= 0x537 << (i - 10);
    }
  }

  return ((data << 10) | remainder) ^ 0x5412;
}

function bit(bits, index) {
  return ((bits >>> index) & 1) !== 0;
}

function drawFormatBits(matrix, mask) {
  const bits = getFormatBits(mask);

  for (let i = 0; i <= 5; i += 1) {
    setFunctionModule(matrix, 8, i, bit(bits, i));
  }

  setFunctionModule(matrix, 8, 7, bit(bits, 6));
  setFunctionModule(matrix, 8, 8, bit(bits, 7));
  setFunctionModule(matrix, 7, 8, bit(bits, 8));

  for (let i = 9; i < 15; i += 1) {
    setFunctionModule(matrix, 14 - i, 8, bit(bits, i));
  }

  for (let i = 0; i < 8; i += 1) {
    setFunctionModule(matrix, 8, size - 1 - i, bit(bits, i));
  }

  for (let i = 8; i < 15; i += 1) {
    setFunctionModule(matrix, size - 15 + i, 8, bit(bits, i));
  }

  setFunctionModule(matrix, size - 8, 8, true);
}

function appendBits(target, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) {
    target.push((value >>> i) & 1);
  }
}

function createDataCodewords(text) {
  const bytes = [...Buffer.from(text, 'utf8')];
  const bits = [];
  const capacity = dataCodewords * 8;

  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);

  for (const byte of bytes) {
    appendBits(bits, byte, 8);
  }

  appendBits(bits, 0, Math.min(4, capacity - bits.length));

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) {
      value = (value << 1) | bits[i + j];
    }
    codewords.push(value);
  }

  const padBytes = [0xec, 0x11];
  for (let i = 0; codewords.length < dataCodewords; i += 1) {
    codewords.push(padBytes[i % 2]);
  }

  if (codewords.length !== dataCodewords) {
    throw new Error('The QR payload does not fit into the selected QR version.');
  }

  return codewords;
}

function createGaloisTables() {
  const exp = Array(512).fill(0);
  const log = Array(256).fill(0);
  let value = 1;

  for (let i = 0; i < 255; i += 1) {
    exp[i] = value;
    log[value] = i;
    value <<= 1;
    if ((value & 0x100) !== 0) {
      value ^= 0x11d;
    }
  }

  for (let i = 255; i < exp.length; i += 1) {
    exp[i] = exp[i - 255];
  }

  return { exp, log };
}

const gf = createGaloisTables();

function multiply(a, b) {
  if (a === 0 || b === 0) {
    return 0;
  }

  return gf.exp[gf.log[a] + gf.log[b]];
}

function createGeneratorPolynomial(degree) {
  let result = [1];

  for (let i = 0; i < degree; i += 1) {
    const next = Array(result.length + 1).fill(0);
    const root = gf.exp[i];

    for (let j = 0; j < result.length; j += 1) {
      next[j] ^= multiply(result[j], 1);
      next[j + 1] ^= multiply(result[j], root);
    }

    result = next;
  }

  return result;
}

function createErrorCorrection(dataBlock) {
  const generator = createGeneratorPolynomial(ecCodewordsPerBlock);
  const message = [...dataBlock, ...Array(ecCodewordsPerBlock).fill(0)];

  for (let i = 0; i < dataBlock.length; i += 1) {
    const coefficient = message[i];

    if (coefficient === 0) {
      continue;
    }

    for (let j = 0; j < generator.length; j += 1) {
      message[i + j] ^= multiply(generator[j], coefficient);
    }
  }

  return message.slice(dataBlock.length);
}

function createFinalCodewords(data) {
  const dataBlocks = [];
  const ecBlocks = [];
  const blockSize = dataCodewords / blockCount;

  for (let i = 0; i < blockCount; i += 1) {
    const block = data.slice(i * blockSize, (i + 1) * blockSize);
    dataBlocks.push(block);
    ecBlocks.push(createErrorCorrection(block));
  }

  const result = [];

  for (let i = 0; i < blockSize; i += 1) {
    for (const block of dataBlocks) {
      result.push(block[i]);
    }
  }

  for (let i = 0; i < ecCodewordsPerBlock; i += 1) {
    for (const block of ecBlocks) {
      result.push(block[i]);
    }
  }

  return result;
}

function createDataBits(codewords) {
  const bits = [];

  for (const codeword of codewords) {
    appendBits(bits, codeword, 8);
  }

  return bits;
}

function placeDataBits(matrix, dataBits) {
  let bitIndex = 0;
  let upward = true;

  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) {
      rightCol -= 1;
    }

    for (let i = 0; i < size; i += 1) {
      const row = upward ? size - 1 - i : i;

      for (let colOffset = 0; colOffset < 2; colOffset += 1) {
        const col = rightCol - colOffset;

        if (matrix.isFunction[row][col]) {
          continue;
        }

        matrix.modules[row][col] = bitIndex < dataBits.length ? dataBits[bitIndex] === 1 : false;
        bitIndex += 1;
      }
    }

    upward = !upward;
  }

  if (bitIndex < dataBits.length) {
    throw new Error('Not all QR data bits were placed.');
  }
}

function shouldMask(mask, row, col) {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      throw new Error(`Unsupported QR mask: ${mask}`);
  }
}

function cloneMatrix(matrix) {
  return {
    modules: matrix.modules.map((row) => [...row]),
    isFunction: matrix.isFunction.map((row) => [...row]),
  };
}

function applyMask(matrix, mask) {
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!matrix.isFunction[row][col] && shouldMask(mask, row, col)) {
        matrix.modules[row][col] = !matrix.modules[row][col];
      }
    }
  }
}

function penaltyForRuns(modules) {
  let penalty = 0;

  for (let row = 0; row < size; row += 1) {
    let runColor = modules[row][0];
    let runLength = 1;

    for (let col = 1; col < size; col += 1) {
      if (modules[row][col] === runColor) {
        runLength += 1;
      } else {
        if (runLength >= 5) {
          penalty += runLength - 2;
        }
        runColor = modules[row][col];
        runLength = 1;
      }
    }

    if (runLength >= 5) {
      penalty += runLength - 2;
    }
  }

  for (let col = 0; col < size; col += 1) {
    let runColor = modules[0][col];
    let runLength = 1;

    for (let row = 1; row < size; row += 1) {
      if (modules[row][col] === runColor) {
        runLength += 1;
      } else {
        if (runLength >= 5) {
          penalty += runLength - 2;
        }
        runColor = modules[row][col];
        runLength = 1;
      }
    }

    if (runLength >= 5) {
      penalty += runLength - 2;
    }
  }

  return penalty;
}

function penaltyForBlocks(modules) {
  let penalty = 0;

  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const color = modules[row][col];

      if (
        modules[row][col + 1] === color &&
        modules[row + 1][col] === color &&
        modules[row + 1][col + 1] === color
      ) {
        penalty += 3;
      }
    }
  }

  return penalty;
}

function hasFinderLikePattern(sequence, index) {
  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  const inverse = pattern.map((value) => !value);
  const window = sequence.slice(index, index + pattern.length);

  return (
    window.every((value, i) => value === pattern[i]) ||
    window.every((value, i) => value === inverse[i])
  );
}

function penaltyForFinderLikePatterns(modules) {
  let penalty = 0;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col <= size - 11; col += 1) {
      if (hasFinderLikePattern(modules[row], col)) {
        penalty += 40;
      }
    }
  }

  for (let col = 0; col < size; col += 1) {
    const sequence = modules.map((row) => row[col]);

    for (let row = 0; row <= size - 11; row += 1) {
      if (hasFinderLikePattern(sequence, row)) {
        penalty += 40;
      }
    }
  }

  return penalty;
}

function penaltyForBalance(modules) {
  const total = size * size;
  const dark = modules.flat().filter(Boolean).length;
  const k = Math.floor(Math.abs(dark * 20 - total * 10) / total);

  return k * 10;
}

function calculatePenalty(matrix) {
  const { modules } = matrix;

  return (
    penaltyForRuns(modules) +
    penaltyForBlocks(modules) +
    penaltyForFinderLikePatterns(modules) +
    penaltyForBalance(modules)
  );
}

function createQrMatrix(text) {
  const baseMatrix = createEmptyMatrix();
  drawFunctionPatterns(baseMatrix);
  placeDataBits(baseMatrix, createDataBits(createFinalCodewords(createDataCodewords(text))));

  let bestMatrix = null;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = cloneMatrix(baseMatrix);
    applyMask(candidate, mask);
    drawFormatBits(candidate, mask);

    const penalty = calculatePenalty(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMatrix = candidate;
    }
  }

  return bestMatrix.modules;
}

function createSvg(modules) {
  const svgSize = size + quietZone * 2;
  const path = [];

  for (let row = 0; row < size; row += 1) {
    let col = 0;

    while (col < size) {
      if (!modules[row][col]) {
        col += 1;
        continue;
      }

      const start = col;
      while (col < size && modules[row][col]) {
        col += 1;
      }

      path.push(`M${start + quietZone} ${row + quietZone}h${col - start}v1h-${col - start}z`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="45mm" height="45mm" viewBox="0 0 ${svgSize} ${svgSize}" role="img" aria-labelledby="title desc" shape-rendering="crispEdges">
  <title id="title">QR-Code zur Startseite von Sophia und Marcel</title>
  <desc id="desc">${targetUrl}</desc>
  <rect width="${svgSize}" height="${svgSize}" fill="${lightColor}"/>
  <path fill="${darkColor}" d="${path.join('')}"/>
</svg>
`;
}

function createCrc32Table() {
  const table = new Uint32Array(256);

  for (let i = 0; i < table.length; i += 1) {
    let value = i;

    for (let j = 0; j < 8; j += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[i] = value >>> 0;
  }

  return table;
}

const crc32Table = createCrc32Table();

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createPng(modules) {
  const moduleScale = 40;
  const pixelSize = (size + quietZone * 2) * moduleScale;
  const rowLength = 1 + pixelSize * 3;
  const raw = Buffer.alloc(rowLength * pixelSize);
  const dark = [0x4f, 0x34, 0x2b];
  const light = [0xff, 0xff, 0xff];

  for (let y = 0; y < pixelSize; y += 1) {
    const rowStart = y * rowLength;
    raw[rowStart] = 0;

    for (let x = 0; x < pixelSize; x += 1) {
      const qrRow = Math.floor(y / moduleScale) - quietZone;
      const qrCol = Math.floor(x / moduleScale) - quietZone;
      const isDark =
        qrRow >= 0 && qrRow < size && qrCol >= 0 && qrCol < size && modules[qrRow][qrCol];
      const color = isDark ? dark : light;
      const offset = rowStart + 1 + x * 3;

      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(pixelSize, 0);
  ihdr.writeUInt32BE(pixelSize, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(11811, 0);
  phys.writeUInt32BE(11811, 4);
  phys[8] = 1;

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('pHYs', phys),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(outputDir, { recursive: true });

const modules = createQrMatrix(targetUrl);
writeFileSync(svgPath, createSvg(modules), 'utf8');
writeFileSync(pngPath, createPng(modules));

console.log(`Created ${svgPath}`);
console.log(`Created ${pngPath}`);
