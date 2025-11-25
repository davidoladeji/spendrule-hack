import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './db';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Preprocess OCR text to improve extraction accuracy
 * Fixes common OCR errors and normalizes text
 */
function preprocessOCRText(text: string): string {
  let processed = text;
  
  // Fix common OCR errors in amounts
  // Replace "O" with "0" when in numeric contexts (but not in words)
  processed = processed.replace(/(\$|€|£|USD|EUR|GBP|Total|Amount|Subtotal|Tax|Due)[\s:]*([\d,]*)[Oo]([\d,]*\.?\d*)/g, '$1$20$3');
  processed = processed.replace(/([\d,]+)[Oo]([\d,]*\.?\d*)/g, '$10$2');
  
  // Fix "I" vs "1" in amounts (but be careful not to break words)
  processed = processed.replace(/(\$|€|£|USD|EUR|GBP|Total|Amount|Subtotal|Tax|Due)[\s:]*([\d,]*)[Il]([\d,]*\.?\d*)/g, '$1$21$3');
  
  // Fix "S" vs "5" in amounts
  processed = processed.replace(/(\$|€|£|USD|EUR|GBP|Total|Amount|Subtotal|Tax|Due)[\s:]*([\d,]*)[Ss]([\d,]*\.?\d*)/g, '$1$25$3');
  
  // Normalize whitespace
  processed = processed.replace(/\s+/g, ' ');
  
  // Fix common date OCR errors
  processed = processed.replace(/(\d{1,2})[Oo](\d{1,2})[Oo](\d{2,4})/g, '$10$20$3'); // OO → 00 in dates
  processed = processed.replace(/(\d{1,2})[Il](\d{1,2})[Il](\d{2,4})/g, '$11$21$3'); // II → 11 in dates
  
  return processed;
}

export interface ExtractionResult {
  success: boolean;
  data: any;
  confidence: number;
  errors?: string[];
  extractionMetadata?: {
    extractionVersion: string;
    processingTimestamp: string;
    overallConfidence: number;
    documentTypeDetected: string;
    totalPages: number;
  };
}

// ContractSphere v2.3.1 Schema for Contract Extraction
const contractSphereSchema = {
  type: 'object',
  properties: {
    _extraction_metadata: {
      type: 'object',
      properties: {
        extraction_version: { type: 'string' },
        processing_timestamp: { type: 'string' },
        overall_confidence: { type: 'number' },
        document_type_detected: { type: 'string' },
        total_pages: { type: 'number' },
      },
    },
    parties: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          party_id: { type: 'string' },
          party_type: { type: 'string' },
          legal_name: { type: 'string' },
          trading_name: { type: 'string' },
          tax_id: { type: 'string' },
          duns_number: { type: 'string' },
          npi_number: { type: 'string' },
          cage_code: { type: 'string' },
          external_ids: {
            type: 'object',
            properties: {
              erp_vendor_id: { type: 'string' },
              supplier_code: { type: 'string' },
              erp_customer_id: { type: 'string' },
              health_system_code: { type: 'string' },
            },
          },
          primary_contact_email: { type: 'string' },
          primary_contact_phone: { type: 'string' },
        },
        required: ['party_id', 'party_type', 'legal_name'],
      },
    },
    contracts: {
      type: 'object',
      properties: {
        contract_id: { type: 'string' },
        contract_title: { type: 'string' },
        contract_type: { type: 'string' },
        version: { type: 'string' },
        external_ids: {
          type: 'object',
          properties: {
            erp_contract_number: { type: 'string' },
          },
        },
        effective_date: { type: 'string' },
        expiration_date: { type: 'string' },
        governing_law: { type: 'string' },
        termination_clause: { type: 'string' },
        termination_rights: { type: 'string' },
        auto_renewal: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            renewal_period: { type: 'string' },
            notice_period: { type: 'string' },
          },
        },
        locations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              location_id: { type: 'string' },
              location_name: { type: 'string' },
              location_type: { type: 'string' },
              address: { type: 'string' },
            },
          },
        },
        contract_status: { type: 'string' },
        processing_status: { type: 'string' },
      },
      required: ['contract_id', 'contract_title', 'contract_type', 'effective_date', 'expiration_date'],
    },
    billable_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          item_name: { type: 'string' },
          external_ids: {
            type: 'object',
            properties: {
              vendor_sku: { type: 'string' },
              item_code: { type: 'string' },
            },
          },
          pricing_model_id: { type: 'string' },
          pricing_details: {
            type: 'object',
            properties: {
              list_price: { type: 'number' },
              unit_cost: { type: 'number' },
              contractual_price_floor: { type: 'number' },
              price_ceiling: { type: 'number' },
              rate_type: { type: 'string' },
              allowed_variance: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  value: { type: 'number' },
                },
              },
              line_item_code: { type: 'string' },
              currency: { type: 'string' },
              unit_of_measure: { type: 'string' },
            },
          },
        },
        required: ['item_id', 'item_name'],
      },
    },
    pricing_models: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          model_id: { type: 'string' },
          model_name: { type: 'string' },
          model_type: { type: 'string' },
          version: { type: 'string' },
        },
        required: ['model_id', 'model_name', 'model_type'],
      },
    },
    payment_terms: {
      type: 'object',
      properties: {
        payment_schedule: { type: 'string' },
        payment_method: { type: 'string' },
        net_days: { type: 'number' },
        currency: { type: 'string' },
      },
    },
    _validation_summary: {
      type: 'object',
      properties: {
        high_confidence_items: { type: 'number' },
        items_requiring_review: { type: 'number' },
        estimated_annual_value: { type: 'number' },
        critical_missing_fields: { type: 'array', items: { type: 'string' } },
        date_consistency_check: { type: 'boolean' },
        currency_consistency_check: { type: 'boolean' },
      },
    },
  },
  required: ['parties', 'contracts', 'billable_items'],
};

