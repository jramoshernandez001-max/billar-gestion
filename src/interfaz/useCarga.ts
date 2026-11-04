/**
 * Hook de carga de datos.
 *
 * Qué hace: ejecuta una carga asíncrona y entrega su estado (cargando, listo
 * o error), los datos o el mensaje de error, y una función para recargar.
 * Cómo lo hace: lanza la carga al montarse y cada vez que cambia la función o
 * se pide recargar; descarta la respuesta de una carga que ya fue reemplazada.
 * Por qué: todas las pantallas leen datos igual. Ignorar respuestas viejas
 * evita mostrar datos de una carga anterior si llegan tarde. La función
 * `cargar` debe ser estable (useCallback) para no recargar sin necesidad.
 */
import { useCallback, useEffect, useState } from 'react'

/** Estado de una carga. */
export interface EstadoCarga<T> {
  estado: 'cargando' | 'listo' | 'error'
  datos: T | null
  error: string | null
  recargar: () => void
}

export function useCarga<T>(cargar: () => Promise<T>): EstadoCarga<T> {
  const [resultado, setResultado] = useState<{ estado: EstadoCarga<T>['estado']; datos: T | null; error: string | null }>({
    estado: 'cargando',
    datos: null,
    error: null,
  })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    cargar().then(
      (datos) => {
        if (vigente) setResultado({ estado: 'listo', datos, error: null })
      },
      (causa: unknown) => {
        if (vigente) {
          setResultado({ estado: 'error', datos: null, error: causa instanceof Error ? causa.message : String(causa) })
        }
      },
    )
    return () => {
      vigente = false
    }
  }, [cargar, version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  return { ...resultado, recargar }
}
