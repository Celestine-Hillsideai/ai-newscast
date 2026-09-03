import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "./theme";

/** Shared layout/fade-in for every scene, so the seven files only differ in content. */
export const SceneContainer: React.FC<{ children: React.ReactNode; background?: string }> = ({
  children,
  background,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: background ?? theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        opacity,
        padding: 80,
        justifyContent: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
