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
    // Use require for externalized modules (pdf-parse v2.x API)
    const { PDFParse } = require('pdf-parse');
    const dataBuffer = readFileSync(filepath);

    // v2.x API uses class-based approach
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();

    // For now, we'll extract text per page
    // In a production system, you might use more sophisticated OCR
    // or AWS Textract for better accuracy with coordinates
    const pages: PageOCRResult[] = [];

    // pdf-parse v2 provides pages in result
    if (result.pages && Array.isArray(result.pages)) {
      result.pages.forEach((page: any, index: number) => {
        pages.push({
          pageNumber: index + 1,
          text: page.text || '',
        });
      });
    } else {
      // Fallback: split by form feed character
      const textPerPage = result.text.split(/\f/);
      const numPages = result.numPages || textPerPage.length;

      for (let i = 0; i < numPages; i++) {
        pages.push({
          pageNumber: i + 1,
          text: textPerPage[i] || '',
        });
      }
    }

    // Clean up parser resources
    await parser.destroy();

    return {
      text: result.text,
      pages,
      totalPages: result.numPages || pages.length,
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
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

