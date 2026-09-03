import React from "react";
import { SceneContainer } from "../SceneContainer";
import { theme } from "../theme";
import type { NewscastVideoProps } from "../types";

export const Headline: React.FC<NewscastVideoProps> = ({ headline, dek }) => {
  return (
    <SceneContainer>
      <div
        style={{
          fontFamily: theme.fonts.heading,
          fontSize: 84,
          fontWeight: "bold",
          lineHeight: 1.2,
        }}
      >
        {headline}
      </div>
      <div style={{ fontSize: 44, marginTop: 40, color: theme.colors.textMuted }}>{dek}</div>
    </SceneContainer>
  );
};
