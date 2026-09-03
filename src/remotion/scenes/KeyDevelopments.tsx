import React from "react";
import { SceneContainer } from "../SceneContainer";
import { theme } from "../theme";
import type { NewscastVideoProps } from "../types";

export const KeyDevelopments: React.FC<NewscastVideoProps> = ({ keyDevelopments }) => {
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
        Key Developments
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {keyDevelopments.map((item, index) => (
          <div key={index} style={{ fontSize: 40, lineHeight: 1.3 }}>
            • {item}
          </div>
        ))}
      </div>
    </SceneContainer>
  );
};
