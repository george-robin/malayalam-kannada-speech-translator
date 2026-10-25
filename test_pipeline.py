import asyncio
import time
from pathlib import Path

from translator import translate_audio
from speech import synthesize_speech


async def main():
    folder = Path(__file__).parent
    recording = folder / "New Recording 23.m4a"

    start = time.perf_counter()

    result = await translate_audio(
        audio_bytes=recording.read_bytes(),
        mime_type="audio/m4a",
        target_language="English",
    )

    translation_finished = time.perf_counter()

    print("Transcript:", result["transcript"])
    print("Translation:", result["translation"])

    audio_bytes = await synthesize_speech(result["translation"])

    output = folder / "pipeline_english.wav"
    output.write_bytes(audio_bytes)

    finished = time.perf_counter()

    print(f"Translation: {translation_finished - start:.2f} seconds")
    print(f"Speech: {finished - translation_finished:.2f} seconds")
    print(f"Total: {finished - start:.2f} seconds")
    print(f"Saved: {output}")


if __name__ == "__main__":
    asyncio.run(main())