import { prisma } from './db';
import { Decimal } from '@prisma/client/runtime/library';

// ContractSphere v2.3.1 structure
interface ContractSphereData {
  _extraction_metadata?: {
    extraction_version: string;
    processing_timestamp: string;
    overall_confidence: number;
    document_type_detected: string;
    total_pages: number;
  };
  parties?: Array<{
    party_id: string;
    party_type: string;
    legal_name: string;
    trading_name?: string;
    tax_id?: string;
    duns_number?: string;
    npi_number?: string;
    cage_code?: string;
    external_ids?: {
      erp_vendor_id?: string;
      supplier_code?: string;
      erp_customer_id?: string;
      health_system_code?: string;
    };
    primary_contact_email?: string;
    primary_contact_phone?: string;
  }>;
  contracts?: {
    contract_id: string;
    contract_title: string;
    contract_type: string;
    version?: string;
    external_ids?: {
      erp_contract_number?: string;
    };
    effective_date: string;
    expiration_date: string;
    governing_law?: string;
    termination_clause?: string;
    termination_rights?: string;
    auto_renewal?: {
      enabled?: boolean;
      renewal_period?: string;
      notice_period?: string;
    };
    locations?: Array<{
      location_id: string;
      location_name: string;
      location_type?: string;
      address?: string;
    }>;
    contract_status?: string;
    processing_status?: string;
  };
  billable_items?: Array<{
    item_id: string;
    item_name: string;
    external_ids?: {
      vendor_sku?: string;
      item_code?: string;
    };
    pricing_model_id?: string;
    pricing_details?: {
      list_price: number;
      unit_cost?: number;
      contractual_price_floor?: number;
      price_ceiling?: number;
      rate_type?: string;
      allowed_variance?: {
        type?: string;
        value?: number;
      };
      line_item_code?: string;
      currency: string;
      unit_of_measure: string;
    };
  }>;
  pricing_models?: Array<{
    model_id: string;
    model_name: string;
    model_type: string;
    version?: string;
    base_rate?: number;
    currency?: string;
    tiers?: Array<{
      min_value: number;
      max_value?: number;
      rate: number;
    }>;
  }>;
  payment_terms?: {
    payment_schedule?: string;
    payment_method?: string;
    net_days?: number;
    currency?: string;
  };
  _validation_summary?: {
    high_confidence_items?: number;
    items_requiring_review?: number;
    estimated_annual_value?: number;
    critical_missing_fields?: string[];
    date_consistency_check?: boolean;
    currency_consistency_check?: boolean;
  };
}

// SR Validation v1.1 structure
interface ValidationPayload {
  validation_request: {
    request_id: string;
    invoice_data: {
      invoice_header: {
        invoice_id: string;
        invoice_number?: string;
        vendor_party_id: string;
        customer_party_id: string;
        invoice_date: string;
        total_amount: number;
        currency: string;
        service_period?: {
          start_date?: string;
          end_date?: string;
        };
        billing_aggregation_level?: string;
        aggregation_reference?: string;
        external_ids?: {
          erp_invoice_id?: string;
          po_number?: string;
          external_voucher_id?: string;
          ap_unit?: string;
        };
      };
      line_items: Array<{
        line_number: number;
        description: string;
        quantity?: number;
        uom?: string;
        unit_price?: number;
        extended_amount: number;
        aggregation_type?: string;
        aggregation_method?: string;
        aggregated_items?: Array<{
          billable_item_id?: string;
          item_name?: string;
          quantity?: number;
          allocated_amount?: number;
        }>;
      }>;
    };
    contract_context?: {
      primary_contract_id?: string;
    };
    validation_criteria?: {
      rate_tolerance?: {
        type?: string;
        value?: number;
      };
      auto_approve_threshold?: number;
      manual_review_threshold?: number;
    };
  };
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
    processing_statistics?: {
      total_items_detected?: number;
      items_extracted?: number;
      high_confidence_items?: number;
      items_requiring_review?: number;
      average_confidence?: number;
    };
    pattern_recognition_results?: any;
    quality_flags?: any;
  };
}

