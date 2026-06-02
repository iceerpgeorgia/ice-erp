"""Quick smoke test: verify Groq API key works with a simple address matching call."""
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(".env.local")
key = os.environ.get("GROQ_API_KEY", "")
if not key:
    print("GROQ_API_KEY not set")
    exit(1)

client = OpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")

resp = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": (
        'You are an address matching assistant.\n'
        'Reference: "ბათუმი, აბუსერიძის 22"\n'
        'Candidates:\n'
        '1. "ბათუმი, აბუსერიძე 22"\n'
        '2. "ქ.ბათუმი, აბუსერიძის ქ. 22"\n'
        '3. "თბილისი, ვაჟა-ფშაველა 14"\n'
        'Return JSON array with index, is_match, confidence, reason.'
    )}],
    response_format={"type": "json_object"},
    temperature=0,
    max_tokens=512,
)
print("Model response:")
print(resp.choices[0].message.content)
print(f"\nTokens used: {resp.usage.total_tokens}")
