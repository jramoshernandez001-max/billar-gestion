/**
 * Pantalla de acceso.
 *
 * Qué hace: da la bienvenida y ofrece el botón "Entrar con Google"; si falla,
 * muestra el mensaje de error.
 * Cómo lo hace: solo dibuja según el diseño de Figma y avisa cuando se toca el
 * botón; el inicio de sesión lo hace el servicio de acceso.
 * Por qué: sin lógica propia, el diseño cambia sin tocar la autenticación.
 */
import { ShieldCheck, Store } from 'lucide-react'
import { DESCRIPCION_NEGOCIO, NOMBRE_NEGOCIO } from '../../configuracion/negocio'
import { Cabecera } from '../componentes/Cabecera'

interface Propiedades {
  alEntrar: () => void
  /** Mensaje de error del último intento, si lo hubo. */
  error: string | null
}

export function Acceso({ alEntrar, error }: Propiedades) {
  return (
    <>
      <Cabecera titulo={NOMBRE_NEGOCIO} subtitulo={DESCRIPCION_NEGOCIO} />
      <div className="marco__contenido">
        <section className="bienvenida">
          <div className="marca" aria-hidden="true">
            <Store size={30} strokeWidth={1.5} />
          </div>
          <h2 className="bienvenida__titulo">
            Tu negocio,
            <br />
            en orden.
          </h2>
          <p className="bienvenida__texto">
            Ventas, inventario y cuentas claras. Todo lo que necesitas para el día a día.
          </p>
        </section>
        <button type="button" className="boton" onClick={alEntrar}>
          Entrar con Google
        </button>
        {error !== null && (
          <div className="aviso aviso--error" role="alert">
            <div className="aviso__mensaje">{error}</div>
          </div>
        )}
        <p className="texto-suave texto-centrado">Usa la cuenta autorizada por tu negocio.</p>
        <section className="privacidad">
          <ShieldCheck size={20} strokeWidth={1.5} aria-hidden="true" />
          <p className="texto-suave">
            Tus datos pertenecen a tu negocio. Solo las personas autorizadas pueden acceder.
          </p>
        </section>
      </div>
    </>
  )
}