// SR Validation v1.1 Schema for Invoice Extraction
const validationSchema = {
  type: 'object',
  properties: {
    validation_request: {
      type: 'object',
      properties: {
        request_id: { type: 'string' },
        invoice_data: {
          type: 'object',
          properties: {
            invoice_header: {
              type: 'object',
              properties: {
                invoice_id: { type: 'string' },
                vendor_party_id: { type: 'string' },
                customer_party_id: { type: 'string' },
                invoice_date: { type: 'string' },
                total_amount: { type: 'number' },
                currency: { type: 'string' },
                service_period: {
                  type: 'object',
                  properties: {
                    start_date: { type: 'string' },
                    end_date: { type: 'string' },
                  },
                },
                billing_aggregation_level: { type: 'string' },
                aggregation_reference: { type: 'string' },
                external_ids: {
                  type: 'object',
                  properties: {
                    erp_invoice_id: { type: 'string' },
                    po_number: { type: 'string' },
                    external_voucher_id: { type: 'string' },
                    ap_unit: { type: 'string' },
                  },
                },
              },
              required: ['invoice_id', 'vendor_party_id', 'invoice_date', 'total_amount', 'currency'],
            },
            line_items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  line_number: { type: 'number' },
                  description: { type: 'string' },
                  quantity: { type: 'number' },
                  uom: { type: 'string' },
                  unit_price: { type: 'number' },
                  extended_amount: { type: 'number' },
                  aggregation_type: { type: 'string' },
                  aggregation_method: { type: 'string' },
                  aggregated_items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        billable_item_id: { type: 'string' },
                        item_name: { type: 'string' },
                        quantity: { type: 'number' },
                        allocated_amount: { type: 'number' },
                      },
                    },
                  },
                },
                required: ['line_number', 'description', 'extended_amount'],
              },
            },
          },
        },
        contract_context: {
          type: 'object',
          properties: {
            primary_contract_id: { type: 'string' },
          },
        },
        validation_criteria: {
          type: 'object',
          properties: {
            rate_tolerance: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                value: { type: 'number' },
              },
            },
            auto_approve_threshold: { type: 'number' },
            manual_review_threshold: { type: 'number' },
          },
        },
      },
    },
    validation_result: {
      type: 'object',
      properties: {
        overall_status: { type: 'string' },
        confidence_score: { type: 'number' },
        processing_time_ms: { type: 'number' },
        timestamp: { type: 'string' },
        contract_compliance: {
          type: 'object',
          properties: {
            contract_match: {
              type: 'object',
              properties: {
                contract_id: { type: 'string' },
                vendor_validated: { type: 'boolean' },
                customer_validated: { type: 'boolean' },
                date_range_valid: { type: 'boolean' },
                currency_match: { type: 'boolean' },
              },
            },
            line_item_validation: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  line_number: { type: 'number' },
                  validation_approach: { type: 'string' },
                  billable_item_match: {
                    type: 'object',
                    properties: {
                      item_id: { type: 'string' },
                      item_name: { type: 'string' },
                      match_confidence: { type: 'number' },
                      match_method: { type: 'string' },
                    },
                  },
                  pricing_validation: {
                    type: 'object',
                    properties: {
                      pricing_model_id: { type: 'string' },
                      pricing_model_type: { type: 'string' },
                      contract_price: { type: 'number' },
                      invoiced_price: { type: 'number' },
                      variance_amount: { type: 'number' },
                      variance_percentage: { type: 'number' },
                      price_within_tolerance: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        exceptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              exception_type: { type: 'string' },
              category: { type: 'string' },
              severity: { type: 'string' },
              field_name: { type: 'string' },
              expected_value: { type: 'string' },
              actual_value: { type: 'string' },
              financial_impact_amount: { type: 'number' },
              root_cause: { type: 'string' },
              message: { type: 'string' },
              recommendation: { type: 'string' },
            },
          },
        },
        financial_summary: {
          type: 'object',
          properties: {
            expected_net_amount: { type: 'number' },
            actual_net_amount: { type: 'number' },
            variance_amount: { type: 'number' },
            potential_savings: { type: 'number' },
            recommended_payment_amount: { type: 'number' },
          },
        },
        next_actions: {
          type: 'object',
          properties: {
            primary_action: { type: 'string' },
            required_approvers: { type: 'array', items: { type: 'string' } },
            deadline: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
    },
    extraction_intelligence: {
      type: 'object',
      properties: {
        processing_statistics: {
          type: 'object',
          properties: {
            total_items_detected: { type: 'number' },
            items_extracted: { type: 'number' },
            high_confidence_items: { type: 'number' },
            items_requiring_review: { type: 'number' },
            average_confidence: { type: 'number' },
          },
        },
        pattern_recognition_results: {
          type: 'object',
          properties: {
            identifiers_found: {
              type: 'object',
              properties: {
                ein: { type: 'number' },
                duns: { type: 'number' },
                vendor_ids: { type: 'number' },
                npi: { type: 'number' },
              },
            },
          },
        },
        quality_flags: {
          type: 'object',
          properties: {
            currency_inconsistency: { type: 'boolean' },
            date_logic_errors: { type: 'boolean' },
            missing_critical_pricing: { type: 'number' },
            unusual_terms_detected: { type: 'number' },
          },
        },
      },
    },
  },
  required: ['validation_request', 'validation_result'],
};

/**
 * Detects the document type from extracted text using AI
 * @param text - The OCR-extracted text from the document
 * @returns Object with detected type ('contract' | 'invoice' | 'other') and confidence score (0-1)
 */
export async function detectDocumentType(
  text: string
): Promise<{ type: 'contract' | 'invoice' | 'other'; confidence: number }> {
  const { retryWithBackoff } = await import('./error-handling');

  try {
    // Use a sample of the text for faster detection (first 10000 characters should be enough)
    const sampleText = text.substring(0, 10000);
    
    const prompt = `Analyze the following document text and determine if it is:
1. A CONTRACT - Contains terms, agreements, parties, effective dates, expiration dates, legal language, billable items, pricing terms
2. An INVOICE - Contains invoice number, invoice date, vendor information, line items, amounts, payment terms, billing information
3. OTHER - Neither a contract nor an invoice (e.g., purchase order, statement, report, letter, etc.)

Document Text:
${sampleText}

Return a JSON object with:
- "type": one of "contract", "invoice", or "other"
- "confidence": a number between 0 and 1 indicating how confident you are in the classification
- "reasoning": a brief explanation of why you classified it this way

Look for key indicators:
- Contracts: "contract", "agreement", "terms and conditions", "effective date", "expiration date", "parties", "billable items", "pricing model"
- Invoices: "invoice", "invoice number", "invoice date", "bill to", "ship to", "line items", "total amount", "payment due"
- Other: If it doesn't clearly fit either category, classify as "other"`;

    const response = await retryWithBackoff(
      async () => {
        return await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 500,
          temperature: 0.1,
          system: 'You are an expert at classifying business documents. Analyze the text and determine if it is a contract, invoice, or neither. Return only valid JSON with type, confidence, and reasoning fields.',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });
      },
      { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 },
      'document_type_detection'
    );

    const content = response.content[0];
    let jsonText = content.type === 'text' ? content.text : '{}';
    
    // Clean up the response in case Claude includes markdown code blocks
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(jsonText);
    
    // Validate and normalize the result
    const detectedType = result.type?.toLowerCase();
    let normalizedType: 'contract' | 'invoice' | 'other';
    
    if (detectedType === 'contract') {
      normalizedType = 'contract';
    } else if (detectedType === 'invoice') {
      normalizedType = 'invoice';
    } else {
      normalizedType = 'other';
    }
    
    // Ensure confidence is between 0 and 1
    const confidence = Math.max(0, Math.min(1, result.confidence || 0.5));
    
    return {
      type: normalizedType,
      confidence,
    };
  } catch (error) {
    console.error('Document type detection error:', error);
    // On error, default to 'other' with low confidence
    return {
      type: 'other',
      confidence: 0.1,
    };
  }
}

