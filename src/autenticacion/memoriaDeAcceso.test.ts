/**
 * Pruebas de la memoria de acceso.
 *
 * Qué hace: verifica guardar, leer y borrar el correo autorizado, y que un
 * texto dañado se vea como "no hay nada".
 * Cómo lo hace: un Storage falso.
 * Por qué: de esta memoria depende que alguien pueda entrar sin conexión;
 * si estuviera dañada debe negar, no permitir.
 */
import { describe, expect, it } from 'vitest'
import { crearMemoriaDeAcceso } from './memoriaDeAcceso'

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

describe('memoria de acceso', () => {
  it('guarda, lee y borra', () => {
    const memoria = crearMemoriaDeAcceso(storageFalso())
    expect(memoria.leer()).toBeNull()
    memoria.guardar('ana@ejemplo.com', '2026-11-04T10:00:00.000Z')
    expect(memoria.leer()).toEqual({ correo: 'ana@ejemplo.com', en: '2026-11-04T10:00:00.000Z' })
    memoria.borrar()
    expect(memoria.leer()).toBeNull()
  })

  it('texto dañado o con forma inválida se ve como vacío', () => {
    const s = storageFalso()
    const memoria = crearMemoriaDeAcceso(s)
    s.setItem('billar.acceso', '{no json')
    expect(memoria.leer()).toBeNull()
    s.setItem('billar.acceso', JSON.stringify({ correo: 5 }))
    expect(memoria.leer()).toBeNull()
  })

  it('si el almacenamiento falla al guardar, no rompe', () => {
    const s = storageFalso()
    s.setItem = () => {
      throw new Error('cuota')
    }
    expect(() => crearMemoriaDeAcceso(s).guardar('a@b.c', '2026-11-04T10:00:00.000Z')).not.toThrow()
  })
})