export async function normalizeContractData(
  extractedData: ContractSphereData,
  documentId: string,
  userId: string
): Promise<string> {
  if (!extractedData.contracts) {
    throw new Error('Contract data is required');
  }

  const contractData = extractedData.contracts;
  const partyIds: Record<string, string> = {};

  // Upsert parties
  if (extractedData.parties) {
    for (const partyData of extractedData.parties) {
      // Try to find existing party by ID, name, or external IDs
      let party = await prisma.party.findFirst({
        where: {
          OR: [
            { partyId: partyData.party_id },
            { legalName: { contains: partyData.legal_name, mode: 'insensitive' } },
            { tradingName: { contains: partyData.legal_name, mode: 'insensitive' } },
            ...(partyData.tax_id ? [{ taxId: partyData.tax_id }] : []),
            ...(partyData.duns_number ? [{ dunsNumber: partyData.duns_number }] : []),
          ],
        },
      });

      if (!party) {
        // Create new party
        party = await prisma.party.create({
          data: {
            partyId: partyData.party_id,
            partyType: partyData.party_type === 'vendor' ? 'Vendor' : partyData.party_type === 'customer' ? 'Customer' : 'Vendor',
            legalName: partyData.legal_name,
            tradingName: partyData.trading_name,
            taxId: partyData.tax_id,
            dunsNumber: partyData.duns_number,
            npiNumber: partyData.npi_number,
            cageCode: partyData.cage_code,
            externalIds: partyData.external_ids || {},
            primaryContactEmail: partyData.primary_contact_email,
            primaryContactPhone: partyData.primary_contact_phone,
            partyStatus: 'Active',
            createdBy: userId,
          },
        });
      } else {
        // Update existing party with new data
        party = await prisma.party.update({
          where: { partyId: party.partyId },
          data: {
            legalName: partyData.legal_name,
            tradingName: partyData.trading_name || party.tradingName,
            taxId: partyData.tax_id || party.taxId,
            dunsNumber: partyData.duns_number || party.dunsNumber,
            npiNumber: partyData.npi_number || party.npiNumber,
            cageCode: partyData.cage_code || party.cageCode,
            externalIds: partyData.external_ids || party.externalIds,
            primaryContactEmail: partyData.primary_contact_email || party.primaryContactEmail,
            primaryContactPhone: partyData.primary_contact_phone || party.primaryContactPhone,
            updatedBy: userId,
            updatedDate: new Date(),
          },
        });
      }

      partyIds[partyData.party_type] = party.partyId;
    }
  }

  // Create or update contract
  const contractNumber = contractData.external_ids?.erp_contract_number || contractData.contract_id;
  
  let contract = null;
  // Only try findUnique if contract_id exists and looks like a valid UUID
  if (contractData.contract_id && contractData.contract_id.trim() !== '') {
    const contractId = contractData.contract_id.trim();
    if (contractId.length === 36 && contractId.includes('-')) {
      try {
        contract = await prisma.contract.findUnique({
          where: { contractId },
        });
      } catch (error) {
        console.warn(`Failed to find contract by ID ${contractId}:`, error);
      }
    }
  }

  const legalTerms = {
    governing_law: contractData.governing_law,
    termination_clause: contractData.termination_clause,
    termination_rights: contractData.termination_rights,
  };

  // Parse dates with error handling
  let effectiveDate: Date;
  let expirationDate: Date;
  try {
    effectiveDate = new Date(contractData.effective_date);
    if (isNaN(effectiveDate.getTime())) {
      throw new Error('Invalid effective_date');
    }
  } catch {
    // Fallback to today if date is invalid
    effectiveDate = new Date();
    console.warn(`Invalid effective_date "${contractData.effective_date}", using today's date`);
  }

  try {
    expirationDate = new Date(contractData.expiration_date);
    if (isNaN(expirationDate.getTime())) {
      throw new Error('Invalid expiration_date');
    }
  } catch {
    // Fallback to effective_date + 1 year if date is invalid
    expirationDate = new Date(effectiveDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    console.warn(`Invalid expiration_date "${contractData.expiration_date}", using effective_date + 1 year`);
  }

  if (!contract) {
    contract = await prisma.contract.create({
      data: {
        contractId: contractData.contract_id,
        contractNumber,
        contractTitle: contractData.contract_title,
        contractType: contractData.contract_type,
        effectiveDate,
        expirationDate,
        autoRenewalEnabled: contractData.auto_renewal?.enabled,
        renewalPeriod: contractData.auto_renewal?.renewal_period,
        noticePeriodDays: contractData.auto_renewal?.notice_period
          ? parseInt(contractData.auto_renewal.notice_period) || null
          : null,
        currency: 'USD', // Default, should come from data
        externalIds: contractData.external_ids || {},
        legalTerms,
        contractStatus: contractData.contract_status || 'Active',
        version: contractData.version || '1.0',
        createdBy: userId,
      },
    });
  } else {
    contract = await prisma.contract.update({
      where: { contractId: contract.contractId },
      data: {
        contractTitle: contractData.contract_title,
        contractType: contractData.contract_type,
        effectiveDate,
        expirationDate,
        autoRenewalEnabled: contractData.auto_renewal?.enabled,
        renewalPeriod: contractData.auto_renewal?.renewal_period,
        externalIds: contractData.external_ids || contract.externalIds,
        legalTerms,
        contractStatus: contractData.contract_status || contract.contractStatus,
        version: contractData.version || contract.version,
        updatedBy: userId,
        updatedDate: new Date(),
      },
    });
  }

  // Link parties to contract
  if (extractedData.parties) {
    for (const partyData of extractedData.parties) {
      const partyId = partyIds[partyData.party_type];
      if (partyId) {
        // Check if relationship already exists
        const existing = await prisma.contractParty.findFirst({
          where: {
            contractId: contract.contractId,
            partyId,
            partyRole: partyData.party_type,
          },
        });

        if (!existing) {
          await prisma.contractParty.create({
            data: {
              contractId: contract.contractId,
              partyId,
              partyRole: partyData.party_type,
              isPrimary: true,
            },
          });
        }
      }
    }
  }

  // Create or link locations
  if (contractData.locations) {
    for (const locationData of contractData.locations) {
      let location = await prisma.location.findFirst({
        where: {
          OR: [
            { locationId: locationData.location_id },
            { locationCode: locationData.location_id },
          ],
        },
      });

      if (!location) {
        location = await prisma.location.create({
          data: {
            locationId: locationData.location_id,
            locationCode: locationData.location_id,
            locationName: locationData.location_name,
            locationType: locationData.location_type,
            address: locationData.address,
            isActive: true,
          },
        });
      }

      // Link location to contract
      const existingLink = await prisma.contractLocation.findFirst({
        where: {
          contractId: contract.contractId,
          locationId: location.locationId,
        },
      });

      if (!existingLink) {
        await prisma.contractLocation.create({
          data: {
            contractId: contract.contractId,
            locationId: location.locationId,
            isPrimary: true,
          },
        });
      }
    }
  }

  // Create pricing models
  const pricingModelMap: Record<string, string> = {};
  if (extractedData.pricing_models) {
    for (const modelData of extractedData.pricing_models) {
      let pricingModel = null;
      // Only try findUnique if model_id exists and looks like a valid UUID
      if (modelData.model_id && modelData.model_id.trim() !== '') {
        const modelId = modelData.model_id.trim();
        if (modelId.length === 36 && modelId.includes('-')) {
          try {
            pricingModel = await prisma.pricingModel.findUnique({
              where: { modelId },
            });
          } catch (error) {
            console.warn(`Failed to find pricing model by ID ${modelId}:`, error);
          }
        }
      }

      if (!pricingModel) {
        pricingModel = await prisma.pricingModel.create({
          data: {
            modelId: modelData.model_id,
            modelName: modelData.model_name,
            modelType: modelData.model_type,
            version: modelData.version || '1.0',
            baseRate: modelData.base_rate ? new Decimal(modelData.base_rate) : null,
            currency: modelData.currency || 'USD',
            isActive: true,
          },
        });
      }

      pricingModelMap[modelData.model_id] = pricingModel.modelId;
    }
  }

  // Create billable items
  if (extractedData.billable_items) {
    for (const itemData of extractedData.billable_items) {
      const pricingDetails = itemData.pricing_details || {};
      const pricingModelId = itemData.pricing_model_id
        ? pricingModelMap[itemData.pricing_model_id] || null
        : null;

      let billableItem = null;
      // Only try findUnique if item_id exists and looks like a valid UUID
      if (itemData.item_id && itemData.item_id.trim() !== '') {
        const itemId = itemData.item_id.trim();
        if (itemId.length === 36 && itemId.includes('-')) {
          try {
            billableItem = await prisma.billableItem.findUnique({
              where: { itemId },
            });
          } catch (error) {
            console.warn(`Failed to find billable item by ID ${itemId}:`, error);
          }
        }
      }

      if (!billableItem) {
        billableItem = await prisma.billableItem.create({
          data: {
            itemId: itemData.item_id,
            contractId: contract.contractId,
            pricingModelId,
            itemName: itemData.item_name,
            externalIds: itemData.external_ids || {},
            pricingDetails,
            listPrice: new Decimal(pricingDetails.list_price || 0),
            contractPrice: pricingDetails.unit_cost
              ? new Decimal(pricingDetails.unit_cost)
              : null,
            priceFloor: pricingDetails.contractual_price_floor
              ? new Decimal(pricingDetails.contractual_price_floor)
              : null,
            priceCeiling: pricingDetails.price_ceiling
              ? new Decimal(pricingDetails.price_ceiling)
              : null,
            allowedVarianceType: pricingDetails.allowed_variance?.type,
            allowedVarianceValue: pricingDetails.allowed_variance?.value
              ? new Decimal(pricingDetails.allowed_variance.value)
              : null,
            primaryUom: pricingDetails.unit_of_measure || 'unit',
            currency: pricingDetails.currency || 'USD',
            rateType: pricingDetails.rate_type,
            sku: itemData.external_ids?.vendor_sku,
            catalogNumber: itemData.external_ids?.item_code,
            createdDate: new Date(),
          },
        });
      }
    }
  }

  return contract.contractId;
}

export async function normalizeInvoiceData(
  extractedData: ValidationPayload,
  documentId: string,
  userId: string
): Promise<string> {
  if (!extractedData.validation_request?.invoice_data?.invoice_header) {
    throw new Error('Invoice header data is required');
  }

  const header = extractedData.validation_request.invoice_data.invoice_header;
  const lineItems = extractedData.validation_request.invoice_data.line_items || [];
  const contractContext = extractedData.validation_request.contract_context;

  // Find or create vendor party
  let vendorParty = null;

  // Only try findUnique if vendor_party_id exists and looks like a valid UUID
  if (header.vendor_party_id && header.vendor_party_id.trim() !== '') {
    const vendorId = header.vendor_party_id.trim();
    // Check if it looks like a UUID (36 chars with dashes) - if so, try findUnique
    if (vendorId.length === 36 && vendorId.includes('-')) {
      try {
        vendorParty = await prisma.party.findUnique({
          where: { partyId: vendorId },
        });
      } catch (error) {
        // If findUnique fails, continue to findFirst lookup
        console.warn(`Failed to find vendor party by ID ${vendorId}:`, error);
      }
    }
  }

  // If not found by ID, try by name
  if (!vendorParty) {
    // Clean and truncate vendor_party_id if it's too long (might be document text)
    let vendorSearchTerm = header.vendor_party_id || '';
    // If it's longer than 200 characters, it's likely document text - extract first line or first 100 chars
    if (vendorSearchTerm.length > 200) {
      const firstLine = vendorSearchTerm.split('\n')[0].trim();
      vendorSearchTerm = firstLine.length > 100 ? firstLine.substring(0, 100) : firstLine;
    }
    
    // Try to find by name if party_id doesn't exist (vendor_party_id might be a name)
    if (vendorSearchTerm && vendorSearchTerm.length > 0 && vendorSearchTerm.length <= 200) {
      vendorParty = await prisma.party.findFirst({
        where: {
          partyType: 'Vendor',
          OR: [
            { legalName: { contains: vendorSearchTerm, mode: 'insensitive' } },
            { tradingName: { contains: vendorSearchTerm, mode: 'insensitive' } },
            { legalName: { equals: vendorSearchTerm, mode: 'insensitive' } },
          ],
        },
      });
    }
  }

  // If still not found, create a new vendor party
  if (!vendorParty) {
    const { randomUUID } = await import('crypto');
    let vendorName = header.vendor_party_id || 'Unknown Vendor';
    
    // Clean up vendor name - if it's too long, use first line or truncate
    if (vendorName.length > 200) {
      const firstLine = vendorName.split('\n')[0].trim();
      vendorName = firstLine.length > 200 ? firstLine.substring(0, 200) : firstLine;
    }
    
    // Ensure vendor name is reasonable length
    if (vendorName.length === 0) {
      vendorName = 'Unknown Vendor';
    }
    
    vendorParty = await prisma.party.create({
      data: {
        partyId: randomUUID(),
        partyType: 'Vendor',
        legalName: vendorName,
        tradingName: vendorName.length > 200 ? vendorName.substring(0, 200) : vendorName,
        partyStatus: 'Active',
        createdBy: userId,
      },
    });
    console.log(`Created new vendor party: ${vendorName.substring(0, 100)} (${vendorParty.partyId})`);
  }

  // Find customer party
  let customerParty = null;

  // Only try findUnique if customer_party_id exists and looks like a valid UUID
  if (header.customer_party_id && header.customer_party_id.trim() !== '') {
    const customerId = header.customer_party_id.trim();
    // Check if it looks like a UUID (36 chars with dashes) - if so, try findUnique
    if (customerId.length === 36 && customerId.includes('-')) {
      try {
        customerParty = await prisma.party.findUnique({
          where: { partyId: customerId },
        });
      } catch (error) {
        // If findUnique fails, continue to findFirst lookup
        console.warn(`Failed to find customer party by ID ${customerId}:`, error);
      }
    }
  }

  // If not found by ID, try by name
  if (!customerParty) {
    // Clean and truncate customer_party_id if it's too long (might be document text)
    let customerSearchTerm = header.customer_party_id || '';
    // If it's longer than 200 characters, it's likely document text - extract first line or first 100 chars
    if (customerSearchTerm.length > 200) {
      const firstLine = customerSearchTerm.split('\n')[0].trim();
      customerSearchTerm = firstLine.length > 100 ? firstLine.substring(0, 100) : firstLine;
    }
    
    // Try to find by name if party_id doesn't exist (customer_party_id might be a name)
    if (customerSearchTerm && customerSearchTerm.length > 0 && customerSearchTerm.length <= 200) {
      customerParty = await prisma.party.findFirst({
        where: {
          partyType: 'Customer',
          OR: [
            { legalName: { contains: customerSearchTerm, mode: 'insensitive' } },
            { tradingName: { contains: customerSearchTerm, mode: 'insensitive' } },
            { legalName: { equals: customerSearchTerm, mode: 'insensitive' } },
          ],
        },
      });
    }
  }

  if (!customerParty) {
    // Use vendor as fallback
    customerParty = vendorParty;
  }

  // Find contract if provided
  let contractId: string | null = null;
  if (contractContext?.primary_contract_id) {
    const contract = await prisma.contract.findUnique({
      where: { contractId: contractContext.primary_contract_id },
    });
    if (contract) {
      contractId = contract.contractId;
    }
  }

  // Create or update invoice
  const externalIds = header.external_ids || {};
  // Use invoice_id from header, or generate one if not provided
  let invoiceId = header.invoice_id;
  if (!invoiceId || invoiceId.trim() === '') {
    // Generate a UUID if not provided
    const { randomUUID } = await import('crypto');
    invoiceId = randomUUID();
  }
  
  // Use invoice_number from header if available, otherwise use invoice_id
  const invoiceNumber = header.invoice_number || invoiceId;

  let invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
  });

  const servicePeriod = header.service_period;

  if (!invoice) {
    invoice = await prisma.invoice.create({
      data: {
        invoiceId,
        invoiceNumber: invoiceNumber,
        vendorPartyId: vendorParty.partyId,
        customerPartyId: customerParty.partyId,
        contractId,
        sourceDocumentId: documentId,
        poNumber: externalIds.po_number,
        externalVoucherId: externalIds.external_voucher_id,
        apUnit: externalIds.ap_unit,
        invoiceDate: new Date(header.invoice_date),
        servicePeriodStart: servicePeriod?.start_date
          ? new Date(servicePeriod.start_date)
          : null,
        servicePeriodEnd: servicePeriod?.end_date
          ? new Date(servicePeriod.end_date)
          : null,
        netServiceAmount: new Decimal(header.total_amount || 0),
        grossAmount: new Decimal(header.total_amount || 0),
        currency: header.currency || 'USD',
        billingAggregationLevel: header.billing_aggregation_level || 'line_item',
        currentStatus: 'Pending',
        externalIds,
        createdBy: userId,
      },
    });
  } else {
    // Update existing invoice - ensure sourceDocumentId is set if not already set
    invoice = await prisma.invoice.update({
      where: { invoiceId: invoice.invoiceId },
      data: {
        invoiceDate: new Date(header.invoice_date),
        netServiceAmount: new Decimal(header.total_amount),
        grossAmount: new Decimal(header.total_amount),
        currency: header.currency || invoice.currency,
        externalIds: externalIds || invoice.externalIds,
        // Set sourceDocumentId if not already set
        sourceDocumentId: invoice.sourceDocumentId || documentId,
        updatedBy: userId,
        updatedDate: new Date(),
      },
    });
  }

  // Create line items
  for (const lineItemData of lineItems) {
    const aggregationDetails = {
      aggregation_type: lineItemData.aggregation_type,
      aggregation_method: lineItemData.aggregation_method,
      aggregated_items: lineItemData.aggregated_items || [],
    };

    // Check if line item already exists
    const existingLine = await prisma.invoiceLineItem.findFirst({
      where: {
        invoiceId: invoice.invoiceId,
        lineNumber: lineItemData.line_number,
      },
    });

    if (existingLine) {
      await prisma.invoiceLineItem.update({
        where: { lineItemId: existingLine.lineItemId },
        data: {
          description: lineItemData.description,
          invoiceQuantity: lineItemData.quantity
            ? new Decimal(lineItemData.quantity)
            : null,
          invoiceUom: lineItemData.uom,
          invoiceUnitPrice: lineItemData.unit_price
            ? new Decimal(lineItemData.unit_price)
            : null,
          extendedAmount: new Decimal(lineItemData.extended_amount),
          aggregationDetails,
          sourceLineText: lineItemData.description,
        },
      });
    } else {
      await prisma.invoiceLineItem.create({
        data: {
          invoiceId: invoice.invoiceId,
          lineNumber: lineItemData.line_number,
          description: lineItemData.description,
          invoiceQuantity: lineItemData.quantity
            ? new Decimal(lineItemData.quantity)
            : null,
          invoiceUom: lineItemData.uom,
          invoiceUnitPrice: lineItemData.unit_price
            ? new Decimal(lineItemData.unit_price)
            : null,
          extendedAmount: new Decimal(lineItemData.extended_amount),
          aggregationDetails,
          sourceLineText: lineItemData.description,
          validationStatus: 'Pending',
          createdDate: new Date(),
        },
      });
    }
  }

  return invoice.invoiceId;
}
