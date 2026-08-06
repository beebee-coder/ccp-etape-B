"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseResizeOptions {
  minWidth?: number;
  defaultWidth?: number;
  containerRef: React.RefObject<HTMLElement>;
}

interface UseResizeReturn {
  panelWidth: number;
  isDragging: boolean;
  onDividerMouseDown: (e: React.MouseEvent) => void;
  onDividerKeyDown: (e: React.KeyboardEvent) => void;
}

export function useResize({
  minWidth = 200,
  defaultWidth = 360,
  containerRef,
}: UseResizeOptions): UseResizeReturn {
  const [panelWidth, setPanelWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(defaultWidth);

  const updateWidth = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const delta = startXRef.current - clientX;
      const newWidth = startWidthRef.current + delta;
      const clamped = Math.max(minWidth, Math.min(newWidth, containerWidth - minWidth));
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setPanelWidth(clamped);
      });
    },
    [containerRef, minWidth],
  );

  const onDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = panelWidth;
      setIsDragging(true);
    },
    [panelWidth],
  );

  const onDividerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 80 : 16;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPanelWidth((prev) => Math.max(minWidth, prev - step));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPanelWidth((prev) => {
          if (!containerRef.current) return prev;
          return Math.min(prev + step, containerRef.current.clientWidth - minWidth);
        });
      } else if (e.key === "Home") {
        e.preventDefault();
        setPanelWidth(minWidth);
      } else if (e.key === "End") {
        e.preventDefault();
        if (!containerRef.current) return;
        setPanelWidth(containerRef.current.clientWidth - minWidth);
      }
    },
    [minWidth, containerRef],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateWidth(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isDragging, updateWidth]);

  return {
    panelWidth,
    isDragging,
    onDividerMouseDown,
    onDividerKeyDown,
  };
}