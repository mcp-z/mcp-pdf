import { downloadFile, IMAGE_CACHE_DIR } from './download.ts';

export type TransportType = 'stdio' | 'http';

export interface ImageSourceOptions {
  /** Cache for images downloaded from URLs (default: IMAGE_CACHE_DIR) */
  imageCacheDir?: string;
}

/**
 * Turns an image reference into a local file. A URL is downloaded (https, public hosts only). A local path is
 * only honored over stdio, where the caller is on the same machine; over http it would expose the server's files.
 */
export async function resolveImageSource(imagePath: string, transport: TransportType, options: ImageSourceOptions = {}): Promise<string> {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(imagePath)) return downloadFile(imagePath, options.imageCacheDir ?? IMAGE_CACHE_DIR);
  if (transport !== 'stdio') throw new Error(`Local image paths are only available when the server runs over stdio; pass an https URL instead: ${imagePath}`);
  return imagePath;
}

type ContentItem = { type: string; imagePath?: string; children?: ContentItem[] };

/**
 * Resolves every image in a content tree (including group children) to a local file before layout begins.
 */
export async function resolveContentImages<T extends ContentItem>(items: T[], transport: TransportType, options: ImageSourceOptions = {}): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      if (item.type === 'image' && item.imagePath) return { ...item, imagePath: await resolveImageSource(item.imagePath, transport, options) };
      if (item.children) return { ...item, children: await resolveContentImages(item.children, transport, options) };
      return item;
    })
  );
}
