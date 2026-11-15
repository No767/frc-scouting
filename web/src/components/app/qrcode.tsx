import { QRCodeSVG } from "qrcode.react";

interface QRCodeProps {
  value: string;
}

const QR_IMAGE = {
  src: "https://bicmztrblwpucysepkoq.supabase.co/storage/v1/object/public/images/Beakle.png",
  height: 70,
  width: 70,
  excavate: true,
};

export function QRCode({ value }: Readonly<QRCodeProps>) {
  return (
    <QRCodeSVG
      value={value}
      size={300}
      level="H"
      imageSettings={QR_IMAGE}
      className="mx-auto h-auto w-full max-w-xs [&_image]:[clip-path:inset(0_round_2px)]"
    />
  );
}
