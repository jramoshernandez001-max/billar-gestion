/**
 * Ayudas compartidas por las pruebas de la interfaz.
 *
 * Qué hace: crea servicios falsos sin datos (todo vacío).
 * Cómo lo hace: repositorios que devuelven listas vacías.
 * Por qué: varias pruebas de pantallas necesitan servicios que respondan sin
 * una base de datos.
 */
import type { ServiciosApp } from '../App'

/** Servicios de toda la app sin ventas, deudas, productos, cierres ni bitácora. */
export function serviciosVacios(): ServiciosApp {
  return {
    ventas: { listarVentas: async () => [], registrarVenta: async () => 'venta', anularVenta: async () => undefined },
    deudas: { listarDeudas: async () => [], listarAbonos: async () => [] },
    inventario: {
      listarProductos: async () => [],
      obtenerStock: async () => new Map(),
      registrarTraslado: async () => ({ trasladoId: 'traslado', suficiente: true, faltan: 0 }),
      registrarAjuste: async () => 'ajuste',
      listarCompras: async () => [],
      crearProducto: async () => 'producto',
      editarProducto: async () => undefined,
      registrarCompra: async () => 'compra',
      corregirCostoCompra: async () => undefined,
      anularCompra: async () => undefined,
    },
    bitacora: { listarBitacora: async () => [] },
    cierres: { listarCierres: async () => [] },
    desactualizados: { idsDesactualizados: async () => [] },
  }
}
