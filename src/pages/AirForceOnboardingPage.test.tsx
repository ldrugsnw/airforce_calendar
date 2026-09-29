import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from '../app/App'
import { APP_STORAGE_KEY, ONBOARDING_STORAGE_KEY } from '../store/appStorage'

function renderLeaveReview() {
  render(<MemoryRouter><App /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: '내 휴가 설정하기' }))
}

describe('공군 기본 휴가 검토', () => {
  it('공군 선택 후 검토 화면을 보이고 미입력 항목은 아직 오류로 표시하지 않는다', () => {
    renderLeaveReview()

    expect(screen.getByRole('heading', { name: '현재 보유 휴가를 등록해주세요' })).toBeInTheDocument()
    expect(screen.getByText('지금 등록해두면 남은 휴가와 사용 계획을 바로 확인할 수 있어요.')).toBeInTheDocument()
    expect(screen.getByText('나중에 내 휴가에서 언제든 수정할 수 있습니다.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '연가 포함' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '성과제 포함' })).not.toBeChecked()
    const annualInput = screen.getByRole('spinbutton', { name: '연가 보유 일수' })
    expect(annualInput).toHaveValue(null)
    expect(annualInput).toHaveAttribute('aria-invalid', 'false')
    expect(annualInput).toHaveClass('border-slate-300')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '휴가 설정 저장하기' })).toBeDisabled()
    expect(screen.queryByRole('navigation', { name: '주요 화면' })).not.toBeInTheDocument()
  })

  it('항목 포함·제외와 일수 증감 및 직접 입력을 지원한다', () => {
    renderLeaveReview()
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 포함' }))
    expect(screen.getByRole('spinbutton', { name: '성과제 보유 일수' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '성과제 일수 늘리기' }))
    expect(screen.getByRole('spinbutton', { name: '성과제 보유 일수' })).toHaveValue(1)
    fireEvent.click(screen.getByRole('button', { name: '성과제 일수 줄이기' }))
    expect(screen.getByRole('spinbutton', { name: '성과제 보유 일수' })).toHaveValue(0)
    fireEvent.change(screen.getByRole('spinbutton', { name: '성과제 보유 일수' }), { target: { value: '7' } })
    expect(screen.getByRole('spinbutton', { name: '성과제 보유 일수' })).toHaveValue(7)
    fireEvent.click(screen.getByRole('checkbox', { name: '연가 포함' }))
    expect(screen.queryByRole('spinbutton', { name: '연가 보유 일수' })).not.toBeInTheDocument()
  })

  it.each([
    ['', '연가 보유 일수를 1~365일 정수로 입력해주세요.'],
    ['0', '연가 보유 일수를 1~365일 정수로 입력해주세요.'],
    ['1.5', '연가 보유 일수를 1~365일 정수로 입력해주세요.'],
  ])('유효하지 않은 일수 %s는 저장을 막는다', (days, message) => {
    renderLeaveReview()
    const annualInput = screen.getByRole('spinbutton', { name: '연가 보유 일수' })
    if (days) fireEvent.change(annualInput, { target: { value: days } })
    else {
      fireEvent.focus(annualInput)
      fireEvent.blur(annualInput)
    }

    expect(screen.getByRole('button', { name: '휴가 설정 저장하기' })).toBeDisabled()
    const fieldError = screen.getByRole('alert')
    expect(fieldError).toHaveTextContent(message)
    expect(screen.getByRole('spinbutton', { name: '연가 보유 일수' })).toHaveAttribute('aria-invalid', 'true')
    expect(fieldError).toHaveClass('min-h-[4.5rem]')
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
    expect(screen.getByRole('button', { name: '휴가 설정 저장하기' })).toBeEnabled()
  })

  it('성과제 입력 오류는 성과제 입력 바로 아래에 표시하고 CTA를 비활성화한다', () => {
    renderLeaveReview()
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 포함' }))

    const performanceInput = screen.getByRole('spinbutton', { name: '성과제 보유 일수' })
    expect(performanceInput).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByText('성과제 보유 일수를 1~365일 정수로 입력해주세요.')).not.toBeInTheDocument()
    fireEvent.blur(performanceInput)
    const performanceError = screen.getByRole('alert')
    expect(performanceInput).toHaveAttribute('aria-invalid', 'true')
    expect(performanceError).toHaveTextContent('성과제 보유 일수를 1~365일 정수로 입력해주세요.')
    expect(performanceInput.parentElement?.parentElement?.nextElementSibling).toBe(performanceError)
    expect(screen.getByRole('button', { name: '휴가 설정 저장하기' })).toBeDisabled()
  })

  it('미포함한 성과제는 일수가 비어 있어도 검증 오류를 표시하지 않는다', () => {
    renderLeaveReview()
    expect(screen.queryByRole('spinbutton', { name: '성과제 보유 일수' })).not.toBeInTheDocument()
    expect(screen.queryByText('성과제 보유 일수를 1~365일 정수로 입력해주세요.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '휴가 설정 저장하기' })).toBeDisabled()
  })

  it('선택 항목이 없으면 저장을 막는다', () => {
    renderLeaveReview()
    fireEvent.click(screen.getByRole('checkbox', { name: '연가 포함' }))
    expect(screen.getByRole('button', { name: '휴가 설정 저장하기' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('저장할 휴가를 하나 이상 선택해주세요.')
  })

  it('선택된 유효 항목만 저장하고 완료 시각과 저장 요약을 표시한 뒤 CTA로 달력에 이동한다', async () => {
    renderLeaveReview()
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 포함' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: '성과제 보유 일수' }), { target: { value: '3' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '22' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 포함' }))
    fireEvent.click(screen.getByRole('button', { name: '휴가 설정 저장하기' }))

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
    const submit = screen.getByRole('button', { name: '휴가 설정 저장하기' })
    fireEvent.click(submit)
    fireEvent.click(submit)

    await waitFor(() => expect(screen.getByRole('heading', { name: '기본 휴가 설정을 완료했어요' })).toBeInTheDocument())
    const saved = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null')
    expect(saved.leaveGrants).toHaveLength(1)
    expect(saved.leaveGrants[0].id).toBe('air-force-onboarding-annual')
  })

  it('완료 후 새로고침해도 온보딩을 반복하지 않고 저장한 휴가를 유지한다', async () => {
    const { unmount } = render(<MemoryRouter><App /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '내 휴가 설정하기' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: '연가 보유 일수' }), { target: { value: '21' } })
    fireEvent.click(screen.getByRole('button', { name: '휴가 설정 저장하기' }))
    await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' })
    unmount()

    render(<MemoryRouter><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '현재 보유 휴가를 등록해주세요' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null').leaveGrants[0].days).toBe(21)
  })
})
