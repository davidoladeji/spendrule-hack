import { prisma } from './db';
import { Decimal } from '@prisma/client/runtime/library';

interface ValidationPayload {
  validation_result?: {
    overall_status?: string;
    confidence_score?: number;
    processing_time_ms?: number;
    timestamp?: string;
    contract_compliance?: {
      contract_match?: {
        contract_id?: string;
        vendor_validated?: boolean;
        customer_validated?: boolean;
        date_range_valid?: boolean;
        currency_match?: boolean;
      };
      line_item_validation?: Array<{
        line_number: number;
        validation_approach?: string;
        billable_item_match?: {
          item_id?: string;
          item_name?: string;
          match_confidence?: number;
          match_method?: string;
        };
        pricing_validation?: {
          pricing_model_id?: string;
          pricing_model_type?: string;
          contract_price?: number;
          invoiced_price?: number;
          variance_amount?: number;
          variance_percentage?: number;
          price_within_tolerance?: boolean;
        };
      }>;
    };
    exceptions?: Array<{
      exception_type: string;
      category?: string;
      severity?: string;
      field_name?: string;
      expected_value?: string;
      actual_value?: string;
      financial_impact_amount?: number;
      root_cause?: string;
      message: string;
      recommendation?: string;
    }>;
    financial_summary?: {
      expected_net_amount?: number;
      actual_net_amount?: number;
      variance_amount?: number;
      potential_savings?: number;
      recommended_payment_amount?: number;
    };
    next_actions?: {
      primary_action?: string;
      required_approvers?: string[];
      deadline?: string;
      notes?: string;
    };
  };
  extraction_intelligence?: {
    processing_statistics?: any;
    pattern_recognition_results?: any;
    quality_flags?: any;
  };
}

interface ValidationRequest {
  request_id?: string;
  invoice_data?: {
    invoice_header?: {
      invoice_id: string;
    };
  };
  contract_context?: {
    primary_contract_id?: string;
  };
  validation_criteria?: any;
}

/**
 * Run validation on an invoice against its contract
 */
