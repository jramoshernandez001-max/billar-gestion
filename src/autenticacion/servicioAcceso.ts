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
 * Única excepción (modo sin conexión): si la verificación falla por falta de
 * red y ese mismo correo ya fue autorizado por la base en este teléfono en
 * los últimos 30 días, se deja ver lo guardado en el teléfono. No abre nada
 * nuevo: la base sigue validando cada escritura y cada lectura.
 */
import { esErrorDeRed } from '../sincronizacion/errorDeRed'

/** Días que se recuerda una autorización para entrar sin conexión. */
const DIAS_DE_MEMORIA = 30
const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Dónde se recuerda qué correo fue autorizado por la base y cuándo. */
export interface MemoriaDeAcceso {
  leer(): { correo: string; en: string } | null
  guardar(correo: string, en: string): void
  borrar(): void
}

/** Dependencias opcionales del modo sin conexión. */
export interface OpcionesAcceso {
  memoria: MemoriaDeAcceso
  ahora: () => Date
}

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
export function crearServicioAcceso(cliente: ClienteAutenticacion, opciones?: OpcionesAcceso): ServicioAcceso {
  const memoria = opciones?.memoria
  const ahora = opciones?.ahora ?? (() => new Date())

  /** Dice si este correo fue autorizado por la base en este teléfono hace poco. */
  function autorizadoRecientemente(correo: string): boolean {
    const recuerdo = memoria?.leer() ?? null
    if (recuerdo === null || recuerdo.correo !== correo) return false
    const hace = ahora().getTime() - Date.parse(recuerdo.en)
    return Number.isFinite(hace) && hace >= 0 && hace <= DIAS_DE_MEMORIA * MS_POR_DIA
  }

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
        if (esErrorDeRed({ message: respuesta.error }) && autorizadoRecientemente(sesion.correo)) {
          return { tipo: 'autorizado', correo: sesion.correo, ...(sesion.nombre === undefined ? {} : { nombre: sesion.nombre }) }
        }
        return { tipo: 'error', mensaje: `No se pudo verificar el acceso: ${respuesta.error}` }
      }
      if (respuesta.autorizado) memoria?.guardar(sesion.correo, ahora().toISOString())
      else memoria?.borrar()
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
    memoria?.borrar()
    const { error } = await cliente.cerrarSesion()
    if (error !== null) throw new Error(`No se pudo cerrar la sesión: ${error}`)
  }

  return { resolverEstado, suscribir, iniciarSesion, cerrarSesion }
}
