/**
 * Cierre semanal.
 *
 * Qué hace: calcula el costo de reponer lo vendido en la semana, cuadra la
 * semana con sus deudas y devuelve el cuadre junto con la utilidad semanal
 * (esperada, real y diferencia). Si algún producto vendido no tiene costo,
 * el cierre sale incompleto y solo trae la utilidad esperada.
 * Cómo lo hace: funciones puras que componen piezas ya probadas: aUnidades
 * para las unidades vendidas, ultimaCompraDe y compraAUltimaCompra para el
 * costo, costoReposicionTotal, valorVenta, totalDeudasPendientes,
 * cuadrarCierre y calcularUtilidadSemanal.
 * Por qué: la utilidad solo se calcula en el cierre semanal. Cada regla ya
 * vive en su módulo; aquí solo se juntan para la semana.
 */
import { validarSemana } from '../compartido/semana'
import { validarMonto } from '../compartido/validaciones'
import { totalDeudasPendientes, type Abono, type Deuda } from '../deudas/deudas'
import { compraAUltimaCompra, ultimaCompraDe, type Compra } from '../inventario/compras'
import { aUnidades } from '../inventario/conversiones'
import type { RenglonVenta } from '../ventas/movimientosVenta'
import { valorItem, valorVenta } from '../ventas/valorVenta'
import { renglonesVigentes, type Venta } from '../ventas/venta'
import { cuadrarCierre, type ResultadoCuadre } from './cuadreCierre'
import {
  calcularUtilidadSemanal,
  costoReposicionTotal,
  type LineaReposicion,
  type ResultadoUtilidad,
} from './utilidadSemanal'

/** Lo que se necesita para cerrar una semana. Dinero en pesos enteros. */
export interface DatosCierreSemanal {
  /** Lunes con que empieza la semana, en formato AAAA-MM-DD. */
  desde: string
  /** Domingo con que termina la semana (desde + 6 días), AAAA-MM-DD. */
  hasta: string
  /** Ventas del periodo; solo suman las vigentes. */
  ventas: readonly Venta[]
  efectivo: number
  transferencias: number
  /** Deudas registradas; solo entran las nacidas dentro del periodo. */
  deudas: readonly Deuda[]
  abonos: readonly Abono[]
  /**
   * Compras de donde sale el costo de la última compra de cada producto.
   * Solo cuentan las de fecha igual o anterior a `hasta`.
   */
  compras: readonly Compra[]
  /**
   * Costo por unidad, en pesos, para productos vendidos que no tienen
   * ninguna compra hasta `hasta`. La clave es el id del producto.
   */
  costosManuales?: Readonly<Record<string, number>>
}

/** Lo que devuelven por igual un cierre semanal completo y uno incompleto. */
interface BaseCierreSemanal {
  /** Costo de volver a comprar lo vendido que sí tiene costo, en pesos. */
  costoReposicion: number
  /** Productos vendidos sin compras ni costo manual; vacío si completo. */
  productosSinCosto: string[]
  /**
   * Valor vendido de los productos sin costo, en pesos; cero si completo.
   * Va aparte: no entra en la utilidad, pero sí en el cuadre.
   */
  ventasSinCosto: number
  /**
   * Ids de las compras de donde salió el costo. Se guardan para saber si
   * el cierre queda desactualizado cuando una de ellas se anula o corrige.
   */
  comprasUsadas: string[]
  /** Cuadre contra el dinero, con la venta total; trae faltante o sobrante. */
  cuadre: ResultadoCuadre
}

/** Cierre semanal con costo para todo lo vendido: trae la utilidad completa. */
export interface CierreSemanalCompleto extends BaseCierreSemanal {
  completo: true
  /** Utilidad esperada, real y diferencia. */
  utilidad: ResultadoUtilidad
}

/**
 * Cierre semanal con productos vendidos sin costo. No trae utilidad real:
 * el dinero es uno solo y no se puede separar por producto. Trae la
 * utilidad esperada de lo que sí tiene costo, y aparte lo vendido sin
 * costo y el cuadre.
 */
export interface CierreSemanalIncompleto extends BaseCierreSemanal {
  completo: false
  /** Ventas de los productos con costo menos su costo de reposición. */
  utilidadEsperada: number
}

/**
 * Resultado del cierre semanal. Se distingue por `completo`, así no se
 * puede leer una utilidad real que no se calculó.
 */
export type ResultadoCierreSemanal = CierreSemanalCompleto | CierreSemanalIncompleto

/** Líneas con costo, productos que se quedaron sin él y compras usadas. */
export interface LineasReposicion {
  lineas: LineaReposicion[]
  productosSinCosto: string[]
  /** Ids de las compras usadas como costo (no incluye costos manuales). */
  comprasUsadas: string[]
}

/**
 * Arma las líneas de reposición de lo vendido.
 *
 * Qué hace: devuelve, por producto vendido, las unidades vendidas y la
 * referencia de costo: su última compra con fecha igual o anterior a
 * `hasta` o, si no tiene ninguna, el costo manual por unidad. Los productos
 * sin ninguna de las dos se devuelven aparte, en productosSinCosto, y los
 * ids de las compras usadas, en comprasUsadas.
 * Cómo lo hace: suma las unidades de los renglones por producto (en el orden
 * en que aparece cada uno por primera vez), descarta los que suman cero y
 * busca el costo de cada uno. Un costo manual se representa como una compra
 * de 1 unidad por ese costo, para reutilizar costoReposicion.
 * Por qué: el costo se calcula por producto con el total de unidades, para
 * redondear una sola vez por producto. Un producto con cero unidades no
 * cuesta nada reponer, así que no necesita costo. Ignorar las compras
 * posteriores hace que recalcular el cierre más tarde dé el mismo resultado.
 * Un producto sin costo no se toma como cero: se informa para que el cierre
 * quede marcado como incompleto. Si el producto tiene compra, manda la
 * compra y el costo manual no se usa (ver docs/PENDIENTES.md).
 *
 * @throws Error si un costo manual que se usa no es un entero mayor o igual
 * a cero.
 */
