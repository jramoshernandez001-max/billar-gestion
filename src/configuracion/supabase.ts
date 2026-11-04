/**
 * Configuración de Supabase para el navegador.
 *
 * Qué hace: lee y valida la URL del proyecto de Supabase y su clave pública
 * desde las variables de entorno de Vite.
 * Cómo lo hace: una función pura que recibe el entorno (así se prueba sin
 * Vite), limpia los valores, exige una URL https (http solo en local) y
 * rechaza cualquier clave que sea secreta.
 * Por qué: el código de la app viaja al navegador de quien la abra. Solo la
 * clave pública puede estar ahí, y solo es segura porque RLS protege los
 * datos; una clave de servicio saltaría esa protección. Si falta algo, es
 * mejor un error claro al arrancar que un fallo raro después.
 */

/** Datos necesarios para conectar con Supabase desde el navegador. */
export interface ConfiguracionSupabase {
  /** URL del proyecto, sin barra final. */
  url: string
  /** Clave pública (publishable o anon). */
  clavePublica: string
}

/** Entorno de donde se leen las variables (import.meta.env en la app). */
export type EntornoVite = Record<string, string | undefined>

/** Hosts donde se acepta http, solo para desarrollo local. */
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Lee una variable obligatoria.
 *
 * Qué hace: devuelve el valor sin espacios a los lados.
 * Cómo lo hace: trim y, si queda vacío o no existe, lanza un error que
 * nombra la variable.
 * Por qué: el mensaje dice exactamente qué hay que completar en el .env.
 */
function leerObligatoria(entorno: EntornoVite, nombre: string): string {
  const valor = entorno[nombre]?.trim() ?? ''
  if (valor.length === 0) {
    throw new Error(`Falta la variable de entorno ${nombre}`)
  }
  return valor
}

/**
 * Valida y normaliza la URL del proyecto.
 *
 * Qué hace: devuelve la URL sin barra final o lanza un error.
 * Cómo lo hace: la interpreta con URL; exige https, salvo http en hosts
 * locales.
 * También rechaza una URL con ruta (por ejemplo /rest/v1): el cliente de
 * Supabase le agrega sus propias rutas y quedarían mal armadas.
 * Por qué: con http en internet, el token de sesión viajaría sin cifrar.
 */
function validarUrl(texto: string): string {
  let url: URL
  try {
    url = new URL(texto)
  } catch {
    throw new Error('VITE_SUPABASE_URL no es una URL válida')
  }
  const esLocal = HOSTS_LOCALES.has(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && esLocal)) {
    throw new Error('VITE_SUPABASE_URL debe usar https (http solo se acepta en localhost)')
  }
  if (url.pathname.replace(/\/+$/, '') !== '' || url.search !== '' || url.hash !== '') {
    throw new Error(
      'VITE_SUPABASE_URL debe ser solo la dirección del proyecto, sin ruta (por ejemplo https://xxxx.supabase.co, sin /rest/v1)',
    )
  }
  return texto.replace(/\/+$/, '')
}

/**
 * Dice si una clave es secreta.
 *
 * Qué hace: devuelve true para una clave sb_secret_ o un JWT con rol
 * service_role.
 * Cómo lo hace: revisa el prefijo; si es un JWT, decodifica su parte central
 * (base64url) y mira el campo role. Si no se puede decodificar, no es un JWT
 * de servicio.
 * Por qué: las claves nuevas de Supabase son sb_publishable_ y sb_secret_;
 * las antiguas son JWT con rol anon o service_role.
 */
function esClaveSecreta(clave: string): boolean {
  if (clave.startsWith('sb_secret_')) return true
  const partes = clave.split('.')
  if (partes.length !== 3) return false
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
    const carga: unknown = JSON.parse(atob(base64))
    return typeof carga === 'object' && carga !== null && (carga as { role?: unknown }).role === 'service_role'
  } catch {
    return false
  }
}

/**
 * Lee la configuración de Supabase del entorno.
 *
 * Qué hace: devuelve la URL y la clave pública ya validadas.
 * Cómo lo hace: toma VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY, valida
 * la URL y rechaza una clave secreta.
 * Por qué: un solo lugar valida la configuración antes de crear el cliente.
 *
 * @throws Error si falta una variable, la URL no es válida o la clave es secreta.
 */
export function leerConfiguracionSupabase(entorno: EntornoVite): ConfiguracionSupabase {
  const url = validarUrl(leerObligatoria(entorno, 'VITE_SUPABASE_URL'))
  const clavePublica = leerObligatoria(entorno, 'VITE_SUPABASE_PUBLISHABLE_KEY')
  if (esClaveSecreta(clavePublica)) {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY es una clave secreta: nunca debe ir en el navegador; use la clave pública',
    )
  }
  return { url, clavePublica }
}
