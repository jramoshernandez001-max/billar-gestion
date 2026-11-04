/**
 * Aviso de "sin conexión".
 *
 * Qué hace: muestra una franja cuando el dispositivo pierde internet y la
 * quita cuando vuelve.
 * Cómo lo hace: lee `navigator.onLine` y escucha los eventos `online` y
 * `offline` con `useSyncExternalStore`.
 * Por qué: sin conexión se ven las últimas copias guardadas y solo se pueden
 * registrar cosas nuevas (se envían después); anular, corregir y cerrar
 * necesitan internet. Avisarlo evita confusiones.
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
        <span>Ves los últimos datos guardados. Ventas, compras, traslados, ajustes, deudas y abonos se envían al volver internet; lo demás necesita conexión.</span>
      </div>
    </div>
  )
}
