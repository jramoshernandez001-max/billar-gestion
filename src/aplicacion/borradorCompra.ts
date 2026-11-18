/**
 * Borrador de una compra con varios productos.
 *
 * Qué hace: guarda lo que el usuario va armando en "Nueva compra" (fecha y
 * renglones con producto, presentación, cantidad y precio por presentación),
 * calcula el total de cada renglón y el general, y lo convierte en los datos
 * que se registran.
 * Cómo lo hace: funciones puras que devuelven un borrador nuevo en cada
 * cambio; cada renglón se calcula con `calcularCompra`.
 * Por qué: el negocio compra varios productos a la vez (10 cajas de una
 * cerveza, 2 de otra, 2 botellas de licor) y quiere registrarlos con un solo
 * botón, como una venta. Escribe el precio de cada caja y la app saca el
 * total pagado.
 */
import { presentacionPermitida } from '../domain/inventario/categorias'
import type { Presentacion, ProductoConversion } from '../domain/inventario/conversiones'
import { calcularCompra, type ResultadoCompra } from './calculoCompra'

/** Productos que se pueden comprar, por id. */
export type CatalogoCompra = ReadonlyMap<string, ProductoConversion>

/** Un renglón tal como lo va llenando el usuario. */
export interface RenglonCompraBorrador {
  clave: string
  productoId: string | null
  presentacion: Presentacion
  cantidad: number
  /** Precio de cada caja, sixpack o unidad (según la presentación), en pesos. */
  precio: number | null
}

/** La compra en edición. */
export interface BorradorCompra {
  fecha: string
  renglones: readonly RenglonCompraBorrador[]
}

/** Cambios posibles de un renglón. */
export type CambiosRenglonCompra = Partial<Omit<RenglonCompraBorrador, 'clave'>>

/** Resultado de calcular el borrador completo. */
export interface BorradorCompraCalculado {
  renglones: readonly ResultadoCompra[]
  /** Suma de lo pagado en todos los renglones con precio. */
  total: number
  /** Suma de unidades que entran a la bodega. */
  unidades: number
  /** Primer problema que impide registrar, o null. */
  problema: string | null
  puedeRegistrar: boolean
}

/** Datos listos para registrar la compra. */
export interface DatosCompras {
  fecha: string
  renglones: readonly { productoId: string; presentacion: Presentacion; cantidad: number; costoTotal: number }[]
}

/**
 * Presentación válida para un producto.
 * Cómo: si el producto no admite la pedida, usa botella (licor) o caja.
 * Por qué: al cambiar de producto, un "sixpack" o una "caja" puede dejar de
 * tener sentido.
 */
function presentacionPara(producto: ProductoConversion | undefined, pedida: Presentacion): Presentacion {
  if (producto === undefined) return pedida
  const categoria = producto.categoria ?? 'cerveza'
  if (presentacionPermitida(categoria, pedida, producto.manejaSixpack)) return pedida
  return categoria === 'licor' ? 'unidad' : 'caja'
}

/**
 * Crea un renglón nuevo.
 * Cómo: por caja (o botella si es licor), cantidad 1 y sin precio.
 * Por qué: casi todas las compras de cerveza son por caja.
 */
function renglonNuevo(clave: string, productoId: string | null, catalogo: CatalogoCompra): RenglonCompraBorrador {
  const producto = productoId === null ? undefined : catalogo.get(productoId)
  return { clave, productoId, presentacion: presentacionPara(producto, 'caja'), cantidad: 1, precio: null }
}

/**
 * Borrador vacío.
 *
 * Qué hace: devuelve un borrador con la fecha y un primer renglón.
 * Cómo lo hace: si llega un producto (desde Inventario → Comprar) el renglón
 * ya lo trae elegido.
 * Por qué: desde la tarjeta de un producto se llega a comprar ese producto.
 */
