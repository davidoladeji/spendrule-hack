import { prisma } from './db';
import { Decimal } from '@prisma/client/runtime/library';
import {
  validatePrice,
  validateQuantity,
  validateUOM,
  validateDateRange,
  validateLocation,
  validateVendor,
  validateCurrency,
  ValidationContext,
  ValidationResult,
} from './validation-rules';

export interface ValidationSummary {
  overallStatus: 'Passed' | 'Failed' | 'Partial';
  totalExceptions: number;
  totalSavings: Decimal;
  contractMatched: boolean;
  vendorValidated: boolean;
  dateRangeValid: boolean;
  currencyMatch: boolean;
}

export async function runInvoiceValidation(
  invoiceId: string,
  userId: string
): Promise<string> {
  const { handleValidationError, logError } = await import('./error-handling');

  try {
    // Get invoice with all related data
    const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    include: {
      vendorParty: true,
      customerParty: true,
      contract: {
        include: {
          contractParties: {
            include: { party: true },
          },
          contractLocations: {
            include: { location: true },
          },
        },
      },
      invoiceLineItems: {
        include: {
          billableItem: {
            include: {
              pricingModel: {
                include: {
                  pricingTiers: true,
                },
              },
            },
          },
        },
      },
      sourceDocument: {
        include: {
          documentExtractions: true,
        },
      },
    },
  });

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    // Validate required fields
    if (!invoice.netServiceAmount) {
      throw new Error(`Invoice ${invoiceId} is missing netServiceAmount`);
    }

    if (!invoice.invoiceLineItems || invoice.invoiceLineItems.length === 0) {
      console.warn(`Invoice ${invoiceId} has no line items - validation will be limited`);
    }

  const contract = invoice.contract;
  const exceptions: any[] = [];
  let totalSavings = new Decimal(0);
  let contractMatched = !!contract;
  let vendorValidated = false;
  let dateRangeValid = false;
  let currencyMatch = false;

  // Invoice-level validations
  if (contract) {
    // Validate vendor
    const vendorResult = await validateVendor({
      invoice,
      contract,
      lineItem: null as any,
    });
    vendorValidated = vendorResult.passed;
    if (!vendorResult.passed) {
      exceptions.push({
        lineNumber: null,
        fieldName: 'vendor',
        exceptionType: 'Vendor Mismatch',
        exceptionCategory: 'Party Validation',
        severity: 'High',
        expectedValue: vendorResult.expectedValue,
        actualValue: vendorResult.actualValue,
        message: vendorResult.message,
        recommendation: 'Verify vendor matches contract',
      });
    }

    // Validate currency
    const currencyResult = await validateCurrency({
      invoice,
      contract,
      lineItem: null as any,
    });
    currencyMatch = currencyResult.passed;
    if (!currencyResult.passed) {
      exceptions.push({
        lineNumber: null,
        fieldName: 'currency',
        exceptionType: 'Currency Mismatch',
        exceptionCategory: 'Currency Validation',
        severity: 'High',
        expectedValue: currencyResult.expectedValue,
        actualValue: currencyResult.actualValue,
        message: currencyResult.message,
        recommendation: 'Verify currency matches contract',
      });
    }

    // Validate date range
    const dateResult = await validateDateRange({
      invoice,
      contract,
      lineItem: invoice,
    });
    dateRangeValid = dateResult.passed;
    if (!dateResult.passed) {
      exceptions.push({
        lineNumber: null,
        fieldName: 'servicePeriod',
        exceptionType: 'Date Range Invalid',
        exceptionCategory: 'Date Validation',
        severity: 'Medium',
        expectedValue: dateResult.expectedValue,
        actualValue: dateResult.actualValue,
        message: dateResult.message,
        recommendation: 'Verify service period is within contract dates',
      });
    }

    // Validate location
    const locationResult = await validateLocation({
      invoice,
      contract,
      lineItem: null as any,
    });
    if (!locationResult.passed) {
      exceptions.push({
        lineNumber: null,
        fieldName: 'location',
        exceptionType: 'Location Not Authorized',
        exceptionCategory: 'Location Validation',
        severity: 'High',
        message: locationResult.message,
        recommendation: 'Verify location is covered by contract',
      });
    }
  } else {
    exceptions.push({
      lineNumber: null,
      fieldName: 'contract',
      exceptionType: 'Contract Not Matched',
      exceptionCategory: 'Contract Matching',
      severity: 'High',
      message: 'No matching contract found for this invoice',
      recommendation: 'Manually match invoice to contract or create new contract',
    });
  }

  // Line item validations
  for (const lineItem of invoice.invoiceLineItems) {
    const billableItem = lineItem.billableItem;
    const context: ValidationContext = {
      invoice,
      contract,
      lineItem,
      billableItem: billableItem || undefined,
    };

    // Price validation
    if (billableItem) {
      const priceResult = await validatePrice(context);
      if (!priceResult.passed && priceResult.variance) {
        const varianceAmount = priceResult.variance.abs();
        totalSavings = totalSavings.plus(varianceAmount);

        // Find extraction IDs for citation
        const contractExtraction = invoice.sourceDocument?.documentExtractions.find(
          (e) => e.fieldName === 'contractPrice' || e.fieldName.includes('price')
        );
        const invoiceExtraction = invoice.sourceDocument?.documentExtractions.find(
          (e) => e.fieldName === 'unitPrice' || e.fieldName.includes('price')
        );

        exceptions.push({
          lineNumber: lineItem.lineNumber,
          fieldName: 'price',
          exceptionType: 'Price Variance',
          exceptionCategory: 'Pricing Validation',
          severity: varianceAmount.greaterThan(1000) ? 'High' : 'Medium',
          expectedValue: priceResult.expectedValue,
          actualValue: priceResult.actualValue,
          varianceAmount: varianceAmount,
          rootCause: 'Price exceeds allowed tolerance',
          message: priceResult.message,
          recommendation: 'Review pricing and request credit if applicable',
          contractExtractionId: contractExtraction?.extractionId,
          invoiceExtractionId: invoiceExtraction?.extractionId,
        });
      }
    } else {
      exceptions.push({
        lineNumber: lineItem.lineNumber,
        fieldName: 'billableItem',
        exceptionType: 'Item Not Matched',
        exceptionCategory: 'Item Matching',
        severity: 'Medium',
        message: `Line item "${lineItem.description}" could not be matched to a contract billable item`,
        recommendation: 'Manually match line item to contract item or add new item to contract',
      });
    }

    // Quantity validation
    const quantityResult = await validateQuantity(context);
    if (!quantityResult.passed) {
      exceptions.push({
        lineNumber: lineItem.lineNumber,
        fieldName: 'quantity',
        exceptionType: 'Invalid Quantity',
        exceptionCategory: 'Quantity Validation',
        severity: 'Low',
        actualValue: quantityResult.actualValue,
        message: quantityResult.message,
        recommendation: 'Verify quantity is correct',
      });
    }

    // UOM validation
    if (billableItem) {
      const uomResult = await validateUOM(context);
      if (!uomResult.passed) {
        exceptions.push({
          lineNumber: lineItem.lineNumber,
          fieldName: 'uom',
          exceptionType: 'UOM Mismatch',
          exceptionCategory: 'UOM Validation',
          severity: 'Medium',
          expectedValue: uomResult.expectedValue,
          actualValue: uomResult.actualValue,
          message: uomResult.message,
          recommendation: 'Verify unit of measure matches contract or apply conversion',
        });
      }
    }
  }

  // Calculate expected vs actual amounts
  // Convert Prisma Decimal to Decimal.js if needed
  const actualNetAmount = invoice.netServiceAmount instanceof Decimal 
    ? invoice.netServiceAmount 
    : new Decimal(invoice.netServiceAmount?.toString() || '0');

  const expectedNetAmount = contract
    ? invoice.invoiceLineItems.reduce((sum, line) => {
        if (line.billableItem?.contractPrice) {
          const contractPrice = line.billableItem.contractPrice instanceof Decimal
            ? line.billableItem.contractPrice
            : new Decimal(line.billableItem.contractPrice?.toString() || '0');
          const qty = line.normalizedQuantity 
            ? (line.normalizedQuantity instanceof Decimal ? line.normalizedQuantity : new Decimal(line.normalizedQuantity.toString()))
            : line.invoiceQuantity
            ? (line.invoiceQuantity instanceof Decimal ? line.invoiceQuantity : new Decimal(line.invoiceQuantity.toString()))
            : new Decimal(1);
          return sum.plus(contractPrice.times(qty));
        }
        return sum;
      }, new Decimal(0))
    : actualNetAmount;

  const varianceAmount = actualNetAmount.minus(expectedNetAmount);
  const potentialSavings = varianceAmount.greaterThan(0) ? varianceAmount : new Decimal(0);

  // Create validation record
  const validation = await prisma.invoiceValidation.create({
    data: {
      invoiceId,
      overallStatus: exceptions.length === 0 ? 'Passed' : 'Failed',
      contractMatched,
      vendorValidated,
      dateRangeValid,
      currencyMatch,
      expectedNetAmount,
      actualNetAmount,
      varianceAmount,
      potentialSavings: totalSavings.plus(potentialSavings),
      recommendedPaymentAmount: expectedNetAmount,
      validatedBy: userId,
      rulesAppliedCount: 7, // Number of validation rules
    },
  });

  // Create exception records
  for (const exceptionData of exceptions) {
    await prisma.validationException.create({
      data: {
        validationId: validation.validationId,
        ...exceptionData,
      },
    });
  }

  // Update invoice validation status
  await prisma.invoice.update({
    where: { invoiceId },
    data: {
      validationStatus: validation.overallStatus,
    },
  });

    // Auto-create approval requests for exceptions
    if (exceptions.length > 0) {
      const { autoCreateApprovalRequests } = await import('./approval-workflow');
      await autoCreateApprovalRequests(validation.validationId, userId);
    }

    return validation.validationId;
  } catch (error) {
    await handleValidationError(
      invoiceId,
      error instanceof Error ? error : new Error(String(error)),
      userId
    );
    throw error;
  }
}

