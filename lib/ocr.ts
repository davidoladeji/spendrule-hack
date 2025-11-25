import { readFileSync } from 'fs';
import { join } from 'path';

export interface OCRResult {
  text: string;
  pages: PageOCRResult[];
  totalPages: number;
}

export interface PageOCRResult {
  pageNumber: number;
  text: string;
  boundingBoxes?: BoundingBox[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export async function extractTextFromPDF(filepath: string): Promise<OCRResult> {
  try {
    const dataBuffer = readFileSync(filepath);

    // Use pdfjs-dist for serverless environments (Vercel)
    // It works without native dependencies
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(dataBuffer),
      useSystemFonts: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.269/standard_fonts/',
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pages: PageOCRResult[] = [];
    let fullText = '';

    // Extract text from each page
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Combine text items into a single string
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      pages.push({
        pageNumber: i,
        text: pageText,
      });

      fullText += pageText + '\n\n';
    }

    return {
      text: fullText.trim(),
      pages,
      totalPages: numPages,
    };
  } catch (error) {
    console.error('PDF extraction error:', error);

    // Fallback to pdf-parse if pdfjs-dist fails (for development)
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      try {
        const pdfParse = require('pdf-parse');
        const dataBuffer = readFileSync(filepath);
        const result = await pdfParse(dataBuffer);

        const textPerPage = result.text.split(/\f/);
        const pages: PageOCRResult[] = textPerPage.map((text, index) => ({
          pageNumber: index + 1,
          text: text || '',
        }));

        return {
          text: result.text,
          pages,
          totalPages: result.numpages || pages.length,
        };
      } catch (fallbackError) {
        console.error('Fallback PDF extraction error:', fallbackError);
        throw new Error('Failed to extract text from PDF');
      }
    }

    throw new Error('Failed to extract text from PDF');
  }
}

export async function extractTextWithCoordinates(filepath: string): Promise<OCRResult> {
  // This is a placeholder for more advanced OCR with bounding boxes
  // In production, you would use:
  // - AWS Textract
  // - Google Cloud Vision API
  // - Tesseract.js with image preprocessing
  // - pdfjs-dist for more detailed text extraction with positions

  const basicResult = await extractTextFromPDF(filepath);

  // Add placeholder bounding boxes (would be populated by actual OCR service)
  const resultWithBoxes: OCRResult = {
    ...basicResult,
    pages: basicResult.pages.map((page) => ({
      ...page,
      boundingBoxes: [], // Would be populated by OCR service
    })),
  };

  return resultWithBoxes;
}

// AWS Textract integration (for future use)
export async function extractWithAWSTextract(filepath: string): Promise<OCRResult> {
  // Placeholder for AWS Textract integration
  // This would use the AWS SDK to call Textract
  throw new Error('AWS Textract integration not yet implemented');
}

