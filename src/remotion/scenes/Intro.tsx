import React from "react";
import { SceneContainer } from "../SceneContainer";
import { theme } from "../theme";
import type { NewscastVideoProps } from "../types";

export const Intro: React.FC<NewscastVideoProps> = () => {
  return (
    <SceneContainer>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: 88,
            fontWeight: "bold",
            letterSpacing: 6,
            color: theme.colors.accent,
          }}
        >
          {theme.brandName}
        </div>
        <div style={{ fontSize: 40, marginTop: 24, color: theme.colors.textMuted }}>
          Nigeria News Briefing
        </div>
      </div>
    </SceneContainer>
  );
};
