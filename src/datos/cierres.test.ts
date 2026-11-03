/**
 * Pruebas del repositorio de cierres.
 *
 * Qué hace: verifica que guardar, recalcular y corregir el dinero de un cierre
 * validen sus datos, usen los nombres de parámetros de la base y que la
 * lectura convierta las filas (fechas y horas) al formato del dominio.
 * Cómo lo hace: usa el cliente falso compartido.
 * Por qué: el cierre guarda lo que calculó el dominio; un campo mal nombrado
 * o una hora en otro formato rompería el cálculo de "desactualizado".
 */
import { describe, it, expect } from 'vitest'
import { crearRepositorioCierres } from './cierres'
import { clienteFalso, parametrosSql } from './apoyoPruebas'

const ID = '11111111-1111-1111-1111-111111111111'
const semanal = {
  tipo: 'semanal' as const,
  desde: '2026-11-02',
  hasta: '2026-11-08',
  efectivo: 100000,
  transferencias: 50000,
  costosManuales: { [ID]: 1500 },
  costosUsados: [{ productoId: ID, compra: { id: 'c1', fecha: '2026-11-03' } }],
  resultado: { cuadra: true },
}

describe('guardarCierre', () => {
  it('manda los parámetros con los nombres de la base y devuelve el id', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    expect(await crearRepositorioCierres(cliente).guardarCierre(semanal)).toBe(ID)
    const [nombre, args] = rpc.mock.calls[0]
    expect(nombre).toBe('guardar_cierre')
    expect(Object.keys(args)).toEqual(parametrosSql('guardar_cierre'))
    expect(args).toEqual({
      p_tipo: 'semanal',
      p_desde: '2026-11-02',
      p_hasta: '2026-11-08',
      p_efectivo: 100000,
      p_transferencias: 50000,
      p_costos_manuales: { [ID]: 1500 },
      p_costos_usados: [{ productoId: ID, compra: { id: 'c1', fecha: '2026-11-03' } }],
      p_resultado: { cuadra: true },
    })
  })

  it('sin costos manuales manda un objeto vacío', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    await crearRepositorioCierres(cliente).guardarCierre({ ...semanal, costosManuales: undefined })
    expect(rpc.mock.calls[0][1].p_costos_manuales).toEqual({})
  })

  it('rechaza datos inválidos sin llamar a la base', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    const repo = crearRepositorioCierres(cliente)
    await expect(repo.guardarCierre({ ...semanal, tipo: 'mensual' as 'diario' })).rejects.toThrow(/tipo/i)
    await expect(repo.guardarCierre({ ...semanal, desde: '2026-11-03' })).rejects.toThrow(/lunes/i)
    await expect(repo.guardarCierre({ ...semanal, tipo: 'diario', hasta: '2026-11-03' })).rejects.toThrow(/día/i)
    await expect(repo.guardarCierre({ ...semanal, efectivo: -1 })).rejects.toThrow()
    await expect(repo.guardarCierre({ ...semanal, transferencias: 1.5 })).rejects.toThrow()
    await expect(repo.guardarCierre({ ...semanal, costosManuales: { [ID]: -3 } })).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('acepta un cierre diario de un solo día', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    await crearRepositorioCierres(cliente).guardarCierre({ ...semanal, tipo: 'diario', desde: '2026-11-03', hasta: '2026-11-03', costosUsados: [] })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('propaga errores de la base y valida la respuesta', async () => {
    await expect(crearRepositorioCierres(clienteFalso({ error: 'Ya existe un cierre' }).cliente).guardarCierre(semanal)).rejects.toThrow('Ya existe')
    await expect(crearRepositorioCierres(clienteFalso({ data: 7 }).cliente).guardarCierre(semanal)).rejects.toThrow(/respuesta/i)
  })
})

describe('recalcularCierre', () => {
  it('manda id, costos y resultado con los nombres de la base', async () => {
    const { cliente, rpc } = clienteFalso()
    await crearRepositorioCierres(cliente).recalcularCierre(ID, [], { cuadra: false })
    const [nombre, args] = rpc.mock.calls[0]
    expect(nombre).toBe('recalcular_cierre')
    expect(Object.keys(args)).toEqual(parametrosSql('recalcular_cierre'))
    expect(args).toEqual({ p_cierre_id: ID, p_costos_usados: [], p_resultado: { cuadra: false } })
  })

  it('exige el id', async () => {
    const { cliente, rpc } = clienteFalso()
    await expect(crearRepositorioCierres(cliente).recalcularCierre(' ', [], {})).rejects.toThrow(/cierre/i)
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('corregirDineroCierre', () => {
  it('manda id y montos con los nombres de la base', async () => {
    const { cliente, rpc } = clienteFalso()
    await crearRepositorioCierres(cliente).corregirDineroCierre(ID, 90000, 60000)
    const [nombre, args] = rpc.mock.calls[0]
    expect(nombre).toBe('corregir_dinero_cierre')
    expect(Object.keys(args)).toEqual(parametrosSql('corregir_dinero_cierre'))
    expect(args).toEqual({ p_cierre_id: ID, p_efectivo: 90000, p_transferencias: 60000 })
  })

  it('rechaza montos inválidos', async () => {
    const { cliente, rpc } = clienteFalso()
    const repo = crearRepositorioCierres(cliente)
    await expect(repo.corregirDineroCierre(ID, -1, 0)).rejects.toThrow()
    await expect(repo.corregirDineroCierre(ID, 0, 2.5)).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('listarCierres', () => {
  const fila = {
    id: ID,
    tipo: 'semanal',
    desde: '2026-11-02',
    hasta: '2026-11-08',
    efectivo: 100000,
    transferencias: 50000,
    calculado_en: '2026-11-09T14:00:00.123456+00:00',
    dinero_corregido_en: null,
    costos_usados: [{ productoId: ID, compra: { id: 'c1', fecha: '2026-11-03' } }],
    resultado: { cuadra: true },
  }

  it('convierte las filas y normaliza las horas a ISO UTC', async () => {
    const { cliente } = clienteFalso({}, { cierres: [fila, { ...fila, id: 'x', dinero_corregido_en: '2026-11-10T09:30:00+00:00' }] })
    const cierres = await crearRepositorioCierres(cliente).listarCierres()
    expect(cierres[0]).toEqual({
      id: ID,
      tipo: 'semanal',
      desde: '2026-11-02',
      hasta: '2026-11-08',
      efectivo: 100000,
      transferencias: 50000,
      calculadoEn: '2026-11-09T14:00:00.123Z',
      dineroCorregidoEn: null,
      costosUsados: [{ productoId: ID, compra: { id: 'c1', fecha: '2026-11-03' } }],
      resultado: { cuadra: true },
    })
    expect(cierres[1].dineroCorregidoEn).toBe('2026-11-10T09:30:00.000Z')
  })

  it('una fila mal formada da error', async () => {
    for (const mala of [{ ...fila, tipo: 'otro' }, { ...fila, calculado_en: 'ayer' }, { ...fila, costos_usados: {} }, { ...fila, resultado: null }]) {
      const { cliente } = clienteFalso({}, { cierres: [mala] })
      await expect(crearRepositorioCierres(cliente).listarCierres()).rejects.toThrow(/fila/i)
    }
  })
})
