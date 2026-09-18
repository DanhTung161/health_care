import mongoose, { model, models, Schema, type Document } from 'mongoose';

export type ShopifyFinancialTransaction = {
  shopifyTransactionId: string;
  kind: 'SALE' | 'CAPTURE' | 'REFUND' | 'CHANGE';
  amountMinor: number;
  occurredAt: Date;
};
export interface IShopifyOrder extends Document {
  shopDomain: string;
  shopifyOrderId: string;
  shopifyOrderName: string;
  currencyCode: string;
  financialStatus: string | null;
  orderTotalMinor: number;
  grossCollectedMinor: number;
  refundedMinor: number;
  netCollectedMinor: number;
  isTest: boolean;
  processedAt?: Date;
  createdAtShopify: Date;
  sourceUpdatedAt: Date;
  lastSyncedAt: Date;
  lastWebhookId?: string;
  transactions: ShopifyFinancialTransaction[];
}

const isNonNegativeSafeInteger = (value: number) => Number.isSafeInteger(value) && value >= 0;
const isSignedSafeInteger = (value: number) => Number.isSafeInteger(value);

const TransactionSchema = new Schema<ShopifyFinancialTransaction>({
  shopifyTransactionId: { type: String, required: true },
  kind: { type: String, enum: ['SALE', 'CAPTURE', 'REFUND', 'CHANGE'], required: true },
  amountMinor: { type: Number, required: true, validate: { validator: isNonNegativeSafeInteger, message: 'Transaction amount must be a non-negative safe integer' } },
  occurredAt: { type: Date, required: true },
}, { _id: false });

const ShopifyOrderSchema = new Schema<IShopifyOrder>({
  shopDomain: { type: String, required: true },
  shopifyOrderId: { type: String, required: true },
  shopifyOrderName: { type: String, required: true },
  currencyCode: { type: String, required: true },
  financialStatus: { type: String, default: null },
  orderTotalMinor: { type: Number, required: true, validate: { validator: isNonNegativeSafeInteger, message: 'Order total must be a non-negative safe integer' } },
  grossCollectedMinor: { type: Number, required: true, validate: { validator: isNonNegativeSafeInteger, message: 'Gross collection must be a non-negative safe integer' } },
  refundedMinor: { type: Number, required: true, validate: { validator: isNonNegativeSafeInteger, message: 'Refunded amount must be a non-negative safe integer' } },
  netCollectedMinor: { type: Number, required: true, validate: { validator: isSignedSafeInteger, message: 'Net collection must be a safe integer' } },
  isTest: { type: Boolean, required: true },
  processedAt: Date,
  createdAtShopify: { type: Date, required: true },
  sourceUpdatedAt: { type: Date, required: true },
  lastSyncedAt: { type: Date, required: true },
  lastWebhookId: String,
  transactions: { type: [TransactionSchema], default: [] },
}, { timestamps: true });
ShopifyOrderSchema.index({ shopDomain: 1, shopifyOrderId: 1 }, { unique: true });
ShopifyOrderSchema.index({ isTest: 1, 'transactions.occurredAt': 1 });

const ShopifyOrder = (models.ShopifyOrder as mongoose.Model<IShopifyOrder> | undefined) || model<IShopifyOrder>('ShopifyOrder', ShopifyOrderSchema);
export default ShopifyOrder;
