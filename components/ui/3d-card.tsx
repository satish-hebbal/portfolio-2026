"use client";

import { cn } from "@/lib/utils";
import React, { createContext, useState, useContext, useRef, useEffect } from "react";

const MouseEnterContext = createContext<
  [boolean, React.Dispatch<React.SetStateAction<boolean>>] | undefined
>(undefined);

export const CardContainer = ({
  children,
  className,
  containerClassName,
}: {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMouseEntered, setIsMouseEntered] = useState(false);
  // The card's box is read once on enter instead of on every mousemove, and
  // writes are batched to one per frame
  const rectRef = useRef<DOMRect | null>(null);
  const frameRef = useRef(0);
  const pointRef = useRef({ x: 0, y: 0 });

  const paint = () => {
    frameRef.current = 0;
    const el = containerRef.current, rect = rectRef.current;
    if (!el || !rect) return;
    const x = (pointRef.current.x - rect.left - rect.width / 2) / 25;
    const y = (pointRef.current.y - rect.top - rect.height / 2) / 25;
    el.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    pointRef.current = { x: e.clientX, y: e.clientY };
    if (!rectRef.current && containerRef.current) rectRef.current = containerRef.current.getBoundingClientRect();
    if (!frameRef.current) frameRef.current = requestAnimationFrame(paint);
  };

  const handleMouseEnter = () => {
    if (containerRef.current) {
      rectRef.current = containerRef.current.getBoundingClientRect();
      // a short ease while tracking; the old 200ms linear made the tilt trail the cursor
      containerRef.current.style.transition = 'transform 80ms linear';
    }
    setIsMouseEntered(true);
  };

  const handleMouseLeave = () => {
    setIsMouseEntered(false);
    rectRef.current = null;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 300ms ease-out';
      containerRef.current.style.transform = `rotateY(0deg) rotateX(0deg)`;
    }
  };

  return (
    <MouseEnterContext.Provider value={[isMouseEntered, setIsMouseEntered]}>
      <div className={cn("flex items-center justify-center", containerClassName)} style={{ perspective: "1000px" }}>
        <div
          ref={containerRef}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={cn("flex items-center justify-center relative", className)}
          style={{ transformStyle: "preserve-3d" }}
        >
          {children}
        </div>
      </div>
    </MouseEnterContext.Provider>
  );
};

export const CardBody = ({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div className={cn("[transform-style:preserve-3d] [&>*]:[transform-style:preserve-3d]", className)} style={style}>
    {children}
  </div>
);

export const CardItem = ({
  as: Tag = "div",
  children,
  className,
  translateX = 0,
  translateY = 0,
  translateZ = 0,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  ...rest
}: {
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  translateX?: number | string;
  translateY?: number | string;
  translateZ?: number | string;
  rotateX?: number | string;
  rotateY?: number | string;
  rotateZ?: number | string;
  [key: string]: any;
}) => {
  const ref = useRef<any>(null);
  const [isMouseEntered] = useMouseEnter();

  useEffect(() => {
    if (!ref.current) return;
    if (isMouseEntered) {
      ref.current.style.transform = `translateX(${translateX}px) translateY(${translateY}px) translateZ(${translateZ}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;
    } else {
      ref.current.style.transform = `translateX(0px) translateY(0px) translateZ(0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)`;
    }
  }, [isMouseEntered]);

  const Comp = Tag as any;
  return (
    <Comp ref={ref} className={cn("w-fit transition-transform duration-200 ease-out", className)} {...rest}>
      {children}
    </Comp>
  );
};

export const useMouseEnter = () => {
  const context = useContext(MouseEnterContext);
  if (context === undefined) throw new Error("useMouseEnter must be used within a MouseEnterProvider");
  return context;
};
