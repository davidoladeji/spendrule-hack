import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth';

/**
 * DEPRECATED: This endpoint is deprecated. 
 * Please use /api/documents/upload with documentType='invoice' instead.
 * 
 * This endpoint only performed OCR and simple extraction, but did not complete
 * the full pipeline (normalization, validation, exception creation, approval workflow).
 * 
 * The /api/documents/upload endpoint provides the complete invoice processing pipeline:
 * - OCR → AI Extraction → Normalization → Validation → Exception Creation → Approval Workflow
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('invoices:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Return deprecation message
    return NextResponse.json(
      { 
        error: 'This endpoint is deprecated',
        message: 'Please use /api/documents/upload with documentType="invoice" instead. This endpoint provides the complete invoice processing pipeline including OCR, extraction, normalization, validation, exception creation, and approval workflow.',
        deprecated: true,
        migration: {
          oldEndpoint: '/api/invoices/upload',
          newEndpoint: '/api/documents/upload',
          requiredFields: {
            file: 'File to upload',
            documentType: 'Must be "invoice"',
          },
        },
      },
      { status: 410 } // 410 Gone - indicates resource is no longer available
    );
  } catch (error) {
    console.error('Deprecated endpoint error:', error);
    return NextResponse.json(
      { 
        error: 'This endpoint is deprecated',
        message: 'Please use /api/documents/upload with documentType="invoice" instead.',
      },
      { status: 410 }
    );
  }
}
