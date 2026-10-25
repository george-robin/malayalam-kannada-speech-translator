import base64
import os
from google import genai


async def synthesize_speech(text: str) -> bytes:
    if not text.strip():
        raise ValueError("Text cannot be empty.")

    async with genai.Client(
        api_key=os.environ["GEMINI_API_KEY"]
    ).aio as client:
        response = await client.interactions.create(
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

    if not response.output_audio or not response.output_audio.data:
        raise RuntimeError("Gemini returned no audio.")

    return base64.b64decode(response.output_audio.data)