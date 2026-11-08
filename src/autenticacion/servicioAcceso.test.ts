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
  errorCodigo?: string | null
}) {
  let sesion = inicial.sesion ?? null
  const oyentes = new Set<(sesion: SesionUsuario | null) => void>()
  const cliente: ClienteAutenticacion = {
    iniciarSesionConGoogle: vi.fn().mockResolvedValue({ error: null }),
    iniciarSesionConCodigo: vi.fn().mockResolvedValue({ error: inicial.errorCodigo ?? null }),
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

  it('autorizado conserva el nombre de la sesión cuando existe', async () => {
    const { cliente } = clienteFalso({ sesion: { ...ana, nombre: 'Ana' }, autorizado: true })
    expect(await crearServicioAcceso(cliente).resolverEstado()).toEqual({
      tipo: 'autorizado',
      correo: 'ana@ejemplo.com',
      nombre: 'Ana',
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

describe('acceso sin conexión', () => {
  /** Memoria falsa de "este correo ya fue autorizado en este teléfono". */
  function memoriaFalsa() {
    let guardado: { correo: string; en: string } | null = null
    return {
      leer: () => guardado,
      guardar: (correo: string, en: string) => {
        guardado = { correo, en }
      },
      borrar: () => {
        guardado = null
      },
    }
  }
  const DIA = 24 * 60 * 60 * 1000
  const ahoraEn = (ms: number) => () => new Date(ms)
  const T0 = Date.parse('2026-11-04T10:00:00.000Z')

  it('al autorizarse con la base, recuerda el correo', async () => {
    const memoria = memoriaFalsa()
    const { cliente } = clienteFalso({ sesion: ana, autorizado: true })
    await crearServicioAcceso(cliente, { memoria, ahora: ahoraEn(T0) }).resolverEstado()
    expect(memoria.leer()).toEqual({ correo: 'ana@ejemplo.com', en: new Date(T0).toISOString() })
  })

  it('si la verificación falla por falta de red y ya estaba autorizado, entra', async () => {
    const memoria = memoriaFalsa()
    memoria.guardar('ana@ejemplo.com', new Date(T0 - 2 * DIA).toISOString())
    const { cliente } = clienteFalso({ sesion: ana, errorAutorizacion: 'TypeError: Failed to fetch' })
    const estado = await crearServicioAcceso(cliente, { memoria, ahora: ahoraEn(T0) }).resolverEstado()
    expect(estado).toEqual({ tipo: 'autorizado', correo: 'ana@ejemplo.com' })
  })

  it('si pasaron más de 30 días, no entra', async () => {
    const memoria = memoriaFalsa()
    memoria.guardar('ana@ejemplo.com', new Date(T0 - 31 * DIA).toISOString())
    const { cliente } = clienteFalso({ sesion: ana, errorAutorizacion: 'Failed to fetch' })
    const estado = await crearServicioAcceso(cliente, { memoria, ahora: ahoraEn(T0) }).resolverEstado()
    expect(estado.tipo).toBe('error')
  })

  it('si el correo recordado es de otra persona, no entra', async () => {
    const memoria = memoriaFalsa()
    memoria.guardar('otra@ejemplo.com', new Date(T0).toISOString())
    const { cliente } = clienteFalso({ sesion: ana, errorAutorizacion: 'Failed to fetch' })
    expect((await crearServicioAcceso(cliente, { memoria, ahora: ahoraEn(T0) }).resolverEstado()).tipo).toBe('error')
  })

  it('un error que no es de red nunca deja entrar, aunque esté recordado', async () => {
    const memoria = memoriaFalsa()
    memoria.guardar('ana@ejemplo.com', new Date(T0).toISOString())
    const { cliente } = clienteFalso({ sesion: ana, errorAutorizacion: 'permiso denegado' })
    expect((await crearServicioAcceso(cliente, { memoria, ahora: ahoraEn(T0) }).resolverEstado()).tipo).toBe('error')
  })

  it('si la base dice que no está autorizado, olvida el correo', async () => {
    const memoria = memoriaFalsa()
    memoria.guardar('ana@ejemplo.com', new Date(T0).toISOString())
    const { cliente } = clienteFalso({ sesion: ana, autorizado: false })
    const estado = await crearServicioAcceso(cliente, { memoria, ahora: ahoraEn(T0) }).resolverEstado()
    expect(estado.tipo).toBe('no-autorizado')
    expect(memoria.leer()).toBeNull()
  })

  it('al cerrar sesión olvida el correo', async () => {
    const memoria = memoriaFalsa()
    memoria.guardar('ana@ejemplo.com', new Date(T0).toISOString())
    const { cliente } = clienteFalso({ sesion: ana })
    await crearServicioAcceso(cliente, { memoria, ahora: ahoraEn(T0) }).cerrarSesion()
    expect(memoria.leer()).toBeNull()
  })

  it('sin memoria configurada todo sigue igual: un fallo niega el acceso', async () => {
    const { cliente } = clienteFalso({ sesion: ana, errorAutorizacion: 'Failed to fetch' })
    expect((await crearServicioAcceso(cliente).resolverEstado()).tipo).toBe('error')
  })
})

describe('iniciarSesionConCodigo', () => {
  it('envía el código sin espacios a los lados', async () => {
    const { cliente } = clienteFalso({})
    await crearServicioAcceso(cliente).iniciarSesionConCodigo('  clave-de-ana  ')
    expect(cliente.iniciarSesionConCodigo).toHaveBeenCalledWith('clave-de-ana')
  })

  it('un código vacío se rechaza sin llamar al cliente', async () => {
    const { cliente } = clienteFalso({})
    await expect(crearServicioAcceso(cliente).iniciarSesionConCodigo('   ')).rejects.toThrow(/escribe el código/i)
    expect(cliente.iniciarSesionConCodigo).not.toHaveBeenCalled()
  })

  it('si el cliente falla, lanza el motivo', async () => {
    const { cliente } = clienteFalso({ errorCodigo: 'El código no es válido' })
    await expect(crearServicioAcceso(cliente).iniciarSesionConCodigo('otro-codigo')).rejects.toThrow(/no es válido/)
  })
})
