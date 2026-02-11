import React, { useRef, useState } from 'react';

interface AvatarUploaderProps {
  currentUrl?: string | null;
  onUpload: (dataUrl: string) => void;
  size?: number;
}

export function AvatarUploader({ currentUrl, onUpload, size = 80 }: AvatarUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 512 * 1024) {
      alert('Image must be under 512KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      onUpload(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const imgSrc = preview || currentUrl;

  return (
    <div
      className="relative group cursor-pointer"
      style={{ width: size, height: size }}
      onClick={() => fileRef.current?.click()}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt="Avatar"
          className="w-full h-full rounded-full object-cover border-2 border-accent/40"
        />
      ) : (
        <div className="w-full h-full rounded-full border-2 border-accent/30 bg-accent/10 flex items-center justify-center text-accent text-2xl font-bold">
          ?
        </div>
      )}
      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="text-white text-xs font-bold">Edit</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
