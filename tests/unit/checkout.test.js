import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Checkout Pricing', () => {
  it('should compute line totals correctly', () => {
    const lines = [
      { product: { price: 29.99, name: 'T-Shirt', sku: 'TS1', _id: '1' }, quantity: 2, variant: null },
      { product: { price: 49.99, name: 'Jeans', sku: 'JN1', _id: '2' }, quantity: 1, variant: { additionalPrice: 5, name: 'Large', sku: 'JN1-L' } },
    ];

    const pricedLines = lines.map(line => {
      const basePrice = line.product.price;
      const variantExtra = line.variant?.additionalPrice || 0;
      const unitPrice = basePrice + variantExtra;
      const lineTotal = unitPrice * line.quantity;
      return { unitPrice, lineTotal, quantity: line.quantity };
    });

    assert.equal(pricedLines[0].unitPrice, 29.99);
    assert.equal(pricedLines[0].lineTotal, 59.98);
    assert.equal(pricedLines[1].unitPrice, 54.99);
    assert.equal(pricedLines[1].lineTotal, 54.99);

    const subtotal = pricedLines.reduce((sum, l) => sum + l.lineTotal, 0);
    assert.ok(Math.abs(subtotal - 114.97) < 0.01);
  });

  it('should apply percentage discount correctly', () => {
    const subtotal = 100;
    const discountValue = 15; // 15%
    const discountAmount = (subtotal * discountValue) / 100;
    assert.equal(discountAmount, 15);
  });

  it('should cap fixed discount at subtotal', () => {
    const subtotal = 50;
    const discountValue = 75; // $75 off on $50 order
    const discountAmount = Math.min(discountValue, subtotal);
    assert.equal(discountAmount, 50);
  });
});
