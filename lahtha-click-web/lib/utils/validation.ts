export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export function validateCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

export function validateIMEI(imei: string): boolean {
  return /^\d{15}$/.test(imei)
}

export function validatePrice(price: number): boolean {
  return price > 0 && Number.isInteger(price)
}

export function validateStock(stock: number): boolean {
  return stock >= 0 && Number.isInteger(stock)
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
