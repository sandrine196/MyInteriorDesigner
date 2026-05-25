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
    try {
      const { url } = await products.click(id);
      window.open(url ?? href, "_blank", "noopener,noreferrer");
    } catch {
      window.open(href, "_blank", "noopener,noreferrer");
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
