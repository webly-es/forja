// Comprueba la firma de la declaración de autoría con la clave pública.
import { createPublicKey, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'

const here = new URL('.', import.meta.url)
const statement = readFileSync(new URL('declaracion.txt', here))
const signature = Buffer.from(readFileSync(new URL('declaracion.sig', here), 'utf8').trim(), 'base64')
const publicKey = createPublicKey(readFileSync(new URL('clave-publica.pem', here)))

const ok = verify(null, statement, publicKey, signature)
console.log(ok ? 'Firma válida: true' : 'Firma NO válida: false')
process.exit(ok ? 0 : 1)
