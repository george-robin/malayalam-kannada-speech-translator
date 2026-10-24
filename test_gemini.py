import os
import time
from google import genai

start = time.perf_counter()
with genai.Client(api_key=os.environ["GEMINI_API_KEY"]) as client:
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="Reply with exactly: API connection successful."
    )

print(response.text)
print(f"Time taken: {time.perf_counter() - start:.2f} seconds")