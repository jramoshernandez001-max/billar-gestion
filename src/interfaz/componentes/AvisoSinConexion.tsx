/**
 * Aviso de "sin conexión".
 *
 * Qué hace: muestra una franja cuando el dispositivo pierde internet y la
 * quita cuando vuelve.
 * Cómo lo hace: lee `navigator.onLine` y escucha los eventos `online` y
 * `offline` con `useSyncExternalStore`.
 * Por qué: toda escritura pasa por funciones de la base; sin conexión no se
 * puede guardar. Avisarlo evita que alguien crea que registró una venta que
 * no llegó a guardarse.
 */
import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'

function suscribir(alCambiar: () => void): () => void {
  window.addEventListener('online', alCambiar)
  window.addEventListener('offline', alCambiar)
  return () => {
    window.removeEventListener('online', alCambiar)
    window.removeEventListener('offline', alCambiar)
  }
}

export function AvisoSinConexion() {
  const enLinea = useSyncExternalStore(suscribir, () => window.navigator.onLine, () => true)
  if (enLinea) return null
  return (
    <div role="status" className="aviso aviso--sin-conexion">
      <WifiOff size={18} strokeWidth={1.5} aria-hidden="true" />
      <div className="aviso__mensaje">
        <span className="aviso__titulo">Sin conexión</span>
        <span>No se pueden guardar cambios hasta que vuelva internet.</span>
      </div>
    </div>
  )
}
