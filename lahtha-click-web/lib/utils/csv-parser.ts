import { validateIMEI, validatePrice, validateStock } from './validation'

export interface InventoryItem {
  imei: string
  brand: string
  model: string
  condition: 'excellent' | 'good' | 'fair' | 'poor'
  price: number
  stock: number
}

export interface ParseResult {
  valid: InventoryItem[]
  invalid: Array<{ row: number; data: any; errors: string[] }>
  duplicates: string[]
  totalRows: number
}

const VALID_CONDITIONS = ['excellent', 'good', 'fair', 'poor']

export function parseInventoryCSV(csv: string): ParseResult {
  const result: ParseResult = {
    valid: [],
    invalid: [],
    duplicates: [],
    totalRows: 0,
  }

  const lines = csv.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return result

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
  const requiredHeaders = ['imei', 'brand', 'model', 'condition', 'price', 'stock']
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))

  if (missingHeaders.length > 0) {
    result.invalid.push({
      row: 0,
      data: lines[0],
      errors: [`Missing columns: ${missingHeaders.join(', ')}`],
    })
    return result
  }

  const seenImeis = new Set<string>()

  for (let i = 1; i < lines.length; i++) {
    result.totalRows++
    const values = lines[i].split(',').map(v => v.trim())
    const row = Object.fromEntries(
      headers.map((header, idx) => [header, values[idx] || ''])
    ) as Record<string, string>

    const errors: string[] = []

    if (!validateIMEI(row.imei)) {
      errors.push('IMEI يجب أن يكون 15 رقم')
    }
    if (!row.brand) errors.push('الماركة مطلوبة')
    if (!row.model) errors.push('الموديل مطلوب')
    if (!VALID_CONDITIONS.includes(row.condition)) {
      errors.push(`الحالة يجب أن تكون: ${VALID_CONDITIONS.join('/')}`)
    }
    const price = parseInt(row.price, 10) * 100
    if (!validatePrice(price)) errors.push('السعر غير صحيح')
    const stock = parseInt(row.stock, 10)
    if (!validateStock(stock)) errors.push('المخزون غير صحيح')

    if (seenImeis.has(row.imei)) {
      result.duplicates.push(row.imei)
      errors.push('IMEI مكرر في الملف')
    } else {
      seenImeis.add(row.imei)
    }

    if (errors.length > 0) {
      result.invalid.push({ row: i, data: row, errors })
    } else {
      result.valid.push({
        imei: row.imei,
        brand: row.brand,
        model: row.model,
        condition: row.condition as InventoryItem['condition'],
        price,
        stock,
      })
    }
  }

  return result
}

export function generateSampleCSV(): string {
  return [
    'imei,brand,model,condition,price,stock',
    '358240010800100,Apple,iPhone 13 Pro,excellent,1199,3',
    '358240010800101,Apple,iPhone 14,good,899,5',
    '358240010800102,Apple,iPad Air,excellent,1799,2',
  ].join('\n')
}
