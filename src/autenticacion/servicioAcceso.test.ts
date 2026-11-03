/**
 * Pruebas del servicio de acceso.
 *
 * Qué hace: verifica qué estado de acceso resulta de cada combinación de
 * sesión y autorización, que un fallo nunca deje entrar a nadie y que los
 * cambios de sesión se reflejen en orden.
 * Cómo lo hace: usa un cliente de autenticación falso, hecho a mano, que
 * deja controlar la sesión y la respuesta de la base de datos.
 * Por qué: la decisión de a quién se le muestra la app debe ser exacta y no
 * depender de Supabase real para probarla.
 */
import { describe, it, expect, vi } from 'vitest'
import { crearServicioAcceso, type ClienteAutenticacion, type SesionUsuario } from './servicioAcceso'

/** Cliente falso: sesión y autorización configurables. */
function clienteFalso(inicial: {
  sesion?: SesionUsuario | null
  autorizado?: boolean
  errorAutorizacion?: string | null
  errorSesion?: string | null
}) {
  let sesion = inicial.sesion ?? null
  const oyentes = new Set<(sesion: SesionUsuario | null) => void>()
  const cliente: ClienteAutenticacion = {
    iniciarSesionConGoogle: vi.fn().mockResolvedValue({ error: null }),
    cerrarSesion: vi.fn().mockResolvedValue({ error: null }),
    obtenerSesion: vi.fn(async () => {
      if (inicial.errorSesion) throw new Error(inicial.errorSesion)
      return sesion
    }),
    alCambiarSesion: vi.fn((oyente) => {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    }),
    consultarUsuarioAutorizado: vi.fn(async () => ({
      autorizado: inicial.autorizado ?? false,
      error: inicial.errorAutorizacion ?? null,
    })),
  }
  return {
    cliente,
    emitir: (nueva: SesionUsuario | null) => {
      sesion = nueva
      oyentes.forEach((oyente) => oyente(nueva))
    },
    oyentes,
  }
}

const ana: SesionUsuario = { correo: 'ana@ejemplo.com' }
/** Deja pasar las promesas pendientes. */
const esperar = () => new Promise((resolver) => setTimeout(resolver, 0))

describe('resolverEstado', () => {
  it('sin sesión: sin-sesion, y no consulta la base de datos', async () => {
    const { cliente } = clienteFalso({ sesion: null })
    const estado = await crearServicioAcceso(cliente).resolverEstado()
    expect(estado).toEqual({ tipo: 'sin-sesion' })
    expect(cliente.consultarUsuarioAutorizado).not.toHaveBeenCalled()
  })

  it('con sesión y autorizado: autorizado, con su correo', async () => {
    const { cliente } = clienteFalso({ sesion: ana, autorizado: true })
    expect(await crearServicioAcceso(cliente).resolverEstado()).toEqual({
      tipo: 'autorizado',
      correo: 'ana@ejemplo.com',
    })
  })

  it('con sesión y no autorizado: no-autorizado', async () => {
    const { cliente } = clienteFalso({ sesion: ana, autorizado: false })
    expect(await crearServicioAcceso(cliente).resolverEstado()).toEqual({
      tipo: 'no-autorizado',
      correo: 'ana@ejemplo.com',
    })
  })

  it('si falla la consulta de autorización, es un error y nunca autorizado', async () => {
    const { cliente } = clienteFalso({ sesion: ana, autorizado: true, errorAutorizacion: 'sin red' })
    const estado = await crearServicioAcceso(cliente).resolverEstado()
    expect(estado.tipo).toBe('error')
  })

  it('si falla la lectura de la sesión, es un error', async () => {
    const { cliente } = clienteFalso({ errorSesion: 'almacenamiento bloqueado' })
    const estado = await crearServicioAcceso(cliente).resolverEstado()
    expect(estado).toEqual({ tipo: 'error', mensaje: expect.stringContaining('almacenamiento bloqueado') })
  })
})

describe('suscribir', () => {
  it('avisa primero cargando y luego el estado real', async () => {
    const { cliente } = clienteFalso({ sesion: ana, autorizado: true })
    const estados: string[] = []
    crearServicioAcceso(cliente).suscribir((estado) => estados.push(estado.tipo))
    await esperar()
    expect(estados).toEqual(['cargando', 'autorizado'])
  })

  it('reacciona cuando la sesión cambia', async () => {
    const falso = clienteFalso({ sesion: null, autorizado: true })
    const estados: string[] = []
    crearServicioAcceso(falso.cliente).suscribir((estado) => estados.push(estado.tipo))
    await esperar()
    falso.emitir(ana)
    await esperar()
    falso.emitir(null)
    await esperar()
    expect(estados).toEqual(['cargando', 'sin-sesion', 'autorizado', 'sin-sesion'])
  })

  it('una respuesta vieja no pisa a una más nueva', async () => {
    const falso = clienteFalso({ sesion: ana, autorizado: true })
    let liberarPrimera: (valor: { autorizado: boolean; error: null }) => void = () => {}
    vi.mocked(falso.cliente.consultarUsuarioAutorizado)
      .mockImplementationOnce(() => new Promise((resolver) => (liberarPrimera = resolver)))
      .mockResolvedValueOnce({ autorizado: false, error: null })
    const estados: string[] = []
    crearServicioAcceso(falso.cliente).suscribir((estado) => estados.push(estado.tipo))
    await esperar()
    falso.emitir(ana) // segunda consulta: no autorizado
    await esperar()
    liberarPrimera({ autorizado: true, error: null }) // la primera llega tarde
    await esperar()
    expect(estados.at(-1)).toBe('no-autorizado')
  })

  it('al cancelar la suscripción deja de escuchar y de avisar', async () => {
    const falso = clienteFalso({ sesion: null })
    const estados: string[] = []
    const cancelar = crearServicioAcceso(falso.cliente).suscribir((estado) => estados.push(estado.tipo))
    await esperar()
    cancelar()
    falso.emitir(ana)
    await esperar()
    expect(falso.oyentes.size).toBe(0)
    expect(estados).toEqual(['cargando', 'sin-sesion'])
  })
})

describe('iniciarSesion y cerrarSesion', () => {
  it('inicia sesión con Google y manda a donde se debe volver', async () => {
    const { cliente } = clienteFalso({})
    await crearServicioAcceso(cliente).iniciarSesion('https://ejemplo.com/')
    expect(cliente.iniciarSesionConGoogle).toHaveBeenCalledWith('https://ejemplo.com/')
  })

  it('si Google falla, lanza un error con el motivo', async () => {
    const { cliente } = clienteFalso({})
    vi.mocked(cliente.iniciarSesionConGoogle).mockResolvedValueOnce({ error: 'proveedor desactivado' })
    await expect(crearServicioAcceso(cliente).iniciarSesion('https://ejemplo.com/')).rejects.toThrow(/proveedor desactivado/)
  })

  it('cierra la sesión y, si falla, lanza un error', async () => {
    const { cliente } = clienteFalso({})
    await crearServicioAcceso(cliente).cerrarSesion()
    expect(cliente.cerrarSesion).toHaveBeenCalled()
    vi.mocked(cliente.cerrarSesion).mockResolvedValueOnce({ error: 'sin red' })
    await expect(crearServicioAcceso(cliente).cerrarSesion()).rejects.toThrow(/sin red/)
  })
})
