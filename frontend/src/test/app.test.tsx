import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../App'

describe('App component full mount', () => {
  it('renders App without crashing', async () => {
    const { container } = render(<App />)
    expect(container).toBeTruthy()
  })

  it('opens upload modal when clicking upload button', async () => {
    render(<App />)
    const uploadBtn = screen.getByText('Thêm tài liệu')
    fireEvent.click(uploadBtn)
    expect(screen.getByText('Tải lên tài liệu tiếng Pháp')).toBeInTheDocument()
  })
})
