import pytest
from app.core.config import Settings
from app.schemas.llm import GrammarEvaluationRequest, GrammarExplanationRequest
from app.services.llm.base import LLMProvider
from app.services.llm.mock_provider import MockLLMProvider
from app.services.llm.openai_provider import OpenAICompatibleProvider
from app.services.llm.gemini_provider import GeminiProvider
from app.services.llm.ollama_provider import OllamaProvider
from app.services.llm.factory import get_llm_provider


@pytest.mark.asyncio
async def test_mock_provider_futur_proche_correct():
    provider = MockLLMProvider()
    assert provider.provider_name == "mock"
    assert await provider.health_check() is True

    req = GrammarEvaluationRequest(
        user_sentence="Je vais visiter mon ami ce week-end.",
        target_rule_id="futur_proche",
        target_rule_name="Futur proche",
        target_rule_formula="aller + infinitif",
    )
    result = await provider.evaluate_sentence(req)
    assert result.is_correct is True
    assert result.target_pattern_matched is True
    assert result.score >= 90
    assert result.status == "correct"
    assert result.positive_feedback is not None


@pytest.mark.asyncio
async def test_mock_provider_futur_proche_missing_infinitive():
    provider = MockLLMProvider()
    req = GrammarEvaluationRequest(
        user_sentence="Je vais à la plage.",
        target_rule_id="futur_proche",
        target_rule_name="Futur proche",
    )
    result = await provider.evaluate_sentence(req)
    assert result.is_correct is False
    assert result.target_pattern_matched is False
    assert result.score <= 50
    assert result.status == "incorrect"
    assert "infinitif" in result.error_explanation.lower()


@pytest.mark.asyncio
async def test_mock_provider_futur_proche_missing_aller():
    provider = MockLLMProvider()
    req = GrammarEvaluationRequest(
        user_sentence="Je visite la ville de Paris.",
        target_rule_id="futur_proche",
        target_rule_name="Futur proche",
    )
    result = await provider.evaluate_sentence(req)
    assert result.is_correct is False
    assert result.target_pattern_matched is False
    assert "aller" in result.error_explanation.lower()


@pytest.mark.asyncio
async def test_mock_provider_passe_compose():
    provider = MockLLMProvider()
    req_good = GrammarEvaluationRequest(
        user_sentence="J'ai mangé une délicieuse pomme.",
        target_rule_id="passe_compose",
        target_rule_name="Passé composé",
    )
    result_good = await provider.evaluate_sentence(req_good)
    assert result_good.is_correct is True
    assert result_good.target_pattern_matched is True

    req_bad = GrammarEvaluationRequest(
        user_sentence="Je mange une pomme.",
        target_rule_id="passe_compose",
        target_rule_name="Passé composé",
    )
    result_bad = await provider.evaluate_sentence(req_bad)
    assert result_bad.is_correct is False


@pytest.mark.asyncio
async def test_mock_provider_negation():
    provider = MockLLMProvider()
    req = GrammarEvaluationRequest(
        user_sentence="Je ne parle pas espagnol.",
        target_rule_id="negation",
        target_rule_name="Négation simple",
    )
    result = await provider.evaluate_sentence(req)
    assert result.is_correct is True
    assert result.target_pattern_matched is True


@pytest.mark.asyncio
async def test_mock_provider_explanation():
    provider = MockLLMProvider()
    req = GrammarExplanationRequest(
        rule_id="futur_proche",
        rule_name="Futur proche",
    )
    explanation = await provider.explain_grammar_point(req)
    assert explanation.rule_id == "futur_proche"
    assert "aller" in explanation.formula.lower()
    assert len(explanation.key_rules) > 0
    assert "je" in explanation.conjugation_or_forms
    assert len(explanation.examples) > 0


def test_factory_creation():
    mock_settings = Settings(llm_provider="mock")
    provider = get_llm_provider(mock_settings)
    assert isinstance(provider, MockLLMProvider)

    openai_settings = Settings(llm_provider="openai", openai_api_key="test-key")
    provider = get_llm_provider(openai_settings)
    assert isinstance(provider, OpenAICompatibleProvider)
    assert provider.api_key == "test-key"

    gemini_settings = Settings(llm_provider="gemini", gemini_api_key="gemini-key")
    provider = get_llm_provider(gemini_settings)
    assert isinstance(provider, GeminiProvider)
    assert provider.api_key == "gemini-key"

    ollama_settings = Settings(llm_provider="ollama", ollama_base_url="http://localhost:11434")
    provider = get_llm_provider(ollama_settings)
    assert isinstance(provider, OllamaProvider)
    assert provider.base_url == "http://localhost:11434/v1"
