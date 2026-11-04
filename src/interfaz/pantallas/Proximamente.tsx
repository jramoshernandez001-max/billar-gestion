/**
 * Pantalla provisional.
 *
 * Qué hace: avisa que una pantalla todavía no está lista.
 * Cómo lo hace: dibuja la cabecera con el nombre de la ruta y un texto.
 * Por qué: ninguna ruta debe dejar la app en blanco mientras se construyen
 * las pantallas del diseño, una por una.
 */
import { DESCRIPCION_NEGOCIO, NOMBRE_NEGOCIO } from '../../configuracion/negocio'
import { Cabecera } from '../componentes/Cabecera'

export function Proximamente({ ruta }: { ruta: string }) {
  return (
    <>
      <Cabecera titulo={NOMBRE_NEGOCIO} subtitulo={DESCRIPCION_NEGOCIO} />
      <div className="marco__contenido">
        <p className="estado" role="status">
          La pantalla «{ruta}» está en construcción.
        </p>
      </div>
    </>
  )
}
