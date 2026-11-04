/**
 * Adaptador entre Supabase y el servicio de acceso.
 *
 * Qué hace: traduce lo que responde el cliente de Supabase al contrato
 * ClienteAutenticacion que usa el servicio de acceso, y crea el cliente real
 * a partir de la configuración validada.
 * Cómo lo hace: una función que recibe un cliente de Supabase (solo lo que
 * usa, descrito en ClienteSupabaseMinimo) y devuelve las cinco operaciones.
 * Por qué: es el único archivo de autenticación que conoce a Supabase; el
 * resto del sistema depende de la interfaz, así que se prueba sin red y
 * cambiar de proveedor no tocaría el servicio.
 */
import { createClient } from '@supabase/supabase-js'
import type { ConfiguracionSupabase } from '../configuracion/supabase'
import type {
  ClienteAutenticacion,
  ResultadoAutorizacion,
  ResultadoOperacion,
  SesionUsuario,
} from './servicioAcceso'

/** Sesión de Supabase: solo importa el correo del usuario. */
interface SesionSupabase {
  user: { email?: string; user_metadata?: Record<string, unknown> }
}

/** Lo único que el adaptador usa del cliente de Supabase. */
export interface ClienteSupabaseMinimo {
  auth: {
    signInWithOAuth(credenciales: {
      provider: 'google'
      options: { redirectTo: string }
    }): PromiseLike<{ error: { message: string } | null }>
    signOut(): PromiseLike<{ error: { message: string } | null }>
    getSession(): PromiseLike<{
      data: { session: SesionSupabase | null }
      error: { message: string } | null
    }>
    onAuthStateChange(
      oyente: (evento: string, sesion: SesionSupabase | null) => void,
    ): { data: { subscription: { unsubscribe(): void } } }
  }
  rpc(nombre: string): PromiseLike<{ data: unknown; error: { message: string } | null }>
}

/** Convierte una sesión de Supabase en la que usa el servicio. */
function aSesionUsuario(sesion: SesionSupabase | null): SesionUsuario | null {
  if (sesion === null) return null
  const nombre = primerNombre(sesion.user.user_metadata)
  return { correo: sesion.user.email ?? '', ...(nombre === undefined ? {} : { nombre }) }
}

/**
 * Saca el primer nombre de los datos que Google entrega.
 * Qué hace: devuelve la primera palabra de `full_name` o `name`, o undefined.
 * Por qué: solo sirve para saludar ("Hola, Andrea"); nunca decide el acceso.
 */
function primerNombre(metadatos: Record<string, unknown> | undefined): string | undefined {
  const completo = metadatos?.full_name ?? metadatos?.name
  if (typeof completo !== 'string') return undefined
  return completo.trim().split(/\s+/)[0] || undefined
}

/**
 * Crea el cliente real de Supabase.
 *
 * Qué hace: devuelve el cliente con la URL y la clave pública.
 * Cómo lo hace: createClient con la sesión guardada en el navegador y
 * renovada sola.
 * Por qué: es el único punto donde se crea la conexión.
 */
export function crearClienteSupabase(config: ConfiguracionSupabase) {
  return createClient(config.url, config.clavePublica)
}

/**
 * Adapta un cliente de Supabase al contrato del servicio de acceso.
 *
 * Qué hace: implementa iniciar sesión con Google, cerrar sesión, leer la
 * sesión, escuchar cambios y consultar la autorización.
 * Cómo lo hace: cada operación llama a Supabase y devuelve solo lo que el
 * servicio necesita. Un resultado de autorización solo es verdadero si la
 * base de datos devuelve exactamente true y no hubo error.
 * Por qué: ante cualquier respuesta rara (null, texto, un error) se niega el
 * acceso. Los avisos de cambio de sesión se difieren un instante porque
 * Supabase no permite que su propio aviso llame de inmediato a otras
 * operaciones suyas (puede quedarse esperando).
 */
export function adaptarClienteSupabase(supabase: ClienteSupabaseMinimo): ClienteAutenticacion {
  return {
    async iniciarSesionConGoogle(redirigirA: string): Promise<ResultadoOperacion> {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirigirA },
      })
      return { error: error?.message ?? null }
    },

    async cerrarSesion(): Promise<ResultadoOperacion> {
      const { error } = await supabase.auth.signOut()
      return { error: error?.message ?? null }
    },

    async obtenerSesion(): Promise<SesionUsuario | null> {
      const { data, error } = await supabase.auth.getSession()
      if (error !== null) throw new Error(error.message)
      return aSesionUsuario(data.session)
    },

    alCambiarSesion(oyente) {
      const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
        setTimeout(() => oyente(aSesionUsuario(sesion)), 0)
      })
      return () => data.subscription.unsubscribe()
    },

    async consultarUsuarioAutorizado(): Promise<ResultadoAutorizacion> {
      const { data, error } = await supabase.rpc('es_usuario_autorizado')
      if (error !== null) return { autorizado: false, error: error.message }
      return { autorizado: data === true, error: null }
    },
  }
}
