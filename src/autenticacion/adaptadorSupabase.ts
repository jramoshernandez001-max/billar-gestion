/**
 * Adaptador entre Supabase y el servicio de acceso.
 *
 * Qué hace: traduce lo que responde el cliente de Supabase al contrato
 * ClienteAutenticacion que usa el servicio de acceso, y crea el cliente real
 * a partir de la configuración validada.
 * Cómo lo hace: una función que recibe un cliente de Supabase (solo lo que
 * usa, descrito en ClienteSupabaseMinimo) y devuelve las seis operaciones.
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

/** Sesión de Supabase: solo importa el correo y si es anónima (código). */
interface SesionSupabase {
  user: { email?: string; is_anonymous?: boolean; user_metadata?: Record<string, unknown> }
}

/** Cómo se muestra una sesión que entró con código (no tiene correo). */
export const ETIQUETA_SESION_CON_CODIGO = 'Acceso con código'

/** Mensaje cuando el código no coincide con ninguno activo. */
const CODIGO_NO_VALIDO = 'El código no es válido'

/** Lo único que el adaptador usa del cliente de Supabase. */
export interface ClienteSupabaseMinimo {
  auth: {
    signInWithOAuth(credenciales: {
      provider: 'google'
      options: { redirectTo: string }
    }): PromiseLike<{ error: { message: string } | null }>
    signOut(): PromiseLike<{ error: { message: string } | null }>
    signInAnonymously(): PromiseLike<{ error: { message: string } | null }>
    updateUser(datos: { data: Record<string, unknown> }): PromiseLike<{ error: { message: string } | null }>
    refreshSession(): PromiseLike<{ error: { message: string } | null }>
    getSession(): PromiseLike<{
      data: { session: SesionSupabase | null }
      error: { message: string } | null
    }>
    onAuthStateChange(
      oyente: (evento: string, sesion: SesionSupabase | null) => void,
    ): { data: { subscription: { unsubscribe(): void } } }
  }
  rpc(nombre: string, argumentos?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>
}

/** Convierte una sesión de Supabase en la que usa el servicio. */
function aSesionUsuario(sesion: SesionSupabase | null): SesionUsuario | null {
  if (sesion === null) return null
  const nombre = primerNombre(sesion.user.user_metadata)
  // Una sesión anónima es la de un código: no tiene correo que mostrar.
  const correo = sesion.user.is_anonymous === true ? ETIQUETA_SESION_CON_CODIGO : (sesion.user.email ?? '')
  return { correo, ...(nombre === undefined ? {} : { nombre }) }
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

    /**
     * Entra con un código de acceso.
     *
     * Qué hace: abre una sesión anónima (si no hay una), canjea el código en
     * la base y guarda el nombre de la persona para saludarla.
     * Cómo lo hace: signInAnonymously, luego la función
     * canjear_codigo_acceso, que devuelve el nombre o null. Si no sirve, cierra
     * la sesión anónima que abrió. Guardar el nombre (updateUser) avisa a la
     * app que la sesión cambió; si eso falla, renueva la sesión para avisar
     * igual.
     * Por qué: la autorización la decide la base (el código se compara con
     * hashes que la app nunca ve); el nombre guardado solo sirve para saludar,
     * nunca para dar acceso. No se deja una sesión anónima colgada si el
     * código era malo.
     */
    async iniciarSesionConCodigo(codigo: string): Promise<ResultadoOperacion> {
      const actual = await supabase.auth.getSession()
      if (actual.error !== null) return { error: actual.error.message }
      const abrioSesion = actual.data.session === null
      if (abrioSesion) {
        const { error } = await supabase.auth.signInAnonymously()
        if (error !== null) return { error: `No se pudo abrir la sesión para el código: ${error.message}` }
      }
      const { data, error } = await supabase.rpc('canjear_codigo_acceso', { p_codigo: codigo })
      if (error !== null || typeof data !== 'string') {
        if (abrioSesion) await supabase.auth.signOut()
        return { error: error?.message ?? CODIGO_NO_VALIDO }
      }
      const { error: errorNombre } = await supabase.auth.updateUser({ data: { full_name: data } })
      if (errorNombre !== null) await supabase.auth.refreshSession()
      return { error: null }
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
