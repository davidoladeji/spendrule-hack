/**
 * Deterministic validation rules for extracted invoice data
 * These rules catch obviously wrong extractions before they enter the system
 */

export interface ExtractionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidencePenalty: number; // 0-1, reduces overall confidence
}

const INVALID_VENDOR_PATTERNS = [
  /^your\s+(previous|current|total|due|balance|account)/i,
  /^(the|a|an)\s+/i,
  /^(previous|current|total|due|balance|account|amount|invoice|bill)/i,
  /^(please|thank|dear|sir|madam)/i,
  /^(detach|send|payment|remit)/i,
  /^[0-9]+$/,
  /^[^a-z]{1,3}$/i, // Too short or all caps/special chars
];

const VALID_VENDOR_PATTERNS = [
  /(inc|llc|corp|ltd|llp|company|services|group|associates|enterprises)/i,
  /[a-z]{4,}/i, // At least 4 letters
];

const MIN_VENDOR_NAME_LENGTH = 3;
const MAX_VENDOR_NAME_LENGTH = 200;

const MIN_REASONABLE_AMOUNT = 0.01; // Reject amounts less than 1 cent
const MAX_REASONABLE_AMOUNT = 1000000000; // Reject amounts over 1 billion

const MIN_REASONABLE_YEAR = 2020;
const MAX_REASONABLE_YEAR = 2030;

/**
 * Validate extracted vendor name
 */
export function validateVendorName(vendorName: string | null | undefined): ExtractionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let confidencePenalty = 0;

  if (!vendorName || vendorName.trim() === '') {
    return {
      isValid: false,
      errors: ['Vendor name is required'],
      warnings: [],
      confidencePenalty: 1.0,
    };
  }

  const trimmed = vendorName.trim();

  // Check length
  if (trimmed.length < MIN_VENDOR_NAME_LENGTH) {
    errors.push(`Vendor name too short: "${trimmed}"`);
    confidencePenalty += 0.5;
  }

  if (trimmed.length > MAX_VENDOR_NAME_LENGTH) {
    errors.push(`Vendor name too long: ${trimmed.length} characters`);
    confidencePenalty += 0.3;
  }

  // Check for invalid patterns (common OCR false positives)
  for (const pattern of INVALID_VENDOR_PATTERNS) {
    if (pattern.test(trimmed)) {
      errors.push(`Vendor name matches invalid pattern: "${trimmed}"`);
      confidencePenalty += 0.8;
    }
  }

  // Check for valid patterns (company indicators)
  const hasValidPattern = VALID_VENDOR_PATTERNS.some(pattern => pattern.test(trimmed));
  if (!hasValidPattern && trimmed.length < 10) {
    warnings.push(`Vendor name may be incomplete: "${trimmed}"`);
    confidencePenalty += 0.2;
  }

  // Check for common words that shouldn't be vendor names
  const commonFalsePositives = [
    'previous', 'current', 'total', 'due', 'balance', 'account',
    'invoice', 'bill', 'statement', 'payment', 'remit', 'detach',
    'please', 'thank', 'dear', 'sir', 'madam', 'your', 'the', 'a', 'an',
  ];
  
  const lowerTrimmed = trimmed.toLowerCase();
  for (const falsePositive of commonFalsePositives) {
    if (lowerTrimmed === falsePositive || lowerTrimmed.startsWith(falsePositive + ' ')) {
      errors.push(`Vendor name is a common false positive: "${trimmed}"`);
      confidencePenalty += 0.9;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    confidencePenalty: Math.min(confidencePenalty, 1.0),
  };
}

/**
 * Validate extracted amount
 */
export function validateAmount(
  amount: number | null | undefined,
  fieldName: string = 'amount'
): ExtractionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let confidencePenalty = 0;

  if (amount === null || amount === undefined) {
    return {
      isValid: false,
      errors: [`${fieldName} is required`],
      warnings: [],
      confidencePenalty: 1.0,
    };
  }

  if (typeof amount !== 'number' || isNaN(amount)) {
    return {
      isValid: false,
      errors: [`${fieldName} is not a valid number: ${amount}`],
      warnings: [],
      confidencePenalty: 1.0,
    };
  }

  if (amount < MIN_REASONABLE_AMOUNT) {
    errors.push(`${fieldName} is too small: $${amount.toFixed(2)}`);
    confidencePenalty += 0.7;
  }

  if (amount > MAX_REASONABLE_AMOUNT) {
    errors.push(`${fieldName} is too large: $${amount.toFixed(2)}`);
    confidencePenalty += 0.7;
  }

  // Check for suspiciously round numbers that might be placeholders
  if (amount === 0) {
    warnings.push(`${fieldName} is zero`);
    confidencePenalty += 0.3;
  }

  // Check for amounts that look like they might be line item totals instead of invoice totals
  if (fieldName === 'total_amount' && amount < 10) {
    warnings.push(`Total amount seems very small: $${amount.toFixed(2)}`);
    confidencePenalty += 0.4;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    confidencePenalty: Math.min(confidencePenalty, 1.0),
  };
}

