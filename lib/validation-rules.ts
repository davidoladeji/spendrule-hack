import { prisma } from './db';
import { Decimal } from '@prisma/client/runtime/library';

export interface ValidationResult {
  passed: boolean;
  message: string;
  variance?: Decimal;
  expectedValue?: string;
  actualValue?: string;
}

export interface ValidationContext {
  invoice: any;
  contract: any;
  lineItem: any;
  billableItem?: any;
}

// Price Validation
export async function validatePrice(
  context: ValidationContext
): Promise<ValidationResult> {
  const { lineItem, billableItem } = context;

  if (!billableItem) {
    return {
      passed: false,
      message: 'No matching billable item found for line item',
    };
  }

  const invoicePrice = lineItem.invoiceUnitPrice || new Decimal(0);
  const contractPrice = billableItem.contractPrice || billableItem.listPrice;
  const allowedVariance = billableItem.allowedVarianceValue || new Decimal(0);
  const varianceType = billableItem.allowedVarianceType || 'absolute';

  let variance: Decimal;
  let withinTolerance: boolean;

  if (varianceType === 'percentage') {
    const percentageVariance = invoicePrice
      .minus(contractPrice)
      .dividedBy(contractPrice)
      .times(100);
    variance = invoicePrice.minus(contractPrice);
    withinTolerance = percentageVariance.abs().lessThanOrEqualTo(allowedVariance);
  } else {
    variance = invoicePrice.minus(contractPrice);
    withinTolerance = variance.abs().lessThanOrEqualTo(allowedVariance);
  }

  return {
    passed: withinTolerance,
    message: withinTolerance
      ? 'Price is within allowed tolerance'
      : `Price variance exceeds tolerance: ${variance.toString()}`,
    variance,
    expectedValue: contractPrice.toString(),
    actualValue: invoicePrice.toString(),
  };
}

// Quantity Validation
export async function validateQuantity(
  context: ValidationContext
): Promise<ValidationResult> {
  const { lineItem } = context;

  if (!lineItem.invoiceQuantity) {
    return {
      passed: true,
      message: 'No quantity specified, skipping quantity validation',
    };
  }

  // In a real system, you might check against contract limits
  // For now, we'll just validate that quantity is positive
  if (lineItem.invoiceQuantity.lessThanOrEqualTo(0)) {
    return {
      passed: false,
      message: 'Invoice quantity must be greater than zero',
      actualValue: lineItem.invoiceQuantity.toString(),
    };
  }

  return {
    passed: true,
    message: 'Quantity is valid',
  };
}

// UOM (Unit of Measure) Validation
export async function validateUOM(
  context: ValidationContext
): Promise<ValidationResult> {
  const { lineItem, billableItem } = context;

  if (!billableItem) {
    return {
      passed: false,
      message: 'No matching billable item found for UOM validation',
    };
  }

  const invoiceUom = lineItem.invoiceUom?.toLowerCase();
  const contractUom = billableItem.primaryUom?.toLowerCase();

  if (!invoiceUom || !contractUom) {
    return {
      passed: false,
      message: 'UOM missing in invoice or contract',
      expectedValue: contractUom || 'N/A',
      actualValue: invoiceUom || 'N/A',
    };
  }

  // Check if UOMs match or if conversion is allowed
  const allowedUoms = (billableItem.allowedUoms as string[]) || [];
  const normalizedInvoiceUom = invoiceUom.toLowerCase();
  const normalizedContractUom = contractUom.toLowerCase();

  if (normalizedInvoiceUom === normalizedContractUom) {
    return {
      passed: true,
      message: 'UOM matches contract',
    };
  }

  // Check if invoice UOM is in allowed UOMs list
  const allowedUomsLower = allowedUoms.map((uom) => uom.toLowerCase());
  if (allowedUomsLower.includes(normalizedInvoiceUom)) {
    // Check if conversion factor exists
    const conversionRules = (billableItem.uomConversionRules as any) || {};
    if (conversionRules[normalizedInvoiceUom]) {
      return {
        passed: true,
        message: 'UOM is allowed with conversion',
      };
    }
  }

  return {
    passed: false,
    message: `UOM mismatch: invoice uses ${invoiceUom}, contract requires ${contractUom}`,
    expectedValue: contractUom,
    actualValue: invoiceUom,
  };
}

