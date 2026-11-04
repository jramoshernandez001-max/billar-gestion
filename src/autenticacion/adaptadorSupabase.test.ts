/**
 * Pruebas del adaptador de Supabase.
 *
 * Qué hace: verifica cómo se traducen las respuestas de Supabase a las del
 * servicio de acceso: la sesión, los errores y, sobre todo, que solo un
 * "true" exacto de la base de datos cuente como autorizado.
 * Cómo lo hace: usa un cliente de Supabase falso con solo lo que el
 * adaptador usa.
 * Por qué: es la costura entre el sistema y Supabase real; un error aquí
 * podría mostrar la app a quien no debe.
 */
import { describe, it, expect, vi } from 'vitest'
import { adaptarClienteSupabase, type ClienteSupabaseMinimo } from './adaptadorSupabase'

/** Cliente de Supabase falso, con respuestas configurables. */
function supabaseFalso(opciones: {
  sesion?: { user: { email?: string; user_metadata?: Record<string, unknown> } } | null
  errorSesion?: string
  rpc?: { data: unknown; error: { message: string } | null }
  errorOAuth?: string
  errorSalir?: string
} = {}) {
  let oyente: ((evento: string, sesion: { user: { email?: string; user_metadata?: Record<string, unknown> } } | null) => void) | null = null
  const cancelar = vi.fn()
  const cliente: ClienteSupabaseMinimo = {
    auth: {
      signInWithOAuth: vi.fn(async () => ({ error: opciones.errorOAuth ? { message: opciones.errorOAuth } : null })),
      signOut: vi.fn(async () => ({ error: opciones.errorSalir ? { message: opciones.errorSalir } : null })),
      getSession: vi.fn(async () => ({
        data: { session: opciones.sesion ?? null },
        error: opciones.errorSesion ? { message: opciones.errorSesion } : null,
      })),
      onAuthStateChange: vi.fn((callback) => {
        oyente = callback
        return { data: { subscription: { unsubscribe: cancelar } } }
      }),
    },
    rpc: vi.fn(async () => opciones.rpc ?? { data: true, error: null }),
  }
  return { cliente, emitir: (sesion: { user: { email?: string; user_metadata?: Record<string, unknown> } } | null) => oyente?.('SIGNED_IN', sesion), cancelar }
}

describe('adaptarClienteSupabase', () => {
  it('obtenerSesion devuelve el correo de la sesión, o null sin sesión', async () => {
    const con = adaptarClienteSupabase(supabaseFalso({ sesion: { user: { email: 'ana@ejemplo.com' } } }).cliente)
    expect(await con.obtenerSesion()).toEqual({ correo: 'ana@ejemplo.com' })
    const sin = adaptarClienteSupabase(supabaseFalso({ sesion: null }).cliente)
    expect(await sin.obtenerSesion()).toBeNull()
  })

  it('toma el primer nombre de los datos de Google, si vienen', async () => {
    const con = (metadatos: Record<string, unknown>) =>
      adaptarClienteSupabase(supabaseFalso({ sesion: { user: { email: 'a@ejemplo.com', user_metadata: metadatos } } }).cliente).obtenerSesion()
    expect(await con({ full_name: 'Andrea Pérez Gómez' })).toEqual({ correo: 'a@ejemplo.com', nombre: 'Andrea' })
    expect(await con({ name: '  Luis  ' })).toEqual({ correo: 'a@ejemplo.com', nombre: 'Luis' })
    expect(await con({ full_name: 42 })).toEqual({ correo: 'a@ejemplo.com' })
    expect(await con({})).toEqual({ correo: 'a@ejemplo.com' })
  })

  it('una sesión sin correo queda con correo vacío (la base de datos no la autoriza)', async () => {
    const adaptado = adaptarClienteSupabase(supabaseFalso({ sesion: { user: {} } }).cliente)
    expect(await adaptado.obtenerSesion()).toEqual({ correo: '' })
  })

  it('obtenerSesion lanza un error si Supabase no puede leerla', async () => {
    const adaptado = adaptarClienteSupabase(supabaseFalso({ errorSesion: 'sin acceso' }).cliente)
    await expect(adaptado.obtenerSesion()).rejects.toThrow(/sin acceso/)
  })

  it('inicia sesión con Google y manda a dónde volver', async () => {
    const { cliente } = supabaseFalso()
    const resultado = await adaptarClienteSupabase(cliente).iniciarSesionConGoogle('https://ejemplo.com/')
    expect(resultado).toEqual({ error: null })
    expect(cliente.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://ejemplo.com/' },
    })
  })

  it('devuelve el mensaje de error de Google y de cerrar sesión', async () => {
    expect(await adaptarClienteSupabase(supabaseFalso({ errorOAuth: 'desactivado' }).cliente).iniciarSesionConGoogle('x')).toEqual({
      error: 'desactivado',
    })
    expect(await adaptarClienteSupabase(supabaseFalso({ errorSalir: 'sin red' }).cliente).cerrarSesion()).toEqual({
      error: 'sin red',
    })
  })

  it('solo un true exacto cuenta como autorizado', async () => {
    for (const data of [false, null, 'true', 1, undefined, {}]) {
      const { cliente } = supabaseFalso({ rpc: { data, error: null } })
      const respuesta = await adaptarClienteSupabase(cliente).consultarUsuarioAutorizado()
      expect(respuesta.autorizado, String(data)).toBe(false)
    }
    const { cliente } = supabaseFalso({ rpc: { data: true, error: null } })
    expect(await adaptarClienteSupabase(cliente).consultarUsuarioAutorizado()).toEqual({ autorizado: true, error: null })
    expect(cliente.rpc).toHaveBeenCalledWith('es_usuario_autorizado')
  })

  it('un error de la base de datos nunca autoriza', async () => {
    const { cliente } = supabaseFalso({ rpc: { data: true, error: { message: 'fallo' } } })
    expect(await adaptarClienteSupabase(cliente).consultarUsuarioAutorizado()).toEqual({
      autorizado: false,
      error: 'fallo',
    })
  })

  it('avisa los cambios de sesión de forma diferida y permite cancelar', async () => {
    vi.useFakeTimers()
    const { cliente, emitir, cancelar } = supabaseFalso()
    const oyente = vi.fn()
    const dejarDeEscuchar = adaptarClienteSupabase(cliente).alCambiarSesion(oyente)
    emitir({ user: { email: 'ana@ejemplo.com' } })
    // Diferido: Supabase no permite llamarlo a él mismo dentro de su propio aviso.
    expect(oyente).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(oyente).toHaveBeenCalledWith({ correo: 'ana@ejemplo.com' })
    emitir(null)
    vi.runAllTimers()
    expect(oyente).toHaveBeenLastCalledWith(null)
    dejarDeEscuchar()
    expect(cancelar).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
