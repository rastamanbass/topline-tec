import { z } from 'zod';

/** Luhn algorithm — validates IMEI check digit */
function luhn(imei: string): boolean {
  let sum = 0;
  for (let i = 0; i < imei.length; i++) {
    let digit = parseInt(imei[imei.length - 1 - i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

const PHONE_STATUSES = [
  'En Bodega (USA)',
  'En Tránsito (a El Salvador)',
  'En Stock (Disponible para Venta)',
  'Apartado',
  'Pagado',
  'Vendido (Pendiente de Entrega)',
  'Vendido',
  'Enviado a Taller (Garantía)',
  'Enviado a Taller (Externo)',
  'En Taller (Recibido)',
  'Enviado a Gerencia (Pendiente)',
  'Enviado a Gerencia',
  'Recibido de Taller (OK)',
  'Entregado al Cliente',
  'Reingreso (Tomado como parte de pago)',
  'De Baja',
] as const;

export const phoneSchema = z
  .object({
    imei: z
      .string()
      .min(1, 'IMEI es requerido')
      .refine((val) => {
        const lines = val.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        return lines.length > 0;
      }, 'Ingresa al menos un IMEI')
      .refine((val) => {
        const lines = val.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        return lines.every(l => /^\d{15}$/.test(l));
      }, 'Cada IMEI debe tener exactamente 15 dígitos numéricos')
      .refine((val) => {
        const lines = val.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        return lines.every(l => luhn(l));
      }, 'IMEI inválido (falla verificación de dígito Luhn)'),
    marca: z.string().min(1, 'Marca es requerida'),
    modelo: z.string().min(1, 'Modelo es requerido'),
    storage: z.string().optional(),
    lote: z.string().min(1, 'Lote es requerido'),
    costo: z.number().positive('Costo debe ser mayor a 0'),
    precioVenta: z.number().positive('Precio de venta debe ser mayor a 0'),
    estado: z.enum(PHONE_STATUSES),
    condition: z.enum(['New', 'Open Box', 'Grade A', 'Grade B', 'Grade C']).optional(),
  })
  .refine((data) => data.precioVenta >= data.costo, {
    message: 'El precio de venta debe ser mayor o igual al costo',
    path: ['precioVenta'],
  });

export type PhoneFormData = z.infer<typeof phoneSchema>;
