/**
 * Cálculos de una compra y de la corrección de su costo.
 *
 * Qué hace: obtiene unidades, costo por unidad y si se puede registrar o
 * guardar, y la diferencia al corregir el costo.
 * Cómo lo hace: usa la conversión del dominio y redondea el costo por unidad
 * al peso más cercano solo para mostrarlo (el costo guardado es el total).
 * Por qué: la pantalla no calcula; el costo por unidad alimenta la utilidad.
 */
import { aUnidades, type Presentacion, type ProductoConversion } from '../domain/inventario/conversiones'

export interface EntradaCompra {
  producto: ProductoConversion | null
  presentacion: Presentacion
  cantidad: number
  costoTotal: number | null
}

export interface ResultadoCompra {
  unidades: number
  costoPorUnidad: number | null
  problema: string | null
  puedeRegistrar: boolean
  /** Cuenta de unidades para el panel: "2 cajas × 24 unidades". */
  detalle: string
}

/** "2 cajas × 24 unidades", "1 sixpack × 6 unidades" o "3 unidades". */
function detalleUnidades(producto: ProductoConversion, presentacion: Presentacion, cantidad: number, unidades: number): string {
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
  if (presentacion === 'unidad') return plural(unidades, 'unidad', 'unidades')
  if (presentacion === 'sixpack') return `${plural(cantidad, 'sixpack', 'sixpacks')} × 6 unidades`
  return `${plural(cantidad, 'caja', 'cajas')} × ${producto.unidadesPorCaja} unidades`
}

/** Valida y calcula una compra en edición. */
export function calcularCompra(e: EntradaCompra): ResultadoCompra {
  if (e.producto === null) return { unidades: 0, costoPorUnidad: null, problema: 'Elige un producto', puedeRegistrar: false, detalle: '' }
  if (e.presentacion === 'sixpack' && !e.producto.manejaSixpack) {
    return { unidades: 0, costoPorUnidad: null, problema: 'Este producto no se maneja por sixpack', puedeRegistrar: false, detalle: '' }
  }
  if (!Number.isInteger(e.cantidad) || e.cantidad <= 0) {
    return { unidades: 0, costoPorUnidad: null, problema: 'La cantidad debe ser mayor a cero', puedeRegistrar: false, detalle: '' }
  }
  const unidades = aUnidades(e.producto, e.presentacion, e.cantidad)
  const detalle = detalleUnidades(e.producto, e.presentacion, e.cantidad, unidades)
  if (e.costoTotal === null || !Number.isInteger(e.costoTotal) || e.costoTotal <= 0) {
    return { unidades, costoPorUnidad: null, problema: 'Escribe el costo total en pesos', puedeRegistrar: false, detalle }
  }
  return { unidades, costoPorUnidad: Math.round(e.costoTotal / unidades), problema: null, puedeRegistrar: true, detalle }
}

export interface EntradaCorreccion {
  unidades: number
  costoActual: number
  costoNuevo: number | null
}

export interface ResultadoCorreccion {
  costoPorUnidad: number | null
  diferencia: number | null
  problema: string | null
  puedeGuardar: boolean
}

/** Calcula el efecto de cambiar el costo total de una compra. */
export function calcularCorreccionCosto(e: EntradaCorreccion): ResultadoCorreccion {
  const nulo = (problema: string | null): ResultadoCorreccion => ({ costoPorUnidad: null, diferencia: null, problema, puedeGuardar: false })
  if (e.costoNuevo === null) return nulo(null)
  if (!Number.isInteger(e.costoNuevo) || e.costoNuevo <= 0) return nulo('El costo debe ser un monto entero mayor a cero')
  const diferencia = e.costoNuevo - e.costoActual
  const costoPorUnidad = Math.round(e.costoNuevo / e.unidades)
  if (diferencia === 0) return { costoPorUnidad, diferencia, problema: 'El costo nuevo es igual al actual', puedeGuardar: false }
  return { costoPorUnidad, diferencia, problema: null, puedeGuardar: true }
}
