/**
 * Formulario para anular un registro con motivo.
 *
 * Qué hace: muestra un campo de motivo y los botones Cancelar y Confirmar
 * anulación; Confirmar solo se habilita con un motivo escrito.
 * Cómo lo hace: llama a `alConfirmar` con el motivo sin espacios a los lados
 * y, si falla, muestra el mensaje junto al botón.
 * Por qué: nada se borra; toda anulación (venta, compra, deuda, abono) exige
 * un motivo que queda en la bitácora. Un solo componente evita repetir el
 * mismo formulario en cada pantalla.
 */
import { useId, useState } from 'react'

interface Propiedades {
  alConfirmar: (motivo: string) => Promise<void>
  alCancelar: () => void
}

export function FormularioAnulacion({ alConfirmar, alCancelar }: Propiedades) {
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
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>Motivo de la anulación</label>
      <textarea id={id} className="entrada entrada--texto" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      {fallo !== null && <span role="alert" className="texto-error">{fallo}</span>}
      <div className="acciones">
        <button type="button" className="boton" onClick={alCancelar}>Cancelar</button>
        <button type="button" className="boton boton--peligro" disabled={motivo.trim() === '' || enviando} onClick={confirmar}>
          Confirmar anulación
        </button>
      </div>
    </div>
  )
}
