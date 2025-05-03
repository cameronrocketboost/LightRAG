# LightRAG Accuracy Improvement Tasks

## Problem Statement

LightRAG is exhibiting inaccurate information generation and hallucinations. Queries also seem to consistently retrieve the same small set of sources.

## Research Findings & Proposed Solutions

Based on research, the following potential improvements were identified:

1.  **Lightweight Entity Matching Before Generation:** Check if key query entities exist in retrieved context. If not, trigger a second retrieval targeting the missing entity. (Difficulty: Moderate)
2.  **Micro-Reranking of Retrieved Graphs:** Use a small cross-encoder model to rerank retrieved triples/chunks based on relevance to the query before generation. (Difficulty: Moderate-High)
3.  **Minimal Context Formatting:** Convert raw graph triples into readable sentences before passing them to the LLM. (Difficulty: Low)
4.  **Small Pre-Checks Before Final Generation:** Check if retrieved context is sufficient (e.g., not empty, minimum length) before calling the LLM. Prime the LLM prompt to strictly adhere to provided facts and allow answering "Insufficient information." (Difficulty: Low)
5.  **Minimal Multi-hop Retrieval:** Expand graph retrieval by one hop from initially retrieved nodes/edges to potentially capture more relevant context for multi-step reasoning. (Difficulty: Moderate)

## Source Repetition Hypothesis

The consistent use of the same sources likely stems from:
*   Vector database clustering effects.
*   Knowledge graph structure favoring certain nodes.
*   A fixed, potentially small `top_k` retrieval limit.
*   Potentially simplistic keyword extraction or query formulation for retrieval.

## Implementation Plan (Phased)

### Phase 1: Easy Wins (Completed)
*   [X] **Implement Pre-Checks & Prompt Priming (Fix 4):**
    *   [X] Add context validity checks (not empty, minimum length) before LLM call in `operate.py`.
        *   **Context:** Added logic in `mix_kg_vector_query` to check if both `formatted_kg_context` and `vector_context` are effectively empty (None, whitespace, or placeholder text). If so, it now returns "Insufficient information." directly.
        *   **Why:** Prevents the LLM from attempting generation with clearly inadequate context, reducing the chance of hallucination when no relevant data is found.
    *   [X] Modify system prompt (`prompt.py`) to enforce fact-based answers and allow "Insufficient information" response.
        *   **Context:** Updated `PROMPTS["mix_rag_response"]` in `lightrag/prompt.py` with stricter instructions based on research findings.
        *   **Why:** Explicitly instructs the LLM to base answers *only* on provided facts, forbids inference/assumption, and gives clear permission to state "Insufficient information.", directly tackling hallucination by constraining the LLM's behavior.
*   [X] **Implement Context Formatting (Fix 3):**
    *   [X] Define a function (`format_kg_context`) to format graph triples/data into sentences.
        *   **Context:** Added `format_kg_context` function in `lightrag/operate.py`.
        *   **Why:** To convert potentially raw graph data (assumed newline-separated subject-predicate-object strings) into a more natural language format that is easier for the LLM to understand.
    *   [X] Integrate formatting into `operate.py` before prompt construction.
        *   **Context:** Called `format_kg_context` on `kg_context` within `mix_kg_vector_query` before it's passed into the prompt.
        *   **Why:** Ensures the LLM receives the formatted, more readable graph context, reducing misinterpretations that can lead to hallucinations.

### Phase 2: Targeted Improvements
*   [ ] **Implement Entity Matching (Fix 1):**
    *   [ ] Add entity check logic post-retrieval in `operate.py`.
    *   [ ] Implement re-retrieval mechanism if entities are missing.
*   [ ] **(Optional) Implement Minimal Multi-hop (Fix 5):**
    *   [ ] Modify KG retrieval logic (`operate.py` or graph storage) for 1-hop expansion.

### Phase 3: Advanced Optimization
*   [ ] **Implement Micro-Reranking (Fix 2):**
    *   [ ] Integrate a cross-encoder model for reranking post-retrieval.

### Phase 4: Advanced Architecture / Retrieval
*   [ ] **Implement More Sophisticated Graph Traversal:**
    *   [ ] Go beyond simple multi-hop; implement intelligent graph pathfinding based on query semantics, relationship types, weights, or other properties.
*   [ ] **Implement Ensemble Retrieval:**
    *   [ ] Combine results from multiple retrieval methods (e.g., keyword search, vector search, graph traversal) and develop strategies for intelligently merging and ranking the combined results before generation.

### Investigation Tasks
*   [ ] Investigate `top_k` values used in VDB/KG retrieval calls (`operate.py`, configuration files?) to assess impact on source diversity. 