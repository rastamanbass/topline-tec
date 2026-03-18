declare module 'jsbarcode' {
  function JsBarcode(
    element: SVGElement | string,
    data: string,
    options?: Record<string, unknown>
  ): void;
  export default JsBarcode;
}
