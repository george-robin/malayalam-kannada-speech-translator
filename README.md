# Malayalam–Kannada Speech Translator

A hackathon prototype for short service conversations where a speaker switches between Malayalam, Kannada, and English. A scooter owner, for example, might describe a problem in Malayalam but use English words for parts and repairs. The backend takes a phone recording and returns a transcript, an English rendering of the meaning, and a translation in the selected language. The client can then request spoken playback. The basic mobile frontend has not been pushed. You can try the backend on its own through FastAPI’s interactive docs.

## What failed in testing

We manually checked mixed Malayalam–English phone recordings against what the speaker meant. The clearest failure came from a repair instruction. The model returned readable text and the request completed normally, but someone following its translation would have taken the opposite action.

| Recording | What we observed | Why it mattered |
| --- | --- | --- |
| 24 · repair instruction | The speaker meant “do not replace it yet.” The English output said “replace it right away.” | The translation dropped the negation and changed the timing. A mechanic would hear permission to do work the customer had asked them to hold off on. |
| 24 · price | The transcript said “500 paisa” while the English rendering said “500 rupees.” | The number looked consistent even though the monetary unit changed. The two fields disagreed, so neither could independently confirm the price. |
| 23 · repeated input | One run described a problem with *my* scooter’s brakes. Another run on the same audio asked about *your* scooter’s brake. One output also used *break* for *brake*. | The wording changed who owned the scooter and whether the speaker was reporting a fault or asking a question. Checking spelling alone would miss both changes. |

These were failures found by listening and reading. The local [pipeline script](test_pipeline.py) prints the output, times translation and speech generation separately, and writes an English WAV file. It has no assertion for whether the translation preserves the speaker’s intent. One run completed in **4.11 seconds** from reading the recording to generating speech. That single timing tells us the pipeline worked on that input. It gives us neither an accuracy score nor a typical response time.

## What changed after the tests

The [translation prompt](translator.py) explicitly asks Gemini to preserve negations, currency units, speaker perspective, and questions, and to mark unclear speech as `[unclear]`. The API exposes the transcript and English meaning alongside the target text so a speaker can inspect how the recording was understood.

If the meaning is wrong, a client can submit the speaker’s corrected wording to `POST /translate/correction` without recording the sentence again. The backend translates the edited text and returns it alongside the new English meaning and target translation. Playback is a separate request, so the client can wait for review before speaking. This gives the speaker a way to intervene. We have not measured how often users catch these errors or how reliably retranslation resolves them.

## Run the backend

From the repository root, use Python 3.11 or newer and a Gemini API key with access to the models configured in [translator.py](translator.py) and [speech.py](speech.py). Audio and text are sent to Gemini for processing.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
export GEMINI_API_KEY='your-api-key'
python -m uvicorn app:app --reload
```

Open [the local API docs](http://127.0.0.1:8000/docs). Start with `POST /translate` and upload a short M4A or audio MP4 recording, up to 10 MiB. Choose Kannada (the default), Malayalam, or English.

| Endpoint | Input | Result |
| --- | --- | --- |
| `GET /health` | None | Confirms the API server is running. |
| `POST /translate` | Multipart fields `audio` and `target_language` | Returns `transcript`, `english_meaning`, and `translation`. |
| `POST /translate/correction` | JSON fields `corrected_text` and `target_language` | Translates the speaker’s edited wording. |
| `POST /speak` | JSON field `text` | Returns WAV audio for the supplied text. |

To repeat the local pipeline check with your own recording, place an M4A file named `New Recording 23.m4a` next to `test_pipeline.py`, or edit the filename in the script. Run `python test_pipeline.py`, inspect the printed transcript and translation against your recording, and listen to `pipeline_english.wav`.

## Evaluation still open

The manual tests exposed specific errors on a small set of recordings. Broader Kannada speaker review and a comparison across both translation directions are still open. We also screened 20 Malayalam IndicVoices records while exploring retrieval-augmented generation (RAG). That sample lacked the repair dialogue we needed, so it did not establish whether supplying examples would help.

A follow-up evaluation would use the same unseen recordings for Google Translate, the current Gemini pipeline, and a version supplied with repair-specific examples. Malayalam and Kannada speakers could score each output on the details that failed here: requested action, negation, amount and unit, speaker perspective, and question versus statement. Running each recording more than once would also reveal changes like the ones we saw on recording 23. We have no comparative results yet.
