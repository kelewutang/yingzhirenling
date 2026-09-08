import assert from 'node:assert/strict';
import { brotliDecompressSync } from 'node:zlib';

const knownTags = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT',
  'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
  'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'
];

export function readWoff2Tables(font) {
  assert.equal(font.subarray(0, 4).toString('ascii'), 'wOF2', 'PBZ Serif must be a WOFF2 asset');
  assert.equal(font.readUInt32BE(8), font.byteLength, 'PBZ Serif WOFF2 length header must match the shipped asset');
  const numTables = font.readUInt16BE(12);
  const totalCompressedSize = font.readUInt32BE(20);
  let cursor = 48;
  const tables = [];
  for (let index = 0; index < numTables; index += 1) {
    const flags = font[cursor++];
    const tagIndex = flags & 0x3f;
    const transformVersion = flags >> 6;
    const tag = tagIndex === 0x3f ? font.subarray(cursor, cursor += 4).toString('ascii') : knownTags[tagIndex];
    assert.ok(tag, `Unsupported WOFF2 known-table index: ${tagIndex}`);
    const originalLength = readUIntBase128(font, () => cursor++);
    const transformed = (tag === 'glyf' || tag === 'loca') ? transformVersion === 0 : transformVersion === 1;
    const transformedLength = transformed ? readUIntBase128(font, () => cursor++) : originalLength;
    tables.push({ tag, originalLength, transformedLength, transformVersion });
  }
  const compressedData = font.subarray(cursor, cursor + totalCompressedSize);
  assert.equal(compressedData.byteLength, totalCompressedSize, 'PBZ Serif WOFF2 compressed data is truncated');
  const decoded = brotliDecompressSync(compressedData);
  let offset = 0;
  for (const table of tables) {
    table.offset = offset;
    offset += table.transformedLength;
  }
  assert.ok(decoded.byteLength >= offset, 'PBZ Serif WOFF2 table data is truncated');
  return { decoded, tables };
}

export function getWoff2Table(font, tag) {
  const { decoded, tables } = readWoff2Tables(font);
  const table = tables.find((entry) => entry.tag === tag);
  assert.ok(table, `PBZ Serif WOFF2 is missing its ${tag} table`);
  assert.equal(table.transformedLength, table.originalLength, `PBZ Serif ${tag} table must not use an unsupported transform`);
  return decoded.subarray(table.offset, table.offset + table.originalLength);
}

export function getWoff2CmapCoverage(font) {
  const cmap = getWoff2Table(font, 'cmap');
  const recordCount = cmap.readUInt16BE(2);
  let preferredFormat12;
  let fallbackFormat12;
  let preferredFormat4;
  let fallbackFormat4;
  for (let index = 0; index < recordCount; index += 1) {
    const recordOffset = 4 + index * 8;
    const platformId = cmap.readUInt16BE(recordOffset);
    const encodingId = cmap.readUInt16BE(recordOffset + 2);
    const subtableOffset = cmap.readUInt32BE(recordOffset + 4);
    const format = cmap.readUInt16BE(subtableOffset);
    if (format === 12) {
      const candidate = readFormat12(cmap, subtableOffset);
      if (platformId === 3 && encodingId === 10) preferredFormat12 = candidate;
      fallbackFormat12 ||= candidate;
    } else if (format === 4) {
      const candidate = readFormat4(cmap, subtableOffset);
      if (platformId === 3 && encodingId === 1) preferredFormat4 = candidate;
      fallbackFormat4 ||= candidate;
    }
  }
  const groups = preferredFormat12 || fallbackFormat12;
  const format4 = preferredFormat4 || fallbackFormat4;
  assert.ok(groups || format4, 'PBZ Serif WOFF2 must contain a Unicode cmap');
  return {
    has(codePoint) {
      if (!groups && codePoint > 0xffff) return false;
      if (!groups) return format4.has(codePoint);
      let lower = 0;
      let upper = groups.length - 1;
      while (lower <= upper) {
        const middle = Math.floor((lower + upper) / 2);
        const group = groups[middle];
        if (codePoint < group.start) upper = middle - 1;
        else if (codePoint > group.end) lower = middle + 1;
        else return true;
      }
      return format4?.has(codePoint) || false;
    }
  };
}

export function getWoff2WeightRange(font) {
  const fvar = getWoff2Table(font, 'fvar');
  const axisOffset = fvar.readUInt16BE(4);
  const axisCount = fvar.readUInt16BE(8);
  const axisSize = fvar.readUInt16BE(10);
  for (let index = 0; index < axisCount; index += 1) {
    const offset = axisOffset + index * axisSize;
    if (fvar.subarray(offset, offset + 4).toString('ascii') !== 'wght') continue;
    return { min: readFixed(fvar, offset + 4), max: readFixed(fvar, offset + 12) };
  }
  throw new Error('PBZ Serif WOFF2 is missing its wght axis');
}

function readFormat12(cmap, offset) {
  const groupCount = cmap.readUInt32BE(offset + 12);
  const groups = [];
  for (let index = 0; index < groupCount; index += 1) {
    const groupOffset = offset + 16 + index * 12;
    groups.push({ start: cmap.readUInt32BE(groupOffset), end: cmap.readUInt32BE(groupOffset + 4) });
  }
  return groups;
}

function readFormat4(cmap, offset) {
  const segmentCount = cmap.readUInt16BE(offset + 6) / 2;
  const endCodeOffset = offset + 14;
  const startCodeOffset = endCodeOffset + segmentCount * 2 + 2;
  const idDeltaOffset = startCodeOffset + segmentCount * 2;
  const idRangeOffset = idDeltaOffset + segmentCount * 2;
  return {
    has(codePoint) {
      let lower = 0;
      let upper = segmentCount - 1;
      while (lower <= upper) {
        const middle = Math.floor((lower + upper) / 2);
        const end = cmap.readUInt16BE(endCodeOffset + middle * 2);
        if (codePoint > end) lower = middle + 1;
        else upper = middle - 1;
      }
      if (lower === segmentCount) return false;
      const start = cmap.readUInt16BE(startCodeOffset + lower * 2);
      if (codePoint < start) return false;
      const rangeOffsetPosition = idRangeOffset + lower * 2;
      const rangeOffset = cmap.readUInt16BE(rangeOffsetPosition);
      if (rangeOffset === 0) return ((codePoint + cmap.readInt16BE(idDeltaOffset + lower * 2)) & 0xffff) !== 0;
      const glyphOffset = rangeOffsetPosition + rangeOffset + (codePoint - start) * 2;
      if (glyphOffset + 2 > cmap.byteLength) return false;
      return cmap.readUInt16BE(glyphOffset) !== 0;
    }
  };
}

function readUIntBase128(buffer, advance) {
  let value = 0;
  for (let index = 0; index < 5; index += 1) {
    const byte = buffer[advance()];
    assert.notEqual(byte, undefined, 'PBZ Serif WOFF2 table directory is truncated');
    assert.ok(!(index === 0 && byte === 0x80), 'PBZ Serif WOFF2 has an invalid UIntBase128 value');
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return value >>> 0;
  }
  throw new Error('PBZ Serif WOFF2 has an invalid UIntBase128 value');
}

function readFixed(buffer, offset) {
  return buffer.readInt32BE(offset) / 65536;
}