export async function extractContractData(
  text: string,
  documentId: string,
  totalPages: number = 1
): Promise<ExtractionResult> {
  const { retryWithBackoff, handlePartialExtraction, ExtractionError } = await import('./error-handling');

  try {
    const prompt = `Extract contract information from the following document text. Return a JSON object matching the ContractSphere v2.3.1 schema.

Document Text:
${text.substring(0, 15000)}

CRITICAL: You MUST extract these required fields:
1. contract_id: Extract contract number or ID from the document. If not found, generate a UUID
2. contract_title: Extract contract title or name. If not found, use "Contract" + contract number or date
3. effective_date: Extract effective/start date (format: YYYY-MM-DD). If not found, use today's date
4. expiration_date: Extract expiration/end date (format: YYYY-MM-DD). If not found, use effective_date + 1 year

Extract all contract details including:
- Parties (vendor, customer) with external IDs
- Contract details (title, type, dates, terms) - REQUIRED FIELDS ABOVE
- Billable items with pricing details
- Pricing models and tiers
- Payment terms
- Locations
- Legal terms and amendments

For each extracted field, note the page number where it was found. Generate UUIDs for party_id, contract_id, item_id, and model_id fields.

IMPORTANT: Always populate contract_id, contract_title, effective_date, and expiration_date even if you need to infer or generate them.

Return the full ContractSphere envelope structure.`;

    const response = await retryWithBackoff(
      async () => {
        return await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8000,
          temperature: 0.1,
          system: 'You are an expert at extracting structured data from contract documents. Return valid JSON matching the ContractSphere v2.3.1 schema. Include _extraction_metadata with confidence scores and page numbers for each field. Your response must be only valid JSON, no other text. IMPORTANT: Ensure all strings are properly escaped and all JSON syntax is valid. Do not include unterminated strings or unescaped quotes.',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });
      },
      { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 },
      'contract_extraction'
    );

    const content = response.content[0];
    let jsonText = content.type === 'text' ? content.text : '{}';
    
    // Clean up the response in case Claude includes markdown code blocks
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to find JSON object boundaries if response contains extra text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    // Attempt to parse JSON with error recovery
    let extractedData;
    try {
      extractedData = JSON.parse(jsonText);
    } catch (parseError) {
      // Try to fix unterminated strings and other common issues
      console.warn('Contract JSON parse failed, attempting to fix:', parseError);
      
      // Try to fix unterminated strings by finding and closing them
      let fixedJson = jsonText;
      
      // Count quotes to find unbalanced strings
      const quoteMatches = fixedJson.match(/"/g);
      if (quoteMatches && quoteMatches.length % 2 !== 0) {
        // Odd number of quotes - likely an unterminated string
        const lastQuoteIndex = fixedJson.lastIndexOf('"');
        if (lastQuoteIndex > 0) {
          // Check if it's escaped
          let escapeCount = 0;
          for (let i = lastQuoteIndex - 1; i >= 0 && fixedJson[i] === '\\'; i--) {
            escapeCount++;
          }
          // If not escaped (or escaped an even number of times), it's an opening quote
          if (escapeCount % 2 === 0) {
            // Try to find where the string should end
            const nextComma = fixedJson.indexOf(',', lastQuoteIndex);
            const nextBrace = fixedJson.indexOf('}', lastQuoteIndex);
            const nextBracket = fixedJson.indexOf(']', lastQuoteIndex);
            
            let insertPos = fixedJson.length;
            if (nextComma > 0) insertPos = Math.min(insertPos, nextComma);
            if (nextBrace > 0) insertPos = Math.min(insertPos, nextBrace);
            if (nextBracket > 0) insertPos = Math.min(insertPos, nextBracket);
            
            fixedJson = fixedJson.substring(0, insertPos) + '"' + fixedJson.substring(insertPos);
          }
        }
      }
      
      // Try parsing again
      try {
        extractedData = JSON.parse(fixedJson);
      } catch (secondError) {
        console.error('Contract JSON parsing failed after fix attempt:', secondError);
        // Create a minimal valid structure as fallback
        extractedData = {
          contracts: {},
          parties: [],
          billable_items: [],
          pricing_models: []
        };
      }
    }

    // Ensure contracts structure exists
    if (!extractedData.contracts) {
      extractedData.contracts = {};
    }

    const contractData = extractedData.contracts;

    // Extract metadata
    const metadata = extractedData._extraction_metadata || {
      extraction_version: '3.1',
      processing_timestamp: new Date().toISOString(),
      overall_confidence: 0.9,
      document_type_detected: 'contract',
      total_pages: totalPages,
    };

    // Add fallback logic for missing required fields
    const { randomUUID } = await import('crypto');
    const warnings: string[] = [];
    let needsFallback = false;

    // Fallback for contract_id
    if (!contractData.contract_id || contractData.contract_id.trim() === '') {
      // Try to use external_ids.erp_contract_number if available
      if (contractData.external_ids?.erp_contract_number && contractData.external_ids.erp_contract_number.trim() !== '') {
        contractData.contract_id = contractData.external_ids.erp_contract_number;
      } else {
        // Generate a UUID for contract_id
        contractData.contract_id = randomUUID();
        needsFallback = true;
        warnings.push('contract_id: Generated UUID fallback');
      }
    }

    // Fallback for contract_title
    if (!contractData.contract_title || contractData.contract_title.trim() === '') {
      // Try to infer from contract number or use a default
      const contractNumber = contractData.external_ids?.erp_contract_number || contractData.contract_id?.substring(0, 8) || 'CONTRACT';
      contractData.contract_title = `Contract ${contractNumber}`;
      needsFallback = true;
      warnings.push('contract_title: Generated fallback title');
    }

    // Fallback for effective_date
    if (!contractData.effective_date || contractData.effective_date.trim() === '') {
      // Use today's date as fallback
      const today = new Date();
      contractData.effective_date = today.toISOString().split('T')[0];
      needsFallback = true;
      warnings.push('effective_date: Used today\'s date as fallback');
    }

    // Fallback for expiration_date
    if (!contractData.expiration_date || contractData.expiration_date.trim() === '') {
      // Use effective_date + 1 year as fallback
      try {
        const effectiveDate = new Date(contractData.effective_date);
        const expirationDate = new Date(effectiveDate);
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        contractData.expiration_date = expirationDate.toISOString().split('T')[0];
      } catch {
        // If effective_date is invalid, use today + 1 year
        const today = new Date();
        today.setFullYear(today.getFullYear() + 1);
        contractData.expiration_date = today.toISOString().split('T')[0];
      }
      needsFallback = true;
      warnings.push('expiration_date: Generated fallback date (effective_date + 1 year)');
    }

    // Ensure contract_type exists
    if (!contractData.contract_type || contractData.contract_type.trim() === '') {
      contractData.contract_type = 'Service Agreement';
      warnings.push('contract_type: Used default value');
    }

    // Log warnings if fallbacks were used
    if (warnings.length > 0) {
      console.warn('Contract extraction used fallbacks:', warnings);
      await handlePartialExtraction(documentId, extractedData, warnings);
    }

    return {
      success: true,
      data: extractedData,
      confidence: needsFallback ? (metadata.overall_confidence || 0.7) : (metadata.overall_confidence || 0.9),
      errors: warnings.length > 0 ? warnings : undefined,
      extractionMetadata: metadata,
    };
  } catch (error) {
    console.error('Contract extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await handlePartialExtraction(documentId, {}, [errorMessage]);

    return {
      success: false,
      data: null,
      confidence: 0,
      errors: [errorMessage],
      extractionMetadata: {
        extractionVersion: '3.1',
        processingTimestamp: new Date().toISOString(),
        overallConfidence: 0,
        documentTypeDetected: 'contract',
        totalPages: totalPages,
      },
    };
  }
}

