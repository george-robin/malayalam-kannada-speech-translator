# Malayalam–Kannada Speech Translator

A speech translation prototype for short conversations that mix Malayalam, Kannada, and English. Built during a 24-hour hackathon, the project combines an Expo/React Native mobile app, a FastAPI backend, and Gemini for transcription, translation, and speech generation.

The most useful result came from testing recordings whose intended meaning was already known. A repair instruction meaning **“do not replace it yet”** came back as **“replace it right away.”** That failure shaped the speaker-review and correction workflow described below.

**Status:** The repository includes mobile recording, original-audio replay, translation results, and translated-speech playback. Text correction is implemented in the backend, while the “Wrong meaning” button still needs frontend integration. Evaluation is exploratory, with no accuracy benchmark or demonstrated improvement over another translator.

## Why this project

In a repair-shop conversation, a speaker may describe a scooter problem in Malayalam while using English words such as “brake.” A useful translation needs to preserve the action, the person speaking, the price, and whether the sentence is a question. A small change to any of those details can change what the listener does.

Gemini supplies the language and speech capabilities. The project work focuses on connecting those capabilities to a mobile workflow, inspecting errors in known recordings, exposing the model’s interpretation for review, and exploring whether relevant examples could help.

## Testing with known speech

During development on October 24–25, 2026, short phone recordings were used to compare the model’s output with the speaker’s intended words and meaning. The inputs included Malayalam mixed with English vocabulary about scooter repairs. Knowing what had been said gave the developer a reference for checking the transcript and English rendering.

These were informal developer checks. The available notes identify recordings 23 and 24, with repeated runs of recording 23. Those filenames are phone recording labels, not the size of a test dataset. A complete count of recordings, attempts, and failures was not retained, so the examples below cannot be used to calculate an error rate.

### Errors observed

| Input | Observed output | What the error changes |
| --- | --- | --- |
| Recording 24, repair instruction | “Do not replace it yet” was rendered as “replace it right away.” | Reverses the requested action and timing. |
| Recording 24, price | The transcript contained “500 paisa,” while the English rendering contained “500 rupees.” | The fields disagree about the unit. Since 100 paisa equals 1 rupee, these amounts are ₹5 and ₹500, a 100× difference. The disagreement alone does not establish which field matched the audio. |
| Recording 23, repeated runs | One result described a problem with “my scooter’s brakes.” Another asked about “your scooter’s brake.” | Changes the speaker’s perspective and turns a statement into a question. |
| Recording 23, terminology | One output used “break” in place of “brake.” | Loses the intended repair term. |

The documented meaning checks concern Malayalam–English mixed input and the resulting transcript or English interpretation. Kannada output was also requested, but a completed independent Kannada-speaker evaluation is still missing. The project name reflects the intended Malayalam–Kannada use case, while the available evidence covers a narrower set of checks.

The requests could complete and return readable text even when meaning was wrong. The test scripts print results for inspection and measure elapsed time. They do not automatically detect these semantic errors.

### Speech and timing checks

Speech generation was also tried separately with a fixed Malayalam sentence about a scooter brake, allowing the generated audio to be checked against known input text. The synchronous and asynchronous TTS scripts use the same sentence. The combined pipeline then passes the translation of a phone recording into speech generation.

One local pipeline run produced an English WAV file in **4.11 seconds**. This is a single measurement covering translation and speech generation. It does not establish average latency, mobile round-trip time, pronunciation accuracy, or translation quality.

### Response to the failures

The current prompt explicitly asks the model to preserve negation, currency units, technical terms, speaker perspective, and questions. It also asks for unclear speech to be marked as `[unclear]`.

The backend exposes a correction endpoint so the speaker can replace a mistaken interpretation with their intended wording. A controlled before/after evaluation of these changes has not been recorded. The README therefore makes no claim that the prompt or correction flow eliminated the observed errors.

## Reviewing meaning and requesting speech

### “Wrong meaning” workflow

The intended interaction is to inspect the transcript and English meaning, select **Wrong meaning**, edit the intended message, and request a new translation before playing it aloud.

The backend implements this through `POST /translate/correction`. It accepts `corrected_text` and `target_language`, translates the edited wording, and returns the corrected text, English meaning, and target translation. This lets the speaker correct the message without recording it again.

**Current frontend status:** The pushed Home screen displays the three result fields, but contains no correction editor or “Wrong meaning” button. The correction endpoint can currently be exercised through the API docs or a direct request. The English meaning is another model-generated field, so it can help a speaker spot a problem but cannot certify that the target-language text is correct.

