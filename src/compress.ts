import { Stats } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { optimize as svgo } from "svgo";
import { minify as htmlminifier } from 'html-minifier-terser';
import { minify as csso } from "csso";
import { formatBytes } from './utils.js';
import sharp from 'sharp';
import swc from '@swc/core';
import globalState, { Result } from './state.js';
import { globby } from 'globby';

const beginProgress = (): void => {
}

const printProgress = (): void => {
  const gain = globalState.summary.dataLenUncompressed-globalState.summary.dataLenCompressed;
  const msg = `${globalState.summary.nbFiles} files | ${formatBytes(globalState.summary.dataLenUncompressed)} → ${formatBytes(globalState.summary.dataLenCompressed)} | -${formatBytes(gain)} `;
  if (!process.stdout.clearLine || !process.stdout.cursorTo) {
    // In CI we don't have access to clearLine or cursorTo
    // Just don't log any progress
  }
  else {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(msg);
  }
}

const endProgress = (): void => {
  process.stdout.write('\n');
}

const processFile = async (file: string, stats: Stats): Promise<void> => {
  const result = {
    file,
    originalSize: stats.size,
    compressedSize: stats.size
  }

  let writeData: Buffer | string | undefined = undefined;

  try {
    const ext = path.extname(file);

    switch(ext) {
      case '.svg':
      case '.png':
      case '.jpg':
      case '.jpeg':
      case '.webp':
      case '.gif':
        const newImageData = await compressImageFile(file);
        if (newImageData && newImageData.length < result.originalSize) {
          writeData = newImageData;
        }
        break;
      case '.html':
        case '.htm':
          const htmldata = await fs.readFile(file);
          const newhtmlData = await htmlminifier(htmldata.toString(), { minifyCSS: true, minifyJS: true, sortClassName: true, sortAttributes: true});
          writeData = newhtmlData;
          break;
      case '.css':
        const cssdata = await fs.readFile(file);
        const newcssData = await csso(cssdata.toString()).css;
        if (newcssData) {
          writeData = newcssData;
        }
        break;
      case '.js':
        const jsdata = await fs.readFile(file);
        const newjsresult = await swc.minify(jsdata.toString(), { compress: true, mangle: true });
        if (newjsresult.code && newjsresult.code.length < jsdata.length) {
          writeData = newjsresult.code;
        }
        break;
    }
  }
  catch(e) {
    // console error for the moment
    console.error(`\n${file}`);
    console.error(e);
  }

  // Writedata
  if (writeData && writeData.length < result.originalSize) {
    result.compressedSize = writeData.length;
    
    if (!globalState.args.nowrite) {
      await fs.writeFile(file, writeData);
    }
  }

  globalState.addFile(result);

  printProgress();
}

export const compressImage = async (data: Buffer, resize: sharp.ResizeOptions ): Promise<Buffer | undefined> => {

  const sharpFile = await sharp(data, { animated: true });
  const meta = await sharpFile.metadata();

  switch(meta.format) {
    case 'svg':
      const newData = svgo(data, {});
      if (newData.error || newData.modernError) {
        console.log( `Error processing svg ${data}`);
        return undefined;
      }
      return Buffer.from(newData.data, 'utf8');
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'gif':
      return await sharpFile.resize( {...resize, withoutEnlargement: true} ).toBuffer();
  }

  return undefined;
}

const compressImageFile = async (file: string): Promise<Buffer | string | undefined> => {
  const buffer = await fs.readFile(file);
  return compressImage(buffer, {});
}

export async function compress(glob: string): Promise<void> {  
  beginProgress();
  
  const paths = await globby(glob, { cwd: globalState.dir, absolute: true });

  // "Parallel" processing
  await Promise.all(paths.map(async file => {
    if (!globalState.compressedFiles.includes(file)) {
      await processFile(file, await fs.stat(file));
    }
  }));

  endProgress();
}
