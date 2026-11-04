/**
 * Ayudas compartidas por las pruebas de la interfaz.
 *
 * Qué hace: crea servicios falsos sin datos (todo vacío).
 * Cómo lo hace: repositorios que devuelven listas vacías.
 * Por qué: varias pruebas de pantallas necesitan servicios que respondan sin
 * una base de datos.
 */
import type { ServiciosInicio } from '../aplicacion/cargarInicio'

/** Servicios del inicio sin ventas, deudas, productos ni cierres. */
export function serviciosVacios(): ServiciosInicio {
  return {
    ventas: { listarVentas: async () => [] },
    deudas: { listarDeudas: async () => [], listarAbonos: async () => [] },
    inventario: { listarProductos: async () => [], obtenerStock: async () => new Map() },
    cierres: { listarCierres: async () => [] },
    desactualizados: { idsDesactualizados: async () => [] },
  }
}