### Speech button

The mobile app has a separate **Listen to translation** button. Translation does not automatically start speech playback, giving the user an opportunity to inspect the displayed result first.

Pressing the button sends the target translation to `POST /speak`, checks that the returned bytes have a WAV header, saves a temporary audio file, and plays it. The control displays preparation progress and supports **Pause speech** and **Replay translation**. Replay uses the cached file for that result. A changed translation remounts the control, and cleanup attempts to remove the previous temporary speech file.

Original recording replay is a separate control, so the user can listen to what they recorded before comparing it with the output.

## IndicVoices and the RAG investigation

After seeing meaning errors, the project explored retrieval-augmented generation (RAG): supplying relevant terminology or verified examples as context for translation.

The exploration included screening **20 Malayalam IndicVoices records** for useful material. The sample lacked the repair-specific dialogue needed for the scooter use case. It did not provide a suitable basis for the proposed repair-example collection.

That investigation exposed two requirements for useful retrieval data.

- Speech and transcripts need additional checking and translation to become verified Malayalam–Kannada examples.
- Examples need to match the conversational task. Malayalam text alone does not establish relevance to repairs, prices, or instructions.

Automatically generating translations of those records would still require human review before treating the translations as references. Additional recordings also do not update Gemini’s model weights through this application.

**RAG is not integrated into the current pipeline.** There is no retrieval index or measured RAG accuracy gain. The sample review informed the decision to seek more relevant, verified examples. It does not establish whether RAG would improve this task or whether the wider IndicVoices dataset would be suitable.

## How the application works

1. The mobile app requests microphone permission and records a short message.
2. The user can replay the recording and select Kannada, Malayalam, or English as the target language.
3. The app uploads the recording to FastAPI as multipart form data.
4. Gemini receives the audio and returns a transcript, English meaning, and target translation in one structured response.
5. The app displays the three fields. Speech generation happens only when requested.

The English meaning and target translation are produced together. The application does not implement a separate audio-to-English-to-Kannada translation chain.

| Component | Implementation |
| --- | --- |
| Mobile UI | React Native, TypeScript, Expo SDK 58, Expo Router |
| Recording and playback | `expo-audio` |
| Uploads and temporary speech files | `expo/fetch`, `expo-file-system` |
| Backend | Python, FastAPI, Pydantic |
| Translation and correction | `gemini-3.5-flash-lite`, as configured in `translator.py` |
| Speech generation | `gemini-3.8-flash-tts`, voice `Kore`, as configured in `speech.py` |

Temperature is not explicitly set in the translation code. The configured model names describe the repository implementation; access depends on the Gemini account and API. The current files do not constitute a complete record of the model configuration used for every historical run.

The backend limits recordings to 10 MiB and accepts M4A/audio MP4 uploads. Model requests have a 60-second timeout, and the frontend uses a 75-second request timeout. Empty input, invalid responses, and upstream failures produce errors for the user. Pydantic validates the response structure and nonempty fields, while meaning still requires review.

## Run locally

### Backend

Use Python 3.11 or newer because the backend uses `asyncio.timeout`. Install the pinned dependencies and set a Gemini API key in the server environment.

```bash
git clone https://github.com/george-robin/malayalam-kannada-speech-translator.git
cd malayalam-kannada-speech-translator
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
export GEMINI_API_KEY='your-api-key'
python -m uvicorn app:app --reload
```

Open the interactive API docs at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) after starting the server. This address is local to your computer.

### Mobile app

Install Node.js/npm compatible with the project's Expo version. From a second terminal, enter the repository’s `frontend` directory.

```bash
cd frontend
npm ci
```

Create `frontend/.env.local` with the backend address reachable from the phone.

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:8000
```

For a physical phone on the same trusted network, start the backend with `python -m uvicorn app:app --host 0.0.0.0 --port 8000`. Then run `npm start` in `frontend` and open the app with an Expo-compatible mobile client or development build.

The Gemini key belongs only in the backend environment. `EXPO_PUBLIC_API_URL` contains the server address and is visible to the client. The backend currently has no authentication and is intended for controlled local development. Browser recording compatibility has not been established. These setup steps reflect the code and have not been revalidated in a clean installation for this README.

## API

| Endpoint | Request | Response |
| --- | --- | --- |
| `GET /health` | None | Server status |
| `POST /translate` | Multipart `audio` and `target_language` | Transcript, English meaning, translation, target language, and formatted `text` |
| `POST /translate/correction` | JSON `corrected_text` and `target_language` | Corrected transcript, English meaning, translation, target language |
| `POST /speak` | JSON `text` | WAV audio |

The backend also provides `/test/audio` for upload inspection and `/test/translate` as an alias for `/translate`.

Example correction request, using English as the target to make the response readable without Kannada knowledge.

```bash
curl -X POST http://127.0.0.1:8000/translate/correction \
  -H 'Content-Type: application/json' \
  -d '{"corrected_text":"Do not replace the brake yet.","target_language":"English"}'
