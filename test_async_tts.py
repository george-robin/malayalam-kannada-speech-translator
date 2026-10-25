import asyncio
import time
from pathlib import Path
from speech import synthesize_speech

text = "എന്റെ സ്കൂട്ടറിന്റെ ബ്രേക്ക് ശരിയായി പ്രവർത്തിക്കുന്നില്ല."
output_path = Path(__file__).with_name("tts_async_malayalam.wav")

start = time.perf_counter()

audio_bytes = asyncio.run(synthesize_speech(text))
output_path.write_bytes(audio_bytes)

print(f"Saved {len(audio_bytes)} bytes to {output_path.name}")
print(f"Time taken: {time.perf_counter() - start:.2f} seconds")