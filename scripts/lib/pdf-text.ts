/**
 * PDF text extraction helpers.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

export const extractPdfText = (pdfPath: string): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexiconforge-pdf-'));
  const outputPath = path.join(tempDir, 'extracted.txt');

  try {
    const result = spawnSync(
      'pdftotext',
      ['-enc', 'UTF-8', '-nopgbrk', pdfPath, outputPath],
      { encoding: 'utf-8' }
    );

    if (result.status !== 0) {
      const stderr = result.stderr?.toString().trim();
      throw new Error(
        stderr && stderr.length > 0
          ? `pdftotext failed: ${stderr}`
          : 'pdftotext failed to extract the PDF text'
      );
    }

    return fs.readFileSync(outputPath, 'utf-8');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error('pdftotext is required but was not found on PATH');
    }
    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};
