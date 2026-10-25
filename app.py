import binascii

from fastapi.responses import Response
from pydantic import BaseModel, StringConstraints, ValidationError

from speech import synthesize_speech
import asyncio
import os
from typing import Annotated, Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from google.genai import errors

from translator import translate_audio, translate_text

app = FastAPI(title="Translation Backend")

MAX_AUDIO_BYTES = 10 * 1024 * 1024


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/test/audio")
async def test_audio(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read(MAX_AUDIO_BYTES + 1)

        if not audio_bytes:
            raise HTTPException(400, "The uploaded file is empty.")

        if len(audio_bytes) > MAX_AUDIO_BYTES:
            raise HTTPException(413, "Audio must be 10 MiB or smaller.")

        return {
            "status": "received",
            "received_bytes": len(audio_bytes),
            "reported_mime_type": audio.content_type,
        }
    finally:
        await audio.close()


@app.post("/translate", response_model=dict[str, str])
@app.post("/test/translate", response_model=dict[str, str])
async def test_translate(
    audio: UploadFile = File(...),
    target_language: Literal[
        "Kannada", "Malayalam", "English"
    ] = Form("Kannada"),
):
    try:
        audio_bytes = await audio.read(MAX_AUDIO_BYTES + 1)
        mime_type = (
            (audio.content_type or "audio/m4a")
            .split(";")[0]
            .strip()
            .lower()
        )
    finally:
        await audio.close()

    if not audio_bytes:
        raise HTTPException(400, "The recording is empty.")

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Audio must be 10 MiB or smaller.")

    if mime_type == "audio/x-m4a":
        mime_type = "audio/m4a"

    if mime_type not in {"audio/m4a", "audio/mp4"}:
        raise HTTPException(
            415, "Use an M4A/MP4 recording for this test."
        )

    if not os.environ.get("GEMINI_API_KEY"):
        raise HTTPException(
            503, "The server's Gemini API key is not configured."
        )

    try:
        async with asyncio.timeout(60):
            return await translate_audio(
                audio_bytes=audio_bytes,
                mime_type=mime_type,
                target_language=target_language,
            )
    except TimeoutError:
        raise HTTPException(504, "Translation timed out.") from None
    except errors.APIError as exc:
        print(f"Gemini upstream error: HTTP {exc.code}", flush=True)

        if exc.code == 429:
            raise HTTPException(
                429, "Gemini rate limit reached. Try again later."
            ) from None

        raise HTTPException(
            502, "Gemini could not process the recording."
        ) from None
    except (RuntimeError, ValidationError):
        raise HTTPException(
            502, "Gemini returned an empty or invalid translation."
        ) from None

class CorrectionRequest(BaseModel):
    corrected_text: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            min_length=1,
            max_length=5000,
        ),
    ]
    target_language: Literal["Kannada", "Malayalam", "English"]


@app.post("/translate/correction", response_model=dict[str, str])
async def translate_correction(request: CorrectionRequest):
    if not os.environ.get("GEMINI_API_KEY"):
        raise HTTPException(
            503, "The server's Gemini API key is not configured."
        )

    try:
        async with asyncio.timeout(60):
            return await translate_text(
                corrected_text=request.corrected_text,
                target_language=request.target_language,
            )
    except TimeoutError:
        raise HTTPException(504, "Translation timed out.") from None
    except errors.APIError as exc:
        print(f"Gemini upstream error: HTTP {exc.code}", flush=True)
        if exc.code == 429:
            raise HTTPException(
                429, "Gemini rate limit reached. Try again later."
            ) from None
        raise HTTPException(
            502, "Gemini could not translate the correction."
        ) from None
    except (RuntimeError, ValidationError):
        raise HTTPException(
            502, "Gemini returned an empty or invalid translation."
        ) from None

class SpeakRequest(BaseModel):
    text: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            min_length=1,
            max_length=5000,
        ),
    ]


@app.post(
    "/speak",
    response_class=Response,
    responses={200: {"content": {"audio/wav": {}}}},
)
async def speak(request: SpeakRequest):
    if not os.environ.get("GEMINI_API_KEY"):
        raise HTTPException(
            503, "The server's Gemini API key is not configured."
        )

    try:
        async with asyncio.timeout(60):
            audio_bytes = await synthesize_speech(request.text)

        if (
            len(audio_bytes) < 12
            or audio_bytes[:4] != b"RIFF"
            or audio_bytes[8:12] != b"WAVE"
        ):
            raise RuntimeError("Invalid WAV response.")

    except TimeoutError:
        raise HTTPException(
            504, "Speech generation timed out."
        ) from None

    except errors.APIError as exc:
        print(
            f"Gemini speech upstream error: HTTP {exc.code}",
            flush=True,
        )

        if exc.code == 429:
            raise HTTPException(
                429, "Gemini rate limit reached. Try again later."
            ) from None

        raise HTTPException(
            502, "Gemini could not generate speech."
        ) from None

    except (RuntimeError, ValidationError, binascii.Error):
        raise HTTPException(
            502, "Gemini returned empty or invalid speech audio."
        ) from None

    return Response(
        content=audio_bytes,
        media_type="audio/wav",
        headers={"Cache-Control": "no-store"},
    )