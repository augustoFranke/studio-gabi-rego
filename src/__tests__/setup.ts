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
