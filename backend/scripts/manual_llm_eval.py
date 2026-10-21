"""Manual evaluation script testing real LLM integration on French grammar practice sentences.

Run with:
  cd d:\Project3\backend
  .venv\Scripts\python.exe scripts/manual_llm_eval.py [--provider gemini|openai|ollama]
"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Ensure utf-8 stdout encoding on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

load_dotenv(backend_dir / ".env")

from app.core.config import get_settings
from app.services.llm.factory import get_llm_provider
from app.services.practice_rule_verifier import verify_sentence_by_rules

BENCHMARK_PROMPTS = [
    ("Je vais visiter mon ami ce soir.", True, "Valid standard sentence"),
    ("Tu va partir demain matin.", False, "Auxiliary mismatch: tu va instead of vas"),
    ("Je vais mange une pomme.", False, "Main verb not infinitive: mange instead of manger"),
    ("Je vais à Hanoi en train.", False, "Preposition phrase without action infinitive"),
]


async def run_manual_evaluation():
    settings = get_settings()
    provider_name = sys.argv[2] if len(sys.argv) > 2 else settings.llm_provider
    print("\n=======================================================")
    print(f" MANUAL EVALUATION OF LLM PIPELINE ({provider_name.upper()})")
    print("=======================================================")

    provider = get_llm_provider(settings)
    print(f"Active Provider: {provider.provider_name}")
    is_healthy = await provider.health_check()
    print(f"Provider Health Check: {'OK' if is_healthy else 'FAILED (Check credentials)'}")

    target_rule_id = "aller_infinitif"
    target_rule_name = "Futur proche (aller + infinitif)"

    for idx, (sent, expected_correct, desc) in enumerate(BENCHMARK_PROMPTS, 1):
        print(f"\n[{idx}] Test Sentence: « {sent} »")
        print(f"    Expected: {'CORRECT' if expected_correct else 'INCORRECT'} ({desc})")

        # 1. spaCy Rule Verification
        rule_res = verify_sentence_by_rules(sent, target_rule_id)
        print("    --> spaCy Rule Verification:")
        print(f"        Pattern: {rule_res.pattern_matched} | Aux correct: {rule_res.auxiliary_correct} (Sub: {rule_res.subject_token}) | Inf correct: {rule_res.main_verb_infinitive}")

        # 2. LLM Call
        try:
            llm_eval = await provider.evaluate_practice_submission(
                user_sentence=sent,
                target_rule_id=target_rule_id,
                target_rule_name=target_rule_name,
                rule_check=rule_res,
            )
            print("    --> LLM Response:")
            print(f"        is_correct: {llm_eval.is_correct} | uses_construct: {llm_eval.uses_target_construct}")
            print(f"        Comment: {llm_eval.short_comment}")
            if llm_eval.errors:
                for err in llm_eval.errors:
                    print(f"        Error [{err.type}]: '{err.span}' -> Suggestion: '{err.suggestion}' ({err.explanation_vi})")
            if llm_eval.corrected_sentence and not llm_eval.is_correct:
                print(f"        Corrected: « {llm_eval.corrected_sentence} »")
        except Exception as e:
            print(f"    --> LLM Error: {e}")

    print("\n=======================================================\n")


if __name__ == "__main__":
    asyncio.run(run_manual_evaluation())
