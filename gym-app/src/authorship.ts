// Forja · © 2026 Jonathan Suárez. Todos los derechos reservados. Ver LICENSE y AUTORIA/.
// Fingerprint of the author's signing key (AUTORIA/clave-publica.pem): it ships in the
// published bundle so copies of this code can be identified even if the notices are removed.
export const AUTHORSHIP = {
  work: 'Forja',
  author: 'Jonathan Suárez',
  rights: '© 2026 Jonathan Suárez. Todos los derechos reservados.',
  keyFingerprint: '182f589eb21b270026b37cead1bddbea885950e93a0b22306b3047746aee3d79',
} as const

export function stampAuthorship() {
  document.documentElement.dataset.forja = AUTHORSHIP.keyFingerprint
  document.querySelector('meta[name="author"]')?.setAttribute('content', AUTHORSHIP.rights)
}
