/**
 * Pruebas del repositorio de bitácora.
 *
 * Qué hace: verifica la lectura de la bitácora: conversión de filas (hora a
 * ISO UTC, antes y después como objetos) y errores ante filas mal formadas.
 * Cómo lo hace: usa el cliente falso compartido.
 * Por qué: la bitácora es solo de lectura para la app; de ella se saca qué
 * cambió y cuándo para saber qué cierres quedaron desactualizados.
 */
import { describe, it, expect } from 'vitest'
import { crearRepositorioBitacora } from './bitacora'
import { clienteFalso } from './apoyoPruebas'

const fila = {
  id: 'b1',
  momento: '2026-11-04T10:00:00.5+00:00',
  usuario: 'persona@ejemplo.com',
  accion: 'anular-registro',
  tabla: 'ventas',
  registro_id: 'v1',
  antes: { estado: 'vigente' },
  despues: { estado: 'anulada', fecha: '2026-11-03' },
  motivo: 'error',
}

describe('listarBitacora', () => {
  it('convierte las filas a entradas con hora ISO UTC', async () => {
    const { cliente } = clienteFalso({}, { bitacora: [fila, { ...fila, id: 'b2', tabla: null, registro_id: null, antes: null, motivo: null }] })
    const entradas = await crearRepositorioBitacora(cliente).listarBitacora()
    expect(entradas[0]).toEqual({
      id: 'b1',
      momento: '2026-11-04T10:00:00.500Z',
      usuario: 'persona@ejemplo.com',
      accion: 'anular-registro',
      tabla: 'ventas',
      registroId: 'v1',
      antes: { estado: 'vigente' },
      despues: { estado: 'anulada', fecha: '2026-11-03' },
      motivo: 'error',
    })
    expect(entradas[1]).toMatchObject({ tabla: null, registroId: null, antes: null, motivo: null })
  })

  it('rechaza filas mal formadas o con una acción fuera de la lista', async () => {
    for (const mala of [
      { ...fila, momento: 'ayer' },
      { ...fila, accion: 'borrar-todo' },
      { ...fila, usuario: 7 },
      { ...fila, despues: 'texto' },
    ]) {
      const { cliente } = clienteFalso({}, { bitacora: [mala] })
      await expect(crearRepositorioBitacora(cliente).listarBitacora()).rejects.toThrow(/fila/i)
    }
  })

  it('propaga el error de lectura', async () => {
    const cliente = {
      rpc: async () => ({ data: null, error: null }),
      from: () => ({ select: async () => ({ data: null, error: { message: 'sin permisos' } }) }),
    }
    await expect(crearRepositorioBitacora(cliente).listarBitacora()).rejects.toThrow('sin permisos')
  })
})
