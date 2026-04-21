import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

print("Fetching active GenAI models...\n")

# Just print the raw name of every single model available
for model in client.models.list():
    print(model.name)