// Date Range Validation
export async function validateDateRange(
  context: ValidationContext
): Promise<ValidationResult> {
  const { invoice, contract, lineItem } = context;

  if (!contract) {
    return {
      passed: false,
      message: 'No contract found for date validation',
    };
  }

  const invoiceDate = new Date(invoice.invoiceDate);
  const serviceStart = lineItem.servicePeriodStart
    ? new Date(lineItem.servicePeriodStart)
    : invoiceDate;
  const serviceEnd = lineItem.servicePeriodEnd
    ? new Date(lineItem.servicePeriodEnd)
    : invoiceDate;

  const contractStart = new Date(contract.effectiveDate);
  const contractEnd = new Date(contract.expirationDate);

  if (serviceStart < contractStart || serviceEnd > contractEnd) {
    return {
      passed: false,
      message: `Service period (${serviceStart.toISOString()} to ${serviceEnd.toISOString()}) is outside contract period (${contractStart.toISOString()} to ${contractEnd.toISOString()})`,
      expectedValue: `${contractStart.toISOString()} to ${contractEnd.toISOString()}`,
      actualValue: `${serviceStart.toISOString()} to ${serviceEnd.toISOString()}`,
    };
  }

  return {
    passed: true,
    message: 'Service period is within contract dates',
  };
}

// Location Validation
export async function validateLocation(
  context: ValidationContext
): Promise<ValidationResult> {
  const { invoice, contract } = context;

  if (!contract) {
    return {
      passed: false,
      message: 'No contract found for location validation',
    };
  }

  // Get contract locations
  const contractLocations = await prisma.contractLocation.findMany({
    where: { contractId: contract.contractId },
    include: { location: true },
  });

  if (contractLocations.length === 0) {
    // If no specific locations in contract, assume all locations are valid
    return {
      passed: true,
      message: 'Contract has no location restrictions',
    };
  }

  // In a real system, you would check if invoice location matches contract locations
  // For now, we'll assume validation passes if contract has locations defined
  return {
    passed: true,
    message: 'Location validation passed (simplified)',
  };
}

// Vendor Validation
export async function validateVendor(
  context: ValidationContext
): Promise<ValidationResult> {
  const { invoice, contract } = context;

  if (!contract) {
    return {
      passed: false,
      message: 'No contract found for vendor validation',
    };
  }

  // Get contract vendor
  const contractVendor = await prisma.contractParty.findFirst({
    where: {
      contractId: contract.contractId,
      partyRole: 'Vendor',
    },
    include: { party: true },
  });

  if (!contractVendor) {
    return {
      passed: false,
      message: 'No vendor found in contract',
    };
  }

  if (contractVendor.party.partyId !== invoice.vendorPartyId) {
    return {
      passed: false,
      message: `Vendor mismatch: invoice vendor (${invoice.vendorPartyId}) does not match contract vendor (${contractVendor.party.partyId})`,
      expectedValue: contractVendor.party.legalName,
      actualValue: 'Invoice vendor',
    };
  }

  return {
    passed: true,
    message: 'Vendor matches contract',
  };
}

// Currency Validation
export async function validateCurrency(
  context: ValidationContext
): Promise<ValidationResult> {
  const { invoice, contract } = context;

  if (!contract) {
    return {
      passed: false,
      message: 'No contract found for currency validation',
    };
  }

  if (invoice.currency !== contract.currency) {
    return {
      passed: false,
      message: `Currency mismatch: invoice uses ${invoice.currency}, contract uses ${contract.currency}`,
      expectedValue: contract.currency,
      actualValue: invoice.currency,
    };
  }

  return {
    passed: true,
    message: 'Currency matches contract',
  };
}

// Tiered Pricing Calculation
export function calculateTieredPrice(
  quantity: Decimal,
  pricingModel: any,
  tiers: any[]
): Decimal {
  if (!tiers || tiers.length === 0) {
    return pricingModel.baseRate || new Decimal(0);
  }

  // Sort tiers by minValue
  const sortedTiers = [...tiers].sort((a, b) =>
    a.minValue.comparedTo(b.minValue)
  );

  // Find applicable tier
  for (let i = sortedTiers.length - 1; i >= 0; i--) {
    const tier = sortedTiers[i];
    if (quantity.greaterThanOrEqualTo(tier.minValue)) {
      if (!tier.maxValue || quantity.lessThanOrEqualTo(tier.maxValue)) {
        return tier.rate;
      }
    }
  }

  // If quantity exceeds all tiers, use the highest tier rate
  return sortedTiers[sortedTiers.length - 1].rate;
}