export async function extractInvoiceData(
  text: string,
  documentId: string,
  totalPages: number = 1
): Promise<ExtractionResult> {
  const { retryWithBackoff, handlePartialExtraction } = await import('./error-handling');

  try {
    // Preprocess text to improve OCR quality
    const preprocessedText = preprocessOCRText(text);
    
    const prompt = `Extract invoice information from the following document text. Return a JSON object matching the SR Validation v1.1 schema.

Document Text:
${preprocessedText.substring(0, 15000)}

CRITICAL EXTRACTION RULES:

1. INVOICE AMOUNTS (total_amount, gross_amount, net_amount, tax_amount):
   - Look for currency symbols ($, €, £, etc.) and amounts with commas/decimals
   - Common patterns: "$1,234.56", "Total: $5,000.00", "Amount Due: 1234.56", "Your Total Due: $3,996.24"
   - IMPORTANT: Look for "Total Due", "Total Account Balance Due", "Current Invoice Charges" sections
   - "Total Account Balance Due" = total_amount (includes previous balance + current charges)
   - "Current Invoice Charges" = net_amount or gross_amount for this invoice period
   - Be careful with OCR errors: "O" vs "0", "I" vs "1", "S" vs "5"
   - If you see ambiguous characters, prefer numeric interpretation (0, 1, 5 over O, I, S)
   - Always extract as a NUMBER (not string), remove currency symbols and commas
   - If multiple amounts found:
     * "Total Account Balance Due" or "Total Due" = total_amount
     * "Current Invoice Charges" = gross_amount or net_amount
   - Verify amounts make sense (total should be >= sum of line items)

2. VENDOR NAME (vendor_party_id):
   - Look for company names at the top of the document, near "From:", "Vendor:", "Bill From:", "Remit To:"
   - IMPORTANT: "Remit To" often contains the vendor/payment agent name (e.g., "WM CORPORATE SERVICES, INC. AS PAYMENT AGENT")
   - Extract the company name BEFORE "AS PAYMENT AGENT" or similar phrases
   - Common patterns: "Company Name Inc.", "ABC Corp", "XYZ LLC", "WM CORPORATE SERVICES, INC."
   - Be careful with OCR errors in company names
   - If text is garbled, try to reconstruct from context
   - Extract the FULL legal company name, not abbreviations
   - Look for company identifiers: Inc, LLC, Corp, Ltd, etc.
   - If multiple vendor names appear, prioritize "Remit To" or header section
   - For WM invoices: Look for "WM CORPORATE SERVICES" or "Waste Management" in Remit To section

3. INVOICE NUMBER (invoice_id):
   - Look for "Invoice #", "Invoice Number", "INV-", "Doc #"
   - May be alphanumeric: "INV-2024-001", "12345", "ABC-2024-001"
   - Extract exactly as shown, preserving format

4. INVOICE DATE (invoice_date):
   - Look for "Invoice Date", "Date:", "Issued:", "Billing Date"
   - Common formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
   - Convert to YYYY-MM-DD format
   - Be careful with OCR errors in dates (0 vs O, 1 vs I)

CRITICAL: You MUST extract these required fields:
1. invoice_id: Extract invoice number or ID from the document. If not found, use "INV-" + first 8 characters of a UUID
2. invoice_date: Extract the invoice date (format: YYYY-MM-DD). If not found, use today's date
3. vendor_party_id: Extract vendor name/identifier. If vendor name is found, use it as vendor_party_id (we'll match to party later)
4. total_amount: Extract total invoice amount (numeric value). If not found, sum all line item amounts

Extract all invoice details including:
- Invoice header (number, date, vendor, customer, amounts) - REQUIRED FIELDS ABOVE
- Line items (description, quantity, unit price, extended amount)
- External IDs (PO number, voucher ID, AP unit)
- Service period dates
- Aggregation details

For each extracted field, note the page number where it was found and your confidence level (0-1).

IMPORTANT: 
- Always populate invoice_id, invoice_date, vendor_party_id, and total_amount even if you need to infer or generate them
- For amounts: Double-check OCR errors (O→0, I→1, S→5) and ensure numeric values are correct
- For vendor names: Extract complete company names, be careful with OCR character errors
- Include extraction_intelligence with confidence scores for each field

Return the full validation payload structure with validation_request and validation_result.`;

    const response = await retryWithBackoff(
      async () => {
        return await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8000,
          temperature: 0.1,
          system: `You are an expert at extracting structured data from invoice documents with poor OCR quality. 

CRITICAL INSTRUCTIONS:
1. AMOUNTS: Be extremely careful with OCR errors. Common mistakes: "O" should be "0", "I" should be "1", "S" should be "5". Always verify amounts are numeric.
2. VENDOR NAMES: Extract complete company names. If OCR text is garbled, try to reconstruct from context and common company name patterns.
3. CONFIDENCE: Assign low confidence scores (<0.7) if OCR text quality is poor or ambiguous.
4. VALIDATION: Verify extracted amounts make logical sense (total >= line items, positive numbers, reasonable currency values).

Return valid JSON matching the SR Validation v1.1 schema. Include extraction_intelligence with confidence scores and page numbers for each field. Your response must be only valid JSON, no other text. IMPORTANT: Ensure all strings are properly escaped and all JSON syntax is valid. Do not include unterminated strings or unescaped quotes.`,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });
      },
      { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 },
      'invoice_extraction'
    );

    const content = response.content[0];
    let jsonText = content.type === 'text' ? content.text : '{}';
    
    // Clean up the response in case Claude includes markdown code blocks
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to find JSON object boundaries if response contains extra text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    // Attempt to fix common JSON issues
    let extractedData;
    try {
      extractedData = JSON.parse(jsonText);
    } catch (parseError) {
      // Try to fix unterminated strings and other common issues
      console.warn('Initial JSON parse failed, attempting to fix:', parseError);
      
      // Try to fix unterminated strings by finding and closing them
      let fixedJson = jsonText;
      
      // Count quotes to find unbalanced strings
      const quoteMatches = fixedJson.match(/"/g);
      if (quoteMatches && quoteMatches.length % 2 !== 0) {
        // Odd number of quotes - likely an unterminated string
        // Try to find the last unescaped quote and close the string
        const lastQuoteIndex = fixedJson.lastIndexOf('"');
        if (lastQuoteIndex > 0) {
          // Check if it's escaped
          let escapeCount = 0;
          for (let i = lastQuoteIndex - 1; i >= 0 && fixedJson[i] === '\\'; i--) {
            escapeCount++;
          }
          // If not escaped (or escaped an even number of times), it's an opening quote
          if (escapeCount % 2 === 0) {
            // Try to find where the string should end (before next comma, }, or end of text)
            const nextComma = fixedJson.indexOf(',', lastQuoteIndex);
            const nextBrace = fixedJson.indexOf('}', lastQuoteIndex);
            const nextBracket = fixedJson.indexOf(']', lastQuoteIndex);
            
            let insertPos = fixedJson.length;
            if (nextComma > 0) insertPos = Math.min(insertPos, nextComma);
            if (nextBrace > 0) insertPos = Math.min(insertPos, nextBrace);
            if (nextBracket > 0) insertPos = Math.min(insertPos, nextBracket);
            
            fixedJson = fixedJson.substring(0, insertPos) + '"' + fixedJson.substring(insertPos);
          }
        }
      }
      
      // Try parsing again
      try {
        extractedData = JSON.parse(fixedJson);
      } catch (secondError) {
        // If still failing, try to extract just the structure we need
        console.error('JSON parsing failed after fix attempt:', secondError);
        console.error('JSON text length:', jsonText.length);
        console.error('JSON text preview:', jsonText.substring(0, 500));
        console.error('JSON text near error position:', jsonText.substring(Math.max(0, 20700), Math.min(jsonText.length, 20900)));
        
        // Create a minimal valid structure as fallback
        extractedData = {
          validation_request: {
            invoice_data: {
              invoice_header: {},
              line_items: []
            }
          },
          validation_result: {},
          extraction_intelligence: {}
        };
        
        // Try to extract what we can using regex
        const invoiceIdMatch = jsonText.match(/"invoice_id"\s*:\s*"([^"]*)"/);
        const invoiceDateMatch = jsonText.match(/"invoice_date"\s*:\s*"([^"]*)"/);
        const vendorMatch = jsonText.match(/"vendor_party_id"\s*:\s*"([^"]*)"/);
        const totalAmountMatch = jsonText.match(/"total_amount"\s*:\s*([0-9.]+)/);
        
        if (invoiceIdMatch) extractedData.validation_request.invoice_data.invoice_header.invoice_id = invoiceIdMatch[1];
        if (invoiceDateMatch) extractedData.validation_request.invoice_data.invoice_header.invoice_date = invoiceDateMatch[1];
        if (vendorMatch) extractedData.validation_request.invoice_data.invoice_header.vendor_party_id = vendorMatch[1];
        if (totalAmountMatch) extractedData.validation_request.invoice_data.invoice_header.total_amount = parseFloat(totalAmountMatch[1]);
      }
    }

    // Ensure validation_request structure exists
    if (!extractedData.validation_request) {
      extractedData.validation_request = {};
    }
    if (!extractedData.validation_request.invoice_data) {
      extractedData.validation_request.invoice_data = {};
    }
    if (!extractedData.validation_request.invoice_data.invoice_header) {
      extractedData.validation_request.invoice_data.invoice_header = {};
    }

    const header = extractedData.validation_request.invoice_data.invoice_header;
    const lineItems = extractedData.validation_request.invoice_data.line_items || [];

    // Import validation functions
    const { validateInvoiceHeader, validateVendorName, validateAmount, validateDate } = await import('./extraction-validation');

    // Add fallback logic for missing required fields
    const { randomUUID } = await import('crypto');
    const errors: string[] = [];
    let needsFallback = false;

    // Fallback for invoice_id
    if (!header.invoice_id || header.invoice_id.trim() === '') {
      // Try to use invoice_number if available
      if (header.invoice_number && header.invoice_number.trim() !== '') {
        header.invoice_id = header.invoice_number;
      } else {
        // Generate a UUID-based invoice ID
        const uuid = randomUUID();
        header.invoice_id = `INV-${uuid.substring(0, 8).toUpperCase()}`;
        needsFallback = true;
        errors.push('invoice_id: Generated fallback ID');
      }
    }

    // Fallback for invoice_date
    if (!header.invoice_date || header.invoice_date.trim() === '') {
      // Use today's date as fallback
      const today = new Date();
      header.invoice_date = today.toISOString().split('T')[0];
      needsFallback = true;
      errors.push('invoice_date: Used today\'s date as fallback');
    }

    // Fallback for vendor_party_id
    // First check if existing vendor_party_id is valid
    const vendorValidation = validateVendorName(header.vendor_party_id);
    if (!vendorValidation.isValid && header.vendor_party_id) {
      // Existing vendor name is invalid, clear it and try to extract a better one
      console.warn(`Invalid vendor name detected: "${header.vendor_party_id}" - Errors: ${vendorValidation.errors.join(', ')}`);
      header.vendor_party_id = '';
      errors.push(`vendor_party_id: Rejected invalid value, attempting re-extraction`);
    }

    if (!header.vendor_party_id || header.vendor_party_id.trim() === '') {
      // Try to extract vendor name from text or use a default
      // Look for common vendor name patterns (limit to reasonable length)
      // Improved vendor patterns - prioritize "Remit To" section
      const vendorPatterns = [
        /(?:remit\s+to|payment\s+agent)[\s:]+([A-Z][A-Za-z0-9\s&,.-]{1,100}?)(?:\s+AS\s+PAYMENT\s+AGENT|$)/i,
        /WM\s+(?:CORPORATE\s+SERVICES|CORPORATION|CORP)/i,
        /WASTE\s+MANAGEMENT/i,
        /(?:vendor|supplier|from|bill\s+from)[\s:]+([A-Z][A-Za-z0-9\s&,.-]{3,100})/i,
        /^([A-Z][A-Za-z0-9\s&,.-]{3,100})\s*(?:invoice|bill|statement)/i,
        /(?:company|inc|llc|ltd|corp)[\s:]+([A-Z][A-Za-z0-9\s&,.-]{3,100})/i,
      ];
      
      let vendorName = null;
      for (const pattern of vendorPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          vendorName = match[1].trim();
          // Limit to first line if it contains newlines
          if (vendorName.includes('\n')) {
            vendorName = vendorName.split('\n')[0].trim();
          }
          // Limit length
          if (vendorName.length > 200) {
            vendorName = vendorName.substring(0, 200);
          }
          if (vendorName.length > 0 && vendorName.length <= 200) {
            break;
          }
        }
      }
      
      if (vendorName && vendorName.length > 0 && vendorName.length <= 200) {
        // Validate the extracted vendor name before using it
        const extractedVendorValidation = validateVendorName(vendorName);
        if (extractedVendorValidation.isValid) {
          header.vendor_party_id = vendorName;
          needsFallback = true;
          errors.push('vendor_party_id: Extracted from document text');
        } else {
          // Extracted vendor name is invalid, try next pattern or use fallback
          console.warn(`Extracted vendor name failed validation: "${vendorName}" - ${extractedVendorValidation.errors.join(', ')}`);
          header.vendor_party_id = 'Unknown Vendor';
          needsFallback = true;
          errors.push(`vendor_party_id: Extracted value failed validation, using fallback`);
        }
      } else {
        header.vendor_party_id = 'Unknown Vendor';
        needsFallback = true;
        errors.push('vendor_party_id: Used default fallback');
      }
    } else {
      // Clean up existing vendor_party_id if it's too long (might be document text)
      let vendorId = header.vendor_party_id.trim();
      if (vendorId.length > 200) {
        // If it's very long, it's likely document text - extract first line
        const firstLine = vendorId.split('\n')[0].trim();
        vendorId = firstLine.length > 200 ? firstLine.substring(0, 200) : firstLine;
        if (vendorId.length === 0) {
          vendorId = 'Unknown Vendor';
        }
        header.vendor_party_id = vendorId;
        needsFallback = true;
        errors.push('vendor_party_id: Cleaned up (was too long)');
      }
    }

    // Validate existing total_amount if present
    if (header.total_amount) {
      const amountValidation = validateAmount(header.total_amount, 'total_amount');
      if (!amountValidation.isValid) {
        console.warn(`Invalid total_amount detected: ${header.total_amount} - ${amountValidation.errors.join(', ')}`);
        // Clear invalid amount to trigger re-extraction
        header.total_amount = 0;
        errors.push(`total_amount: Rejected invalid value, attempting re-extraction`);
      }
    }

    // Fallback for total_amount
    if (!header.total_amount || (typeof header.total_amount === 'number' && header.total_amount === 0)) {
      // Look for "Total Account Balance Due" or "Total Due" first (most accurate for WM invoices)
      const totalDueMatch = text.match(/(?:total\s+account\s+balance\s+due|your\s+total\s+due|total\s+due)[\s:]*\$?([\d,]+\.?\d*)/i);
      if (totalDueMatch && totalDueMatch[1]) {
        header.total_amount = parseFloat(totalDueMatch[1].replace(/,/g, ''));
        needsFallback = true;
        errors.push('total_amount: Extracted from "Total Due"');
      } else {
        // Try to sum line items
        let calculatedTotal = 0;
        if (lineItems && lineItems.length > 0) {
          calculatedTotal = lineItems.reduce((sum: number, item: any) => {
            const amount = item.extended_amount || item.unit_price * (item.quantity || 1) || 0;
            return sum + (typeof amount === 'number' ? amount : parseFloat(amount) || 0);
          }, 0);
        }
        
        if (calculatedTotal > 0) {
          header.total_amount = calculatedTotal;
          needsFallback = true;
          errors.push('total_amount: Calculated from line items');
        } else {
          // Try to extract from text
          const amountMatch = text.match(/(?:total|amount due|grand total)[\s:]*\$?([\d,]+\.?\d*)/i);
          if (amountMatch && amountMatch[1]) {
            header.total_amount = parseFloat(amountMatch[1].replace(/,/g, ''));
            needsFallback = true;
            errors.push('total_amount: Extracted from document text');
          } else {
            header.total_amount = 0;
            needsFallback = true;
            errors.push('total_amount: Set to 0 (no amount found)');
          }
        }
      }
    }
    
    // Also extract current invoice charges as net_amount if available
    if (!header.net_amount || header.net_amount === 0) {
      const currentChargesMatch = text.match(/(?:current\s+invoice\s+charges|current\s+charges)[\s:]*\$?([\d,]+\.?\d*)/i);
      if (currentChargesMatch && currentChargesMatch[1]) {
        const extractedNetAmount = parseFloat(currentChargesMatch[1].replace(/,/g, ''));
        // Validate the extracted amount
        const netAmountValidation = validateAmount(extractedNetAmount, 'net_amount');
        if (netAmountValidation.isValid) {
          header.net_amount = extractedNetAmount;
          // Also set gross_amount if not set
          if (!header.gross_amount || header.gross_amount === 0) {
            header.gross_amount = header.net_amount;
          }
        } else {
          console.warn(`Extracted net_amount failed validation: ${extractedNetAmount} - ${netAmountValidation.errors.join(', ')}`);
        }
      }
    }

    // Final validation check - validate all fields after fallbacks
    const finalValidation = validateInvoiceHeader({
      vendor_party_id: header.vendor_party_id,
      invoice_id: header.invoice_id,
      invoice_date: header.invoice_date,
      total_amount: header.total_amount,
      gross_amount: header.gross_amount,
      net_amount: header.net_amount,
    });

    // Extract metadata from validation_result or create default
    const extractedValidationResult = extractedData.validation_result || {};
    const intelligence = extractedData.extraction_intelligence || {};
    
    // Adjust confidence based on validation penalties
    let baseConfidence = needsFallback 
      ? Math.max(0.5, (extractedValidationResult.confidence_score || intelligence.processing_statistics?.average_confidence || 0.9) - 0.2)
      : extractedValidationResult.confidence_score || intelligence.processing_statistics?.average_confidence || 0.9;
    
    // Apply validation penalty
    const finalConfidence = Math.max(0, baseConfidence * (1 - finalValidation.confidencePenalty));
    
    const metadata = {
      extraction_version: '3.1',
      processing_timestamp: new Date().toISOString(),
      overall_confidence: finalConfidence,
      document_type_detected: 'invoice',
      total_pages: totalPages,
      requiresHumanReview: !finalValidation.isValid || finalValidation.confidencePenalty > 0.5,
      validationErrors: finalValidation.errors,
      validationWarnings: finalValidation.warnings,
    };

    // Log validation failures
    if (!finalValidation.isValid || finalValidation.confidencePenalty > 0.5) {
      console.warn(`Extraction validation failed for document ${documentId}:`, {
        errors: finalValidation.errors,
        warnings: finalValidation.warnings,
        confidencePenalty: finalValidation.confidencePenalty,
      });
      errors.push(`VALIDATION: ${finalValidation.errors.length} errors, ${finalValidation.warnings.length} warnings`);
      if (finalValidation.errors.length > 0) {
        errors.push(...finalValidation.errors.map(e => `  - ${e}`));
      }
    }

    // Log fallback usage if needed
    if (needsFallback) {
      console.warn(`Used fallbacks for missing fields in document ${documentId}:`, errors);
      await handlePartialExtraction(documentId, extractedData, errors);
    }

    // Return success, but mark for human review if validation failed
    return {
      success: true,
      data: extractedData,
      confidence: finalConfidence,
      errors: errors.length > 0 ? errors : undefined,
      warnings: needsFallback ? errors : undefined,
      extractionMetadata: {
        extractionVersion: metadata.extraction_version,
        processingTimestamp: metadata.processing_timestamp,
        overallConfidence: metadata.overall_confidence,
        documentTypeDetected: metadata.document_type_detected,
        totalPages: metadata.total_pages,
        requiresHumanReview: metadata.requiresHumanReview,
        validationErrors: metadata.validationErrors,
        validationWarnings: metadata.validationWarnings,
      },
    };
  } catch (error) {
    console.error('Invoice extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await handlePartialExtraction(documentId, {}, [errorMessage]);

    return {
      success: false,
      data: null,
      confidence: 0,
      errors: [errorMessage],
      extractionMetadata: {
        extractionVersion: '3.1',
        processingTimestamp: new Date().toISOString(),
        overallConfidence: 0,
        documentTypeDetected: 'invoice',
        totalPages: totalPages,
      },
    };
  }
}

