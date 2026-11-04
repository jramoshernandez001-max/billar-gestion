/**
 * Hook de ruta.
 *
 * Qué hace: devuelve la ruta actual (la parte de la dirección después de #/)
 * y una función `ir` para cambiarla.
 * Cómo lo hace: lee `location.hash`, escucha el evento `hashchange` y escribe
 * el hash al navegar.
 * Por qué: así el botón "atrás" del celular vuelve a la pantalla anterior y
 * una pantalla interna se puede recargar sin configurar el servidor.
 */
import { useCallback, useEffect, useState } from 'react'
import { rutaDesdeHash } from './ruta'

export function useRuta(): { ruta: string; ir: (ruta: string) => void } {
  const [ruta, setRuta] = useState(() => rutaDesdeHash(window.location.hash))

  useEffect(() => {
    const alCambiar = () => setRuta(rutaDesdeHash(window.location.hash))
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  const ir = useCallback((destino: string) => {
    window.location.hash = `#/${destino}`
    setRuta(destino)
  }, [])

  return { ruta, ir }
}
