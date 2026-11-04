/**
 * Cabecera de una pantalla interna.
 *
 * Qué hace: muestra la flecha para volver, el título y un subtítulo, como en
 * las pantallas internas del diseño de Figma (Nueva venta, Ventas, etc.).
 * Cómo lo hace: recibe los textos y la acción de volver por propiedades.
 * Por qué: todas las pantallas internas llevan la misma cabecera; un solo
 * componente mantiene el diseño igual y la flecha accesible (con nombre).
 */
import { ArrowLeft } from 'lucide-react'

interface Propiedades {
  titulo: string
  subtitulo: string
  alVolver: () => void
}

export function CabeceraInterna({ titulo, subtitulo, alVolver }: Propiedades) {
  return (
    <header className="cabecera">
      <button type="button" className="cabecera__volver" aria-label="Volver" onClick={alVolver}>
        <ArrowLeft size={20} strokeWidth={1.5} />
      </button>
      <div className="cabecera__titulos">
        <h1 className="cabecera__titulo">{titulo}</h1>
        <p className="cabecera__subtitulo">{subtitulo}</p>
      </div>
    </header>
  )
}