// Simplified invoice extraction for upload modal
export interface SimpleInvoiceData {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  vendorName: string | null;
  grossAmount: number | null;
  netServiceAmount: number | null;
  taxAmount: number | null;
  currency: string;
}

export async function extractSimpleInvoiceData(
  text: string,
  documentId: string,
  totalPages: number = 1
): Promise<SimpleInvoiceData> {
  try {
    // Preprocess text to improve OCR quality
    const preprocessedText = preprocessOCRText(text);
    
    // Use Claude AI with a simplified prompt for invoice field extraction
    const prompt = `You are an expert at extracting key information from invoices with poor OCR quality.

CRITICAL: The document text may contain OCR errors. Be careful with:
- Amounts: "O" might be "0", "I" might be "1", "S" might be "5"
- Vendor names: May have character errors, try to reconstruct from context
- Dates: May have OCR errors in numbers

Extract the following fields from this document text (return null if not found):
- invoice_number: The invoice or document number
- invoice_date: The invoice or document date (format as YYYY-MM-DD)
- vendor_name: The vendor/seller/supplier company name (extract FULL company name)
- gross_amount: The total/gross amount (as NUMBER, remove currency symbols and commas)
- net_amount: The net/subtotal amount (before tax, as NUMBER)
- tax_amount: The tax amount (as NUMBER)
- currency: The currency code (default to USD if not found)

Document Text:
${preprocessedText.substring(0, 15000)}

Return ONLY a valid JSON object with these exact keys (use snake_case as shown):
{
  "invoice_number": "...",
  "invoice_date": "...",
  "vendor_name": "...",
  "gross_amount": 0.00,
  "net_amount": 0.00,
  "tax_amount": 0.00,
  "currency": "USD"
}`;

    const { retryWithBackoff } = await import('./error-handling');

    const response = await retryWithBackoff(
      async () => {
        return await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1000,
          temperature: 0,
          system: `You are a data extraction expert working with poor-quality OCR text. 

CRITICAL INSTRUCTIONS:
1. AMOUNTS: Fix OCR errors - "O"→"0", "I"→"1", "S"→"5" in numeric contexts. Always return numbers, not strings.
2. VENDOR NAMES: Extract complete company names. If OCR text is garbled, reconstruct from context.
3. VALIDATION: Verify amounts are positive numbers and make logical sense.

Extract invoice information and return ONLY valid JSON. Do not include any explanatory text, markdown formatting, or code blocks. Return only the raw JSON object.`,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });
      },
      { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 },
      'simple_invoice_extraction'
    );

    const content = response.content[0];
    let jsonText = content.type === 'text' ? content.text : '{}';

    // Clean up the response in case Claude includes markdown code blocks
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const extracted = JSON.parse(jsonText);

    // Transform to expected format
    return {
      invoiceNumber: extracted.invoice_number || null,
      invoiceDate: extracted.invoice_date || null,
      vendorName: extracted.vendor_name || null,
      grossAmount: extracted.gross_amount || null,
      netServiceAmount: extracted.net_amount || null,
      taxAmount: extracted.tax_amount || null,
      currency: extracted.currency || 'USD',
    };
  } catch (error) {
    console.error('Simple invoice extraction error:', error);
    // Return empty data on error
    return {
      invoiceNumber: null,
      invoiceDate: null,
      vendorName: null,
      grossAmount: null,
      netServiceAmount: null,
      taxAmount: null,
      currency: 'USD',
    };
  }
}

