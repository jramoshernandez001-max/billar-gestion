/**
 * Pruebas de la configuración de Supabase.
 *
 * Qué hace: verifica que la configuración se lea del entorno, que falte
 * algo se avise con un error claro y que nunca se acepte una clave secreta.
 * Cómo lo hace: llama a leerConfiguracionSupabase con entornos inventados.
 * Por qué: la app corre en el navegador de cualquiera; una clave de servicio
 * ahí saltaría toda la seguridad de la base de datos.
 */
import { describe, it, expect } from 'vitest'
import { leerConfiguracionSupabase } from './supabase'

const URL_VALIDA = 'https://proyectoejemplo.supabase.co'
const CLAVE_PUBLICA = 'sb_publishable_claveDeEjemplo123'

/** Arma un JWT de ejemplo con el rol indicado (la firma no importa aquí). */
const jwtConRol = (rol: string): string => {
  const codificar = (objeto: object) =>
    btoa(JSON.stringify(objeto)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${codificar({ alg: 'HS256', typ: 'JWT' })}.${codificar({ role: rol })}.firma`
}

describe('leerConfiguracionSupabase', () => {
  it('devuelve la URL y la clave pública', () => {
    const config = leerConfiguracionSupabase({
      VITE_SUPABASE_URL: URL_VALIDA,
      VITE_SUPABASE_PUBLISHABLE_KEY: CLAVE_PUBLICA,
    })
    expect(config).toEqual({ url: URL_VALIDA, clavePublica: CLAVE_PUBLICA })
  })

  it('quita los espacios y la barra final de la URL', () => {
    const config = leerConfiguracionSupabase({
      VITE_SUPABASE_URL: `  ${URL_VALIDA}/  `,
      VITE_SUPABASE_PUBLISHABLE_KEY: ` ${CLAVE_PUBLICA} `,
    })
    expect(config.url).toBe(URL_VALIDA)
    expect(config.clavePublica).toBe(CLAVE_PUBLICA)
  })

  it('avisa qué variable falta', () => {
    expect(() => leerConfiguracionSupabase({ VITE_SUPABASE_PUBLISHABLE_KEY: CLAVE_PUBLICA })).toThrow(
      /VITE_SUPABASE_URL/,
    )
    expect(() => leerConfiguracionSupabase({ VITE_SUPABASE_URL: URL_VALIDA })).toThrow(
      /VITE_SUPABASE_PUBLISHABLE_KEY/,
    )
    expect(() =>
      leerConfiguracionSupabase({ VITE_SUPABASE_URL: '   ', VITE_SUPABASE_PUBLISHABLE_KEY: CLAVE_PUBLICA }),
    ).toThrow(/VITE_SUPABASE_URL/)
  })

  it('rechaza una URL que no es https', () => {
    const entorno = { VITE_SUPABASE_PUBLISHABLE_KEY: CLAVE_PUBLICA }
    expect(() => leerConfiguracionSupabase({ ...entorno, VITE_SUPABASE_URL: 'http://proyectoejemplo.supabase.co' })).toThrow(/https/)
    expect(() => leerConfiguracionSupabase({ ...entorno, VITE_SUPABASE_URL: 'no es una url' })).toThrow(/URL/)
  })

  it('acepta http solo para el desarrollo local', () => {
    const entorno = { VITE_SUPABASE_PUBLISHABLE_KEY: CLAVE_PUBLICA }
    expect(leerConfiguracionSupabase({ ...entorno, VITE_SUPABASE_URL: 'http://localhost:54321' }).url).toBe(
      'http://localhost:54321',
    )
    expect(leerConfiguracionSupabase({ ...entorno, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }).url).toBe(
      'http://127.0.0.1:54321',
    )
  })

  it('rechaza una clave secreta (sb_secret_)', () => {
    expect(() =>
      leerConfiguracionSupabase({ VITE_SUPABASE_URL: URL_VALIDA, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_ejemplo' }),
    ).toThrow(/secreta/)
  })

  it('rechaza una clave JWT con rol service_role', () => {
    expect(() =>
      leerConfiguracionSupabase({ VITE_SUPABASE_URL: URL_VALIDA, VITE_SUPABASE_PUBLISHABLE_KEY: jwtConRol('service_role') }),
    ).toThrow(/secreta/)
  })

  it('acepta una clave JWT con rol anon', () => {
    const anon = jwtConRol('anon')
    expect(
      leerConfiguracionSupabase({ VITE_SUPABASE_URL: URL_VALIDA, VITE_SUPABASE_PUBLISHABLE_KEY: anon }).clavePublica,
    ).toBe(anon)
  })

  it('rechaza una URL con ruta, como la de la API de datos (/rest/v1)', () => {
    const entorno = { VITE_SUPABASE_URL: 'https://abc.supabase.co/rest/v1', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }
    expect(() => leerConfiguracionSupabase(entorno)).toThrow(/sin ruta/i)
  })

  it('acepta la URL con barra final o con espacios (no es una ruta)', () => {
    const entorno = { VITE_SUPABASE_URL: ' https://abc.supabase.co/ ', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }
    expect(leerConfiguracionSupabase(entorno).url).toBe('https://abc.supabase.co')
  })
})
