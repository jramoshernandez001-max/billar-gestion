/**
 * Lista desplegable con etiqueta.
 *
 * Qué hace: muestra un campo con la opción elegida y una flecha, y deja
 * cambiarla desde la lista del teléfono.
 * Cómo lo hace: un `<select>` nativo sin estilo propio, dentro del recuadro
 * del diseño, con el ícono de flecha encima.
 * Por qué: la lista nativa es la más cómoda y accesible en el celular; solo se
 * le da la apariencia del diseño.
 */
import { useId } from 'react'
import { ChevronDown } from 'lucide-react'

export interface OpcionLista {
  valor: string
  etiqueta: string
}

interface Propiedades {
  etiqueta: string
  /** Valor elegido; cadena vacía significa que aún no se elige. */
  valor: string
  opciones: readonly OpcionLista[]
  /** Texto de la opción vacía (ej. "Elegir producto"). */
  textoVacio?: string
  alCambiar: (valor: string) => void
}

export function ListaDesplegable({ etiqueta, valor, opciones, textoVacio = 'Elegir', alCambiar }: Propiedades) {
  const id = useId()
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>{etiqueta}</label>
      <div className="entrada">
        <select id={id} className="entrada__control entrada__control--lista" value={valor} onChange={(e) => alCambiar(e.target.value)}>
          {valor === '' && <option value="">{textoVacio}</option>}
          {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>
        <ChevronDown size={18} strokeWidth={1.5} className="entrada__icono" aria-hidden="true" />
      </div>
    </div>
  )
}
