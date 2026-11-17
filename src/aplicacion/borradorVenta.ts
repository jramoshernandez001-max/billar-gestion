/**
 * Borrador de venta (estado del formulario "Nueva venta").
 *
 * Qué hace: maneja la venta que se está armando antes de registrarla: agregar,
 * cambiar y quitar renglones y productos adicionales ("Otros"); calcular precio de lista, subtotales y total; y
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
import { presentacionPermitida } from '../domain/inventario/categorias'
import { precioDeLista, valorItem, type ProductoVendible } from '../domain/ventas/valorVenta'
import { normalizarAdicional, type ProductoAdicional } from '../domain/ventas/productosAdicionales'
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

/** Un producto adicional ("Otros") mientras se captura. */
export interface AdicionalBorrador {
  /** Identificador dentro del formulario (lo da la pantalla). */
  clave: string
  /** Nombre tal como se escribe; se limpia al registrar. */
  descripcion: string
  cantidad: number
  /** Valor total del renglón; null mientras no se escribe. */
  valor: number | null
}

/** La venta que se está armando. */
export interface BorradorVenta {
  fecha: string
  renglones: readonly RenglonBorrador[]
  /** Productos que no están en el inventario; si falta, no hay ninguno. */
  adicionales?: readonly AdicionalBorrador[]
}

