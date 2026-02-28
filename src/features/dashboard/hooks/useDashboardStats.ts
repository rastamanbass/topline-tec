import { usePhones } from '../../inventory/hooks/usePhones';

export function useDashboardStats() {
  const { data: phones, isLoading } = usePhones();

  if (isLoading || !phones) {
    return { isLoading: true, stats: null };
  }

  const soldPhones = phones.filter(
    (p) => p.estado && (p.estado.includes('Vendido') || p.estado === 'Pagado')
  );

  // Revenue & Profit
  const totalRevenue = soldPhones.reduce((sum, p) => sum + (p.precioVenta || 0), 0);
  const totalCost = soldPhones.reduce((sum, p) => sum + (p.costo || 0), 0);
  const totalProfit = totalRevenue - totalCost;

  // Counts
  const inStock = phones.filter((p) => p.estado === 'En Stock (Disponible para Venta)').length;
  const inWorkshop = phones.filter(
    (p) => p.estado && (p.estado.includes('Taller') || p.estado.includes('Gerencia'))
  ).length;

  // Workshop specific counts
  const pendingReception = phones.filter(
    (p) => p.estado === 'Enviado a Taller (Externo)' || p.estado === 'Enviado a Taller (Garantía)'
  ).length;
  const pendingManagementReception = phones.filter(
    (p) => p.estado === 'Enviado a Gerencia (Pendiente)'
  ).length;
  const inRepair = phones.filter((p) => p.estado === 'En Taller (Recibido)').length;

  // Debt
  const workshopDebt = phones.reduce((total, phone) => {
    const unpaidRepairs = (phone.reparaciones || [])
      .filter((r) => !r.paid && r.cost > 0)
      .reduce((sum, r) => sum + r.cost, 0);
    return total + unpaidRepairs;
  }, 0);

  return {
    isLoading: false,
    stats: {
      totalRevenue,
      totalProfit,
      inStock,
      inWorkshop,
      pendingReception,
      pendingManagementReception,
      inRepair,
      workshopDebt,
    },
  };
}
