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
 * autorizado. El aspecto viene del diseño de Figma (carpeta interfaz): aquí
 * solo se decide qué pantalla corresponde, sin tocar el diseño.
 */
import { useState, type ReactNode } from 'react'
import { Acceso } from '../interfaz/pantallas/Acceso'
import { AccesoNoAutorizado } from '../interfaz/pantallas/AccesoNoAutorizado'
import { useEstadoAcceso } from './useEstadoAcceso'
import type { ServicioAcceso } from './servicioAcceso'

/** Lo que recibe el contenido de la app cuando el usuario está autorizado. */
export interface ContextoAutorizado {
  correo: string
  /** Primer nombre de la cuenta de Google, si lo trae. */
  nombre?: string
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
      return <p role="status" className="estado">Cargando…</p>

    case 'sin-sesion':
      return <Acceso alEntrar={() => void ejecutar(() => servicio.iniciarSesion(redirigirA))} error={errorAccion} />

    case 'no-autorizado':
      return <AccesoNoAutorizado correo={estado.correo} alCerrarSesion={() => void cerrarSesion()} errorAccion={errorAccion} />

    case 'error':
      return (
        <AccesoNoAutorizado
          correo={null}
          titulo="No se pudo verificar el acceso"
          mensaje={estado.mensaje}
          alCerrarSesion={() => void cerrarSesion()}
          errorAccion={errorAccion}
        />
      )

    case 'autorizado':
      return <>{children({ correo: estado.correo, nombre: estado.nombre, cerrarSesion })}</>
  }
}
