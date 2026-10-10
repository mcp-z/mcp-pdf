import { createHash, randomBytes } from 'crypto';
import { lookup as dnsLookup, type LookupAddress } from 'dns';
import { existsSync } from 'fs';
import { mkdir, rename, writeFile } from 'fs/promises';
import type { IncomingMessage } from 'http';
import { get } from 'https';
import ipaddr from 'ipaddr.js';
import { isIP, type LookupFunction } from 'net';
import { homedir } from 'os';
import { extname, join } from 'path';
import type { Readable } from 'stream';

/** Machine-wide caches for files downloaded from URLs, shared by every project */
export const FONT_CACHE_DIR = join(homedir(), '.mcp-z', 'mcp-pdf', 'cache', 'fonts');
export const IMAGE_CACHE_DIR = join(homedir(), '.mcp-z', 'mcp-pdf', 'cache', 'images');

/** Largest file accepted from a URL */
export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

const MAX_REDIRECTS = 5;
const KEPT_EXTENSIONS = new Set(['.ttf', '.otf', '.ttc', '.woff', '.woff2', '.png', '.jpg', '.jpeg']);

/**
 * True for a public unicast address; false for loopback, private, link-local, shared, reserved, multicast and
 * unspecified ranges, including IPv4 addresses written as IPv6.
 */
export function isPublicAddress(address: string): boolean {
  return ipaddr.isValid(address) && ipaddr.process(address).range() === 'unicast';
}

/**
 * Reads a stream into memory, failing as soon as it exceeds `maxBytes`.
 */
export async function readWithLimit(stream: Readable, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > maxBytes) {
      stream.destroy();
      throw new Error(`File is larger than ${maxBytes} bytes`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Checked when the connection is made, so a host cannot pass validation and then resolve elsewhere.
const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, '', 0);
    const blocked = addresses.find((entry) => !isPublicAddress(entry.address));
    if (blocked) return callback(new Error(`${hostname} resolves to ${blocked.address}, which is not a public address`), '', 0);
    if (options.all) return (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, addresses);
    const [first] = addresses;
    if (!first) return callback(new Error(`${hostname} has no addresses`), '', 0);
    callback(null, first.address, first.family);
  });
};

function assertAllowed(url: URL): void {
  if (url.protocol !== 'https:') throw new Error(`URLs must use https: ${url.href}`);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) throw new Error(`${host} is not a public address`);
}

function request(url: URL): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    get(url, { lookup: publicLookup }, resolve).on('error', reject);
  });
}

async function fetchFile(url: string): Promise<Buffer> {
  let current = new URL(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertAllowed(current);
    const response = await request(current);
    const status = response.statusCode ?? 0;
    const location = response.headers.location;
    if (status >= 300 && status < 400 && location) {
      response.resume();
      current = new URL(location, current);
      continue;
    }
    if (status !== 200) {
      response.resume();
      throw new Error(`Download failed (HTTP ${status}): ${current.href}`);
    }
    if (Number(response.headers['content-length']) > MAX_DOWNLOAD_BYTES) {
      response.destroy();
      throw new Error(`File is larger than ${MAX_DOWNLOAD_BYTES} bytes: ${current.href}`);
    }
    return readWithLimit(response, MAX_DOWNLOAD_BYTES);
  }
  throw new Error(`Download redirected more than ${MAX_REDIRECTS} times: ${url}`);
}

/**
 * Downloads a file over https from a public host into `cacheDir` and returns its path. Files are keyed by a hash
 * of the URL, so each URL is downloaded once and different URLs never share a file.
 */
export async function downloadFile(url: string, cacheDir: string): Promise<string> {
  const parsed = new URL(url);
  assertAllowed(parsed);
  const extension = extname(parsed.pathname).toLowerCase();
  const path = join(cacheDir, createHash('sha256').update(url).digest('hex') + (KEPT_EXTENSIONS.has(extension) ? extension : ''));
  if (existsSync(path)) return path;

  const data = await fetchFile(url);
  await mkdir(cacheDir, { recursive: true });
  const staging = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(staging, data);
  await rename(staging, path);
  return path;
}
