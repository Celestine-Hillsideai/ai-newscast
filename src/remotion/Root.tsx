import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { Newscast } from "./Newscast";
import type { NewscastVideoProps } from "./types";

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

/**
 * Sets the composition's actual duration from durationSeconds (already
 * known exactly from Phase 4's real audio parsing) rather than re-deriving
 * it here — see https://www.remotion.dev/docs/calculate-metadata.
 */
const calculateMetadata: CalculateMetadataFunction<NewscastVideoProps> = ({ props }) => {
  return {
    durationInFrames: Math.max(1, Math.round(props.durationSeconds * FPS)),
  };
};

const defaultProps: NewscastVideoProps = {
  headline: "",
  dek: "",
  whatHappened: "",
  keyDevelopments: [],
  whyItMatters: "",
  timeline: [],
  sourceNames: [],
  audioUrl: "",
  durationSeconds: 60,
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="newscast"
      component={Newscast}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      durationInFrames={FPS * 60}
      calculateMetadata={calculateMetadata}
      defaultProps={defaultProps}
    />
  );
};
