import React from "react";
import { Audio, Series, useVideoConfig } from "remotion";
import { computeSceneDurationsInFrames } from "./scene-timing";
import { Intro } from "./scenes/Intro";
import { Headline } from "./scenes/Headline";
import { KeyDevelopments } from "./scenes/KeyDevelopments";
import { Timeline } from "./scenes/Timeline";
import { WhyItMatters } from "./scenes/WhyItMatters";
import { Sources } from "./scenes/Sources";
import { Outro } from "./scenes/Outro";
import type { NewscastVideoProps } from "./types";

/** Top-level composition: narration audio spanning the full video, plus the seven scenes in sequence. */
export const Newscast: React.FC<NewscastVideoProps> = (props) => {
  const { durationInFrames, fps } = useVideoConfig();
  const scenes = computeSceneDurationsInFrames(durationInFrames, fps);

  return (
    <>
      <Audio src={props.audioUrl} />
      <Series>
        <Series.Sequence durationInFrames={scenes.intro}>
          <Intro {...props} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={scenes.headline}>
          <Headline {...props} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={scenes.keyDevelopments}>
          <KeyDevelopments {...props} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={scenes.timeline}>
          <Timeline {...props} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={scenes.whyItMatters}>
          <WhyItMatters {...props} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={scenes.sources}>
          <Sources {...props} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={scenes.outro}>
          <Outro {...props} />
        </Series.Sequence>
      </Series>
    </>
  );
};