export async function validateInvoice(
  invoiceId: string,
  validationPayload?: ValidationPayload | any,
  validationRequest?: ValidationRequest | any
): Promise<string> {
  // Get invoice with line items
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    include: {
      invoiceLineItems: true,
      contract: {
        include: {
          billableItems: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  const validationResult = validationPayload?.validation_result;
  const contractCompliance = validationResult?.contract_compliance;
  const contractMatch = contractCompliance?.contract_match;
  const financialSummary = validationResult?.financial_summary || {};
  const intelligence = validationPayload?.extraction_intelligence;

  // Create intelligence summary
  const intelligenceSummary = {
    _validation_summary: validationPayload?._validation_summary,
    extraction_intelligence: intelligence,
    aggregation_validation: validationResult?.aggregation_validation,
  };

  // Create validation record
  const validation = await prisma.invoiceValidation.create({
    data: {
      invoiceId: invoice.invoiceId,
      requestId: validationRequest?.request_id,
      validationEngineVersion: '3.1',
      validationConfigUsed: validationRequest?.validation_criteria || {},
      overallStatus: validationResult?.overall_status || 'pending',
      confidenceScore: validationResult?.confidence_score
        ? new Decimal(validationResult.confidence_score)
        : null,
      contractMatched: contractMatch?.contract_id ? true : false,
      vendorValidated: contractMatch?.vendor_validated || false,
      dateRangeValid: contractMatch?.date_range_valid || false,
      currencyMatch: contractMatch?.currency_match || false,
      expectedNetAmount: financialSummary.expected_net_amount
        ? new Decimal(financialSummary.expected_net_amount)
        : null,
      actualNetAmount: new Decimal(financialSummary.actual_net_amount || invoice.netServiceAmount),
      varianceAmount: financialSummary.variance_amount
        ? new Decimal(financialSummary.variance_amount)
        : null,
      potentialSavings: financialSummary.potential_savings
        ? new Decimal(financialSummary.potential_savings)
        : null,
      recommendedPaymentAmount: financialSummary.recommended_payment_amount
        ? new Decimal(financialSummary.recommended_payment_amount)
        : null,
      processingTimeMs: validationResult?.processing_time_ms || null,
      validationMethod: 'llm_validation',
      autoApproved: validationResult?.next_actions?.primary_action === 'auto_approve_payment',
      approvalNotes: validationResult?.next_actions?.notes || null,
      validatedBy: 'llm_engine',
      intelligenceSummary,
    },
  });

  // Create line item matches and exceptions
  if (contractCompliance?.line_item_validation && invoice.contract) {
    for (const lineValidation of contractCompliance.line_item_validation) {
      const lineItem = invoice.invoiceLineItems.find(
        (li) => li.lineNumber === lineValidation.line_number
      );

      if (!lineItem) continue;

      const billableMatch = lineValidation.billable_item_match;
      const pricingValidation = lineValidation.pricing_validation;

      // Create line item match if billable item is matched
      if (billableMatch?.item_id && invoice.contract) {
        const billableItem = invoice.contract.billableItems.find(
          (bi) => bi.itemId === billableMatch.item_id
        );

        if (billableItem) {
          // Update line item with billable item reference
          await prisma.invoiceLineItem.update({
            where: { lineItemId: lineItem.lineItemId },
            data: {
              billableItemId: billableItem.itemId,
              expectedUnitPrice: pricingValidation?.contract_price
                ? new Decimal(pricingValidation.contract_price)
                : null,
              priceVariance: pricingValidation?.variance_amount
                ? new Decimal(pricingValidation.variance_amount)
                : null,
              withinTolerance: pricingValidation?.price_within_tolerance || false,
            },
          });

          // Create line item match record
          await prisma.lineItemMatch.create({
            data: {
              lineItemId: lineItem.lineItemId,
              billableItemId: billableItem.itemId,
              matchConfidence: billableMatch.match_confidence
                ? new Decimal(billableMatch.match_confidence)
                : new Decimal(0),
              matchMethod: billableMatch.match_method || 'description_match',
              matchScoreBreakdown: {},
              priceValid: pricingValidation?.price_within_tolerance || false,
              quantityValid: true, // Would be computed from actual validation
              uomValid: true, // Would be computed from actual validation
              withinTolerance: pricingValidation?.price_within_tolerance || false,
              matchedBy: 'llm_engine',
            },
          });
        }
      }
    }
  }

  // Create validation exceptions
  if (validationResult?.exceptions) {
    for (const exception of validationResult.exceptions) {
      // Find contract and invoice extraction IDs if available
      let contractExtractionId: string | null = null;
      let invoiceExtractionId: string | null = null;

      if (exception.field_name) {
        // Try to find extraction records for this field
        const contractExtraction = await prisma.documentExtractionData.findFirst({
          where: {
            contractId: invoice.contractId,
            fieldName: { contains: exception.field_name },
          },
        });
        if (contractExtraction) {
          contractExtractionId = contractExtraction.extractionId;
        }

        const invoiceExtraction = await prisma.documentExtractionData.findFirst({
          where: {
            invoiceId: invoice.invoiceId,
            fieldName: { contains: exception.field_name },
          },
        });
        if (invoiceExtraction) {
          invoiceExtractionId = invoiceExtraction.extractionId;
        }
      }

      await prisma.validationException.create({
        data: {
          validationId: validation.validationId,
          fieldName: exception.field_name,
          exceptionType: exception.exception_type,
          exceptionCategory: exception.category,
          severity: (exception.severity || 'Medium') as 'High' | 'Medium' | 'Low',
          expectedValue: exception.expected_value,
          actualValue: exception.actual_value,
          varianceAmount: exception.financial_impact_amount
            ? new Decimal(exception.financial_impact_amount)
            : null,
          rootCause: exception.root_cause,
          contractExtractionId,
          invoiceExtractionId,
          message: exception.message,
          recommendation: exception.recommendation,
          resolved: false,
        },
      });
    }
  }

  // Update invoice validation status
  await prisma.invoice.update({
    where: { invoiceId: invoice.invoiceId },
    data: {
      validationStatus: validation.overallStatus,
    },
  });

  // Create approval request if needed
  const nextAction = validationResult?.next_actions?.primary_action;
  if (nextAction && nextAction !== 'auto_approve_payment') {
    await createApprovalRequest(invoice.invoiceId, validation.validationId, validationResult);
  }

  return validation.validationId;
}

/**
 * Create an approval request for an invoice
 */
async function createApprovalRequest(
  invoiceId: string,
  validationId: string,
  validationResult?: ValidationPayload['validation_result']
): Promise<void> {
  // Find the first approval level (lowest)
  const firstLevel = await prisma.approvalLevel.findFirst({
    where: { isActive: true },
    orderBy: { approvalSequence: 'asc' },
  });

  if (!firstLevel) {
    console.warn('No approval levels configured, skipping approval request creation');
    return;
  }

  await prisma.invoiceApprovalRequest.create({
    data: {
      invoiceId,
      validationId,
      currentLevel: firstLevel.levelId,
      currentStatus: 'Pending',
      assignedToRole: firstLevel.requiresRole || 'AP Manager',
      assignedDate: new Date(),
      comments: validationResult?.next_actions?.notes || null,
      createdBy: 'llm_engine',
    },
  });
}

/**
 * Run validation without LLM payload (deterministic validation)
 */
export async function validateInvoiceDeterministic(invoiceId: string): Promise<string> {
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    include: {
      invoiceLineItems: {
        include: {
          billableItem: true,
        },
      },
      contract: {
        include: {
          billableItems: true,
        },
      },
      vendorParty: true,
      customerParty: true,
    },
  });

  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  // Basic validation checks
  const contractMatched = !!invoice.contractId;
  const vendorValidated = !!invoice.vendorPartyId;
  const dateRangeValid = invoice.contract
    ? invoice.invoiceDate >= invoice.contract.effectiveDate &&
      invoice.invoiceDate <= invoice.contract.expirationDate
    : false;
  const currencyMatch = invoice.contract
    ? invoice.currency === invoice.contract.currency
    : true;

  // Calculate expected amount from contract
  let expectedNetAmount = new Decimal(0);
  let actualNetAmount = invoice.netServiceAmount;
  const exceptions: any[] = [];

  if (invoice.contract && invoice.invoiceLineItems.length > 0) {
    for (const lineItem of invoice.invoiceLineItems) {
      if (lineItem.billableItem) {
        const expectedPrice = lineItem.billableItem.contractPrice || lineItem.billableItem.listPrice;
        const expectedAmount = expectedPrice.mul(
          lineItem.normalizedQuantity || lineItem.invoiceQuantity || new Decimal(1)
        );
        expectedNetAmount = expectedNetAmount.add(expectedAmount);

        // Check for price variance
        if (lineItem.invoiceUnitPrice && expectedPrice) {
          const variance = lineItem.invoiceUnitPrice.sub(expectedPrice);
          const variancePercent = variance.div(expectedPrice).mul(100);

          if (variancePercent.abs().greaterThan(5)) {
            // More than 5% variance
            exceptions.push({
              exception_type: 'price_variance',
              category: 'pricing',
              severity: variancePercent.abs().greaterThan(10) ? 'High' : 'Medium',
              field_name: 'unit_price',
              expected_value: expectedPrice.toString(),
              actual_value: lineItem.invoiceUnitPrice.toString(),
              financial_impact_amount: variance
                .mul(lineItem.normalizedQuantity || lineItem.invoiceQuantity || new Decimal(1))
                .toString(),
              message: `Price variance of ${variancePercent.toFixed(2)}% for line ${lineItem.lineNumber}`,
              recommendation: 'Review contract pricing terms',
            });
          }
        }
      }
    }
  } else {
    expectedNetAmount = actualNetAmount;
  }

  const varianceAmount = actualNetAmount.sub(expectedNetAmount);
  const overallStatus =
    exceptions.length === 0 && varianceAmount.abs().lessThan(new Decimal(1))
      ? 'approved'
      : exceptions.some((e) => e.severity === 'High')
      ? 'rejected'
      : 'pending_review';

  // Create validation record
  const validation = await prisma.invoiceValidation.create({
    data: {
      invoiceId: invoice.invoiceId,
      overallStatus,
      confidenceScore: new Decimal(0.85),
      contractMatched,
      vendorValidated,
      dateRangeValid,
      currencyMatch,
      expectedNetAmount,
      actualNetAmount,
      varianceAmount: varianceAmount.abs(),
      potentialSavings: varianceAmount.greaterThan(0) ? varianceAmount : new Decimal(0),
      recommendedPaymentAmount: actualNetAmount,
      validationMethod: 'deterministic',
      autoApproved: overallStatus === 'approved',
      validatedBy: 'validation_engine',
    },
  });

  // Create exceptions
  for (const exception of exceptions) {
    await prisma.validationException.create({
      data: {
        validationId: validation.validationId,
        fieldName: exception.field_name,
        exceptionType: exception.exception_type,
        exceptionCategory: exception.category,
        severity: exception.severity,
        expectedValue: exception.expected_value,
        actualValue: exception.actual_value,
        varianceAmount: exception.financial_impact_amount
          ? new Decimal(exception.financial_impact_amount)
          : null,
        message: exception.message,
        recommendation: exception.recommendation,
        resolved: false,
      },
    });
  }

  // Create approval request if needed
  if (overallStatus !== 'approved') {
    await createApprovalRequest(invoice.invoiceId, validation.validationId);
  }

  return validation.validationId;
}

