import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from '../app/App'
import { APP_STORAGE_KEY, ONBOARDING_STORAGE_KEY } from '../store/appStorage'

function renderLeaveReview() {
  render(<MemoryRouter><App /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: '내 휴가 설정하기' }))
}

describe('공군 기본 휴가 검토', () => {
  it('뒤로가기 버튼으로 저장 없이 시작 화면으로 돌아간다', () => {
    renderLeaveReview()
    const onboardingBefore = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    const appBefore = localStorage.getItem(APP_STORAGE_KEY)

    fireEvent.click(screen.getByRole('button', { name: '이전 단계로 돌아가기' }))

    expect(screen.getByText('1/3 · 시작')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '공군 휴가, 받는 날부터 쓰는 날까지' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '내 휴가 설정하기' })).toBeInTheDocument()
    expect(screen.queryByText('2/3 · 보유 휴가')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이전 단계로 돌아가기' })).not.toBeInTheDocument()
    expect(localStorage.getItem(APP_STORAGE_KEY)).toBe(appBefore)
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe(onboardingBefore)
    expect(JSON.parse(onboardingBefore ?? 'null').leaveSetupCompletedAt).toBeNull()
  })

  it.each([[true, true], [false, true], [true, false]])('다시 진입하면 연가 선택 %s·성과제 선택 %s와 입력 일수를 유지한다', (annualIncluded, performanceIncluded) => {
    renderLeaveReview()
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '24' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: '성과제 보유 일수' }), { target: { value: '7' } })
    if (!annualIncluded) fireEvent.click(screen.getByRole('checkbox', { name: '연가 등록' }))
    if (!performanceIncluded) fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))

    fireEvent.click(screen.getByRole('button', { name: '이전 단계로 돌아가기' }))
    fireEvent.click(screen.getByRole('button', { name: '내 휴가 설정하기' }))

    expect(screen.getByText('2/3 · 보유 휴가')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '연가 등록' })).toHaveProperty('checked', annualIncluded)
    expect(screen.getByRole('checkbox', { name: '성과제 등록' })).toHaveProperty('checked', performanceIncluded)
    if (!performanceIncluded) {
      expect(screen.queryByRole('spinbutton', { name: '성과제 보유 일수' })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    }
    expect(screen.getByRole('spinbutton', { name: '성과제 보유 일수' })).toHaveValue(7)
    if (!annualIncluded) {
      expect(screen.queryByRole('spinbutton', { name: '연가 보유 일수' })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('checkbox', { name: '연가 등록' }))
    }
    expect(screen.getByRole('spinbutton', { name: '연가 보유 일수' })).toHaveValue(24)
    expect(localStorage.getItem(APP_STORAGE_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? 'null').leaveSetupCompletedAt).toBeNull()
  })

  it('공군 선택 후 검토 화면을 보이고 미입력 항목은 아직 오류로 표시하지 않는다', () => {
    renderLeaveReview()

    expect(screen.getByText('2/3 · 보유 휴가')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '지금 가지고 있는 휴가를 알려주세요' })).toBeInTheDocument()
    expect(screen.getByText('먼저 보유 휴가를 등록하면 남은 휴가와 사용할 일정을 계산해드려요.')).toBeInTheDocument()
    expect(screen.getByText('정확하지 않아도 괜찮아요. 나중에 언제든 수정할 수 있어요.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '연가 등록' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '성과제 등록' })).not.toBeChecked()
    const annualInput = screen.getByRole('spinbutton', { name: '연가 보유 일수' })
    expect(annualInput).toHaveValue(null)
    expect(annualInput).toHaveAttribute('aria-invalid', 'false')
    expect(annualInput).toHaveClass('border-slate-300')
    expect(annualInput).toHaveAttribute('inputmode', 'numeric')
    expect(annualInput).toHaveAttribute('min', '1')
    expect(annualInput).toHaveAttribute('max', '365')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이 휴가로 시작하기' })).toBeEnabled()
    expect(screen.queryByRole('navigation', { name: '주요 화면' })).not.toBeInTheDocument()
  })

  it('증감 버튼 없이 항목 등록·제외와 일수 직접 입력을 지원한다', () => {
    renderLeaveReview()
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    expect(screen.getByRole('spinbutton', { name: '성과제 보유 일수' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /일수 (늘리기|줄이기)/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^[+−-]$/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('spinbutton', { name: '성과제 보유 일수' }), { target: { value: '7' } })
    expect(screen.getByRole('spinbutton', { name: '성과제 보유 일수' })).toHaveValue(7)
    fireEvent.click(screen.getByRole('checkbox', { name: '연가 등록' }))
    expect(screen.queryByRole('spinbutton', { name: '연가 보유 일수' })).not.toBeInTheDocument()
  })

  it.each([
    ['', '연가 보유 일수를 1~365일 정수로 입력해주세요.'],
    ['0', '연가 보유 일수를 1~365일 정수로 입력해주세요.'],
    ['1.5', '연가 보유 일수를 1~365일 정수로 입력해주세요.'],
    ['366', '연가 보유 일수를 1~365일 정수로 입력해주세요.'],
  ])('유효하지 않은 일수 %s는 저장을 막는다', (days, message) => {
    renderLeaveReview()
    const annualInput = screen.getByRole('spinbutton', { name: '연가 보유 일수' })
    if (days) fireEvent.change(annualInput, { target: { value: days } })
    fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))
    const fieldError = screen.getByRole('alert')
    expect(fieldError).toHaveTextContent(message)
    expect(screen.getByRole('spinbutton', { name: '연가 보유 일수' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('heading', { name: '기본 휴가 설정을 완료했어요' })).not.toBeInTheDocument()
    expect(localStorage.getItem(APP_STORAGE_KEY)).toBeNull()
  })

  it('유효한 일수를 입력하면 표시 중인 오류를 즉시 제거한다', () => {
    renderLeaveReview()
    const annualInput = screen.getByRole('spinbutton', { name: '연가 보유 일수' })
    fireEvent.change(annualInput, { target: { value: '0' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(annualInput, { target: { value: '30' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(annualInput).toHaveAttribute('aria-invalid', 'false')
    expect(annualInput).toHaveClass('border-slate-300')
    expect(screen.getByRole('button', { name: '이 휴가로 시작하기' })).toBeEnabled()
  })

  it('입력한 일수를 지우면 빈 값으로 유지하고 오류를 표시한다', () => {
    renderLeaveReview()
    const annualInput = screen.getByRole('spinbutton', { name: '연가 보유 일수' })
    fireEvent.change(annualInput, { target: { value: '30' } })
    fireEvent.change(annualInput, { target: { value: '' } })

    expect(annualInput).toHaveValue(null)
    expect(screen.getByRole('alert')).toHaveTextContent('연가 보유 일수를 1~365일 정수로 입력해주세요.')
    fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))
    expect(localStorage.getItem(APP_STORAGE_KEY)).toBeNull()
  })

  it('연가를 제외하면 성과제만 저장하며 365일도 유효하다', async () => {
    renderLeaveReview()
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '연가 등록' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: '성과제 보유 일수' }), { target: { value: '365' } })
    fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))

    await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' })
    const saved = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null')
    expect(saved.leaveGrants).toHaveLength(1)
    expect(saved.leaveGrants[0]).toMatchObject({ type: 'performance', days: 365 })
  })

  it('성과제 입력 오류는 성과제 입력 바로 아래에 표시하고 저장을 막는다', () => {
    renderLeaveReview()
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))

    const performanceInput = screen.getByRole('spinbutton', { name: '성과제 보유 일수' })
    expect(performanceInput).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByText('성과제 보유 일수를 1~365일 정수로 입력해주세요.')).not.toBeInTheDocument()
    fireEvent.blur(performanceInput)
    const performanceError = screen.getByRole('alert')
    expect(performanceInput).toHaveAttribute('aria-invalid', 'true')
    expect(performanceError).toHaveTextContent('성과제 보유 일수를 1~365일 정수로 입력해주세요.')
    expect(performanceInput.parentElement?.nextElementSibling).toBe(performanceError)
    fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))
    expect(localStorage.getItem(APP_STORAGE_KEY)).toBeNull()
  })

  it('미포함한 성과제는 일수가 비어 있어도 검증 오류를 표시하지 않는다', () => {
    renderLeaveReview()
    expect(screen.queryByRole('spinbutton', { name: '성과제 보유 일수' })).not.toBeInTheDocument()
    expect(screen.queryByText('성과제 보유 일수를 1~365일 정수로 입력해주세요.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이 휴가로 시작하기' })).toBeEnabled()
  })

  it('선택 항목이 없으면 저장을 막는다', () => {
    renderLeaveReview()
    fireEvent.click(screen.getByRole('checkbox', { name: '연가 등록' }))
    expect(screen.getByRole('button', { name: '이 휴가로 시작하기' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('저장할 휴가를 하나 이상 선택해주세요.')
  })

  it('선택된 유효 항목만 저장하고 완료 시각과 저장 요약을 표시한 뒤 CTA로 달력에 이동한다', async () => {
    renderLeaveReview()
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: '성과제 보유 일수' }), { target: { value: '3' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '22' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))

    expect(await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '달력' })).not.toBeInTheDocument()
    expect(screen.getByText('연가')).toBeInTheDocument()
    expect(screen.getByText('22일')).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null')
    expect(saved.leaveGrants).toHaveLength(1)
    expect(saved.leaveGrants[0]).toMatchObject({ type: 'annual', days: 22, acquiredDate: null })
    const onboarding = JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? 'null')
    expect(onboarding.branch).toBe('air_force')
    expect(Date.parse(onboarding.leaveSetupCompletedAt)).not.toBeNaN()
    fireEvent.click(screen.getByRole('button', { name: '첫 휴가 계획하기' }))
    expect(await screen.findByRole('heading', { name: '달력' })).toBeInTheDocument()
  })

  it('빠른 중복 클릭에도 같은 기본 휴가를 한 번만 만든다', async () => {
    renderLeaveReview()
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '18' } })
    const submit = screen.getByRole('button', { name: '이 휴가로 시작하기' })
    fireEvent.click(submit)
    fireEvent.click(submit)

    await waitFor(() => expect(screen.getByRole('heading', { name: '기본 휴가 설정을 완료했어요' })).toBeInTheDocument())
    const saved = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null')
    expect(saved.leaveGrants).toHaveLength(1)
    expect(saved.leaveGrants[0].id).toBe('air-force-onboarding-annual')
  })

  it.each(['연가·성과제 일수 수정하기', '이전 단계로 돌아가기'])('%s로 입력 단계에 돌아가 수정 후 완료해도 기존 휴가를 갱신한다', async (buttonName) => {
    renderLeaveReview()
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '24' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: '성과제 보유 일수' }), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))
    await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' })
    const before = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null')

    fireEvent.click(screen.getByRole('button', { name: buttonName }))
    expect(screen.getByText('2/3 · 보유 휴가')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '연가 등록' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '성과제 등록' })).toBeChecked()
    expect(screen.getByRole('spinbutton', { name: '연가 보유 일수' })).toHaveValue(24)
    expect(screen.getByRole('spinbutton', { name: '성과제 보유 일수' })).toHaveValue(7)
    expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null')).toEqual(before)

    // The introduction round trip must preserve the completed form too.
    fireEvent.click(screen.getByRole('button', { name: '이전 단계로 돌아가기' }))
    fireEvent.click(screen.getByRole('button', { name: '내 휴가 설정하기' }))
    expect(screen.getByRole('spinbutton', { name: '연가 보유 일수' })).toHaveValue(24)
    expect(screen.getByRole('spinbutton', { name: '성과제 보유 일수' })).toHaveValue(7)
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '20' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: '성과제 보유 일수' }), { target: { value: '5' } })
    const submit = screen.getByRole('button', { name: '이 휴가로 시작하기' })
    fireEvent.click(submit)
    fireEvent.click(submit)
    await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' })
    expect(screen.getByText('20일')).toBeInTheDocument()
    expect(screen.getByText('5일')).toBeInTheDocument()
    const after = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null')
    expect(after.leaveGrants).toHaveLength(2)
    expect(after.leaveGrants).toEqual(before.leaveGrants.map((grant: { type: string }) => ({
      ...grant,
      days: grant.type === 'annual' ? 20 : 5,
      updatedAt: expect.any(String),
    })))

    fireEvent.click(screen.getByRole('button', { name: buttonName }))
    fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))
    await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' })
    expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null')).toEqual(after)
    fireEvent.click(screen.getByRole('button', { name: '첫 휴가 계획하기' }))
    expect(await screen.findByRole('heading', { name: '달력' })).toBeInTheDocument()
  })

  it('수정 시 선택 해제한 항목을 제거하고 다시 선택해도 한 번만 저장한다', async () => {
    renderLeaveReview()
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '24' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: '성과제 보유 일수' }), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))
    await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' })

    fireEvent.click(screen.getByRole('button', { name: '연가·성과제 일수 수정하기' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))
    await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' })
    expect(screen.queryByText('성과제')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null').leaveGrants).toEqual([
      expect.objectContaining({ id: 'air-force-onboarding-annual', days: 24 }),
    ])

    fireEvent.click(screen.getByRole('button', { name: '이전 단계로 돌아가기' }))
    expect(screen.getByRole('checkbox', { name: '성과제 등록' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    expect(screen.getByRole('spinbutton', { name: '성과제 보유 일수' })).toHaveValue(7)
    fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))
    await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' })
    expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null').leaveGrants).toHaveLength(2)
  })

  it('완료 기록 저장에 실패한 뒤 재시도하면 이미 저장된 휴가를 중복 생성하지 않는다', async () => {
    renderLeaveReview()
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '24' } })
    const setItem = Storage.prototype.setItem
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === ONBOARDING_STORAGE_KEY) throw new Error('Storage unavailable')
      setItem.call(this, key, value)
    })
    try {
      fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('휴가를 저장했지만 설정 완료를 기록하지 못했습니다.')
    } finally {
      storageSpy.mockRestore()
    }

    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))
    await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' })
    expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null').leaveGrants).toEqual([
      expect.objectContaining({ id: 'air-force-onboarding-annual', days: 20 }),
    ])
  })

  it('완료 후 새로고침해도 온보딩을 반복하지 않고 저장한 휴가를 유지한다', async () => {
    const { unmount } = render(<MemoryRouter><App /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '내 휴가 설정하기' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '21' } })
    fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' }))
    await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' })
    unmount()

    render(<MemoryRouter><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '지금 가지고 있는 휴가를 알려주세요' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null').leaveGrants[0].days).toBe(21)
  })
})
