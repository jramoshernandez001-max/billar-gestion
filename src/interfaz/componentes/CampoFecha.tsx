/**
 * Campo de fecha.
 *
 * Qué hace: muestra la fecha elegida ("Hoy, 03/11/2026") con el ícono de
 * calendario y deja cambiarla.
 * Cómo lo hace: un campo de fecha nativo, invisible y encima del texto, abre
 * el calendario del teléfono; el texto visible sale de `fechaCompleta`.
 * Por qué: el calendario nativo es el más cómodo en el celular y el texto
 * propio mantiene el formato día/mes/año del diseño. La fecha se guarda como
 * texto AAAA-MM-DD, sin hora.
 */
import { CalendarDays } from 'lucide-react'
import { fechaCompleta } from '../formato'

interface Propiedades {
  /** Fecha elegida, AAAA-MM-DD. */
  valor: string
  /** Día de hoy, AAAA-MM-DD (para escribir "Hoy, …"). */
  hoy: string
  etiqueta?: string
  alCambiar: (fecha: string) => void
}

export function CampoFecha({ valor, hoy, etiqueta = 'Fecha', alCambiar }: Propiedades) {
  const texto = valor === hoy ? `Hoy, ${fechaCompleta(valor)}` : fechaCompleta(valor)
  return (
    <div className="campo">
      <span className="campo__etiqueta">{etiqueta}</span>
      <label className="entrada entrada--fecha">
        <span className="entrada__texto">{texto}</span>
        <CalendarDays size={18} strokeWidth={1.5} className="entrada__icono" aria-hidden="true" />
        <input
          type="date"
          className="entrada__fecha-nativa"
          aria-label={etiqueta}
          value={valor}
          onChange={(e) => {
            if (e.target.value !== '') alCambiar(e.target.value)
          }}
        />
      </label>
    </div>
  )
}
