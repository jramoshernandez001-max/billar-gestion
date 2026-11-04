/**
 * Borrador de venta (estado del formulario "Nueva venta").
 *
 * Qué hace: maneja la venta que se está armando antes de registrarla: agregar,
 * cambiar y quitar renglones; calcular precio de lista, subtotales y total; y
 * decir qué problemas impiden registrarla.
 * Cómo lo hace: funciones puras que devuelven un borrador nuevo (nunca
 * modifican el anterior) y usan el cálculo de precios del dominio.
 * Por qué: la pantalla solo dibuja este estado y llama a estas funciones; así
 * la lógica se prueba sin pantalla y el diseño de Figma puede cambiar sin
 * tocarla. El registro real lo hace el repositorio de ventas, y la base
 * vuelve a validar todo.
 */
import type { Presentacion } from '../domain/inventario/conversiones'
import { validarFecha } from '../domain/compartido/validaciones'
import { aUnidades } from '../domain/inventario/conversiones'
import { precioDeLista, valorItem, type ProductoVendible } from '../domain/ventas/valorVenta'
import type { DatosVenta } from '../datos/ventas'

/** Productos disponibles para vender, por id. */
export type CatalogoVendible = ReadonlyMap<string, ProductoVendible>

/** Un renglón mientras se captura. */
export interface RenglonBorrador {
  /** Identificador del renglón dentro del formulario (lo da la pantalla). */
  clave: string
  /** Producto elegido; null mientras no se elige. */
  productoId: string | null
  presentacion: Presentacion
  cantidad: number
  /** Precio por presentación editado a mano; si falta rige el de lista. */
  precioCobrado?: number
}

/** La venta que se está armando. */
export interface BorradorVenta {
  fecha: string
  renglones: readonly RenglonBorrador[]
}

/** Lo calculado de un renglón para mostrarlo. */
export interface RenglonCalculado {
  clave: string
  /** Precio de lista de la presentación; null si no se pudo determinar. */
  precioLista: number | null
  /** Cantidad por precio efectivo; null si hay un problema. */
  subtotal: number | null
  /** Unidades físicas del renglón; 0 si hay un problema. */
  unidades: number
  /** Qué está mal en el renglón; null si está bien. */
  problema: string | null
}

/** Lo calculado de toda la venta. */
export interface BorradorCalculado {
  renglones: RenglonCalculado[]
  total: number
  /** Unidades físicas de todos los renglones válidos. */
  unidades: number
  /** Problemas de la venta y de sus renglones, en lenguaje claro. */
  problemas: string[]
  puedeRegistrar: boolean
}

/** Cambios permitidos en un renglón (la clave no cambia). */
export type CambiosRenglon = Partial<Omit<RenglonBorrador, 'clave'>>

/** Empieza una venta sin renglones. */
export function borradorVacio(fecha: string): BorradorVenta {
  return { fecha, renglones: [] }
}

/**
 * Agrega un renglón vacío (sin producto, una unidad).
 * @throws Error si ya hay un renglón con esa clave.
 */
export function agregarRenglon(borrador: BorradorVenta, clave: string): BorradorVenta {
  if (borrador.renglones.some((r) => r.clave === clave)) {
    throw new Error(`Ya existe un renglón con la clave ${clave}`)
  }
  return {
    ...borrador,
    renglones: [...borrador.renglones, { clave, productoId: null, presentacion: 'unidad', cantidad: 1 }],
  }
}

/**
 * Cambia campos de un renglón.
 *
 * Qué hace: devuelve el borrador con el renglón cambiado.
 * Cómo lo hace: copia el renglón con los cambios. Si cambia la presentación se
 * descarta el precio cobrado (era el de otra presentación). Si cambia el
 * producto y se da el catálogo, un sixpack de un producto que no lo maneja
 * vuelve a unidad.
 * Por qué: evita cobrar por error el precio de una presentación en otra.
 *
 * @throws Error si no existe el renglón.
 */
