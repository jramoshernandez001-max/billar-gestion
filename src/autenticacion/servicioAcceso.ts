/**
 * Servicio de acceso: quién ve la app y quién no.
 *
 * Qué hace: decide en qué estado está quien abre la app (sin sesión, con
 * sesión pero sin autorización, autorizado, cargando o con error), inicia y
 * cierra la sesión con Google y avisa cuando ese estado cambia.
 * Cómo lo hace: recibe un cliente de autenticación (una interfaz pequeña) en
 * vez de usar Supabase directo. Con sesión, le pregunta a la base de datos
 * si el correo está autorizado (es_usuario_autorizado); sin sesión, ni
 * pregunta.
 * Por qué: la lista de correos autorizados vive en la base de datos y RLS es
 * la protección real; esta decisión solo sirve para mostrar la pantalla
 * correcta. Ante cualquier fallo se niega el acceso (nunca "autorizado" por
 * error). Al depender de una interfaz, se prueba sin Supabase real.
 */

/** Lo único que la app necesita saber de una sesión iniciada. */
export interface SesionUsuario {
  correo: string
  /** Primer nombre de la cuenta de Google, si lo trae (solo para saludar). */
  nombre?: string
}

/** Respuesta de una operación que puede fallar con un mensaje. */
export interface ResultadoOperacion {
  error: string | null
}

/** Respuesta de la consulta de autorización a la base de datos. */
export interface ResultadoAutorizacion {
  autorizado: boolean
  error: string | null
}

/** Lo que el servicio necesita de un cliente de autenticación. */
export interface ClienteAutenticacion {
  /** Redirige a Google; al volver, el usuario queda en redirigirA. */
  iniciarSesionConGoogle(redirigirA: string): Promise<ResultadoOperacion>
  cerrarSesion(): Promise<ResultadoOperacion>
  /** Sesión actual, o null si no hay. Lanza un error si no se puede leer. */
  obtenerSesion(): Promise<SesionUsuario | null>
  /** Avisa cada vez que la sesión cambia; devuelve cómo dejar de escuchar. */
  alCambiarSesion(oyente: (sesion: SesionUsuario | null) => void): () => void
  /** Pregunta a la base de datos si la sesión actual está autorizada. */
  consultarUsuarioAutorizado(): Promise<ResultadoAutorizacion>
}

/** Estados posibles de quien abre la app. */
export type EstadoAcceso =
  | { tipo: 'cargando' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'no-autorizado'; correo: string }
  | { tipo: 'autorizado'; correo: string; nombre?: string }
  | { tipo: 'error'; mensaje: string }

/** Operaciones que ofrece el servicio. */
export interface ServicioAcceso {
  resolverEstado(): Promise<EstadoAcceso>
  suscribir(alCambiar: (estado: EstadoAcceso) => void): () => void
  iniciarSesion(redirigirA: string): Promise<void>
  cerrarSesion(): Promise<void>
}

/** Convierte cualquier cosa lanzada en un mensaje legible. */
function mensajeDe(causa: unknown): string {
  return causa instanceof Error ? causa.message : String(causa)
}

/**
 * Crea el servicio de acceso.
 *
 * Qué hace: devuelve las operaciones de acceso sobre un cliente dado.
 * Cómo lo hace: cierra sobre el cliente y expone cuatro funciones pequeñas.
 * Por qué: inyectar el cliente separa la decisión de acceso de Supabase.
 */
export function crearServicioAcceso(cliente: ClienteAutenticacion): ServicioAcceso {
  /**
   * Calcula el estado actual.
   *
   * Qué hace: lee la sesión y, si hay, consulta la autorización.
   * Cómo lo hace: cualquier error, de lectura o de consulta, termina en el
   * estado error, que no deja entrar.
   * Por qué: ante la duda, se niega el acceso.
   */
  async function resolverEstado(): Promise<EstadoAcceso> {
    try {
      const sesion = await cliente.obtenerSesion()
      if (sesion === null) return { tipo: 'sin-sesion' }
      const respuesta = await cliente.consultarUsuarioAutorizado()
      if (respuesta.error !== null) {
        return { tipo: 'error', mensaje: `No se pudo verificar el acceso: ${respuesta.error}` }
      }
      return respuesta.autorizado
        ? { tipo: 'autorizado', correo: sesion.correo, ...(sesion.nombre === undefined ? {} : { nombre: sesion.nombre }) }
        : { tipo: 'no-autorizado', correo: sesion.correo }
    } catch (causa) {
      return { tipo: 'error', mensaje: `No se pudo leer la sesión: ${mensajeDe(causa)}` }
    }
  }

  /**
   * Avisa el estado ahora y cada vez que la sesión cambie.
   *
   * Qué hace: emite cargando, luego el estado real, y repite al cambiar la
   * sesión.
   * Cómo lo hace: cada cálculo lleva un número; solo el más reciente avisa,
   * para que una respuesta lenta no pise a una más nueva. Al cancelar, deja
   * de escuchar y de avisar.
   * Por qué: cerrar sesión o entrar con otra cuenta no debe dejar en pantalla
   * un estado viejo.
   */
  function suscribir(alCambiar: (estado: EstadoAcceso) => void): () => void {
    let activo = true
    let version = 0
    const actualizar = async () => {
      const mia = ++version
      const estado = await resolverEstado()
      if (activo && mia === version) alCambiar(estado)
    }
    alCambiar({ tipo: 'cargando' })
    void actualizar()
    const dejarDeEscuchar = cliente.alCambiarSesion(() => {
      void actualizar()
    })
    return () => {
      activo = false
      dejarDeEscuchar()
    }
  }

  /** Inicia sesión con Google; lanza un error con el motivo si falla. */
  async function iniciarSesion(redirigirA: string): Promise<void> {
    const { error } = await cliente.iniciarSesionConGoogle(redirigirA)
    if (error !== null) throw new Error(`No se pudo iniciar sesión con Google: ${error}`)
  }

  /** Cierra la sesión; lanza un error con el motivo si falla. */
  async function cerrarSesion(): Promise<void> {
    const { error } = await cliente.cerrarSesion()
    if (error !== null) throw new Error(`No se pudo cerrar la sesión: ${error}`)
  }

  return { resolverEstado, suscribir, iniciarSesion, cerrarSesion }
}
