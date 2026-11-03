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
import { validarSemana } from '../compartido/semana'
import { validarMonto } from '../compartido/validaciones'
import { totalDeudasPendientes, type Abono, type Deuda } from '../deudas/deudas'
import { compraAUltimaCompra, ultimaCompraDe, type Compra } from '../inventario/compras'
import { aUnidades } from '../inventario/conversiones'
import type { RenglonVenta } from '../ventas/movimientosVenta'
import { valorItem, valorVenta } from '../ventas/valorVenta'
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
  /** Renglones de todo lo vendido en el periodo. */
  renglones: readonly RenglonVenta[]
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

/** Resultado del cierre semanal. */
export interface ResultadoCierreSemanal {
  /** Costo de volver a comprar lo vendido que sí tiene costo, en pesos. */
  costoReposicion: number
  /** Falso si algún producto vendido quedó sin costo. */
  completo: boolean
  /** Productos vendidos sin compras ni costo manual; vacío si completo. */
  productosSinCosto: string[]
  /**
   * Valor vendido de los productos sin costo, en pesos; cero si completo.
   * Va aparte: no entra en la utilidad, pero sí en el cuadre.
   */
  ventasSinCosto: number
  cuadre: ResultadoCuadre
  utilidad: ResultadoUtilidad
}

/** Líneas con costo y productos que se quedaron sin él. */
export interface LineasReposicion {
  lineas: LineaReposicion[]
  productosSinCosto: string[]
}

/**
 * Arma las líneas de reposición de lo vendido.
 *
 * Qué hace: devuelve, por producto vendido, las unidades vendidas y la
 * referencia de costo: su última compra con fecha igual o anterior a
 * `hasta` o, si no tiene ninguna, el costo manual por unidad. Los productos
 * sin ninguna de las dos se devuelven aparte, en productosSinCosto.
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

  const resultado: LineasReposicion = { lineas: [], productosSinCosto: [] }
  for (const [productoId, unidadesVendidas] of unidadesPorProducto) {
    if (unidadesVendidas === 0) continue
    const ultima = ultimaCompraDe(compras, productoId, hasta)
    if (ultima !== undefined) {
      resultado.lineas.push({ unidadesVendidas, ultimaCompra: compraAUltimaCompra(ultima) })
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
 * Calcula la utilidad solo con los productos que tienen costo.
 *
 * Qué hace: devuelve la utilidad esperada, la real y la diferencia dejando
 * por fuera lo vendido de los productos sin costo.
 * Cómo lo hace: la esperada es lo vendido con costo menos el costo. La real
 * parte del dinero total y le quita lo vendido sin costo (el dinero es uno
 * solo y no se puede separar por producto, así que se descuenta ese valor)
 * y el costo. Se usa calcularUtilidadSemanal con el dinero completo y luego
 * se resta lo vendido sin costo, porque el dinero que queda puede salir
 * negativo si el faltante es grande, y esa función no acepta dinero
 * negativo.
 * Por qué: así la utilidad no se infla con ventas cuyo costo no se conoce,
 * y la diferencia (real menos esperada) sigue siendo igual a la del cuadre.
 * Con todo el costo conocido, lo vendido sin costo es cero y el resultado es
 * el mismo de siempre.
 */
function utilidadConCosto(
  valorVentas: number,
  ventasSinCosto: number,
  costoReposicion: number,
  dineroTotal: number,
): ResultadoUtilidad {
  const base = calcularUtilidadSemanal({
    valorVentas: valorVentas - ventasSinCosto,
    costoReposicion,
    dineroTotal,
  })
  const utilidadReal = base.utilidadReal - ventasSinCosto
  return {
    utilidadEsperada: base.utilidadEsperada,
    utilidadReal,
    diferencia: utilidadReal - base.utilidadEsperada,
  }
}

/**
 * Cierra una semana.
 *
 * Qué hace: devuelve el costo de reposición, el cuadre, la utilidad y si
 * el resultado está completo (todos los productos vendidos con costo).
 * Cómo lo hace: valida que el periodo vaya de lunes a domingo, cuadra lo
 * vendido contra efectivo, transferencias y las
 * deudas nacidas en el periodo (por lo que sigan debiendo al último día), y
 * calcula la utilidad solo con los productos que tienen costo; lo vendido
 * de los demás se devuelve aparte.
 * Por qué: el cuadre usa la venta total, porque toda la venta debe estar en
 * el dinero. La utilidad solo puede calcularse donde hay costo, y su
 * diferencia coincide con el faltante o sobrante de la semana. Un producto
 * sin costo no impide cerrar: el resultado sale marcado como incompleto,
 * con la lista de esos productos y su venta, para no ocultar el hueco.
 *
 * @throws Error si alguna fecha, monto, costo manual o renglón es inválido,
 * o si el periodo no va de un lunes al domingo siguiente.
 */
export function cerrarSemana(datos: DatosCierreSemanal): ResultadoCierreSemanal {
  validarSemana(datos.desde, datos.hasta)
  const valorVentas = valorVenta(datos.renglones)
  const cuadre = cuadrarCierre({
    valorVentas,
    efectivo: datos.efectivo,
    transferencias: datos.transferencias,
    deudas: totalDeudasPendientes(datos.deudas, datos.abonos, datos.desde, datos.hasta),
  })
  const { lineas, productosSinCosto } = lineasReposicion(
    datos.renglones,
    datos.compras,
    datos.hasta,
    datos.costosManuales,
  )
  const costoReposicion = costoReposicionTotal(lineas)
  const ventasSinCosto = valorDeProductos(datos.renglones, productosSinCosto)

  return {
    costoReposicion,
    completo: productosSinCosto.length === 0,
    productosSinCosto,
    ventasSinCosto,
    cuadre,
    utilidad: utilidadConCosto(valorVentas, ventasSinCosto, costoReposicion, cuadre.dineroTotal),
  }
}
