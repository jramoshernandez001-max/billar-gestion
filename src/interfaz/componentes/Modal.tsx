/**
 * Ventana emergente (modal).
 *
 * Qué hace: muestra un contenido sobre la pantalla, con título y botón
 * Cerrar, atenuando el fondo.
 * Cómo lo hace: un contenedor fijo con rol "dialog" y `aria-modal`; se cierra
 * con Escape, con el botón Cerrar o al tocar el fondo (no al tocar dentro).
 * Por qué: el diseño de Figma pone las confirmaciones (como anular) en
 * ventanas emergentes; un solo componente las hace iguales y usables con
 * teclado y lector de pantalla.
 */
import { useEffect, useId, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Propiedades {
  titulo: string
  alCerrar: () => void
  children: ReactNode
}

export function Modal({ titulo, alCerrar, children }: Propiedades) {
  const idTitulo = useId()

  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [alCerrar])

  return (
    <div className="modal-fondo" data-testid="fondo-modal" onClick={alCerrar}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="modal__cabecera">
          <h2 id={idTitulo} className="modal__titulo">{titulo}</h2>
          <button type="button" className="modal__cerrar" aria-label="Cerrar" onClick={alCerrar}>
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
