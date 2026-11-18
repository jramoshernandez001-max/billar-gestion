/**
 * Ventana para anular un registro con motivo.
 *
 * Qué hace: abre una ventana emergente con un campo de motivo y los botones
 * Cancelar y Confirmar anulación; Confirmar solo se habilita con un motivo
 * escrito.
 * Cómo lo hace: llama a `alConfirmar` con el motivo sin espacios a los lados
 * y, si falla, muestra el mensaje junto al botón.
 * Por qué: nada se borra; toda anulación (venta, compra, deuda, abono) exige
 * un motivo que queda en la bitácora. Un solo componente evita repetir el
 * mismo formulario en cada pantalla.
 */
import { useId, useState } from 'react'
import { Modal } from './Modal'

interface Propiedades {
  /** Título de la ventana, por ejemplo "Anular venta". */
  titulo?: string
  /** Texto sobre el campo del motivo. */
  etiquetaMotivo?: string
  /** Aclaración bajo el campo. */
  nota?: string
  /** Texto del botón que confirma. */
  textoConfirmar?: string
  alConfirmar: (motivo: string) => Promise<void>
  alCancelar: () => void
}

export function FormularioAnulacion({
  titulo = 'Anular registro',
  etiquetaMotivo = 'Motivo de la anulación',
  nota = 'Nada se borra: la anulación queda en la bitácora con este motivo.',
  textoConfirmar = 'Confirmar anulación',
  alConfirmar,
  alCancelar,
}: Propiedades) {
  const id = useId()
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const confirmar = async () => {
    setEnviando(true)
    setFallo(null)
    try {
      await alConfirmar(motivo.trim())
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : String(causa))
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={titulo} alCerrar={alCancelar}>
      <div className="campo">
        <label className="campo__etiqueta" htmlFor={id}>{etiquetaMotivo}</label>
        <textarea id={id} className="entrada entrada--texto" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        {fallo !== null && <span role="alert" className="texto-error">{fallo}</span>}
        <p className="texto-suave">{nota}</p>
        <div className="acciones">
          <button type="button" className="boton" onClick={alCancelar}>Cancelar</button>
          <button type="button" className="boton boton--peligro" disabled={motivo.trim() === '' || enviando} onClick={confirmar}>
            {textoConfirmar}
          </button>
        </div>
      </div>
    </Modal>
  )
}
