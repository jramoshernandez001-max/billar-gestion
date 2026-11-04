/**
 * Pruebas del almacén local.
 *
 * Qué hace: verifica leer, guardar, borrar y listar claves sobre un
 * almacenamiento tipo localStorage.
 * Cómo lo hace: un almacenamiento falso con la misma interfaz de Storage.
 * Por qué: la cola y las copias de lectura dependen de este adaptador.
 */
import { describe, expect, it } from 'vitest'
import { crearAlmacenLocal } from './almacenLocal'

function storageFalso(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  }
}

describe('almacén local', () => {
  it('guarda, lee y borra', () => {
    const a = crearAlmacenLocal(storageFalso())
    expect(a.leer('x')).toBeNull()
    a.guardar('x', '1')
    expect(a.leer('x')).toBe('1')
    a.borrar('x')
    expect(a.leer('x')).toBeNull()
  })

  it('lista las claves', () => {
    const a = crearAlmacenLocal(storageFalso())
    a.guardar('a', '1')
    a.guardar('b', '2')
    expect(a.claves().sort()).toEqual(['a', 'b'])
  })
})
