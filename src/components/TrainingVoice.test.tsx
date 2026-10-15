import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TrainingVoiceControl, type useTrainingVoice } from "./TrainingVoice";

const idle = {
  available: true,
  enabled: false,
  status: "off",
  error: null,
  levels: [0, 0.5, 1],
  stop: () => {},
  toggle: async () => {},
  retry: () => {},
  restoring: false,
} satisfies ReturnType<typeof useTrainingVoice>;

test("dictation offers Stop and an audio-responsive waveform while capturing", () => {
  const html = renderToStaticMarkup(
    <TrainingVoiceControl
      voice={{ ...idle, enabled: true, status: "listening" }}
      compact
      embedded
    />,
  );
  expect(html).toContain('aria-label="Stop dictation"');
  expect(html).toContain("height:12.5px");
  expect(html).toContain("height:22px");
  expect(html).not.toContain("is-processing");
});
test("stopped dictation keeps processing visible until transcription settles", () => {
  const html = renderToStaticMarkup(
    <TrainingVoiceControl
      voice={{ ...idle, status: "transcribing" }}
      compact
      embedded
    />,
  );
  expect(html).toContain("is-processing");
  expect(html).toContain("Transcribing…");
  expect(html).not.toContain("Stop dictation");
  const settled = renderToStaticMarkup(
    <TrainingVoiceControl voice={idle} compact embedded />,
  );
  expect(settled).toContain("Start dictation");
  expect(settled).not.toContain("voice-waveform");
});
