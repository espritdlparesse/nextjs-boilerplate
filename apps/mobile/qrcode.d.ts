declare module "qrcode" {
  type QRColor = {
    dark?: string;
    light?: string;
  };

  type QRCodeOptions = {
    margin?: number;
    width?: number;
    color?: QRColor;
  };

  export function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
}
