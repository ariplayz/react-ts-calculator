import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Helper: Token types for a small expression evaluator (no eval)
type NumToken = { type: 'num'; value: number }
type OpToken = { type: 'op'; op: '+' | '-' | '×' | '÷' }
type Token = NumToken | OpToken

const isOperator = (c: string): c is OpToken['op'] => ['+', '-', '×', '÷'].includes(c)

// Shunting-yard to convert infix tokens to RPN
function toRPN(tokens: Token[]): Token[] {
  const output: Token[] = []
  const ops: OpToken[] = []
  const prec: Record<OpToken['op'], number> = { '+': 1, '-': 1, '×': 2, '÷': 2 }

  for (const t of tokens) {
    if (t.type === 'num') {
      output.push(t)
    } else {
      // pop while the operator at the top of the operator stack has greater precedence
      while (ops.length && prec[ops[ops.length - 1].op] >= prec[t.op]) {
        output.push(ops.pop()!)
      }
      ops.push(t)
    }
  }
  while (ops.length) output.push(ops.pop()!)
  return output
}

function evalRPN(rpn: Token[]): number {
  const stack: number[] = []
  for (const t of rpn) {
    if (t.type === 'num') stack.push(t.value)
    else {
      const b = stack.pop()
      const a = stack.pop()
      if (a === undefined || b === undefined) return NaN
      switch (t.op) {
        case '+': stack.push(a + b); break
        case '-': stack.push(a - b); break
        case '×': stack.push(a * b); break
        case '÷': stack.push(b === 0 ? NaN : a / b); break
      }
    }
  }
  return stack.length ? stack[0] : NaN
}

function formatNumber(n: number): string {
  if (!isFinite(n)) return 'Error'
  // Avoid -0
  if (Object.is(n, -0)) n = 0
  const abs = Math.abs(n)
  // Use up to 10 fraction digits to avoid floating artifacts
  const s = abs >= 1e12 || (abs !== 0 && abs < 1e-6)
    ? n.toExponential(6)
    : n.toLocaleString(undefined, { maximumFractionDigits: 10 })
  return s
}