export function borradorCompraVacio(fecha: string, productoId: string | undefined, catalogo: CatalogoCompra): BorradorCompra {
  const id = productoId !== undefined && catalogo.has(productoId) ? productoId : null
  return { fecha, renglones: [renglonNuevo('r1', id, catalogo)] }
}

/** Agrega un renglón vacío al final, con la clave dada. */
export function agregarRenglonCompra(borrador: BorradorCompra, clave: string): BorradorCompra {
  return { ...borrador, renglones: [...borrador.renglones, { clave, productoId: null, presentacion: 'caja', cantidad: 1, precio: null }] }
}

/**
 * Cambia un renglón.
 *
 * Qué hace: aplica los cambios al renglón con esa clave.
 * Cómo lo hace: mezcla los cambios y corrige la presentación si el producto
 * no la admite.
 * Por qué: la pantalla no decide reglas de productos.
 */
export function cambiarRenglonCompra(
  borrador: BorradorCompra,
  clave: string,
  cambios: CambiosRenglonCompra,
  catalogo: CatalogoCompra,
): BorradorCompra {
  return {
    ...borrador,
    renglones: borrador.renglones.map((r) => {
      if (r.clave !== clave) return r
      const nuevo = { ...r, ...cambios }
      const producto = nuevo.productoId === null ? undefined : catalogo.get(nuevo.productoId)
      return { ...nuevo, presentacion: presentacionPara(producto, nuevo.presentacion) }
    }),
  }
}

/** Quita el renglón con esa clave. */
export function quitarRenglonCompra(borrador: BorradorCompra, clave: string): BorradorCompra {
  return { ...borrador, renglones: borrador.renglones.filter((r) => r.clave !== clave) }
}

/**
 * Calcula el borrador.
 *
 * Qué hace: devuelve el cálculo de cada renglón, el total, las unidades y si
 * se puede registrar.
 * Cómo lo hace: usa calcularCompra en cada renglón; el primer problema se
 * informa con su número de renglón.
 * Por qué: una compra con un renglón incompleto no se registra a medias.
 */
export function calcularBorradorCompra(borrador: BorradorCompra, catalogo: CatalogoCompra): BorradorCompraCalculado {
  const renglones = borrador.renglones.map((r) =>
    calcularCompra({
      producto: r.productoId === null ? null : catalogo.get(r.productoId) ?? null,
      presentacion: r.presentacion,
      cantidad: r.cantidad,
      precio: r.precio,
    }),
  )
  const total = renglones.reduce((suma, r) => suma + (r.costoTotal ?? 0), 0)
  const unidades = renglones.reduce((suma, r) => suma + r.unidades, 0)
  const indice = renglones.findIndex((r) => r.problema !== null)
  const problema =
    renglones.length === 0 ? 'Agrega al menos un producto' : indice === -1 ? null : `Renglón ${indice + 1}: ${renglones[indice].problema}`
  return { renglones, total, unidades, problema, puedeRegistrar: problema === null }
}

/**
 * Convierte el borrador en los datos a registrar.
 *
 * Qué hace: devuelve la fecha y, por renglón, producto, presentación,
 * cantidad y total pagado.
 * Cómo lo hace: calcula el borrador y, si hay problema, lo lanza.
 * Por qué: la base guarda el total de cada compra; el precio por caja solo
 * sirve para calcularlo.
 *
 * @throws Error con el problema si el borrador no se puede registrar.
 */
export function aDatosCompras(borrador: BorradorCompra, catalogo: CatalogoCompra): DatosCompras {
  const calculado = calcularBorradorCompra(borrador, catalogo)
  if (calculado.problema !== null) throw new Error(calculado.problema)
  return {
    fecha: borrador.fecha,
    renglones: borrador.renglones.map((r, i) => ({
      productoId: r.productoId as string,
      presentacion: r.presentacion,
      cantidad: r.cantidad,
      costoTotal: calculado.renglones[i].costoTotal as number,
    })),
  }
}
