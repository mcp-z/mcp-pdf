#!/usr/bin/env node
const { access, mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const FONT_URL = 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf';
const FONT_PATH = join(__dirname, '..', '.fonts', 'NotoColorEmoji.ttf');

async function main() {
  try {
    await access(FONT_PATH);
    console.log('✅ Noto Color Emoji font already exists');
  } catch {
    console.log('📥 Downloading Noto Color Emoji font...');
    const response = await fetch(FONT_URL);
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    await mkdir(join(__dirname, '..', '.fonts'), { recursive: true });
    await writeFile(FONT_PATH, Buffer.from(buffer));
    console.log(`✅ Downloaded Noto Color Emoji font (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);
  }
}

main().catch((err) => {
  console.warn('⚠️  Failed to download emoji font:', err.message);
  console.warn('   Emoji rendering will not be available');
  console.warn('   You can manually download from:', FONT_URL);
});
