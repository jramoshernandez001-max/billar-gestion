/**
 * Control de acceso de la app.
 *
 * Qué hace: muestra la pantalla que corresponde a quien abre la app: cargando,
 * botón para entrar con Google, aviso de que su correo no está autorizado, un
 * error, o la app misma si está autorizado.
 * Cómo lo hace: lee el estado con useEstadoAcceso y dibuja solo ese caso. El
 * contenido (children) es una función que recibe el correo y la acción de
 * cerrar sesión, y solo se llama con un usuario autorizado.
 * Por qué: el contenido de la app no debe ni renderizarse para quien no esté
 * autorizado. El aspecto lo diseña el dueño en Figma: aquí solo hay marcado
 * mínimo y semántico, fácil de reemplazar sin tocar la lógica.
 */
import { useState, type ReactNode } from 'react'
import { useEstadoAcceso } from './useEstadoAcceso'
import type { ServicioAcceso } from './servicioAcceso'

/** Lo que recibe el contenido de la app cuando el usuario está autorizado. */
export interface ContextoAutorizado {
  correo: string
  cerrarSesion: () => Promise<void>
}

interface Propiedades {
  servicio: ServicioAcceso
  /** Dirección a la que Google devuelve al usuario después de entrar. */
  redirigirA: string
  children: (contexto: ContextoAutorizado) => ReactNode
}

export function ControlDeAcceso({ servicio, redirigirA, children }: Propiedades) {
  const estado = useEstadoAcceso(servicio)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  /** Ejecuta una acción del servicio y muestra su error si falla. */
  const ejecutar = async (accion: () => Promise<void>) => {
    setErrorAccion(null)
    try {
      await accion()
    } catch (causa) {
      setErrorAccion(causa instanceof Error ? causa.message : String(causa))
    }
  }
  const cerrarSesion = () => ejecutar(() => servicio.cerrarSesion())

  switch (estado.tipo) {
    case 'cargando':
      return <p role="status">Cargando…</p>

    case 'sin-sesion':
      return (
        <main>
          <h1>Billar Gestión</h1>
          <button type="button" onClick={() => void ejecutar(() => servicio.iniciarSesion(redirigirA))}>
            Entrar con Google
          </button>
          {errorAccion !== null && <p role="alert">{errorAccion}</p>}
        </main>
      )

    case 'no-autorizado':
      return (
        <main>
          <p role="alert">La cuenta {estado.correo} no está autorizada para entrar a este sistema.</p>
          <button type="button" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </button>
          {errorAccion !== null && <p role="alert">{errorAccion}</p>}
        </main>
      )

    case 'error':
      return (
        <main>
          <p role="alert">{estado.mensaje}</p>
          <button type="button" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </button>
          {errorAccion !== null && <p role="alert">{errorAccion}</p>}
        </main>
      )

    case 'autorizado':
      return <>{children({ correo: estado.correo, cerrarSesion })}</>
  }
}