export function cambiarRenglon(
  borrador: BorradorVenta,
  clave: string,
  cambios: CambiosRenglon,
  catalogo?: CatalogoVendible,
): BorradorVenta {
  if (!borrador.renglones.some((r) => r.clave === clave)) throw new Error(`No existe el renglón ${clave}`)
  return {
    ...borrador,
    renglones: borrador.renglones.map((anterior) => {
      if (anterior.clave !== clave) return anterior
      const nuevo: RenglonBorrador = { ...anterior, ...cambios }
      if (cambios.presentacion !== undefined && cambios.presentacion !== anterior.presentacion && cambios.precioCobrado === undefined) {
        delete nuevo.precioCobrado
      }
      if (cambios.productoId !== undefined && catalogo !== undefined && nuevo.presentacion === 'sixpack') {
        const producto = nuevo.productoId === null ? undefined : catalogo.get(nuevo.productoId)
        if (producto !== undefined && !producto.manejaSixpack) nuevo.presentacion = 'unidad'
      }
      return nuevo
    }),
  }
}

/** Quita un renglón. @throws Error si no existe. */
export function quitarRenglon(borrador: BorradorVenta, clave: string): BorradorVenta {
  if (!borrador.renglones.some((r) => r.clave === clave)) throw new Error(`No existe el renglón ${clave}`)
  return { ...borrador, renglones: borrador.renglones.filter((r) => r.clave !== clave) }
}

/** Calcula un renglón; los errores del dominio se vuelven un problema legible. */
function calcularRenglon(renglon: RenglonBorrador, catalogo: CatalogoVendible): RenglonCalculado {
  const vacio = { clave: renglon.clave, precioLista: null, subtotal: null, unidades: 0 }
  if (renglon.productoId === null) return { ...vacio, problema: 'Elige un producto' }
  const producto = catalogo.get(renglon.productoId)
  if (producto === undefined) return { ...vacio, problema: 'El producto elegido no existe' }
  try {
    const precioLista = precioDeLista(producto, renglon.presentacion)
    const subtotal = valorItem({
      producto,
      presentacion: renglon.presentacion,
      cantidad: renglon.cantidad,
      precioCobrado: renglon.precioCobrado,
    })
    const unidades = aUnidades(producto, renglon.presentacion, renglon.cantidad)
    return { clave: renglon.clave, precioLista, subtotal, unidades, problema: null }
  } catch (causa) {
    return { ...vacio, problema: causa instanceof Error ? causa.message : String(causa) }
  }
}

/**
 * Calcula precios, total y problemas del borrador.
 *
 * Qué hace: devuelve lo que la pantalla muestra y si se puede registrar.
 * Cómo lo hace: calcula cada renglón, suma los subtotales válidos y junta los
 * problemas (fecha, renglones, y que haya algo que vender).
 * Por qué: un renglón de cantidad cero se ignora, pero si todos son cero la
 * venta se rechaza (igual que en la base).
 */
export function calcularBorrador(borrador: BorradorVenta, catalogo: CatalogoVendible): BorradorCalculado {
  const renglones = borrador.renglones.map((r) => calcularRenglon(r, catalogo))
  const problemas: string[] = []
  try {
    validarFecha('La fecha de la venta', borrador.fecha)
  } catch (causa) {
    problemas.push(causa instanceof Error ? causa.message : String(causa))
  }
  for (const r of renglones) if (r.problema !== null) problemas.push(r.problema)
  const hayAlgo = borrador.renglones.some((r, i) => renglones[i].problema === null && r.cantidad > 0)
  if (!hayAlgo && problemas.length === 0) problemas.push('No hay nada que vender: agrega un renglón con cantidad')
  const total = renglones.reduce((suma, r) => suma + (r.subtotal ?? 0), 0)
  const unidades = renglones.reduce((suma, r) => suma + r.unidades, 0)
  return { renglones, total, unidades, problemas, puedeRegistrar: problemas.length === 0 }
}

/**
 * Convierte el borrador en los datos que recibe el repositorio de ventas.
 * @throws Error con el primer problema si el borrador no se puede registrar.
 */
export function aDatosVenta(borrador: BorradorVenta, catalogo: CatalogoVendible): DatosVenta {
  const calculado = calcularBorrador(borrador, catalogo)
  if (!calculado.puedeRegistrar) throw new Error(calculado.problemas[0])
  return {
    fecha: borrador.fecha,
    renglones: borrador.renglones.map((r) => ({
      productoId: r.productoId as string,
      presentacion: r.presentacion,
      cantidad: r.cantidad,
      ...(r.precioCobrado !== undefined ? { precioCobrado: r.precioCobrado } : {}),
    })),
  }
}
