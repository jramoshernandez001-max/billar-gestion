/**
 * Productos vendidos en un periodo.
 *
 * Qué hace: suma, por producto, las unidades y el valor vendidos en las
 * ventas vigentes dentro de un periodo, con el desglose por presentación
 * ("1 caja · 4 unidades"), y los totales.
 * Cómo lo hace: filtra las ventas por fecha (extremos incluidos), descarta
 * las anuladas, y recorre los renglones convirtiendo con `aUnidades` y
 * valorando con `valorItem` (precio cobrado, o el de lista si no hay).
 * Ordena de mayor a menor valor. Además cuenta las cajas de cerveza vendidas
 * en equivalente: las unidades de cada cerveza se dividen entre las unidades
 * por caja de ese producto (`descomponerEnCajas`) y se suman las cajas y las
 * unidades sueltas de todas.
 * Por qué: al consultar un cierre, la persona quiere ver qué se vendió ese día
 * o esa semana. Usa las ventas vigentes de hoy: si algo se anuló después del
 * cierre, el cierre aparece como desactualizado y recalcularlo lo alinea.
 * Las cajas se cuentan por producto porque cada cerveza trae un número
 * distinto de unidades por caja (no se pueden juntar las sueltas de dos
 * marcas en una caja).
 */
import type { CategoriaProducto } from '../domain/inventario/categorias'
import { aUnidades, descomponerEnCajas, type Presentacion } from '../domain/inventario/conversiones'
import { estaVigente } from '../domain/compartido/estado'
import type { Venta } from '../domain/ventas/venta'
import { valorItem } from '../domain/ventas/valorVenta'

/** Una fila del resumen: un producto con lo vendido. */
export interface FilaVendida {
  productoId: string
  nombre: string
  categoria: CategoriaProducto
  unidades: number
  valor: number
  /** "1 caja · 4 unidades" (o "2 botellas" si es licor). */
  desglose: string
}

export interface ProductosVendidos {
  filas: FilaVendida[]
  totalUnidades: number
  totalValor: number
  /** Cantidad de ventas vigentes del periodo. */
  ventas: number
  /**
   * Cajas de cerveza vendidas en equivalente: suma, por cada cerveza, de las
   * cajas completas y de las unidades que sobran de cada una.
   */
  cajasCerveza: { cajas: number; sueltas: number }
}

/** Nombre y categoría de cada producto, por id. */
export type NombresDeProductos = ReadonlyMap<string, { nombre: string; categoria: CategoriaProducto }>

const ORDEN: readonly Presentacion[] = ['caja', 'sixpack', 'unidad']

/** Texto de una presentación con su cantidad: "2 cajas", "1 botella". */
function textoPresentacion(presentacion: Presentacion, cantidad: number, categoria: CategoriaProducto): string {
  const uno = cantidad === 1
  if (presentacion === 'caja') return `${cantidad} ${uno ? 'caja' : 'cajas'}`
  if (presentacion === 'sixpack') return `${cantidad} ${uno ? 'sixpack' : 'sixpacks'}`
  if (categoria === 'licor') return `${cantidad} ${uno ? 'botella' : 'botellas'}`
  return `${cantidad} ${uno ? 'unidad' : 'unidades'}`
}

interface Acumulado {
  unidades: number
  unidadesPorCaja: number
  valor: number
  porPresentacion: Map<Presentacion, number>
}

export function resumirProductosVendidos(
  ventas: readonly Venta[],
  desde: string,
  hasta: string,
  nombres: NombresDeProductos,
): ProductosVendidos {
  const vigentes = ventas.filter(
    (venta) => venta.fecha >= desde && venta.fecha <= hasta && estaVigente(venta, `La venta ${venta.id}`),
  )
  const porProducto = new Map<string, Acumulado>()
  for (const venta of vigentes) {
    for (const renglon of venta.renglones) {
      const unidades = aUnidades(renglon.producto, renglon.presentacion, renglon.cantidad)
      if (unidades === 0) continue
      const actual = porProducto.get(renglon.productoId) ?? { unidades: 0, unidadesPorCaja: renglon.producto.unidadesPorCaja, valor: 0, porPresentacion: new Map() }
      actual.unidades += unidades
      actual.valor += valorItem(renglon)
      actual.porPresentacion.set(renglon.presentacion, (actual.porPresentacion.get(renglon.presentacion) ?? 0) + renglon.cantidad)
      porProducto.set(renglon.productoId, actual)
    }
  }

  const cajasCerveza = contarCajasCerveza(porProducto, nombres)
  const filas = [...porProducto].map(([productoId, a]): FilaVendida => {
    const info = nombres.get(productoId) ?? { nombre: 'Producto', categoria: 'cerveza' as const }
    return {
      productoId,
      nombre: info.nombre,
      categoria: info.categoria,
      unidades: a.unidades,
      valor: a.valor,
      desglose: ORDEN.filter((p) => a.porPresentacion.has(p))
        .map((p) => textoPresentacion(p, a.porPresentacion.get(p) ?? 0, info.categoria))
        .join(' · '),
    }
  })
  filas.sort((x, y) => y.valor - x.valor || x.nombre.localeCompare(y.nombre))

  return {
    filas,
    totalUnidades: filas.reduce((suma, f) => suma + f.unidades, 0),
    totalValor: filas.reduce((suma, f) => suma + f.valor, 0),
    ventas: vigentes.length,
    cajasCerveza,
  }
}

/**
 * Cuenta las cajas de cerveza vendidas en equivalente.
 *
 * Qué hace: devuelve el total de cajas completas y de unidades sueltas de
 * todas las cervezas vendidas.
 * Cómo lo hace: para cada producto de categoría cerveza, descompone sus
 * unidades vendidas con sus propias unidades por caja y suma los resultados.
 * Por qué: el negocio piensa la venta de la semana en cajas; licores y otros
 * productos no se cuentan en cajas.
 */
function contarCajasCerveza(
  porProducto: ReadonlyMap<string, Acumulado>,
  nombres: NombresDeProductos,
): { cajas: number; sueltas: number } {
  let cajas = 0
  let sueltas = 0
  for (const [productoId, a] of porProducto) {
    const categoria = nombres.get(productoId)?.categoria ?? 'cerveza'
    if (categoria !== 'cerveza') continue
    const partes = descomponerEnCajas(a.unidades, a.unidadesPorCaja)
    cajas += partes.cajas
    sueltas += partes.sueltas
  }
  return { cajas, sueltas }
}
