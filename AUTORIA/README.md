# Autoría de Forja

`declaracion.txt` es una declaración de autoría de Jonathan Suárez sobre este código,
firmada con su clave privada (Ed25519). La clave privada no está en el repositorio:
solo la tiene el autor. Cualquiera puede comprobar la firma con la clave pública:

```bash
node AUTORIA/verificar.mjs
```

Si la comprobación da `true`, la declaración la firmó quien posee la clave privada
correspondiente a `clave-publica.pem` (huella SHA-256 indicada en la declaración), y
no se ha modificado ni una letra desde entonces.

La app publicada lleva además una marca de autoría con esa misma huella, para
identificar copias del código aunque se elimine este aviso.
