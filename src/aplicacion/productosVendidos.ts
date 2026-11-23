/**
 * Productos vendidos en un periodo.
 *
 * Qué hace: suma, por producto, las unidades y el valor vendidos en las
 * ventas vigentes dentro de un periodo (y aparte los productos adicionales
 * "Otros", juntados por nombre), con lo vendido expresado en cajas completas
 * y unidades sueltas ("25 cajas · 28 unidades"), y los totales.
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
import { aUnidades, descomponerEnCajas } from '../domain/inventario/conversiones'
import { estaVigente } from '../domain/compartido/estado'
import type { Venta } from '../domain/ventas/venta'
import type { ProductoAdicional } from '../domain/ventas/productosAdicionales'
import { valorItem } from '../domain/ventas/valorVenta'

/** Una fila del resumen: un producto con lo vendido. */
export interface FilaVendida {
  productoId: string
  nombre: string
  categoria: CategoriaProducto
  unidades: number
  valor: number
  /** "25 cajas · 28 unidades" en equivalente de cajas (o "2 botellas" si es licor). */
  desglose: string
}

export interface ProductosVendidos {
  filas: FilaVendida[]
  /** Unidades del inventario (los adicionales no cuentan). */
  totalUnidades: number
  /** Valor de todo lo vendido, con los adicionales. */
  totalValor: number
  /** Productos adicionales ("Otros") juntados por nombre, de mayor a menor valor. */
  adicionales: ProductoAdicional[]
  /** Valor de los adicionales. */
  totalAdicionales: number
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

/**
 * Texto de lo vendido de un producto.
 *
 * Qué hace: devuelve "25 cajas · 28 unidades", "2 cajas" o "12 unidades";
 * para el licor, "3 botellas".
 * Cómo lo hace: junta todas las unidades vendidas (cajas, sixpacks y
 * unidades ya convertidas) y las parte con `descomponerEnCajas` usando las
 * unidades por caja de ese producto; omite la parte que dé cero.
 * Por qué: antes se mostraba tal cual se vendió ("24 cajas · 66 unidades"),
 * y con una caja de 38 eso son en realidad 25 cajas y 28 unidades. El
 * negocio cuenta en cajas completas.
 */
function textoVendido(unidades: number, unidadesPorCaja: number, categoria: CategoriaProducto): string {
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
  if (categoria === 'licor') return plural(unidades, 'botella', 'botellas')
  const { cajas, sueltas } = descomponerEnCajas(unidades, unidadesPorCaja)
  const partes = [
    ...(cajas > 0 ? [plural(cajas, 'caja', 'cajas')] : []),
    ...(sueltas > 0 || cajas === 0 ? [plural(sueltas, 'unidad', 'unidades')] : []),
  ]
  return partes.join(' · ')
}

interface Acumulado {
  unidades: number
  unidadesPorCaja: number
  valor: number
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
      const actual = porProducto.get(renglon.productoId) ?? { unidades: 0, unidadesPorCaja: renglon.producto.unidadesPorCaja, valor: 0 }
      actual.unidades += unidades
      actual.valor += valorItem(renglon)
      porProducto.set(renglon.productoId, actual)
    }
  }

  const adicionales = juntarAdicionales(vigentes)
  const totalAdicionales = adicionales.reduce((suma, a) => suma + a.valor, 0)
  const cajasCerveza = contarCajasCerveza(porProducto, nombres)
  const filas = [...porProducto].map(([productoId, a]): FilaVendida => {
    const info = nombres.get(productoId) ?? { nombre: 'Producto', categoria: 'cerveza' as const }
    return {
      productoId,
      nombre: info.nombre,
      categoria: info.categoria,
      unidades: a.unidades,
      valor: a.valor,
      desglose: textoVendido(a.unidades, a.unidadesPorCaja, info.categoria),
    }
  })
  filas.sort((x, y) => y.valor - x.valor || x.nombre.localeCompare(y.nombre))

  return {
    filas,
    totalUnidades: filas.reduce((suma, f) => suma + f.unidades, 0),
    totalValor: filas.reduce((suma, f) => suma + f.valor, 0) + totalAdicionales,
    adicionales,
    totalAdicionales,
    ventas: vigentes.length,
    cajasCerveza,
  }
}

/**
 * Junta los productos adicionales de las ventas por nombre.
 *
 * Qué hace: devuelve un renglón por nombre con la cantidad y el valor sumados.
 * Cómo lo hace: agrupa sin importar mayúsculas (deja el primer nombre como se
 * escribió) y ordena de mayor a menor valor.
 * Por qué: el mismo producto se escribe a mano en varias ventas; en el
 * resumen del día o la semana se lee mejor una sola línea por producto.
 */
function juntarAdicionales(ventas: readonly Venta[]): ProductoAdicional[] {
  const porNombre = new Map<string, ProductoAdicional>()
  for (const venta of ventas) {
    for (const a of venta.adicionales ?? []) {
      const clave = a.descripcion.toLocaleLowerCase('es')
      const actual = porNombre.get(clave)
      porNombre.set(clave, actual === undefined ? { ...a } : { ...actual, cantidad: actual.cantidad + a.cantidad, valor: actual.valor + a.valor })
    }
  }
  return [...porNombre.values()].sort((x, y) => y.valor - x.valor || x.descripcion.localeCompare(y.descripcion))
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
