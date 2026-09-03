import React from "react";
import { SceneContainer } from "../SceneContainer";
import { theme } from "../theme";
import type { NewscastVideoProps } from "../types";

export const Timeline: React.FC<NewscastVideoProps> = ({ timeline }) => {
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
        Timeline
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {timeline.map((entry, index) => (
          <div key={index}>
            <div style={{ fontSize: 32, color: theme.colors.textMuted }}>{entry.label}</div>
            <div style={{ fontSize: 38 }}>{entry.description}</div>
          </div>
        ))}
      </div>
    </SceneContainer>
  );
};