```

Illustrative response shape, not a saved test result.

```json
{
  "transcript": "Do not replace the brake yet.",
  "english_meaning": "Do not replace the brake yet.",
  "translation": "Do not replace the brake yet.",
  "target_language": "English"
}
```

## Source and manual test scripts

| File | Purpose |
| --- | --- |
| [app.py](app.py) | API routes, validation, upload limits, and error handling |
| [translator.py](translator.py) | Audio translation and corrected-text translation |
| [speech.py](speech.py) | Asynchronous speech generation |
| [frontend/src/app/index.tsx](frontend/src/app/index.tsx) | Recording, original playback, language selection, and result display |
| [frontend/src/lib/api.ts](frontend/src/lib/api.ts) | Recording upload and translation-response validation |
| [frontend/src/components/speech-controls.tsx](frontend/src/components/speech-controls.tsx) | Speech loading, playback, replay, and cleanup |
| [frontend/src/lib/speech.ts](frontend/src/lib/speech.ts) | Speech request and temporary WAV creation |
| [test_audio.py](test_audio.py), [test_async_audio.py](test_async_audio.py) | Manual recording-based translation checks |
| [test_tts.py](test_tts.py), [test_async_tts.py](test_async_tts.py) | Speech generation from a fixed Malayalam sentence |
| [test_pipeline.py](test_pipeline.py) | Recording-to-English-speech check with separate timings |
| [requirements.txt](requirements.txt), [requirements-ai.txt](requirements-ai.txt) | Pinned Python dependencies |

To run `python test_pipeline.py`, supply your own `New Recording 23.m4a` beside the script or update its recording path. The script writes `pipeline_english.wav`. These scripts make live API calls and require manual inspection of results. They contain no semantic pass/fail assertions.

## Limitations and next evaluation

- The available examples come from a small, informal set with no complete denominator or independently scored benchmark.
- Kannada accuracy, reverse-direction translation, dialect coverage, and pronunciation require further speaker evaluation.
- Repeated input produced different interpretations. No controlled before/after results establish that the current prompt resolved those failures.
- The correction UI remains unfinished, and the frontend still contains Expo starter content.
- No completed comparison with Google Translate or a retrieval-assisted version is available.

The next evaluation should retain each recording, its speaker-verified transcript and intended meaning, the model configuration, and repeated outputs. Reviewers can then score action, negation, price units, perspective, and question/statement preservation separately. Corrections should be retested on the original failure cases and on unseen recordings.

This prototype is intended for experimentation and supervised demonstrations. Translation should be reviewed by someone who understands the relevant languages before being acted on. It is unsuitable for medical, legal, safety-critical, or financial decisions.

## Data and privacy

Audio is sent from the phone to the backend and then to Gemini. Corrected text and text submitted for speech generation also go to Gemini.

The application code has no database or explicit persistent server-side recording store. Upload handling may use temporary storage through the web framework. The backend explicitly logs upstream HTTP error codes, and server operators can access their deployment logs. Provider handling and any additional hosting logs depend on the services and account configuration.

The mobile app keeps recordings locally for replay and caches generated speech temporarily. The manual Python scripts write WAV files locally. Original-recording deletion is not explicitly managed by the Home screen.

The reviewed `main` tree contains no test audio files. The root `.gitignore` excludes local environments, environment files, and common audio formats. This describes the current tree and ignore rules, rather than a completed audit of every historical commit.

## Credits and license

Built by a three-person hackathon team, with work divided across the mobile frontend, FastAPI backend, and Gemini integration and evaluation. The frontend builds on the Expo starter project and includes its MIT notice in [frontend/LICENSE](frontend/LICENSE). A repository-wide license has not been added.

The project uses Google's Gemini API and is independently developed, with no affiliation with or endorsement by Google. Project questions can be raised through [GitHub Issues](https://github.com/george-robin/malayalam-kannada-speech-translator/issues).

