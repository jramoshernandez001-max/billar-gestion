/**
 * Pruebas del repositorio de deudas y abonos.
 *
 * Qué hace: verifica validación, normalización de descripciones, nombres de
 * parámetros (contra las migraciones) y manejo de respuestas y errores.
 * Cómo lo hace: usa el cliente falso compartido.
 * Por qué: cada deuda y abono debe quedar justificado y con monto positivo;
 * es mejor avisar antes de ir a la base, que de todos modos vuelve a validar.
 */
import { describe, it, expect } from 'vitest'
import { crearRepositorioDeudas } from './deudas'
import { clienteFalso, parametrosSql } from './apoyoPruebas'

const ID = '11111111-1111-1111-1111-111111111111'
const deuda = { cliente: 'Cliente Ejemplo', fecha: '2026-11-03', monto: 15000, descripcion: 'Consumo fiado' }
const abono = { deudaId: ID, fecha: '2026-11-04', monto: 5000, descripcion: 'Abono en efectivo' }

describe('registrarDeuda', () => {
  it('manda los parámetros con nombres de la base y normaliza la descripción', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    const id = await crearRepositorioDeudas(cliente).registrarDeuda({
      ...deuda,
      cliente: '  Cliente   Ejemplo ',
      descripcion: '  Consumo \n  fiado  ',
    })
    expect(id).toBe(ID)
    const [nombre, args] = rpc.mock.calls[0]
    expect(nombre).toBe('registrar_deuda')
    expect(Object.keys(args)).toEqual(parametrosSql('registrar_deuda'))
    expect(args).toEqual({ p_cliente: 'Cliente Ejemplo', p_fecha: '2026-11-03', p_monto: 15000, p_descripcion: 'Consumo fiado' })
  })

  it('rechaza datos inválidos sin llamar a la base', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    const repo = crearRepositorioDeudas(cliente)
    await expect(repo.registrarDeuda({ ...deuda, cliente: '  ' })).rejects.toThrow(/cliente/i)
    await expect(repo.registrarDeuda({ ...deuda, fecha: '3/11/2026' })).rejects.toThrow()
    await expect(repo.registrarDeuda({ ...deuda, monto: 0 })).rejects.toThrow(/mayor a cero/)
    await expect(repo.registrarDeuda({ ...deuda, monto: 10.5 })).rejects.toThrow()
    await expect(repo.registrarDeuda({ ...deuda, descripcion: '   ' })).rejects.toThrow(/descripción/i)
    await expect(repo.registrarDeuda({ ...deuda, descripcion: 'a'.repeat(201) })).rejects.toThrow(/200/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('propaga errores de la base y valida la respuesta', async () => {
    await expect(crearRepositorioDeudas(clienteFalso({ error: 'No autorizado' }).cliente).registrarDeuda(deuda)).rejects.toThrow('No autorizado')
    await expect(crearRepositorioDeudas(clienteFalso({ data: 1 }).cliente).registrarDeuda(deuda)).rejects.toThrow(/respuesta/i)
  })
})

describe('registrarAbono', () => {
  it('manda los parámetros con nombres de la base', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    expect(await crearRepositorioDeudas(cliente).registrarAbono({ ...abono, descripcion: ' Abono   en efectivo ' })).toBe(ID)
    const [nombre, args] = rpc.mock.calls[0]
    expect(nombre).toBe('registrar_abono')
    expect(Object.keys(args)).toEqual(parametrosSql('registrar_abono'))
    expect(args).toEqual({ p_deuda_id: ID, p_fecha: '2026-11-04', p_monto: 5000, p_descripcion: 'Abono en efectivo' })
  })

  it('rechaza datos inválidos sin llamar a la base', async () => {
    const { cliente, rpc } = clienteFalso({ data: ID })
    const repo = crearRepositorioDeudas(cliente)
    await expect(repo.registrarAbono({ ...abono, deudaId: '' })).rejects.toThrow(/deuda/i)
    await expect(repo.registrarAbono({ ...abono, monto: 0 })).rejects.toThrow(/mayor a cero/)
    await expect(repo.registrarAbono({ ...abono, descripcion: '' })).rejects.toThrow(/descripción/i)
    await expect(repo.registrarAbono({ ...abono, fecha: 'x' })).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('muestra el mensaje de la base si el abono supera la deuda', async () => {
    const { cliente } = clienteFalso({ error: 'El abono supera lo que se debe' })
    await expect(crearRepositorioDeudas(cliente).registrarAbono(abono)).rejects.toThrow('supera')
  })
})

describe('anular deuda y abono', () => {
  it('anularDeuda manda id y motivo', async () => {
    const { cliente, rpc } = clienteFalso()
    await crearRepositorioDeudas(cliente).anularDeuda(ID, ' se cargó al cliente equivocado ')
    const [nombre, args] = rpc.mock.calls[0]
    expect(nombre).toBe('anular_deuda')
    expect(Object.keys(args)).toEqual(parametrosSql('anular_deuda'))
    expect(args).toEqual({ p_deuda_id: ID, p_motivo: 'se cargó al cliente equivocado' })
  })

  it('anularAbono manda id y motivo', async () => {
    const { cliente, rpc } = clienteFalso()
    await crearRepositorioDeudas(cliente).anularAbono(ID, 'monto mal digitado')
    const [nombre, args] = rpc.mock.calls[0]
    expect(nombre).toBe('anular_abono')
    expect(Object.keys(args)).toEqual(parametrosSql('anular_abono'))
    expect(args).toEqual({ p_abono_id: ID, p_motivo: 'monto mal digitado' })
  })

  it('exigen id y motivo, y propagan errores', async () => {
    const { cliente, rpc } = clienteFalso()
    const repo = crearRepositorioDeudas(cliente)
    await expect(repo.anularDeuda('', 'x')).rejects.toThrow(/deuda/i)
    await expect(repo.anularDeuda(ID, ' ')).rejects.toThrow(/motivo/i)
    await expect(repo.anularAbono('', 'x')).rejects.toThrow(/abono/i)
    await expect(repo.anularAbono(ID, '')).rejects.toThrow(/motivo/i)
    expect(rpc).not.toHaveBeenCalled()
    await expect(crearRepositorioDeudas(clienteFalso({ error: 'tiene abonos vigentes' }).cliente).anularDeuda(ID, 'x')).rejects.toThrow('abonos vigentes')
  })
})

describe('lecturas', () => {
  it('listarDeudas y listarAbonos convierten las filas', async () => {
    const { cliente } = clienteFalso({}, {
      deudas: [{ id: ID, cliente: 'Ana', fecha: '2026-11-03', monto: 15000, descripcion: 'Fiado', estado: 'vigente' }],
      abonos_deuda: [{ id: 'a1', deuda_id: ID, fecha: '2026-11-04', monto: 5000, descripcion: 'Abono', estado: 'anulada' }],
    })
    const repo = crearRepositorioDeudas(cliente)
    expect(await repo.listarDeudas()).toEqual([{ id: ID, cliente: 'Ana', fecha: '2026-11-03', monto: 15000, descripcion: 'Fiado', estado: 'vigente' }])
    expect(await repo.listarAbonos()).toEqual([{ id: 'a1', deudaId: ID, fecha: '2026-11-04', monto: 5000, descripcion: 'Abono', estado: 'anulada' }])
  })

  it('una fila mal formada da error', async () => {
    const mala = clienteFalso({}, { deudas: [{ id: 1 }], abonos_deuda: [{ id: 'a', estado: 'otro' }] }).cliente
    await expect(crearRepositorioDeudas(mala).listarDeudas()).rejects.toThrow(/fila/i)
    await expect(crearRepositorioDeudas(mala).listarAbonos()).rejects.toThrow(/fila/i)
  })
})
