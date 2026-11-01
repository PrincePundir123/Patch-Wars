import { z } from 'zod';

// Fixed, versioned products. Generated blueprints never become paid products implicitly.
export const SOLDIER_PRODUCTS = [
  { unitId: 'sprinter', name: 'Sprinter', sku: 'patchwars.sprinter.v1', bits: 10 },
  { unitId: 'archer', name: 'Archer', sku: 'patchwars.archer.v1', bits: 20 },
  { unitId: 'guardian', name: 'Guardian', sku: 'patchwars.guardian.v1', bits: 30 },
  { unitId: 'healer', name: 'Healer', sku: 'patchwars.healer.v1', bits: 40 },
  { unitId: 'bomber', name: 'Bomber', sku: 'patchwars.bomber.v1', bits: 50 },
] as const;
export const DeploymentStatus = z.enum([
  'confirming',
  'queued',
  'dispatching',
  'fulfilled',
  'review',
]);
export const DeploymentRecord = z.object({
  id: z.string().uuid(),
  channelId: z.string().regex(/^\d+$/),
  userId: z.string().regex(/^\d+$/),
  sku: z.string().max(80),
  unitId: z.string().max(40),
  bits: z.number().int().min(1).max(10000),
  status: DeploymentStatus,
  transactionId: z.string().max(100).nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  roomId: z.string().uuid(),
  entityId: z.number().int().nullable(),
  note: z.string().max(300),
});
export type DeploymentRecord = z.infer<typeof DeploymentRecord>;
export const PaymentDisplay = z.object({
  enabled: z.boolean(),
  accepting: z.boolean(),
  acceptingEnabled: z.boolean().default(false),
  message: z.string().max(300),
  products: z
    .array(
      z.object({
        unitId: z.string().max(40),
        name: z.string().max(60),
        sku: z.string().max(80),
        bits: z.number().int().min(1).max(10000),
      }),
    )
    .max(5),
  records: z.array(DeploymentRecord).max(50),
});
export type PaymentDisplay = z.infer<typeof PaymentDisplay>;
export const IntentRequest = z
  .object({ roomId: z.string().uuid(), sku: z.string().min(1).max(80) })
  .strict();
export const ReceiptRequest = z
  .object({ intentId: z.string().uuid(), receipt: z.string().min(1).max(6000) })
  .strict();
export const ReconcileRequest = z
  .object({ intentId: z.string().uuid(), transactionId: z.string().min(1).max(100) })
  .strict();
export const PaymentAdminRequest = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('accepting'),
      channelId: z.string().regex(/^\d+$/),
      accepting: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.enum(['requeue', 'fulfilled']),
      channelId: z.string().regex(/^\d+$/),
      id: z.string().uuid(),
      note: z.string().trim().min(10).max(300),
    })
    .strict(),
]);
