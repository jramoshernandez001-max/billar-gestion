/**
 * Rutas de la interfaz.
 *
 * Qué hace: lee la ruta de la dirección (la parte después de #) y dice a qué
 * pestaña de la barra inferior pertenece.
 * Cómo lo hace: funciones puras sobre texto; la ruta es el texto que sigue a
 * `#/` (por ejemplo "deudas/nueva").
 * Por qué: con rutas por `#` no hace falta configurar el servidor para
 * instalar la app ni recargar una pantalla interna. Las pantallas internas
 * (ej. "inventario/trasladar") pertenecen a la pestaña de su primer tramo.
 */

/** Pestañas de la barra inferior. */
export type Pestana = 'inicio' | 'vender' | 'inventario' | 'deudas' | 'mas'

/** Ruta inicial cuando la dirección no trae una. */
export const RUTA_INICIAL = 'inicio'

const PESTANAS: readonly Pestana[] = ['inicio', 'vender', 'inventario', 'deudas', 'mas']

/** Lee la ruta de un `location.hash`; vacío significa inicio. */
export function rutaDesdeHash(hash: string): string {
  const ruta = hash.replace(/^#\/?/, '')
  return ruta === '' ? RUTA_INICIAL : ruta
}

/** Pestaña a la que pertenece una ruta, o null si no es de ninguna. */
export function pestanaDe(ruta: string): Pestana | null {
  const primero = ruta.split('/')[0]
  return PESTANAS.find((p) => p === primero) ?? null
}

/**
 * Parte una ruta en tramos ("inventario/trasladar/abc" → 3 tramos).
 *
 * Qué hace: devuelve los tramos sin vacíos y con los identificadores
 * decodificados.
 * Cómo lee: separa por "/" y decodifica cada tramo; si la codificación está
 * rota deja el tramo como vino.
 * Por qué: las pantallas internas llevan el producto en la ruta
 * (`inventario/trasladar/<id>`); así se recarga la pantalla y el botón
 * "atrás" funciona sin guardar estado aparte.
 */
export function segmentosDeRuta(ruta: string): string[] {
  return ruta
    .split('/')
    .filter((tramo) => tramo !== '')
    .map((tramo) => {
      try {
        return decodeURIComponent(tramo)
      } catch {
        return tramo
      }
    })
}
