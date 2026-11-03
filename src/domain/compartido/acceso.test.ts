/**
 * Pruebas del control de acceso por lista de correos.
 *
 * Qué hace: verifica que un correo de Google esté autorizado solo si está en
 * la lista, sin importar mayúsculas ni espacios a los lados.
 * Cómo lo hace: usa una lista de correos inventados y prueba correos que
 * deben entrar y correos que no.
 * Por qué: el login es solo con Google y solo para las personas de la
 * lista; un error aquí deja entrar a quien no debe o deja fuera al dueño.
 */
import { describe, it, expect } from 'vitest'
import { estaAutorizado } from './acceso'

const autorizados = ['dueno@example.com', ' Socio@Example.com ']

describe('estaAutorizado', () => {
  it('autoriza un correo que está en la lista', () => {
    expect(estaAutorizado('dueno@example.com', autorizados)).toBe(true)
  })

  it('ignora mayúsculas en el correo y en la lista', () => {
    expect(estaAutorizado('DUENO@Example.COM', autorizados)).toBe(true)
    expect(estaAutorizado('socio@example.com', autorizados)).toBe(true)
  })

  it('ignora espacios a los lados en el correo y en la lista', () => {
    expect(estaAutorizado('  dueno@example.com  ', autorizados)).toBe(true)
    expect(estaAutorizado('socio@example.com', autorizados)).toBe(true)
  })

  it('no autoriza un correo que no está en la lista', () => {
    expect(estaAutorizado('otro@example.com', autorizados)).toBe(false)
  })

  it('no autoriza un correo parecido pero distinto', () => {
    expect(estaAutorizado('dueno@example.co', autorizados)).toBe(false)
    expect(estaAutorizado('xdueno@example.com', autorizados)).toBe(false)
  })

  it('no autoriza un correo vacío, aunque la lista tenga un vacío', () => {
    expect(estaAutorizado('', autorizados)).toBe(false)
    expect(estaAutorizado('   ', ['  '])).toBe(false)
  })

  it('con la lista vacía no autoriza a nadie', () => {
    expect(estaAutorizado('dueno@example.com', [])).toBe(false)
  })
})
