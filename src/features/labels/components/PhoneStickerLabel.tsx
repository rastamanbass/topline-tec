import { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { buildTrackingUrl, formatImeiDisplay } from '../utils/stickerUtils';
import type { Phone } from '../../../types';

interface Props {
  phone: Phone;
  index?: number;
  total?: number;
}

export default function PhoneStickerLabel({ phone, index, total }: Props) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const trackingUrl = buildTrackingUrl(phone.imei);

  useEffect(() => {
    if (barcodeRef.current && !phone.seized) {
      try {
        JsBarcode(barcodeRef.current, phone.imei, {
          format: 'CODE128',
          width: 1.2,
          height: 25,
          displayValue: false,
          margin: 0,
        });
      } catch {
        /* invalid data fallback */
      }
    }
  }, [phone.imei, phone.seized]);

  return (
    <div className="w-[40mm] h-[30mm] bg-white p-1 font-sans text-black flex flex-col overflow-hidden border border-dashed border-gray-300 print:border-none page-break-after-always">
      {/* Row 1: Model info + QR side by side */}
      <div className="flex items-start gap-1 mb-0.5">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold leading-tight truncate">{phone.modelo}</p>
          <p className="text-[8px] leading-tight text-gray-700">{phone.storage || ''}</p>
          <p className="text-[7px] text-gray-500 truncate mt-0.5">{phone.lote}</p>
        </div>
        {!phone.seized && <QRCodeSVG value={trackingUrl} size={36} className="shrink-0" />}
      </div>

      {/* Row 2: Barcode or INHABILITADO */}
      <div className="flex flex-col items-center mt-auto">
        {phone.seized ? (
          <div className="bg-red-600 text-white font-black text-[8px] px-2 py-0.5 rounded">
            INHABILITADO
          </div>
        ) : (
          <>
            <svg ref={barcodeRef} className="w-full max-h-[20px]" />
            <p className="text-[6px] tracking-[0.12em] font-bold leading-none mt-px">
              {formatImeiDisplay(phone.imei)}
            </p>
          </>
        )}
      </div>

      {/* Counter (only in batch mode) */}
      {index !== undefined && total !== undefined && (
        <p className="text-[5px] text-center text-gray-400 leading-none mt-px">
          {index + 1}/{total}
        </p>
      )}
    </div>
  );
}
