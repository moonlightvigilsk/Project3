import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn()