/** Lo calculado de un producto adicional para mostrarlo. */
export interface AdicionalCalculado {
  clave: string
  /** Qué está mal; null si está bien. */
  problema: string | null
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
  adicionales: AdicionalCalculado[]
  /** Productos del inventario más el valor de los adicionales válidos. */
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
 * Agrega un renglón vacío (sin producto, una unidad) arriba de los demás.
 *
 * Qué hace: devuelve el borrador con el renglón nuevo de primero.
 * Cómo lo hace: lo pone al inicio de la lista, antes de los que ya había.
 * Por qué: en el celular, el renglón nuevo queda a la vista junto al botón
 * de agregar, sin bajar hasta el final de una venta larga.
 *
 * @throws Error si ya hay un renglón con esa clave.
 */
export function agregarRenglon(borrador: BorradorVenta, clave: string): BorradorVenta {
  if (borrador.renglones.some((r) => r.clave === clave)) {
    throw new Error(`Ya existe un renglón con la clave ${clave}`)
  }
  return {
    ...borrador,
    renglones: [{ clave, productoId: null, presentacion: 'unidad', cantidad: 1 }, ...borrador.renglones],
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
      if (cambios.productoId !== undefined && catalogo !== undefined) {
        const producto = nuevo.productoId === null ? undefined : catalogo.get(nuevo.productoId)
        // Si el producto nuevo no admite la presentación elegida (sixpack sin
        // sixpack, o caja/sixpack en un licor), vuelve a unidad.
        if (producto !== undefined && !presentacionPermitida(producto.categoria ?? 'cerveza', nuevo.presentacion, producto.manejaSixpack)) {
          nuevo.presentacion = 'unidad'
        }
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

/** Cambios permitidos en un adicional (la clave no cambia). */
export type CambiosAdicional = Partial<Omit<AdicionalBorrador, 'clave'>>

/**
 * Agrega un producto adicional vacío (sin nombre, cantidad 1, sin valor)
 * arriba de los demás.
 *
 * Qué hace: devuelve el borrador con el adicional nuevo de primero.
 * Cómo lo hace: lo pone al inicio de la lista de adicionales.
 * Por qué: igual que los renglones, el nuevo queda a la vista junto al botón.
 *
 * @throws Error si ya hay un adicional con esa clave.
 */
export function agregarAdicional(borrador: BorradorVenta, clave: string): BorradorVenta {
  const actuales = borrador.adicionales ?? []
  if (actuales.some((a) => a.clave === clave)) throw new Error(`Ya existe un producto adicional con la clave ${clave}`)
  return { ...borrador, adicionales: [{ clave, descripcion: '', cantidad: 1, valor: null }, ...actuales] }
}

/**
 * Cambia campos de un producto adicional.
 * Cómo lo hace: copia el adicional con los cambios.
 * @throws Error si no existe.
 */
export function cambiarAdicional(borrador: BorradorVenta, clave: string, cambios: CambiosAdicional): BorradorVenta {
  const actuales = borrador.adicionales ?? []
  if (!actuales.some((a) => a.clave === clave)) throw new Error(`No existe el producto adicional ${clave}`)
  return { ...borrador, adicionales: actuales.map((a) => (a.clave === clave ? { ...a, ...cambios } : a)) }
}

/** Quita un producto adicional. @throws Error si no existe. */
export function quitarAdicional(borrador: BorradorVenta, clave: string): BorradorVenta {
  const actuales = borrador.adicionales ?? []
  if (!actuales.some((a) => a.clave === clave)) throw new Error(`No existe el producto adicional ${clave}`)
  return { ...borrador, adicionales: actuales.filter((a) => a.clave !== clave) }
}

/**
 * Convierte un adicional del formulario en uno del dominio, limpio.
 *
 * Qué hace: devuelve el adicional listo o el problema que lo impide.
 * Cómo lo hace: exige un valor escrito y usa normalizarAdicional, que limpia
 * el nombre y valida cantidad y valor.
 * Por qué: la pantalla muestra el problema en lenguaje claro y no deja
 * registrar hasta corregirlo.
 */
function revisarAdicional(adicional: AdicionalBorrador): { listo: ProductoAdicional | null; problema: string | null } {
  if (adicional.valor === null) return { listo: null, problema: 'Escribe el valor del producto adicional' }
  try {
    const listo = normalizarAdicional({ descripcion: adicional.descripcion, cantidad: adicional.cantidad, valor: adicional.valor })
    return { listo, problema: null }
  } catch (causa) {
    return { listo: null, problema: causa instanceof Error ? causa.message : String(causa) }
  }
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
  const revisados = (borrador.adicionales ?? []).map(revisarAdicional)
  const adicionales = (borrador.adicionales ?? []).map((a, i) => ({ clave: a.clave, problema: revisados[i].problema }))
  const problemas: string[] = []
  try {
    validarFecha('La fecha de la venta', borrador.fecha)
  } catch (causa) {
    problemas.push(causa instanceof Error ? causa.message : String(causa))
  }
  for (const r of renglones) if (r.problema !== null) problemas.push(r.problema)
  for (const a of adicionales) if (a.problema !== null) problemas.push(a.problema)
  // Un adicional válido también es algo que vender (puede ir solo).
  const hayAlgo =
    borrador.renglones.some((r, i) => renglones[i].problema === null && r.cantidad > 0) ||
    revisados.some((a) => a.listo !== null)
  if (!hayAlgo && problemas.length === 0) problemas.push('No hay nada que vender: agrega un renglón con cantidad')
  const total =
    renglones.reduce((suma, r) => suma + (r.subtotal ?? 0), 0) +
    revisados.reduce((suma, a) => suma + (a.listo?.valor ?? 0), 0)
  // Las unidades son las del inventario: los adicionales no cuentan.
  const unidades = renglones.reduce((suma, r) => suma + r.unidades, 0)
  return { renglones, adicionales, total, unidades, problemas, puedeRegistrar: problemas.length === 0 }
}

/**
 * Convierte el borrador en los datos que recibe el repositorio de ventas.
 * @throws Error con el primer problema si el borrador no se puede registrar.
 */
export function aDatosVenta(borrador: BorradorVenta, catalogo: CatalogoVendible): DatosVenta {
  const calculado = calcularBorrador(borrador, catalogo)
  if (!calculado.puedeRegistrar) throw new Error(calculado.problemas[0])
  const adicionales = (borrador.adicionales ?? []).map((a) => revisarAdicional(a).listo as ProductoAdicional)
  return {
    fecha: borrador.fecha,
    renglones: borrador.renglones.map((r) => ({
      productoId: r.productoId as string,
      presentacion: r.presentacion,
      cantidad: r.cantidad,
      ...(r.precioCobrado !== undefined ? { precioCobrado: r.precioCobrado } : {}),
    })),
    ...(adicionales.length > 0 ? { adicionales } : {}),
  }
}
