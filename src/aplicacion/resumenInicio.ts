/**
 * Resumen de la pantalla de inicio.
 *
 * Qué hace: calcula las ventas de hoy (total y cantidad), la serie de ventas
 * de los últimos 7 días para el gráfico de barras y los avisos del día.
 * Cómo lo hace: filtra las ventas vigentes por fecha, las valora con el
 * dominio (`valorVenta`) y recorre los 7 días terminando hoy con `sumarDias`.
 * Por qué: la pantalla solo dibuja este resumen. Una venta anulada no suma,
 * igual que en los cierres; los días sin ventas aparecen en cero para que el
 * gráfico no se salte días.
 */
import { sumarDias } from '../domain/compartido/semana'
import { validarFecha } from '../domain/compartido/validaciones'
import { aUnidades } from '../domain/inventario/conversiones'
import { valorVenta } from '../domain/ventas/valorVenta'
import { renglonesVigentes, type Venta } from '../domain/ventas/venta'

/** Cuántos días muestra el gráfico (hoy y los 6 anteriores). */
const DIAS_DEL_GRAFICO = 7

/** Datos de entrada del resumen. */
export interface DatosInicio {
  /** Día de hoy, AAAA-MM-DD. */
  hoy: string
  ventas: readonly Venta[]
  /** Total que se debe en deudas, en pesos (de resumirDeudas). */
  deudaPendiente: number
  /** Productos con stock negativo (de resumirInventario). */
  productosNegativos: number
  /** Cierres por recalcular (del detector). */
  cierresDesactualizados: number
}

/** Ventas de un día. */
export interface VentasDelDia {
  fecha: string
  total: number
  cantidadVentas: number
  /** Unidades vendidas (cajas y sixpacks convertidos a unidades). */
  unidades: number
}

/** Lo que muestra el inicio. */
export interface ResumenInicio {
  hoy: { total: number; cantidadVentas: number; unidades: number }
  ultimosDias: VentasDelDia[]
  avisos: { deudaPendiente: number; productosNegativos: number; cierresDesactualizados: number }
}

/** Total y cantidad de las ventas vigentes de un día. */
function ventasDe(ventas: readonly Venta[], fecha: string): VentasDelDia {
  const vigentes = ventas.filter((v) => v.fecha === fecha && v.estado === 'vigente')
  const renglones = renglonesVigentes(vigentes)
  const unidades = renglones.reduce((suma, r) => suma + aUnidades(r.producto, r.presentacion, r.cantidad), 0)
  return { fecha, total: valorVenta(renglones), cantidadVentas: vigentes.length, unidades }
}

/**
 * Arma el resumen del inicio.
 * @throws Error si la fecha de hoy es inválida.
 */
export function resumirInicio(datos: DatosInicio): ResumenInicio {
  validarFecha('La fecha de hoy', datos.hoy)
  const ultimosDias = Array.from({ length: DIAS_DEL_GRAFICO }, (_, i) =>
    ventasDe(datos.ventas, sumarDias(datos.hoy, i - (DIAS_DEL_GRAFICO - 1))),
  )
  const hoy = ultimosDias[DIAS_DEL_GRAFICO - 1]
  return {
    hoy: { total: hoy.total, cantidadVentas: hoy.cantidadVentas, unidades: hoy.unidades },
    ultimosDias,
    avisos: {
      deudaPendiente: datos.deudaPendiente,
      productosNegativos: datos.productosNegativos,
      cierresDesactualizados: datos.cierresDesactualizados,
    },
  }
}
