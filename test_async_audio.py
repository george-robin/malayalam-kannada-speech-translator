import asyncio
import time
from pathlib import Path
from translator import translate_audio

audio_path = Path(__file__).with_name("New Recording 23.m4a")

start = time.perf_counter()

result = asyncio.run(
    translate_audio(
        audio_bytes=audio_path.read_bytes(),
        mime_type="audio/x-m4a",
        target_language="Kannada",
    )
)

print(result)
print(f"Time taken: {time.perf_counter() - start:.2f} seconds")