import React from "react";
import { SceneContainer } from "../SceneContainer";
import { theme } from "../theme";
import type { NewscastVideoProps } from "../types";

export const Outro: React.FC<NewscastVideoProps> = () => {
  return (
    <SceneContainer>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: 64,
            fontWeight: "bold",
            color: theme.colors.accent,
          }}
        >
          {theme.brandName}
        </div>
        <div style={{ fontSize: 32, marginTop: 24, color: theme.colors.textMuted }}>
          Thank you for watching
        </div>
      </div>
    </SceneContainer>
  );
};