export function lineasReposicion(
  renglones: readonly RenglonVenta[],
  compras: readonly Compra[],
  hasta: string,
  costosManuales: Readonly<Record<string, number>> = {},
): LineasReposicion {
  const unidadesPorProducto = new Map<string, number>()
  for (const renglon of renglones) {
    const unidades = aUnidades(renglon.producto, renglon.presentacion, renglon.cantidad)
    unidadesPorProducto.set(
      renglon.productoId,
      (unidadesPorProducto.get(renglon.productoId) ?? 0) + unidades,
    )
  }

  const resultado: LineasReposicion = { lineas: [], productosSinCosto: [], comprasUsadas: [] }
  for (const [productoId, unidadesVendidas] of unidadesPorProducto) {
    if (unidadesVendidas === 0) continue
    const ultima = ultimaCompraDe(compras, productoId, hasta)
    if (ultima !== undefined) {
      resultado.lineas.push({ unidadesVendidas, ultimaCompra: compraAUltimaCompra(ultima) })
      resultado.comprasUsadas.push(ultima.id)
      continue
    }
    // Object.hasOwn evita tomar por costo algo heredado del prototipo.
    if (Object.hasOwn(costosManuales, productoId)) {
      const costoUnidad = costosManuales[productoId]
      validarMonto(`El costo manual de ${productoId}`, costoUnidad)
      resultado.lineas.push({
        unidadesVendidas,
        ultimaCompra: { unidades: 1, costoTotal: costoUnidad },
      })
      continue
    }
    resultado.productosSinCosto.push(productoId)
  }
  return resultado
}

/**
 * Suma el valor vendido de ciertos productos.
 *
 * Qué hace: devuelve el valor de los renglones cuyos productos están en la
 * lista.
 * Cómo lo hace: filtra los renglones por producto y suma valorItem.
 * Por qué: en un cierre incompleto, lo vendido de los productos sin costo
 * se separa de la utilidad.
 */
function valorDeProductos(
  renglones: readonly RenglonVenta[],
  productos: readonly string[],
): number {
  return renglones
    .filter((renglon) => productos.includes(renglon.productoId))
    .reduce((total, renglon) => total + valorItem(renglon), 0)
}

/**
 * Cierra una semana.
 *
 * Qué hace: devuelve el costo de reposición, el cuadre y, si todo lo
 * vendido tiene costo, la utilidad completa; si no, solo la utilidad
 * esperada de lo que tiene costo y, aparte, lo vendido sin costo.
 * Cómo lo hace: valida que el periodo vaya de lunes a domingo, toma solo
 * las ventas vigentes, cuadra lo vendido contra efectivo, transferencias y las
 * deudas nacidas en el periodo (por lo que sigan debiendo al último día).
 * Si todo tiene costo, calcula la utilidad con calcularUtilidadSemanal; si
 * no, resta el costo de las ventas de los productos con costo.
 * Por qué: el cuadre usa la venta total, porque toda la venta debe estar en
 * el dinero. La utilidad real compara el dinero con el costo, y el dinero
 * no se puede separar por producto: con productos sin costo no hay forma
 * honesta de calcularla, así que no se calcula. Un producto sin costo no
 * impide cerrar: el resultado sale incompleto, con la lista de esos
 * productos, su venta y el faltante o sobrante del cuadre, sin mezclarlos.
 *
 * @throws Error si alguna fecha, monto, costo manual o renglón es inválido,
 * o si el periodo no va de un lunes al domingo siguiente.
 */
export function cerrarSemana(datos: DatosCierreSemanal): ResultadoCierreSemanal {
  validarSemana(datos.desde, datos.hasta)
  // Una venta anulada no suma ni en lo vendido ni en el costo de reposición.
  const renglones = renglonesVigentes(datos.ventas)
  const valorVentas = valorVenta(renglones)
  const cuadre = cuadrarCierre({
    valorVentas,
    efectivo: datos.efectivo,
    transferencias: datos.transferencias,
    deudas: totalDeudasPendientes(datos.deudas, datos.abonos, datos.desde, datos.hasta),
  })
  const { lineas, productosSinCosto, comprasUsadas } = lineasReposicion(
    renglones,
    datos.compras,
    datos.hasta,
    datos.costosManuales,
  )
  const costoReposicion = costoReposicionTotal(lineas)
  const ventasSinCosto = valorDeProductos(renglones, productosSinCosto)

  const base: BaseCierreSemanal = {
    costoReposicion,
    productosSinCosto,
    ventasSinCosto,
    comprasUsadas,
    cuadre,
  }

  if (productosSinCosto.length > 0) {
    return {
      completo: false,
      ...base,
      utilidadEsperada: valorVentas - ventasSinCosto - costoReposicion,
    }
  }
  return {
    completo: true,
    ...base,
    utilidad: calcularUtilidadSemanal({
      valorVentas,
      costoReposicion,
      dineroTotal: cuadre.dineroTotal,
    }),
  }
}
