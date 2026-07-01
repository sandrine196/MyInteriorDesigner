"use client";
import { products } from "@/lib/api";

interface Props {
  id: string;
  href: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  children: React.ReactNode;
}

export default function ProductLink({ id, href, className, style, onClick, children }: Props) {
  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    onClick?.();
    // Open without noopener so we keep the win reference to set location.href later.
    // noopener causes Chrome to return null, breaking the deferred navigation.
    const win = window.open("", "_blank");
    try {
      const { url } = await products.click(id);
      if (win) win.location.href = url ?? href;
      else window.open(url ?? href, "_blank", "noopener,noreferrer");
    } catch {
      if (win) win.location.href = href;
      else window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
