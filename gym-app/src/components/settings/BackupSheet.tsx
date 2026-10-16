import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { exportProfileData, importProfileData } from '../../lib/exportImport'
import { SettingsSheet } from './SettingsSheet'
import { SettingsRow } from './SettingsParts'

export function BackupSheet({ profileId, onClose }: { profileId: number; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importProfileData(file)
      setStatus('Copia importada como perfil nuevo')
    } catch {
      setStatus('No se pudo importar el archivo')
    }
    e.target.value = ''
  }

  return (
    <SettingsSheet title="Copia de seguridad" onClose={onClose}>
      <div className="card-forged divide-y divide-white/[0.06] overflow-hidden">
        <SettingsRow
          icon={Download}
          label="Exportar mis datos"
          detail="Archivo JSON con todo tu perfil"
          onClick={() => exportProfileData(profileId)}
        />
        <SettingsRow
          icon={Upload}
          label="Importar copia de seguridad"
          detail="Se añade como un perfil nuevo"
          onClick={() => fileInputRef.current?.click()}
        />
      </div>
      <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
      {status && <p className="text-center text-xs text-accent">{status}</p>}
    </SettingsSheet>
  )
}
