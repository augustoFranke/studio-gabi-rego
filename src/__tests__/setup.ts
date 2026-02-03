import {
  createPrismaMock,
  createSessionRef,
  createValidateRequestMock,
  mockWithApiAuth,
} from '@/__tests__/test-utils'

globalThis.__testUtils = {
  createPrismaMock,
  createSessionRef,
  createValidateRequestMock,
  mockWithApiAuth,
}

process.env.NODE_ENV = 'test'
process.env.VITEST = 'true'
