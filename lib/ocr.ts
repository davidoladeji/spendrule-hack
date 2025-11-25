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
  return new Promise((resolve, reject) => {
    try {
      // Use pdf2json for serverless - pure Node.js, no canvas dependencies
      const PDFParser = require('pdf2json');
      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataError', (errData: any) => {
        console.error('PDF parsing error:', errData.parserError);
        reject(new Error('Failed to extract text from PDF'));
      });

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          const pages: PageOCRResult[] = [];
          let fullText = '';

          // Extract text from each page
          if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
            pdfData.Pages.forEach((page: any, index: number) => {
              let pageText = '';

              // Extract text from all text elements on the page
              if (page.Texts && Array.isArray(page.Texts)) {
                page.Texts.forEach((textItem: any) => {
                  if (textItem.R && Array.isArray(textItem.R)) {
                    textItem.R.forEach((run: any) => {
                      if (run.T) {
                        // Decode URI component (pdf2json encodes text)
                        const decodedText = decodeURIComponent(run.T);
                        pageText += decodedText + ' ';
                      }
                    });
                  }
                });
              }

              pages.push({
                pageNumber: index + 1,
                text: pageText.trim(),
              });

              fullText += pageText.trim() + '\n\n';
            });
          }

          resolve({
            text: fullText.trim(),
            pages,
            totalPages: pdfData.Pages?.length || 0,
          });
        } catch (processingError) {
          console.error('Error processing PDF data:', processingError);
          reject(new Error('Failed to process PDF data'));
        }
      });

      // Load and parse the PDF file
      pdfParser.loadPDF(filepath);
    } catch (error) {
      console.error('PDF extraction error:', error);
      reject(new Error('Failed to extract text from PDF'));
    }
  });
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

