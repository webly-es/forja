import { useLiveQuery } from 'dexie-react-hooks'
import { getBalanceSeries } from '../../db/progress'
import { shiftDateKey, todayKey } from '../../lib/dates'
import { BalanceBars } from '../charts/BalanceBars'
import { EmptyHint, ProgressSection } from './shared'
import { shortDate } from '../../lib/format'

const DAYS = 14

export function NutritionSection({ profileId }: { profileId: number }) {
  const series = useLiveQuery(() => getBalanceSeries(profileId, DAYS), [profileId])
  if (!series) return null

  const lastWeek = series.filter((d) => d.date > shiftDateKey(todayKey(), -7))
  const avg = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) / Math.max(1, values.length))
  const avgBalance = avg(lastWeek.map((d) => d.consumed - d.spent))

  return (
    <ProgressSection title={`Nutrición (${DAYS} días)`}>
      {series.length === 0 ? (
        <EmptyHint>Registra comidas en Nutrición para ver tu balance aquí.</EmptyHint>
      ) : (
        <>
          {lastWeek.length > 0 && (
            <div className="mb-4 grid grid-cols-3 text-center">
              <div>
                <div className="font-display text-2xl text-text">{avg(lastWeek.map((d) => d.consumed)).toLocaleString('es')}</div>
                <div className="text-[11px] text-text-muted">media consumida</div>
              </div>
              <div>
                <div className="font-display text-2xl text-text">{avg(lastWeek.map((d) => d.spent)).toLocaleString('es')}</div>
                <div className="text-[11px] text-text-muted">media gastada</div>
              </div>
              <div>
                <div className="font-display text-2xl text-accent">
                  {avgBalance > 0 ? '+' : ''}
                  {avgBalance.toLocaleString('es')}
                </div>
                <div className="text-[11px] text-text-muted">balance medio</div>
              </div>
            </div>
          )}
          <BalanceBars
            points={series.map((d) => ({
              label: shortDate(d.date),
              balance: d.consumed - d.spent,
              consumed: d.consumed,
              spent: d.spent,
            }))}
          />
          <p className="mt-1 text-[11px] text-text-muted">Medias de los últimos 7 días con comidas registradas.</p>
        </>
      )}
    </ProgressSection>
  )
}
