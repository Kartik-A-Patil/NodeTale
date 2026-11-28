import { useEffect, useState } from 'react';

// The link as a QR code, for a phone in the same room. The encoder loads only
// when a QR code is first shown.
export function QrCode({ text, size = 176 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let cancelled = false;
    import('qrcode-generator').then(({ default: qrcode }) => {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      if (!cancelled) setSvg(qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }));
    });
    return () => { cancelled = true; };
  }, [text]);
  return (
    <div
      role="img"
      aria-label="QR code of the share link"
      className="rounded-lg bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
