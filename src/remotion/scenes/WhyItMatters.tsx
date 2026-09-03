import React from "react";
import { SceneContainer } from "../SceneContainer";
import { theme } from "../theme";
import type { NewscastVideoProps } from "../types";

export const WhyItMatters: React.FC<NewscastVideoProps> = ({ whyItMatters }) => {
  return (
    <SceneContainer>
      <div
        style={{
          fontFamily: theme.fonts.heading,
          fontSize: 56,
          color: theme.colors.accent,
          marginBottom: 32,
        }}
      >
        Why It Matters
      </div>
      <div style={{ fontSize: 42, lineHeight: 1.4 }}>{whyItMatters}</div>
    </SceneContainer>
  );
};
