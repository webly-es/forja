# Forja

App personal de entrenamiento para uso propio. Perfil con métricas corporales (IMC, calorías, macros), rutinas fijas por día, registro de series con peso/repeticiones, cronómetro de descanso automático y seguimiento de progreso. Todo se guarda localmente en el dispositivo (IndexedDB) — sin cuentas, sin backend.

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Despliegue

Se despliega automáticamente a GitHub Pages vía GitHub Actions en cada push a `main` (ver `.github/workflows/deploy.yml` en la raíz del repo).

## Datos

Todos los datos viven en el navegador (IndexedDB). Usa **Ajustes → Exportar mis datos** para hacer un backup en JSON, e **Importar backup** para restaurarlo (por ejemplo al cambiar de dispositivo o navegador).
