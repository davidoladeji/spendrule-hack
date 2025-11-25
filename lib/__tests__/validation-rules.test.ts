import {
  validatePrice,
  validateQuantity,
  validateUOM,
  validateCurrency,
  ValidationContext,
} from '../validation-rules';
import { Decimal } from '@prisma/client/runtime/library';

describe('Validation Rules', () => {
  describe('validatePrice', () => {
    it('should pass when price matches contract price', async () => {
      const context: ValidationContext = {
        invoice: {} as any,
        contract: {} as any,
        lineItem: {
          invoiceUnitPrice: new Decimal(100),
        } as any,
        billableItem: {
          contractPrice: new Decimal(100),
          listPrice: new Decimal(120),
          allowedVarianceValue: new Decimal(0),
          allowedVarianceType: 'absolute',
        } as any,
      };

      const result = await validatePrice(context);
      expect(result.passed).toBe(true);
    });

    it('should fail when price exceeds tolerance', async () => {
      const context: ValidationContext = {
        invoice: {} as any,
        contract: {} as any,
        lineItem: {
          invoiceUnitPrice: new Decimal(150),
        } as any,
        billableItem: {
          contractPrice: new Decimal(100),
          listPrice: new Decimal(120),
          allowedVarianceValue: new Decimal(10),
          allowedVarianceType: 'absolute',
        } as any,
      };

      const result = await validatePrice(context);
      expect(result.passed).toBe(false);
      expect(result.variance).toBeDefined();
    });
  });

  describe('validateQuantity', () => {
    it('should pass for positive quantity', async () => {
      const context: ValidationContext = {
        invoice: {} as any,
        contract: {} as any,
        lineItem: {
          invoiceQuantity: new Decimal(10),
        } as any,
      };

      const result = await validateQuantity(context);
      expect(result.passed).toBe(true);
    });

    it('should fail for zero or negative quantity', async () => {
      const context: ValidationContext = {
        invoice: {} as any,
        contract: {} as any,
        lineItem: {
          invoiceQuantity: new Decimal(0),
        } as any,
      };

      const result = await validateQuantity(context);
      expect(result.passed).toBe(false);
    });
  });

  describe('validateUOM', () => {
    it('should pass when UOMs match', async () => {
      const context: ValidationContext = {
        invoice: {} as any,
        contract: {} as any,
        lineItem: {
          invoiceUom: 'each',
        } as any,
        billableItem: {
          primaryUom: 'each',
          allowedUoms: [],
        } as any,
      };

      const result = await validateUOM(context);
      expect(result.passed).toBe(true);
    });

    it('should fail when UOMs do not match', async () => {
      const context: ValidationContext = {
        invoice: {} as any,
        contract: {} as any,
        lineItem: {
          invoiceUom: 'box',
        } as any,
        billableItem: {
          primaryUom: 'each',
          allowedUoms: [],
        } as any,
      };

      const result = await validateUOM(context);
      expect(result.passed).toBe(false);
    });
  });

  describe('validateCurrency', () => {
    it('should pass when currencies match', async () => {
      const context: ValidationContext = {
        invoice: {
          currency: 'USD',
        } as any,
        contract: {
          currency: 'USD',
        } as any,
        lineItem: {} as any,
      };

      const result = await validateCurrency(context);
      expect(result.passed).toBe(true);
    });

    it('should fail when currencies do not match', async () => {
      const context: ValidationContext = {
        invoice: {
          currency: 'EUR',
        } as any,
        contract: {
          currency: 'USD',
        } as any,
        lineItem: {} as any,
      };

      const result = await validateCurrency(context);
      expect(result.passed).toBe(false);
    });
  });
});