/**
 * Validate extracted date
 */
export function validateDate(
  dateString: string | null | undefined,
  fieldName: string = 'date'
): ExtractionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let confidencePenalty = 0;

  if (!dateString || dateString.trim() === '') {
    return {
      isValid: false,
      errors: [`${fieldName} is required`],
      warnings: [],
      confidencePenalty: 1.0,
    };
  }

  // Try to parse the date
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      errors: [`${fieldName} is not a valid date: ${dateString}`],
      warnings: [],
      confidencePenalty: 1.0,
    };
  }

  // Check year is reasonable
  const year = date.getFullYear();
  if (year < MIN_REASONABLE_YEAR || year > MAX_REASONABLE_YEAR) {
    errors.push(`${fieldName} year is out of reasonable range: ${year}`);
    confidencePenalty += 0.8;
  }

  // Check if date is in the future (more than 30 days)
  const now = new Date();
  const daysDiff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 30) {
    warnings.push(`${fieldName} is more than 30 days in the future: ${dateString}`);
    confidencePenalty += 0.3;
  }

  // Check if date is too far in the past (more than 5 years)
  if (daysDiff < -1825) {
    warnings.push(`${fieldName} is more than 5 years in the past: ${dateString}`);
    confidencePenalty += 0.2;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    confidencePenalty: Math.min(confidencePenalty, 1.0),
  };
}

/**
 * Validate invoice number
 */
export function validateInvoiceNumber(
  invoiceNumber: string | null | undefined
): ExtractionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let confidencePenalty = 0;

  if (!invoiceNumber || invoiceNumber.trim() === '') {
    return {
      isValid: false,
      errors: ['Invoice number is required'],
      warnings: [],
      confidencePenalty: 1.0,
    };
  }

  const trimmed = invoiceNumber.trim();

  // Check for common false positives
  const falsePositives = ['invoice', 'bill', 'statement', 'document', 'page'];
  const lowerTrimmed = trimmed.toLowerCase();
  if (falsePositives.some(fp => lowerTrimmed === fp)) {
    errors.push(`Invoice number is a common false positive: "${trimmed}"`);
    confidencePenalty += 0.9;
  }

  // Check length (too short might be wrong)
  if (trimmed.length < 3) {
    warnings.push(`Invoice number seems too short: "${trimmed}"`);
    confidencePenalty += 0.3;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    confidencePenalty: Math.min(confidencePenalty, 1.0),
  };
}

/**
 * Comprehensive validation of extracted invoice header
 */
export function validateInvoiceHeader(header: {
  vendor_party_id?: string | null;
  invoice_id?: string | null;
  invoice_date?: string | null;
  total_amount?: number | null;
  gross_amount?: number | null;
  net_amount?: number | null;
}): ExtractionValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  let totalConfidencePenalty = 0;

  // Validate vendor
  const vendorValidation = validateVendorName(header.vendor_party_id);
  allErrors.push(...vendorValidation.errors);
  allWarnings.push(...vendorValidation.warnings);
  totalConfidencePenalty += vendorValidation.confidencePenalty * 0.3; // Vendor is 30% weight

  // Validate invoice number
  const invoiceNumberValidation = validateInvoiceNumber(header.invoice_id);
  allErrors.push(...invoiceNumberValidation.errors);
  allWarnings.push(...invoiceNumberValidation.warnings);
  totalConfidencePenalty += invoiceNumberValidation.confidencePenalty * 0.2; // Invoice number is 20% weight

  // Validate date
  const dateValidation = validateDate(header.invoice_date, 'invoice_date');
  allErrors.push(...dateValidation.errors);
  allWarnings.push(...dateValidation.warnings);
  totalConfidencePenalty += dateValidation.confidencePenalty * 0.2; // Date is 20% weight

  // Validate amounts
  const totalAmountValidation = validateAmount(header.total_amount, 'total_amount');
  allErrors.push(...totalAmountValidation.errors);
  allWarnings.push(...totalAmountValidation.warnings);
  totalConfidencePenalty += totalAmountValidation.confidencePenalty * 0.3; // Total amount is 30% weight

  // Cross-validate amounts
  if (header.total_amount && header.gross_amount) {
    if (header.total_amount < header.gross_amount) {
      allWarnings.push('Total amount is less than gross amount - may be incorrect');
      totalConfidencePenalty += 0.2;
    }
  }

  if (header.total_amount && header.net_amount) {
    if (header.total_amount < header.net_amount) {
      allWarnings.push('Total amount is less than net amount - may be incorrect');
      totalConfidencePenalty += 0.2;
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    confidencePenalty: Math.min(totalConfidencePenalty, 1.0),
  };
}