export default function Calculator() {
  const [display, setDisplay] = useState('0')
  const [tokens, setTokens] = useState<Token[]>([])
  const [justEvaluated, setJustEvaluated] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const canAppendDecimal = useMemo(() => !display.includes('.'), [display])

  const pushNumberFromDisplay = useCallback((arr: Token[]) => {
    const v = parseFloat(display)
    if (!isNaN(v)) arr.push({ type: 'num', value: v })
  }, [display])

  const inputDigit = useCallback((d: string) => {
    setDisplay(prev => {
      if (justEvaluated) {
        setJustEvaluated(false)
        return d
      }
      if (prev === '0') return d
      if (prev === '-0') return '-' + d
      return prev + d
    })
  }, [justEvaluated])

  const inputDecimal = useCallback(() => {
    setDisplay(prev => {
      if (justEvaluated) {
        setJustEvaluated(false)
        return '0.'
      }
      if (!prev.includes('.')) return prev + '.'
      return prev
    })
  }, [justEvaluated])

  const clearAll = useCallback(() => {
    setDisplay('0')
    setTokens([])
    setJustEvaluated(false)
  }, [])

  const backspace = useCallback(() => {
    setDisplay(prev => {
      if (justEvaluated) {
        setJustEvaluated(false)
        return '0'
      }
      const next = prev.length > 1 ? prev.slice(0, -1) : '0'
      return next === '-' ? '0' : next
    })
  }, [justEvaluated])

  const toggleSign = useCallback(() => {
    setDisplay(prev => {
      if (prev.startsWith('-')) return prev.slice(1)
      if (prev === '0') return prev
      return '-' + prev
    })
  }, [])

  const percent = useCallback(() => {
    setDisplay(prev => {
      const v = parseFloat(prev)
      if (isNaN(v)) return prev
      return String(v / 100)
    })
  }, [])

  const inputOperator = useCallback((op: OpToken['op']) => {
    setTokens(prev => {
      const next: Token[] = [...prev]
      // If last token is operator, replace it (operator change)
      if (next.length && next[next.length - 1].type === 'op') {
        next[next.length - 1] = { type: 'op', op }
        return next
      }
      // Push current display as number
      const v = parseFloat(display)
      if (!isNaN(v)) next.push({ type: 'num', value: v })
      next.push({ type: 'op', op })
      setDisplay('0')
      setJustEvaluated(false)
      return next
    })
  }, [display])

  const evaluate = useCallback(() => {
    setTokens(prev => {
      const seq: Token[] = [...prev]
      // push current display number if needed
      const v = parseFloat(display)
      if (!isNaN(v)) seq.push({ type: 'num', value: v })
      // avoid trailing operator
      if (seq.length && seq[seq.length - 1].type === 'op') seq.pop()
      if (!seq.length) {
        setJustEvaluated(true)
        return []
      }
      const rpn = toRPN(seq)
      const res = evalRPN(rpn)
      setDisplay(formatNumber(res))
      setJustEvaluated(true)
      return []
    })
  }, [display])

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key
      if (/^[0-9]$/.test(key)) {
        e.preventDefault()
        inputDigit(key)
      } else if (key === '.') {
        e.preventDefault(); inputDecimal()
      } else if (key === '+' || key === '-') {
        e.preventDefault(); inputOperator(key as '+' | '-')
      } else if (key === '*' || key === 'x' || key === 'X') {
        e.preventDefault(); inputOperator('×')
      } else if (key === '/') {
        e.preventDefault(); inputOperator('÷')
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault(); evaluate()
      } else if (key === 'Backspace') {
        e.preventDefault(); backspace()
      } else if (key === 'Escape' || key.toLowerCase() === 'c') {
        e.preventDefault(); clearAll()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [backspace, clearAll, evaluate, inputDecimal, inputDigit, inputOperator])

  // Build button grid
  const buttons = [
    { label: 'C', kind: 'action', onClick: clearAll, aria: 'Clear all' },
    { label: '±', kind: 'action', onClick: toggleSign, aria: 'Toggle sign' },
    { label: '%', kind: 'action', onClick: percent, aria: 'Percent' },
    { label: '÷', kind: 'op', onClick: () => inputOperator('÷'), aria: 'Divide' },

    { label: '7', kind: 'num', onClick: () => inputDigit('7') },
    { label: '8', kind: 'num', onClick: () => inputDigit('8') },
    { label: '9', kind: 'num', onClick: () => inputDigit('9') },
    { label: '×', kind: 'op', onClick: () => inputOperator('×'), aria: 'Multiply' },

    { label: '4', kind: 'num', onClick: () => inputDigit('4') },
    { label: '5', kind: 'num', onClick: () => inputDigit('5') },
    { label: '6', kind: 'num', onClick: () => inputDigit('6') },
    { label: '-', kind: 'op', onClick: () => inputOperator('-'), aria: 'Minus' },

    { label: '1', kind: 'num', onClick: () => inputDigit('1') },
    { label: '2', kind: 'num', onClick: () => inputDigit('2') },
    { label: '3', kind: 'num', onClick: () => inputDigit('3') },
    { label: '+', kind: 'op', onClick: () => inputOperator('+'), aria: 'Plus' },

    { label: '⌫', kind: 'action', onClick: backspace, aria: 'Backspace' },
    { label: '0', kind: 'num', onClick: () => inputDigit('0') },
    { label: '.', kind: 'num', onClick: inputDecimal },
    { label: '=', kind: 'equals', onClick: evaluate, aria: 'Equals' }
  ] as const

  const displayText = display

  return (
    <div className="calc-root" ref={containerRef} aria-label="Calculator" role="application">
      <div className="calc" tabIndex={-1}>
        <div className="display" aria-live="polite" aria-atomic="true">
          {displayText}
        </div>
        <div className="keys" role="grid" aria-label="Calculator keypad">
          {buttons.map((b) => (
            <button
              key={b.label}
              className={['key', `key-${b.kind}`, b.label === '0' ? 'span-2' : '', b.label === '=' ? 'accent' : ''].filter(Boolean).join(' ')}
              onClick={b.onClick as any}
              aria-label={b.aria ?? b.label}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
