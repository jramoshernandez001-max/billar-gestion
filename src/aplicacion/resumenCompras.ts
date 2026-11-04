/**
 * Resumen del historial de compras.
 *
 * Qué hace: arma las tarjetas del historial: número C-n, producto, cantidad,
 * costo por unidad, total, estado y motivo de anulación.
 * Cómo lo hace: usa el número guardado en la base (o, si falta, numera por
 * orden de registro), filtra periodo y estado y
 * ordena de la más reciente a la más antigua.
 * Por qué: la pantalla solo dibuja; el número lo asigna la base al registrar; el
 * orden de `registradoEn` solo sirve de respaldo.
 */
import type { Compra } from '../domain/inventario/compras'
import { aUnidades } from '../domain/inventario/conversiones'
import { textoUnidades } from '../interfaz/formato'
import type { Anulacion } from './anulaciones'

export type FiltroCompras = 'todas' | 'vigentes' | 'anuladas'

export interface TarjetaCompra {
  id: string
  numero: string
  fecha: string
  estado: Compra['estado']
  producto: string
  cantidadTexto: string
  unidades: number
  costoPorUnidad: number
  total: number
  anulacion: Anulacion | null
}

export interface EntradaResumenCompras {
  compras: readonly Compra[]
  nombres: ReadonlyMap<string, string>
  anulaciones: ReadonlyMap<string, Anulacion>
  desde: string | null
  hasta: string | null
  filtro: FiltroCompras
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Texto de la cantidad: "2 cajas · 48 unidades" o "1 unidad". */
function textoCantidad(c: Compra, unidades: number): string {
  if (c.presentacion === 'unidad') return textoUnidades(unidades)
  const presentacion = c.presentacion === 'caja' ? plural(c.cantidad, 'caja', 'cajas') : plural(c.cantidad, 'sixpack', 'sixpacks')
  return `${presentacion} · ${textoUnidades(unidades)}`
}

/** Tarjetas del historial según periodo y filtro. */
export function resumirCompras(e: EntradaResumenCompras): TarjetaCompra[] {
  const porRegistro = [...e.compras].sort((a, b) => a.registradoEn.localeCompare(b.registradoEn))
  const numeros = new Map(porRegistro.map((c, i) => [c.id, i + 1]))
  return e.compras
    .filter((c) => (e.desde === null || c.fecha >= e.desde) && (e.hasta === null || c.fecha <= e.hasta))
    .filter((c) => e.filtro === 'todas' || (e.filtro === 'vigentes' ? c.estado === 'vigente' : c.estado === 'anulada'))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.registradoEn.localeCompare(a.registradoEn))
    .map((c) => {
      const unidades = aUnidades(c.producto, c.presentacion, c.cantidad)
      return {
        id: c.id,
        numero: `C-${String(c.numero ?? numeros.get(c.id)).padStart(3, '0')}`,
        fecha: c.fecha,
        estado: c.estado,
        producto: e.nombres.get(c.productoId) ?? 'Producto',
        cantidadTexto: textoCantidad(c, unidades),
        unidades,
        costoPorUnidad: Math.round(c.costoTotal / unidades),
        total: c.costoTotal,
        anulacion: c.estado === 'anulada' ? (e.anulaciones.get(c.id) ?? null) : null,
      }
    })
}

export type OpcionPeriodoCompras = '7' | '30' | 'todo'

/** Resta días a una fecha AAAA-MM-DD usando UTC para evitar saltos de horario. */
function restarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

/**
 * Periodo del historial según la opción elegida.
 *
 * Qué hace: devuelve desde/hasta (inclusive) o sin límites para "todo".
 * Cómo lo hace: "últimos N días" incluye hoy y los N-1 anteriores.
 * Por qué: la pantalla no calcula fechas.
 */
export function periodoDeCompras(opcion: OpcionPeriodoCompras, hoy: string): { desde: string | null; hasta: string | null } {
  if (opcion === 'todo') return { desde: null, hasta: null }
  return { desde: restarDias(hoy, Number(opcion) - 1), hasta: hoy }
}
