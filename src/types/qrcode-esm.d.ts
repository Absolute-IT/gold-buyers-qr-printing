// Module declaration to alias qrcode-esm to use @types/qrcode
declare module 'qrcode-esm' {
  export * from 'qrcode';
  export { default } from 'qrcode';
}
