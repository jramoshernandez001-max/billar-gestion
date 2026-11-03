/**
 * Cierre semanal.
 *
 * Qué hace: calcula el costo de reponer lo vendido en la semana, cuadra la
 * semana con sus deudas y devuelve el cuadre junto con la utilidad semanal
 * (esperada, real y diferencia).
 * Cómo lo hace: funciones puras que componen piezas ya probadas: aUnidades
 * para las unidades vendidas, ultimaCompraDe y compraAUltimaCompra para el
 * costo, costoReposicionTotal, valorVenta, totalDeudasPendientes,
 * cuadrarCierre y calcularUtilidadSemanal.
 * Por qué: la utilidad solo se calcula en el cierre semanal. Cada regla ya
 * vive en su módulo; aquí solo se juntan para la semana.
 */
import { totalDeudasPendientes, type Abono, type Deuda } from '../deudas/deudas'
import { compraAUltimaCompra, ultimaCompraDe, type Compra } from '../inventario/compras'
import { aUnidades } from '../inventario/conversiones'
import type { RenglonVenta } from '../ventas/movimientosVenta'
import { valorVenta } from '../ventas/valorVenta'
import { cuadrarCierre, type ResultadoCuadre } from './cuadreCierre'
import {
  calcularUtilidadSemanal,
  costoReposicionTotal,
  type LineaReposicion,
  type ResultadoUtilidad,
} from './utilidadSemanal'

/** Lo que se necesita para cerrar una semana. Dinero en pesos enteros. */
export interface DatosCierreSemanal {
  /** Primer día del periodo, en formato AAAA-MM-DD. */
  desde: string
  /** Último día del periodo, en formato AAAA-MM-DD. */
  hasta: string
  /** Renglones de todo lo vendido en el periodo. */
  renglones: readonly RenglonVenta[]
  efectivo: number
  transferencias: number
  /** Deudas registradas; solo entran las nacidas dentro del periodo. */
  deudas: readonly Deuda[]
  abonos: readonly Abono[]
  /**
   * Compras de donde sale el costo de la última compra de cada producto.
   * Quien llama decide qué compras pasa (ver docs/PENDIENTES.md).
   */
  compras: readonly Compra[]
}

/** Resultado del cierre semanal. */
export interface ResultadoCierreSemanal {
  /** Costo de volver a comprar lo vendido, en pesos. */
  costoReposicion: number
  cuadre: ResultadoCuadre
  utilidad: ResultadoUtilidad
}

/**
 * Arma las líneas de reposición de lo vendido.
 *
 * Qué hace: devuelve, por producto vendido, las unidades vendidas y la
 * referencia de su última compra.
 * Cómo lo hace: suma las unidades de los renglones por producto (en el orden
 * en que aparece cada uno por primera vez), descarta los que suman cero y
 * busca la última compra de cada uno.
 * Por qué: el costo se calcula por producto con el total de unidades, para
 * redondear una sola vez por producto. Un producto con cero unidades no
 * cuesta nada reponer, así que no necesita compra.
 *
 * @throws Error si un producto vendido no tiene compras registradas: sin
 * costo no hay utilidad, y no está definido qué hacer (ver
 * docs/PENDIENTES.md).
 */
export function lineasReposicion(
  renglones: readonly RenglonVenta[],
  compras: readonly Compra[],
): LineaReposicion[] {
  const unidadesPorProducto = new Map<string, number>()
  for (const renglon of renglones) {
    const unidades = aUnidades(renglon.producto, renglon.presentacion, renglon.cantidad)
    unidadesPorProducto.set(
      renglon.productoId,
      (unidadesPorProducto.get(renglon.productoId) ?? 0) + unidades,
    )
  }

  return [...unidadesPorProducto]
    .filter(([, unidadesVendidas]) => unidadesVendidas > 0)
    .map(([productoId, unidadesVendidas]) => {
      const ultima = ultimaCompraDe(compras, productoId)
      if (ultima === undefined) {
        throw new Error(`El producto ${productoId} se vendió pero no tiene compras registradas`)
      }
      return { unidadesVendidas, ultimaCompra: compraAUltimaCompra(ultima) }
    })
}

/**
 * Cierra una semana.
 *
 * Qué hace: devuelve el costo de reposición, el cuadre y la utilidad.
 * Cómo lo hace: cuadra lo vendido contra efectivo, transferencias y las
 * deudas nacidas en el periodo (por lo que sigan debiendo al último día), y
 * con el dinero total del cuadre calcula la utilidad.
 * Por qué: la utilidad real usa el mismo dinero total del cuadre, así la
 * diferencia de utilidad coincide con el faltante o sobrante de la semana.
 *
 * @throws Error si alguna fecha, monto o renglón es inválido, si el inicio
 * es posterior al fin, o si un producto vendido no tiene compras.
 */
export function cerrarSemana(datos: DatosCierreSemanal): ResultadoCierreSemanal {
  const valorVentas = valorVenta(datos.renglones)
  const cuadre = cuadrarCierre({
    valorVentas,
    efectivo: datos.efectivo,
    transferencias: datos.transferencias,
    deudas: totalDeudasPendientes(datos.deudas, datos.abonos, datos.desde, datos.hasta),
  })
  const costoReposicion = costoReposicionTotal(lineasReposicion(datos.renglones, datos.compras))

  return {
    costoReposicion,
    cuadre,
    utilidad: calcularUtilidadSemanal({
      valorVentas,
      costoReposicion,
      dineroTotal: cuadre.dineroTotal,
    }),
  }
}
