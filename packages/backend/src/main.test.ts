import { hello } from './main'

describe('main', () => {
  test('fails', () => {
    expect(hello('Joe')).toEqual('Hello, Joe!')
  })
})
