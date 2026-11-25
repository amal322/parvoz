// A guided walkthrough of one hire, start to invoice. Each step performs the real action in the
// demo store, so what the viewer sees is the product doing its job, not a slideshow.
import React, { useEffect, useState } from 'react'
import { addDays } from '../data/logic'
import { ME_STUDENT, TODAY } from '../data/seed'
import { cardOf, confirmHire, enter, getState, go, openProfile, reportHire, requestIntro, respondIntro, setTour, useStore } from '../data/store'
import { currentT, useT } from '../i18n'
import { sendToAgent } from '../views/agent'
import { Icon } from './bits'

const HIRE_SALARY = 11e6
let placement = ''
const STEPS: (() => void)[] = [
  () => { go('agent'); setTimeout(() => sendToAgent(currentT().t('ag.s1')), 500) },
  () => { if (getState().viewer !== 'company') go('agent'); setTimeout(() => openProfile(ME_STUDENT), 300) },
  () => { if (!cardOf(getState(), ME_STUDENT) || cardOf(getState(), ME_STUDENT)!.intro === 'none') requestIntro(ME_STUDENT) },
  () => enter('student'),
  () => respondIntro(ME_STUDENT, true),
  () => { go('pipeline'); setTimeout(() => { if (cardOf(getState(), ME_STUDENT)?.stage !== 'hired') placement = reportHire(ME_STUDENT, HIRE_SALARY, addDays(TODAY, 20)) }, 500) },
  () => { if (placement) confirmHire(placement, true); go('billing') },
  () => go('placements'),
]
export const TOUR_STEPS = STEPS.length

export function startTour() {
  setTour(0)
  STEPS[0]()
}

export function Tour() {
  const { t } = useT()
  const step = useStore((s) => s.tour)
  const [auto, setAuto] = useState(false)
  const last = step !== null && step >= STEPS.length - 1
  const next = () => {
    const i = getState().tour
    if (i === null || i >= STEPS.length - 1) return
    setTour(i + 1)
    STEPS[i + 1]()
  }
  useEffect(() => {
    if (!auto || step === null || last) return
    const id = setTimeout(next, 5200)
    return () => clearTimeout(id)
  }, [auto, step, last])
  if (step === null) return null
  return (
    <aside className="tour" aria-label={t('tour.t')}>
      <div className="tour-top">
        <span className="tour-n">{t('tour.step', { n: step + 1, m: STEPS.length })}</span>
        <button className="tour-x" onClick={() => { setAuto(false); setTour(null) }} aria-label={t('l.close')}><Icon name="close" size={16} /></button>
      </div>
      <i className="tour-bar" style={{ transform: `scaleX(${(step + 1) / STEPS.length})` }} />
      <h2>{t(`tour.${step + 1}.t`)}</h2>
      <p>{t(`tour.${step + 1}.d`)}</p>
      <div className="tour-act">
        {last ? (
          <button className="tour-next" onClick={() => { location.hash = 'tour'; location.reload() }}>{t('tour.again')}<Icon name="arrow" size={15} /></button>
        ) : (
          <>
            <button className="tour-next" onClick={() => { setAuto(false); next() }}>{t('tour.next')}<Icon name="arrow" size={15} /></button>
            <button className="tour-auto" role="switch" aria-checked={auto} onClick={() => setAuto(!auto)}><Icon name="play" size={13} />{t('tour.auto')}</button>
          </>
        )}
      </div>
    </aside>
  )
}
