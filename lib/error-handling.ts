import { prisma } from './db';

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxRetries) {
        const delay = config.retryDelay * Math.pow(config.backoffMultiplier, attempt);
        console.warn(
          `Retry attempt ${attempt + 1}/${config.maxRetries} for ${context || 'operation'} after ${delay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

export async function logError(
  error: Error,
  context: {
    userId?: string;
    documentId?: string;
    invoiceId?: string;
    contractId?: string;
    operation: string;
  }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tableName: 'error_log',
        recordId: 'error',
        action: 'ERROR',
        changedBy: context.userId || 'system',
        changeReason: `Error in ${context.operation}: ${error.message}`,
        newValues: {
          error: error.message,
          stack: error.stack,
          context,
        },
      },
    });
  } catch (logError) {
    console.error('Failed to log error:', logError);
  }
}

export async function handlePartialExtraction(
  documentId: string,
  extractedData: any,
  errors: string[]
): Promise<void> {
  // Mark document as partially extracted
  await prisma.documentMetadata.update({
    where: { documentId },
    data: {
      extractionCompleted: true, // Still mark as completed even if partial
    },
  });

  // Store extraction errors
  for (const error of errors) {
    await prisma.documentExtractionData.create({
      data: {
        documentId,
        entityType: 'extraction_error',
        fieldName: 'error',
        extractedValue: error,
        extractionMethod: 'error_log',
        requiresHumanReview: true,
      },
    });
  }
}

export async function handleValidationError(
  invoiceId: string,
  error: Error,
  userId: string
): Promise<void> {
  await logError(error, {
    userId,
    invoiceId,
    operation: 'invoice_validation',
  });

  // Update invoice status to indicate validation error
  await prisma.invoice.update({
    where: { invoiceId },
    data: {
      validationStatus: 'Error',
      updatedBy: userId,
    },
  });
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    public documentId: string,
    public partialData?: any
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

