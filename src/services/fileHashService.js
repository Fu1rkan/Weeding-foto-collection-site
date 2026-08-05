import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const HASH_CHUNK_SIZE = 4 * 1024 * 1024;

export async function calculateFileHash(file) {
  const hash = sha256.create();

  for (let offset = 0; offset < file.size; offset += HASH_CHUNK_SIZE) {
    const chunk = file.slice(offset, offset + HASH_CHUNK_SIZE);
    const chunkBuffer = await chunk.arrayBuffer();

    hash.update(new Uint8Array(chunkBuffer));
  }

  return bytesToHex(hash.digest());
}
