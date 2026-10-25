import base64
import os
import time
from pathlib import Path
from google import genai

text = "എന്റെ സ്കൂട്ടറിന്റെ ബ്രേക്ക് ശരിയായി പ്രവർത്തിക്കുന്നില്ല."
output_path = Path(__file__).with_name("tts_malayalam.wav")

start = time.perf_counter()

with genai.Client(api_key=os.environ["GEMINI_API_KEY"]) as client:
    response = client.interactions.create(
        model="gemini-3.8-flash-tts",
        input=[{
            "type": "user_input",
            "content": [{
                "type": "text",
                "text": text,
            }],
        }],
        response_format={"type": "audio"},
        generation_config={
            "speech_config": [{"voice": "Kore"}]
        },
    )

if not response.output_audio:
    raise RuntimeError("Gemini returned no audio.")

output_path.write_bytes(
    base64.b64decode(response.output_audio.data)
)

print(f"Saved: {output_path}")
print(f"Time taken: {time.perf_counter() - start:.2f} seconds")