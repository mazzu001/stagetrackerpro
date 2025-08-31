import { useEffect, useRef, useState } from "react";

interface ScrollingTextProps {
  text: string;
  className?: string;
  speed?: number;
}

export default function ScrollingText({ text, className = "", speed = 2 }: ScrollingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const textElement = textRef.current;
    
    if (!container || !textElement) return;

    // Check if text overflows container
    const containerWidth = container.offsetWidth;
    const textWidth = textElement.scrollWidth;
    
    setShouldScroll(textWidth > containerWidth);
  }, [text]);

  return (
    <div 
      ref={containerRef}
      className={`overflow-hidden ${className}`}
    >
      <div
        ref={textRef}
        className="whitespace-nowrap animate-marquee pt-[0px] pb-[0px] mt-[7px] mb-[7px]"
        style={{
          animationDuration: shouldScroll ? `${Math.max(3, text.length / speed)}s` : undefined
        }}
      >
        {text}
      </div>
    </div>
  );
}