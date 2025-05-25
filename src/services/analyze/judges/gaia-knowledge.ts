export const gaiaKnowledge = `
GaiaNet: Decentralized AI Agent Platform (Condensed for LLMs - with Code Samples)
Core Concept: GaiaNet is a decentralized computing infrastructure for creating, deploying, scaling, and monetizing AI agents. It emphasizes open-source LLMs, customization, data privacy, and user ownership.
Key Components (GaiaNet Node):
Runtime: Uses WasmEdge (Linux Foundation, CNCF project) - a lightweight, secure, high-performance, cross-platform runtime.
LLM Support: Supports most open-source LLMs (including multimodal). Uses GGUF format.
Knowledge Base:
Embedding Model: Embeds text (and other media) into vectors for semantic search.
Vector Database: Qdrant is the default, storing embeddings locally.
Custom Prompts: system_prompt (agent persona), rag_prompt (introduces retrieved knowledge).
Tool Use (Function Calling):
LLMs generate structured JSON output.
Tools are mapped to web service endpoints or local plugins (Rust SDK).
API Server: OpenAI-compatible API. Includes a web-based chatbot UI.
GaiaNet Network (Domains):
Domains: Collections of GaiaNet nodes under a single domain name.
Domain Operators: Manage nodes, pricing, load balancing, and payments.
Incentivization: Web3 technologies (ETH addresses, smart contracts, GaiaNet token).
Contributing to Documentation (GitHub):
Repository: https://github.com/GaiaNet-AI/docs
Process: Fork, clone, branch, modify, commit, push, pull request.
Local Development:
Bash
npm install  # Install dependencies
npm start    # Start development server (http://localhost:3000)


User Guide (End-users):
Accessing Nodes: Lists of public nodes/domains (see nodes.md).
Using Nodes: Replace OpenAI configuration with GaiaNet node details (see examples below).
Node Operator Guide:
Quick Start (Installation):
Bash
curl -sSfL 'https://github.com/GaiaNet-AI/gaianet-node/releases/latest/download/install.sh' | bash
source $HOME/.bashrc # Or equivalent to reload environment
gaianet init       # Initialize with default settings
gaianet start      # Start the node


Customization (config.json and gaianet config):
Bash
# Example: Change LLM, knowledge base, and system prompt
gaianet config \
  --chat-url https://huggingface.co/gaianet/Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct-Q5_K_M.gguf \
  --chat-ctx-size 4096 \
  --prompt-template llama-3-chat \
  --snapshot https://huggingface.co/datasets/gaianet/london/resolve/main/london_768_nomic-embed-text-v1.5-f16.snapshot.tar.gz \
  --embedding-url https://huggingface.co/gaianet/Nomic-embed-text-v1.5-Embedding-GGUF/resolve/main/nomic-embed-text-v1.5.f16.gguf \
  --embedding-ctx-size 8192 \
  --system-prompt "You are a tour guide in London, UK."

gaianet init   # Apply the changes
gaianet start  # Restart the node


--chat-url: URL or local path to the chat LLM GGUF file.
--prompt-template: Prompt template matching the LLM (e.g., llama-3-chat, gemma-chat).
--chat-ctx-size: Context size for the chat LLM.
--snapshot: URL or local path to the vector database snapshot.
--embedding-url: URL or local path to the embedding model GGUF file.
--embedding-ctx-size: Context size for the embedding model.
--system-prompt: Sets the overall agent behavior.
--rag-prompt: Introduces retrieved knowledge (context).
Best Practice: Always run gaianet init after modifying config.json or using gaianet config.
Joining the Protocol (GaiaNet Network):
Get Node ID and Device ID: gaianet info
Bind these IDs to a Metamask account via the Gaia web portal (https://www.gaianet.ai/).
Join a domain (may require approval).
Update node domain (if necessary):
Bash
gaianet stop
gaianet config --domain gaia.domains
gaianet init
gaianet start


System Requirements: macOS (Apple Silicon, 16GB+ RAM), Linux (NVIDIA CUDA 12, 8GB+ VRAM).
CLI Options: gaianet --help (lists all commands and options).
gaianet init --config <URL> Initialize with custom config. *gaianet start --local-only Run node only for local usage.
Troubleshooting: Common issues and solutions provided (CUDA library problems, port conflicts, etc.).
Advanced Tasks: Running nodes in Docker, on AWS, protect the server process.
Domain Operator Guide:
Quick Start: Domain owners launch domains via the Gaia web portal.
Creator Guide (Knowledge Bases):
Creating Knowledge Bases: Tools and scripts provided for creating vector snapshots from:
Plain Text: paragraph_embed.wasm (chunks by blank lines).
Bash
wasmedge --dir .:. --nn-preload embedding:GGML:AUTO:nomic-embed-text-v1.5.f16.gguf \
  paragraph_embed.wasm embedding default 768 input.txt -c 8192


Markdown: markdown_embed.wasm (chunks by headings).
Bash
wasmedge --dir .:. --nn-preload embedding:GGML:AUTO:nomic-embed-text-v1.5.f16.gguf \
 markdown_embed.wasm embedding default 768 input.md --heading_level 1 --ctx_size 8192


CSV (Source/Summary): csv_embed.wasm (embeddings from summary, retrieval of source).
Bash
wasmedge --dir .:. --nn-preload embedding:GGML:AUTO:nomic-embed-text-v1.5.f16.gguf \
  csv_embed.wasm embedding default 768 input.csv --ctx_size 8192


PDF and Web URL: Use external tools to convert into Markdown first and follow markdown steps.
Creating Snapshots (after populating Qdrant):
Bash
curl -X POST 'http://localhost:6333/collections/default/snapshots'  # Create snapshot
tar czvf my.snapshot.tar.gz my.snapshot                         # Compress (recommended)


LLM Finetuning: References llama.cpp for finetuning.
Using GaiaNet Nodes in Applications (OpenAI API Compatibility):
Python (OpenAI Library):
Python
import openai

client = openai.OpenAI(
    base_url="https://YOUR-NODE-ID.us.gaianet.network/v1",
    api_key="YOUR_API_KEY"  # Get API Key: https://www.gaianet.ai/
)

response = client.chat.completions.create(
    model="Meta-Llama-3-8B-Instruct-Q5_K_M",  # Replace with your node's model
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"}
    ],
    temperature=0.7,
    max_tokens=500
)
print(response.choices[0].message.content)



Node.js (OpenAI Library):
JavaScript
const OpenAI = require('openai');
const client = new OpenAI({
  baseURL: 'https://YOUR-NODE-ID.us.gaianet.network/v1',
  apiKey: 'YOUR_API_KEY' //Get API Key: https://www.gaianet.ai/
});
async function callOpenAI() {
    try {
      const response = await client.chat.completions.create({
        model: "Meta-Llama-3-8B-Instruct-Q5_K_M", //Replace with your node's model
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "What is the capital of France?" }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
      console.log(response.choices[0].message.content);
    } catch (error) {
      console.error('Error:', error);
    }
}
callOpenAI();


API Reference: Details on /v1/chat/completions, /v1/embeddings, /v1/retrieve, /v1/models, /v1/info endpoints. Includes request/response examples (non-streaming and streaming).
Key Takeaways and Best Practices (for LLMs):
GaiaNet = Decentralized OpenAI alternative; focus on open-source, customizability, privacy.
Node = AI agent server (LLM + knowledge + tools). Domain = multiple nodes.
Use gaianet config and config.json for node customization.
Always run gaianet init after config changes.
Use appropriate prompt templates for your chosen LLM.
For knowledge bases, choose embedding models and chunking strategies carefully.
Use the provided tools (paragraph_embed.wasm, etc.) for knowledge base creation.
Get your API Key from https://www.gaianet.ai/
Leverage OpenAI-compatible API for easy integration with existing apps.
Protect node server and restart if killed.


`;
