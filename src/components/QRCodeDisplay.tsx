import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QRCodeDisplayProps {
  value: string
  size?: number
  level?: 'L' | 'M' | 'Q' | 'H'
  className?: string
}

export function QRCodeDisplay({
  value,
  size = 180,
  level = 'H',
  className = '',
}: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !value) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: level,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }, [value, size, level])

  return <canvas ref={canvasRef} className={className} />
}
