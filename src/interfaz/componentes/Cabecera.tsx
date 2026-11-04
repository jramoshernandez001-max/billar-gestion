/**
 * Cabecera de pantalla.
 *
 * Qué hace: muestra el título de la pantalla, un subtítulo y la insignia del
 * negocio, como en el diseño de Figma.
 * Cómo lo hace: recibe los textos por propiedades y dibuja el ícono de tienda.
 * Por qué: todas las pantallas llevan la misma cabecera; un solo componente
 * mantiene el diseño igual en todas.
 */
import { Store } from 'lucide-react'

interface Propiedades {
  titulo: string
  subtitulo: string
}

export function Cabecera({ titulo, subtitulo }: Propiedades) {
  return (
    <header className="cabecera">
      <div className="cabecera__titulos">
        <h1 className="cabecera__titulo">{titulo}</h1>
        <p className="cabecera__subtitulo">{subtitulo}</p>
      </div>
      <div className="insignia" aria-hidden="true">
        <Store size={19} strokeWidth={1.5} />
      </div>
    </header>
  )
}
