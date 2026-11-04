/**
 * Validación del formulario de producto.
 *
 * Qué hace: revisa nombre, unidades por caja y precios tal como los escribe
 * la persona y devuelve los datos listos para el repositorio o un mensaje por
 * campo.
 * Cómo lo hace: limpia espacios, convierte los textos a números enteros y
 * compara el nombre (sin mayúsculas ni espacios repetidos) con los otros
 * productos.
 * Un licor se vende por botella entera: no se piden unidades por caja,
 * sixpack ni precio de la caja; se guardan como 1 por caja, sin sixpack y con
 * la caja al precio de la botella (la base exige esa forma).
 * Por qué: la base rechaza nombres repetidos y montos inválidos; avisarlo
 * junto al campo evita un error genérico al guardar. La regla de la base
 * sigue siendo la que manda.
 */
import type { DatosProducto } from '../datos/inventario'
import type { CategoriaProducto } from '../domain/inventario/categorias'

/** Lo que hay escrito en el formulario (todo texto, como en los campos). */
export interface EntradaProducto {
  nombre: string
  categoria: CategoriaProducto
  unidadesPorCaja: string
  manejaSixpack: boolean
  precioUnidad: string
  precioCaja: string
}

export type CampoProducto = 'nombre' | 'unidadesPorCaja' | 'precioUnidad' | 'precioCaja'

export interface ResultadoProducto {
  /** Datos listos para guardar; null si hay errores. */
  datos: DatosProducto | null
  errores: Partial<Record<CampoProducto, string>>
  puedeGuardar: boolean
}

/** Nombre sin mayúsculas ni espacios repetidos, para detectar repetidos. */
export function nombreNormalizado(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Entero mayor a cero o null si el texto no lo es. */
function enteroPositivo(texto: string): number | null {
  if (!/^\d+$/.test(texto.trim())) return null
  const n = Number(texto)
  return n > 0 ? n : null
}

/**
 * Valida el formulario.
 * @param otrosNombres nombres de los demás productos (al editar, sin el propio).
 */
export function validarProducto(entrada: EntradaProducto, otrosNombres: readonly string[]): ResultadoProducto {
  const errores: ResultadoProducto['errores'] = {}
  const nombre = entrada.nombre.trim().replace(/\s+/g, ' ')
  if (nombre === '') errores.nombre = 'Escribe el nombre del producto'
  else if (otrosNombres.some((o) => nombreNormalizado(o) === nombreNormalizado(nombre))) {
    errores.nombre = 'Ya existe un producto con ese nombre'
  }
  const esLicor = entrada.categoria === 'licor'
  const precioUnidad = enteroPositivo(entrada.precioUnidad)
  if (precioUnidad === null) errores.precioUnidad = 'Escribe el precio en pesos, mayor a cero'
  // El licor es por botella: sus unidades por caja y su caja se fijan solas.
  const unidadesPorCaja = esLicor ? 1 : enteroPositivo(entrada.unidadesPorCaja)
  if (unidadesPorCaja === null) errores.unidadesPorCaja = 'Escribe un número entero mayor a cero'
  const precioCaja = esLicor ? precioUnidad : enteroPositivo(entrada.precioCaja)
  if (!esLicor) {
    if (precioCaja === null) errores.precioCaja = 'Escribe el precio en pesos, mayor a cero'
    else if (precioUnidad !== null && precioCaja < precioUnidad) {
      errores.precioCaja = 'El precio de la caja no puede ser menor al de una unidad'
    }
  }

  if (Object.keys(errores).length > 0 || unidadesPorCaja === null || precioUnidad === null || precioCaja === null) {
    return { datos: null, errores, puedeGuardar: false }
  }
  return {
    datos: {
      nombre,
      categoria: entrada.categoria,
      unidadesPorCaja,
      manejaSixpack: esLicor ? false : entrada.manejaSixpack,
      precioUnidad,
      precioCaja,
    },
    errores: {},
    puedeGuardar: true,
  }
}
