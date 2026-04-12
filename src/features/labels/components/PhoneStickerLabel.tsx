import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { formatImeiDisplay } from '../utils/stickerUtils';
import type { Phone } from '../../../types';

interface Props {
  phone: Phone;
  index?: number;
  total?: number;
}

export default function PhoneStickerLabel({ phone, index, total }: Props) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && !phone.seized) {
      try {
        JsBarcode(barcodeRef.current, phone.imei, {
          format: 'CODE128',
          width: 3,
          height: 55,
          displayValue: false,
          margin: 8,
        });
      } catch {
        /* invalid data fallback */
      }
    }
  }, [phone.imei, phone.seized]);

  return (
    <div
      className="sticker-label bg-white font-sans text-black border-2 border-dashed border-gray-300 rounded-lg"
      style={{
        width: '100%',
        maxWidth: '420px',
        aspectRatio: '5/3',
        padding: '3%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* Model + Storage */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexShrink: 0 }}>
        <p
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            margin: 0,
            flex: 1,
            minWidth: 0,
          }}
        >
          {phone.modelo}
        </p>
        {phone.storage && (
          <span style={{ fontSize: '13px', color: '#555', lineHeight: 1.1, flexShrink: 0 }}>
            {phone.storage}
          </span>
        )}
      </div>

      {/* Lote / Envio */}
      <p
        style={{
          fontSize: '10px',
          color: '#999',
          margin: '2px 0 0',
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {phone.lote}
      </p>

      {/* Barcode + IMEI */}
      <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '4px' }}>
        {phone.seized ? (
          <div
            style={{
              background: '#dc2626',
              color: 'white',
              fontWeight: 900,
              fontSize: '14px',
              padding: '2px 8px',
              borderRadius: '4px',
              display: 'inline-block',
            }}
          >
            INHABILITADO
          </div>
        ) : (
          <>
            <svg ref={barcodeRef} style={{ width: '100%', maxHeight: '55px' }} />
            <p
              style={{
                fontSize: '11px',
                letterSpacing: '0.15em',
                fontWeight: 'bold',
                margin: '2px 0 0',
                lineHeight: 1,
              }}
            >
              {formatImeiDisplay(phone.imei)}
            </p>
          </>
        )}
      </div>

      {/* Counter */}
      {index !== undefined && total !== undefined && (
        <p
          style={{
            fontSize: '8px',
            textAlign: 'center',
            color: '#aaa',
            margin: '1px 0 0',
            lineHeight: 1,
          }}
        >
          {index + 1}/{total}
        </p>
      )}
    </div>
  );
}
