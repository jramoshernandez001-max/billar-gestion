/**
 * Pantalla de acceso.
 *
 * Qué hace: da la bienvenida y ofrece dos formas de entrar: "Entrar con
 * Google" o escribir el código de acceso único que entrega el administrador;
 * si falla, muestra el mensaje de error.
 * Cómo lo hace: solo dibuja y avisa cuando se toca un botón (con el código
 * escrito); el inicio de sesión lo hace el servicio de acceso. El campo del
 * código va oculto como una contraseña.
 * Por qué: sin lógica propia, el diseño cambia sin tocar la autenticación.
 * Hay personas autorizadas que no usan una cuenta de Google.
 */
import { useState, type FormEvent } from 'react'
import { ShieldCheck, Store } from 'lucide-react'
import { DESCRIPCION_NEGOCIO, NOMBRE_NEGOCIO } from '../../configuracion/negocio'
import { Cabecera } from '../componentes/Cabecera'

interface Propiedades {
  alEntrar: () => void
  /** Entrar con el código escrito. */
  alEntrarConCodigo: (codigo: string) => void
  /** Verdadero mientras se verifica un código (deshabilita el botón). */
  verificandoCodigo?: boolean
  /** Mensaje de error del último intento, si lo hubo. */
  error: string | null
}

export function Acceso({ alEntrar, alEntrarConCodigo, verificandoCodigo = false, error }: Propiedades) {
  const [codigo, setCodigo] = useState('')

  /** Envía el código al tocar el botón o al presionar Enter. */
  const enviarCodigo = (evento: FormEvent) => {
    evento.preventDefault()
    alEntrarConCodigo(codigo)
  }

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
        <p className="texto-suave texto-centrado">o</p>
        <form className="campo" onSubmit={enviarCodigo}>
          <label className="campo__etiqueta" htmlFor="codigo-acceso">Código de acceso</label>
          <div className="entrada">
            <input
              id="codigo-acceso"
              type="password"
              className="entrada__control"
              placeholder="El código que te dieron"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
          <button type="submit" className="boton" disabled={verificandoCodigo || codigo.trim() === ''}>
            {verificandoCodigo ? 'Verificando…' : 'Entrar con código'}
          </button>
        </form>
        {error !== null && (
          <div className="aviso aviso--error" role="alert">
            <div className="aviso__mensaje">{error}</div>
          </div>
        )}
        <p className="texto-suave texto-centrado">Usa la cuenta o el código autorizado por tu negocio.</p>
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
