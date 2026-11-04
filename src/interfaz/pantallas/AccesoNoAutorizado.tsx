/**
 * Pantalla de acceso no autorizado.
 *
 * Qué hace: explica que la cuenta de Google no tiene permiso, muestra el
 * correo con el que se intentó entrar y permite cerrar sesión.
 * Cómo lo hace: solo dibuja según el diseño de Figma. También sirve para el
 * caso de error al verificar el acceso (con un mensaje propio).
 * Por qué: nada de la app ni de los datos del negocio se muestra a quien no
 * está autorizado; la autorización real la hace la base de datos.
 */
import { CircleAlert, LockKeyhole } from 'lucide-react'
import { DESCRIPCION_NEGOCIO, NOMBRE_NEGOCIO } from '../../configuracion/negocio'
import { Cabecera } from '../componentes/Cabecera'

interface Propiedades {
  /** Correo de la cuenta; null cuando se muestra un error de verificación. */
  correo: string | null
  /** Título del aviso; por defecto "No autorizado". */
  titulo?: string
  /** Texto del aviso; por defecto el del diseño. */
  mensaje?: string
  alCerrarSesion: () => void
  /** Error al cerrar sesión, si lo hubo. */
  errorAccion: string | null
}

export function AccesoNoAutorizado({
  correo,
  titulo = 'No autorizado',
  mensaje = 'No se ha compartido información del negocio con esta cuenta.',
  alCerrarSesion,
  errorAccion,
}: Propiedades) {
  return (
    <>
      <Cabecera titulo={NOMBRE_NEGOCIO} subtitulo={DESCRIPCION_NEGOCIO} />
      <div className="marco__contenido">
        <section className="bienvenida bienvenida--restringida">
          <LockKeyhole size={40} strokeWidth={1.5} className="alerta__icono--aviso" aria-hidden="true" />
          <h2 className="bienvenida__titulo bienvenida__titulo--chico">Esta cuenta no tiene acceso</h2>
          <p className="bienvenida__texto">
            Pídele al administrador que autorice tu correo para entrar al negocio.
          </p>
        </section>
        {correo !== null && (
          <section className="tarjeta">
            <p className="tarjeta__etiqueta">Cuenta de Google</p>
            <p className="tarjeta__valor">{correo}</p>
          </section>
        )}
        <div className="aviso" role="alert">
          <CircleAlert size={18} strokeWidth={1.5} aria-hidden="true" />
          <div className="aviso__mensaje">
            <span className="aviso__titulo">{titulo}</span>
            <span>{mensaje}</span>
          </div>
        </div>
        <button type="button" className="boton" onClick={alCerrarSesion}>
          Cerrar sesión
        </button>
        {errorAccion !== null && (
          <div className="aviso aviso--error" role="alert">
            <div className="aviso__mensaje">{errorAccion}</div>
          </div>
        )}
        <p className="texto-suave texto-centrado">Después puedes entrar con otra cuenta.</p>
      </div>
    </>
  )
}
