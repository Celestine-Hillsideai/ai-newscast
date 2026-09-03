import React from "react";
import { SceneContainer } from "../SceneContainer";
import { theme } from "../theme";
import type { NewscastVideoProps } from "../types";

export const Sources: React.FC<NewscastVideoProps> = ({ sourceNames }) => {
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
        Sources
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {sourceNames.map((name, index) => (
          <div key={index} style={{ fontSize: 34 }}>
            {name}
          </div>
        ))}
      </div>
    </SceneContainer>
  );
};