// Enhanced storage function that stores extraction data with provenance
export async function storeExtractionResults(
  documentId: string,
  extractionResult: ExtractionResult,
  pageNumber?: number
): Promise<void> {
  if (!extractionResult.success || !extractionResult.data) {
    return;
  }

  const data = extractionResult.data;
  const metadata = extractionResult.extractionMetadata || {
    extractionVersion: '3.1',
    processingTimestamp: new Date().toISOString(),
    overallConfidence: extractionResult.confidence,
    documentTypeDetected: 'unknown',
    totalPages: 1,
  };

  // Store extraction metadata
  await prisma.documentExtractionData.create({
    data: {
      documentId,
      entityType: 'extraction_metadata',
      fieldName: '_extraction_metadata',
      extractedValue: JSON.stringify(metadata),
      normalizedValue: JSON.stringify(metadata),
      confidenceScore: metadata.overallConfidence,
      overallConfidence: metadata.overallConfidence,
      extractionMethod: 'anthropic-claude-sonnet-4.5',
      sourcePageNumber: pageNumber || 1,
      extractionEngineVersion: metadata.extractionVersion,
      requiresHumanReview: metadata.overallConfidence < 0.7 || metadata.requiresHumanReview === true,
    },
  });

  // Helper function to recursively store nested objects
  const storeField = async (
    fieldName: string,
    value: any,
    parentPath: string = '',
    pageNum?: number
  ) => {
    if (value === null || value === undefined) return;

    const fullPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;

    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      // For objects, store each property
      for (const [key, val] of Object.entries(value)) {
        await storeField(key, val, fullPath, pageNum);
      }
    } else if (Array.isArray(value)) {
      // For arrays, store each item with index
      for (let i = 0; i < value.length; i++) {
        await storeField(`${i}`, value[i], fullPath, pageNum);
      }
    } else {
      // Store primitive value
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      // Try to extract page number from field if it's in a structured format
      let sourcePage = pageNum || pageNumber || 1;
      if (typeof value === 'object' && value !== null && 'page' in value) {
        sourcePage = (value as any).page || sourcePage;
      }

      await prisma.documentExtractionData.create({
        data: {
          documentId,
          entityType: 'extracted_field',
          fieldName: fullPath,
          extractedValue: stringValue,
          normalizedValue: stringValue,
          confidenceScore: extractionResult.confidence,
          overallConfidence: metadata.overallConfidence,
          extractionMethod: 'anthropic-claude-sonnet-4.5',
          sourcePageNumber: sourcePage,
          extractionEngineVersion: metadata.extractionVersion,
          requiresHumanReview: extractionResult.confidence < 0.7,
          // Store bounding box if available (would need OCR integration for this)
          boundingBoxCoordinates: null,
          textSnippet: stringValue.length > 500 ? stringValue.substring(0, 500) : stringValue,
        },
      });
    }
  };

  // Store all top-level fields
  for (const [fieldName, value] of Object.entries(data)) {
    // Skip metadata as it's already stored
    if (fieldName === '_extraction_metadata') continue;
    
    await storeField(fieldName, value, '', pageNumber);
  }
}
