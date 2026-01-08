import { z } from 'zod';
import type { PhoneStatus } from '../../../types';

export const phoneSchema = z
  .object({
    imei: z.string().min(1, 'IMEI es requerido').min(15, 'IMEI debe tener al menos 15 caracteres'),
    marca: z.string().min(1, 'Marca es requerida'),
    modelo: z.string().min(1, 'Modelo es requerido'),
    lote: z.string().min(1, 'Lote es requerido'),
    costo: z
      .number({ invalid_type_error: 'Costo debe ser un número' })
      .positive('Costo debe ser mayor a 0'),
    precioVenta: z
      .number({ invalid_type_error: 'Precio de venta debe ser un número' })
      .positive('Precio de venta debe ser mayor a 0'),
    estado: z.string() as z.ZodType<PhoneStatus>,
  })
  .refine((data) => data.precioVenta >= data.costo, {
    message: 'El precio de venta debe ser mayor o igual al costo',
    path: ['precioVenta'],
  });

export type PhoneFormData = z.infer<typeof phoneSchema>;
